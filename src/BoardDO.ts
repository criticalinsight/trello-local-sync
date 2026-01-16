import { DurableObject } from 'cloudflare:workers';
import { sendNotification } from './telegramBot';
import { Env } from './types';
import { LeakyBucket } from './utils/rateLimiter';

// Batch threshold - writes are batched if >50 requests/sec
const BATCH_THRESHOLD = 50;
const BATCH_WINDOW_MS = 1000;

export class BoardDO extends DurableObject<Env> {
    private sessions: Map<WebSocket, { id: string }> = new Map();
    private writeQueue: Array<{ sql: string; params: unknown[]; clientId: string }> = [];
    private lastFlush: number = Date.now();
    private requestCount: number = 0;
    private batchTimeout: ReturnType<typeof setTimeout> | null = null;
    private rateLimiter: LeakyBucket;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.rateLimiter = new LeakyBucket(20, 1); // 20 burst, 1/sec
        this.initDatabase();
        this.initScheduler();
        this.scheduleDailyBriefing();
    }

    private initDatabase() {
        // Create tables using native SQLite
        this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS lists (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        pos REAL NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        list_id TEXT NOT NULL,
        pos REAL NOT NULL,
        created_at INTEGER NOT NULL,
        description TEXT,
        tags JSON,
        checklist JSON,
        due_date INTEGER,
        FOREIGN KEY (list_id) REFERENCES lists(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_cards_list ON cards(list_id);
      CREATE INDEX IF NOT EXISTS idx_cards_pos ON cards(pos);
      
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        event TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        board_id TEXT NOT NULL,
        status TEXT NOT NULL,
        pos REAL NOT NULL,
        created_at INTEGER NOT NULL,
        tags TEXT,
        current_version_id TEXT,
        deployed_at INTEGER,
        workflow JSON,
        schedule JSON
      );

      CREATE TABLE IF NOT EXISTS prompt_versions (
        id TEXT PRIMARY KEY,
        prompt_id TEXT NOT NULL,
        content TEXT NOT NULL,
        system_instructions TEXT,
        temperature REAL,
        top_p REAL,
        max_tokens INTEGER,
        model TEXT,
        execution_time INTEGER,
        output TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (prompt_id) REFERENCES prompts(id)
        CREATE TABLE IF NOT EXISTS prompt_versions (
        id TEXT PRIMARY KEY,
        prompt_id TEXT NOT NULL,
        content TEXT NOT NULL,
        system_instructions TEXT,
        temperature REAL,
        top_p REAL,
        max_tokens INTEGER,
        model TEXT,
        execution_time INTEGER,
        output TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (prompt_id) REFERENCES prompts(id)
      );

      CREATE TABLE IF NOT EXISTS users (
        chat_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        role TEXT DEFAULT 'user', -- 'admin' or 'user'
        joined_at INTEGER
      );

        // Migration for existing databases
        try {
            // SQLite doesn't support IF NOT EXISTS in ALTER COLUMN, so we catch errors
            // or checking pragma table_info would be cleaner but verbose.
            // Quick & dirty for this implementation: separate try/catches
            try {
                this.ctx.storage.sql.exec('ALTER TABLE cards ADD COLUMN description TEXT');
            } catch { }
            try {
                this.ctx.storage.sql.exec('ALTER TABLE cards ADD COLUMN tags JSON');
            } catch { }
            try {
                this.ctx.storage.sql.exec('ALTER TABLE cards ADD COLUMN checklist JSON');
            } catch { }
            try {
                this.ctx.storage.sql.exec('ALTER TABLE cards ADD COLUMN due_date INTEGER');
            } catch { }
            try {
                this.ctx.storage.sql.exec('ALTER TABLE prompts ADD COLUMN workflow JSON');
            } catch { }
            try {
                this.ctx.storage.sql.exec('ALTER TABLE prompts ADD COLUMN schedule JSON');
            } catch { }
        } catch (e) {
            console.warn('Migration warning:', e);
        }

        // Insert default lists if empty
        const listCount = this.ctx.storage.sql.exec('SELECT COUNT(*) as count FROM lists').one();
        if (listCount && (listCount.count as number) === 0) {
            this.ctx.storage.sql.exec(`
        INSERT INTO lists(id, title, pos) VALUES
            ('list-1', 'To Do', 0),
            ('list-2', 'In Progress', 1),
            ('list-3', 'Done', 2);
        `);
        }
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // WebSocket upgrade
        if (request.headers.get('Upgrade') === 'websocket') {
            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);

            const clientId = crypto.randomUUID();
            this.sessions.set(server, { id: clientId });

            server.accept();

            // Send client ID
            server.send(JSON.stringify({ type: 'CLIENT_ID', id: clientId }));

            // Send initial state
            this.sendFullState(server);

            server.addEventListener('message', (event) => {
                this.handleMessage(server, event.data as string);
            });

            server.addEventListener('close', () => {
                this.sessions.delete(server);
            });

            return new Response(null, { status: 101, webSocket: client });
        }

        // REST API fallback
        if (url.pathname === '/api/state') {
            const lists = [
                ...this.ctx.storage.sql.exec('SELECT * FROM lists ORDER BY pos').toArray(),
            ];
            const cards = [
                ...this.ctx.storage.sql.exec('SELECT * FROM cards ORDER BY pos').toArray(),
            ];
            return Response.json({ lists, cards });
        }

        // Phase 22B: Health Summary Endpoint
        if (url.pathname === '/api/health') {
            const statusCounts = [
                ...this.ctx.storage.sql.exec('SELECT status, COUNT(*) as count FROM prompts GROUP BY status').toArray(),
            ];
            const totalPrompts = statusCounts.reduce((sum, row: any) => sum + row.count, 0);
            const errorCount = statusCounts.find((r: any) => r.status === 'error')?.count || 0;
            const deployedCount = statusCounts.find((r: any) => r.status === 'deployed')?.count || 0;

            const lastDeployed = this.ctx.storage.sql.exec(
                'SELECT title, deployed_at FROM prompts WHERE deployed_at IS NOT NULL ORDER BY deployed_at DESC LIMIT 1'
            ).one() as any;

            const recentErrors = [
                ...this.ctx.storage.sql.exec(
                    "SELECT details, created_at FROM activity_log WHERE event LIKE '%error%' ORDER BY created_at DESC LIMIT 3"
                ).toArray(),
            ];

            return Response.json({
                status: Number(errorCount) > 0 ? 'DEGRADED' : 'HEALTHY',
                timestamp: new Date().toISOString(),
                summary: {
                    totalPrompts,
                    deployed: deployedCount,
                    errors: errorCount,
                    statusBreakdown: statusCounts,
                },
                lastDeployed: lastDeployed ? {
                    title: lastDeployed.title,
                    at: new Date(lastDeployed.deployed_at).toISOString(),
                } : null,
                recentErrors,
            });
        }

        if (url.pathname === '/api/sql') {
            const body = (await request.json()) as { sql: string; params?: unknown[] };
            const result = this.ctx.storage.sql.exec(body.sql, ...(body.params || []));
            return Response.json({
                success: true,
                result: [...result.toArray()],
            });
        }

        if (url.pathname === '/api/run') {
            const body = (await request.json()) as { promptId: string };
            // Trigger run asynchronously to avoid timing out the request
            // We'll return a 202 Accepted
            this.ctx.blockConcurrencyWhile(async () => {
                const prompt = this.ctx.storage.sql
                    .exec('SELECT * FROM prompts WHERE id = $1', body.promptId)
                    .one() as any;
                if (!prompt) return;

                const version = this.ctx.storage.sql
                    .exec('SELECT * FROM prompt_versions WHERE id = $1', prompt.current_version_id)
                    .one() as any;
                if (!version) return;

                // Update status to generating
                this.ctx.storage.sql.exec(
                    'UPDATE prompts SET status = "generating" WHERE id = $1',
                    body.promptId,
                );

                // Phase 22C: Lifecycle Notification - Run Started
                if (this.env.TELEGRAM_BOT_TOKEN) {
                    await this.rateLimiter.throttle(); // Rate Limit
                    await sendNotification(
                        this.env.TELEGRAM_BOT_TOKEN,
                        this.env as any,
                        `🚀 ** Run Started **\n\nPrompt: ${ prompt.title || body.promptId } \nModel: ${ version.model || 'default' } \nStatus: ⏳ Generating...`,
                    );
                }

                // Construct task object for internal processTask method (to be added/refactored)
                const task = {
                    id: body.promptId,
                    prompt_content: version.content,
                    parameters: JSON.stringify({
                        temperature: version.temperature,
                        topP: version.top_p,
                        maxTokens: version.max_tokens,
                        model: version.model,
                    }),
                    current_version_id: prompt.current_version_id,
                };

                // Use the same logic as processScheduledTasks but refactored
                await this.executeTask(task);
            });
            return Response.json({ success: true, message: 'Execution started' }, { status: 202 });
        }

        if (url.pathname === '/api/latest') {
            const result = this.ctx.storage.sql
                .exec(
                    `
                SELECT p.title, v.output, v.created_at, p.id 
                FROM prompts p 
                JOIN prompt_versions v ON p.current_version_id = v.id 
                WHERE v.output IS NOT NULL 
                ORDER BY v.created_at DESC LIMIT 1
            `,
                )
                .one() as any;
            return Response.json({ success: true, result });
        }

        if (url.pathname === '/api/refine') {
            const body = (await request.json()) as { promptId: string };
            const prompt = this.ctx.storage.sql
                .exec('SELECT * FROM prompts WHERE id = $1', body.promptId)
                .one() as any;
            if (!prompt) return new Response('Prompt not found', { status: 404 });

            const version = this.ctx.storage.sql
                .exec('SELECT * FROM prompt_versions WHERE id = $1', prompt.current_version_id)
                .one() as any;
            if (!version) return new Response('Version not found', { status: 404 });

            // Call AI to refine
            const refinementPrompt = `
                I have a prompt that needs improvement.
            TITLE: ${ prompt.title }
                CURRENT CONTENT: "${version.content}"

        Please:
        1. Critique the current prompt(strengths / weaknesses).
                2. Provide an improved version of the prompt content.

        Respond in JSON format:
        {
            "critique": "...",
                "improvedContent": "..."
        }
        `;

            const aiResponse = await fetch('http://127.0.0.1/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: refinementPrompt }),
            });

            const aiData = (await aiResponse.json()) as any;
            const aiText = aiData.text || aiData.content || '';

            try {
                // Extract JSON from AI text (standardizing)
                const jsonMatch = aiText.match(/\{[\s\S]*\}/);
                const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiText);

                const newVersionId = crypto.randomUUID();
                const now = Date.now();

                // Create new version
                this.ctx.storage.sql.exec(
                    `
                    INSERT INTO prompt_versions(id, prompt_id, content, system_instructions, temperature, top_p, max_tokens, model, created_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                    newVersionId,
                    prompt.id,
                    parsed.improvedContent,
                    version.system_instructions,
                    version.temperature,
                    version.top_p,
                    version.max_tokens,
                    version.model,
                    now,
                );

                // Update prompt
                this.ctx.storage.sql.exec(
                    'UPDATE prompts SET current_version_id = ? WHERE id = ?',
                    newVersionId,
                    prompt.id,
                );

                return Response.json({
                    success: true,
                    critique: parsed.critique,
                    newContent: parsed.improvedContent,
                });
            } catch (e) {
                return Response.json(
                    { success: false, error: 'Failed to parse AI refinement', raw: aiText },
                    { status: 500 },
                );
            }
        }

        if (url.pathname === '/api/log') {
            const body = (await request.json()) as {
                event: string;
                entityId?: string;
                details?: string;
            };
            this.ctx.storage.sql.exec(
                `
                INSERT INTO activity_log(id, event, entity_id, details, created_at)
        VALUES(?, ?, ?, ?, ?)
            `,
                crypto.randomUUID(),
                body.event,
                body.entityId,
                body.details,
                Date.now(),
            );
            return Response.json({ success: true });
        }

        if (url.pathname === '/api/logs') {
            const result = this.ctx.storage.sql
                .exec('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20')
                .toArray();
            return Response.json({ success: true, result });
        }

        if (url.pathname === '/api/search') {
            const body = (await request.json()) as { query: string };
            const q = `% ${ body.query }% `;
            const result = this.ctx.storage.sql
                .exec(
                    `
                SELECT p.id, p.title, v.content 
                FROM prompts p 
                LEFT JOIN prompt_versions v ON p.current_version_id = v.id 
                WHERE p.title LIKE $1 OR v.content LIKE $1
                LIMIT 10
            `,
                    q,
                )
                .toArray();
            return Response.json({ success: true, result });
        }

        if (url.pathname === '/api/tags') {
            const result = this.ctx.storage.sql.exec('SELECT tags FROM prompts').toArray();
            const allTags = new Set<string>();
            result.forEach((row: any) => {
                try {
                    const tags = JSON.parse(row.tags || '[]');
                    tags.forEach((t: string) => allTags.add(t));
                } catch (e) { }
            });
            return Response.json({ success: true, tags: Array.from(allTags) });
        }

        if (url.pathname === '/api/analytics') {
            const counts = this.ctx.storage.sql
                .exec('SELECT status, COUNT(*) as count FROM prompts GROUP BY status')
                .toArray();
            const avgTime = this.ctx.storage.sql
                .exec(
                    'SELECT AVG(execution_time) as avg FROM prompt_versions WHERE execution_time > 0',
                )
                .one() as any;
            const modelDist = this.ctx.storage.sql
                .exec('SELECT model, COUNT(*) as count FROM prompt_versions GROUP BY model')
                .toArray();

            return Response.json({
                success: true,
                stats: {
                    distribution: counts,
                    averageExecutionTime: avgTime?.avg || 0,
                    models: modelDist,
                },
            });
        }

        if (url.pathname === '/api/assign') {
            const body = (await request.json()) as { promptId: string; model: string };
            const prompt = this.ctx.storage.sql
                .exec('SELECT current_version_id FROM prompts WHERE id = ?', body.promptId)
                .one() as any;
            if (!prompt) return new Response('Prompt not found', { status: 404 });

            this.ctx.storage.sql.exec(
                'UPDATE prompt_versions SET model = ? WHERE id = ?',
                body.model,
                prompt.current_version_id,
            );
            return Response.json({ success: true });
        }

        // Scheduler API routing
        if (url.pathname.startsWith('/api/scheduler/')) {
            return this.handleSchedulerRequest(url, request);
        }

        // Admin API routing
        if (url.pathname.startsWith('/api/admin/')) {
            return this.handleAdminRequest(url, request);
        }

        return new Response('Not found', { status: 404 });
        return new Response('Not found', { status: 404 });
    }

    async alarm(): Promise<void> {
        // Daily Briefing Alarm
        const now = Date.now();
        const storedNext = await this.ctx.storage.get<number>('next_briefing_time');

        if (storedNext && now >= storedNext) {
            await this.sendDailyBriefing();
            await this.scheduleDailyBriefing();
        }
    }

    private async scheduleDailyBriefing() {
        // Schedule for 9:00 AM UTC tomorrow (or today if not passed)
        const now = new Date();
        const next = new Date(now);
        next.setUTCHours(9, 0, 0, 0);

        if (next.getTime() <= now.getTime()) {
            next.setDate(next.getDate() + 1);
        }

        await this.ctx.storage.put('next_briefing_time', next.getTime());
        await this.ctx.storage.setAlarm(next.getTime());
        console.log(`[BoardDO] Daily Briefing scheduled for ${ next.toISOString() }`);
    }

    private async sendDailyBriefing() {
        if (!this.env.TELEGRAM_BOT_TOKEN) return;

        // Gather stats
        const draftCount = this.ctx.storage.sql.exec("SELECT COUNT(*) as count FROM prompts WHERE status = 'draft'").one() as any;
        const errorCount = this.ctx.storage.sql.exec("SELECT COUNT(*) as count FROM prompts WHERE status = 'error'").one() as any;

        const msg = `📅 ** Daily Briefing **\n\n` +
            `📝 ** Drafts:** ${ draftCount?.count || 0 } \n` +
            `❌ ** Errors:** ${ errorCount?.count || 0 } \n\n` +
            `System is running smoothly.Use \`/stats\` for more info.`;

        await this.rateLimiter.throttle();
        await sendNotification(this.env.TELEGRAM_BOT_TOKEN, this.env as any, msg);
    }

    private sendFullState(ws: WebSocket) {
        const lists = [...this.ctx.storage.sql.exec('SELECT * FROM lists ORDER BY pos').toArray()];
        const cards = [...this.ctx.storage.sql.exec('SELECT * FROM cards ORDER BY pos').toArray()];
        ws.send(JSON.stringify({ type: 'SYNC_STATE', lists, cards }));
    }

    private handleMessage(sender: WebSocket, data: string) {
        try {
            const msg = JSON.parse(data);

            if (msg.type === 'EXECUTE_SQL') {
                this.requestCount++;
                const now = Date.now();

                // Check if we should batch
                if (this.requestCount > BATCH_THRESHOLD && now - this.lastFlush < BATCH_WINDOW_MS) {
                    // Add to batch queue
                    this.writeQueue.push({
                        sql: msg.sql,
                        params: msg.params,
                        clientId: msg.clientId,
                    });

                    // Set flush timeout if not already set
                    if (!this.batchTimeout) {
                        this.batchTimeout = setTimeout(() => this.flushBatch(), 50);
                    }
                } else {
                    // Execute immediately
                    this.executeAndBroadcast(msg.sql, msg.params, msg.clientId, sender);

                    // Reset counter periodically
                    if (now - this.lastFlush > BATCH_WINDOW_MS) {
                        this.requestCount = 0;
                        this.lastFlush = now;
                    }
                }
            }
        } catch (e) {
            console.error('Error handling message:', e);
        }
    }

    private flushBatch() {
        if (this.writeQueue.length === 0) return;

        // Execute all queued writes in a transaction
        this.ctx.storage.sql.exec('BEGIN TRANSACTION');
        try {
            for (const { sql, params } of this.writeQueue) {
                this.ctx.storage.sql.exec(sql, ...params);
            }
            this.ctx.storage.sql.exec('COMMIT');

            // Broadcast batch result to all clients
            const lastWrite = this.writeQueue[this.writeQueue.length - 1];
            this.broadcast(
                JSON.stringify({
                    type: 'SQL_RESULT',
                    sql: 'BATCH',
                    params: [],
                    result: { affected: this.writeQueue.length },
                }),
                lastWrite.clientId,
            );
        } catch (e) {
            this.ctx.storage.sql.exec('ROLLBACK');
            console.error('Batch write failed:', e);
        }

        this.writeQueue = [];
        this.batchTimeout = null;
        this.lastFlush = Date.now();
    }

    private async executeAndBroadcast(
        sql: string,
        params: unknown[],
        clientId: string,
        sender: WebSocket,
    ) {
        try {
            const result = await this.sql(sql, ...params);
            const rows = [...result.toArray()];

            // Broadcast to all OTHER clients (not the sender)
            this.broadcast(
                JSON.stringify({
                    type: 'SQL_RESULT',
                    sql,
                    params,
                    result: rows,
                }),
                clientId,
            );

            // Phase 11: Check for workflows if this was a card update
            this.processWorkflowTriggers(sql, params);

        } catch (e) {
            console.error('SQL execution error:', e);
            sender.send(JSON.stringify({ type: 'ERROR', message: String(e) }));
        }
    }

    private async processWorkflowTriggers(sql: string, params: unknown[]) {
        const sqlUpper = sql.toUpperCase();
        let triggerType: string | null = null;
        let cardId: string | null = null;

        if (sqlUpper.includes('INSERT INTO CARDS')) {
            triggerType = 'card_added';
            // Extract card ID from params if available, otherwise we'll have to skip or use a different approach
            // Typical INSERT: INSERT INTO cards (id, ...) VALUES (?, ...)
            cardId = params[0] as string;
        } else if (sqlUpper.includes('UPDATE CARDS SET LIST_ID')) {
            triggerType = 'card_moved';
            // Typical UPDATE: UPDATE cards SET list_id = ?, pos = ? WHERE id = ?
            // list_id is params[0], id is usually last or second to last
            cardId = params[params.length - 1] as string;
        } else if (sqlUpper.includes('UPDATE CARDS SET TAGS')) {
            triggerType = 'card_tagged';
            cardId = params[params.length - 1] as string;
        }

        if (!triggerType || !cardId) return;

        // Fetch card details for filtering
        const card = this.ctx.storage.sql.exec('SELECT * FROM cards WHERE id = ?', cardId).one() as any;
        if (!card) return;

        const cardTags = JSON.parse(card.tags || '[]');

        // Fetch all active workflows
        const workflows = [...this.ctx.storage.sql.exec('SELECT id, workflow FROM prompts WHERE workflow IS NOT NULL').toArray()];

        for (const row of workflows) {
            try {
                const config = JSON.parse(row.workflow as string);
                if (!config.enabled || !config.triggers) continue;

                for (const trigger of config.triggers) {
                    if (trigger.type === triggerType) {
                        // Check filter conditions
                        let matches = true;

                        if (trigger.config?.listId && trigger.config.listId !== card.list_id) {
                            matches = false;
                        }

                        if (trigger.config?.tag && !cardTags.includes(trigger.config.tag)) {
                            matches = false;
                        }

                        if (matches) {
                            console.log(`[Workflow] Triggering prompt ${row.id} for event ${triggerType} on card ${cardId}`);
                            this.executePromptById(row.id as string);
                        }
                    }
                }
            } catch (e) {
                console.error('Workflow parsing failed:', e);
            }
        }
    }

    private async executePromptById(promptId: string) {
        // Find current version
        const prompt = this.ctx.storage.sql.exec('SELECT * FROM prompts WHERE id = ?', promptId).one() as any;
        if (!prompt || !prompt.current_version_id) return;

        const version = this.ctx.storage.sql.exec('SELECT * FROM prompt_versions WHERE id = ?', prompt.current_version_id).one() as any;
        if (!version) return;

        // Construct task
        const task = {
            id: promptId,
            prompt_content: version.content,
            system_instructions: version.system_instructions,
            parameters: JSON.stringify({
                temperature: version.temperature,
                topP: version.top_p,
                maxTokens: version.max_tokens,
                model: version.model,
            }),
            current_version_id: prompt.current_version_id,
            title: prompt.title
        };

        await this.executeTask(task);
    }

    // Helper to execute SQL and ensure it's awaited
    private async sql(sql: string, ...params: unknown[]) {
        return await this.ctx.storage.sql.exec(sql, ...params);
    }

    private broadcast(message: string | object, excludeClientId?: string) {
        const messageString = typeof message === 'string' ? message : JSON.stringify(message);
        for (const [ws, session] of this.sessions) {
            if (session.id !== excludeClientId) {
                try {
                    ws.send(messageString);
                } catch {
                    this.sessions.delete(ws);
                }
            }
        }
    }

    // ================= SCHEDULER LOGIC =================

    private async initScheduler() {
        this.ctx.storage.sql.exec(`
            CREATE TABLE IF NOT EXISTS scheduled_tasks (
                id TEXT PRIMARY KEY,
                prompt_id TEXT NOT NULL,
                prompt_content TEXT NOT NULL,
                system_instructions TEXT,
                parameters JSON,
                cron TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                last_run INTEGER,
                next_run INTEGER,
                created_at INTEGER
            );
            
            CREATE TABLE IF NOT EXISTS task_log (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                output TEXT,
                executed_at INTEGER,
                duration INTEGER,
                status TEXT, -- 'success', 'failed'
                FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id)
            );
        `);
    }

    async handleSchedulerRequest(url: URL, request: Request): Promise<Response> {
        // Scheduler API: /api/scheduler/*

        if (request.method === 'POST' && url.pathname.endsWith('/tick')) {
            await this.processScheduledTasks();
            return new Response('Ticked', { status: 200 });
        }

        if (request.method === 'POST' && url.pathname.endsWith('/schedule')) {
            const body = (await request.json()) as any;
            const { id, promptId, content, system, params, cron } = body;

            // Calculate next run
            // Note: Since we don't have a cron parser, we'll assume every minute/hour for MVP
            // or rely on the cron trigger frequency if passed.
            // For MVP: Set next_run to now.
            const nextRun = Date.now();

            this.ctx.storage.sql.exec(
                `
                INSERT INTO scheduled_tasks (id, prompt_id, prompt_content, system_instructions, parameters, cron, enabled, last_run, next_run, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                prompt_content = excluded.prompt_content,
                cron = excluded.cron,
                parameters = excluded.parameters,
                next_run = ?
            `,
                id,
                promptId,
                content,
                system,
                JSON.stringify(params),
                cron,
                nextRun,
                Date.now(),
                nextRun,
            );

            return new Response('Scheduled', { status: 200 });
        }

        return new Response('Not found', { status: 404 });
        return new Response('Not found', { status: 404 });
    }

    // ================= ADMIN LOGIC =================

    async handleAdminRequest(url: URL, request: Request): Promise<Response> {
        if (request.method === 'POST' && url.pathname.endsWith('/register')) {
            const body = (await request.json()) as { chatId: number; username?: string; firstName?: string };
            const now = Date.now();

            // Check if first user
            const count = this.ctx.storage.sql.exec('SELECT COUNT(*) as c FROM users').one() as any;
            const role = (count.c === 0) ? 'admin' : 'user';

            this.ctx.storage.sql.exec(`
                INSERT INTO users (chat_id, username, first_name, role, joined_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(chat_id) DO UPDATE SET
                username = excluded.username,
                first_name = excluded.first_name
            `, body.chatId, body.username, body.firstName, role, now);

            return Response.json({ success: true, role });
        }

        if (request.method === 'POST' && url.pathname.endsWith('/broadcast')) {
            const body = (await request.json()) as { message: string, excludeChatId?: number };
            const users = [...this.ctx.storage.sql.exec('SELECT chat_id FROM users').toArray()];

            let sent = 0;
            for (const user of users) {
                if (body.excludeChatId && user.chat_id === body.excludeChatId) continue;
                if (!this.env.TELEGRAM_BOT_TOKEN) continue;

                try {
                    await this.rateLimiter.throttle();
                    await sendNotification(this.env.TELEGRAM_BOT_TOKEN, this.env as any, body.message, user.chat_id);
                    sent++;
                } catch (e) {
                    console.error(`Failed to send to ${user.chat_id}`, e);
                }
            }
            return Response.json({ success: true, sent });
        }

        if (request.method === 'GET' && url.pathname.endsWith('/check_admin')) {
            const chatId = url.searchParams.get('chatId');
            if (!chatId) return new Response('Missing chatId', { status: 400 });

            const user = this.ctx.storage.sql.exec('SELECT role FROM users WHERE chat_id = ?', chatId).one() as any;
            return Response.json({ isAdmin: user?.role === 'admin' });
        }

        if (request.method === 'POST' && url.pathname.endsWith('/clear_cache')) {
            // "Clear Cache" - Reset internal non-persistent state
            this.sessions.clear();
            this.writeQueue = [];
            // Maybe manual GC? default logic handles it.
            return Response.json({ success: true, message: 'Sessions and Write Queue cleared' });
        }

        return new Response('Not found', { status: 404 });
    }

    private async processScheduledTasks() {
        const now = Date.now();
        // Fetch tasks due
        // Since we don't have sophisticated cron parsing in DO yet, we'll just check 'next_run' <= now
        // And for this MVP, we treat CRON as just "active". Real impl needs 'croner' or similar.
        const tasks = [
            ...this.ctx.storage.sql
                .exec(
                    `
            SELECT * FROM scheduled_tasks WHERE enabled = 1 AND next_run <= ?
        `,
                    now,
                )
                .toArray(),
        ] as any[];

        console.log(`[Scheduler] Processing ${tasks.length} tasks`);

        for (const task of tasks) {
            await this.executeTask(task);
        }
    }

    private async executeTask(task: any) {
        try {
            const params = JSON.parse(task.parameters);
            console.log(`[BoardDO] Executing task: ${task.id}`);

            // Use Gemini Interactions API with the configured API key
            const apiKey = this.env.GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error('GEMINI_API_KEY not configured in worker environment');
            }

            // Fallback chain for rate limit resilience (sync models only)
            const fallbackModels = [
                params.model || 'gemini-3-pro-preview', // Primary
                'gemini-3-flash',                   // Fast fallback
                'gemini-2.5-pro',                   // Stable fallback
                'gemini-2.5-flash',             // Final fallback
            ];

            const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/interactions';
            let output = '';
            let usedModel = '';
            let lastError: Error | null = null;

            // Try each model in the fallback chain
            for (const model of fallbackModels) {
                try {
                    console.log(`[BoardDO] Trying model: ${model}`);
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-goog-api-key': apiKey,
                        },
                        body: JSON.stringify({
                            input: task.prompt_content,
                            model: model,
                        }),
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        // Rate limit or overload - try next model
                        if (response.status === 429 || response.status === 503 ||
                            errorText.includes('RESOURCE_EXHAUSTED')) {
                            console.log(`[BoardDO] Model ${model} rate limited, trying next...`);
                            lastError = new Error(`${response.status}: ${errorText}`);
                            // Phase 22B: Rate Limit Alert
                            if (this.env.TELEGRAM_BOT_TOKEN) {
                                await this.rateLimiter.throttle();
                                await sendNotification(
                                    this.env.TELEGRAM_BOT_TOKEN,
                                    this.env as any,
                                    `⚠️ **Rate Limit Alert**\n\nModel: \`${model}\`\nStatus: ${response.status}\nFalling back to next model...`,
                                );
                            }
                            continue;
                        }
                        throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
                    }

                    const data = (await response.json()) as any;
                    const outputs = data.outputs || [];
                    output = outputs[0]?.text || outputs[0]?.content || JSON.stringify(data);
                    usedModel = model;
                    console.log(`[BoardDO] Success with model: ${model}`);

                    // Phase 22C: Model Success Notification with Output Preview
                    if (this.env.TELEGRAM_BOT_TOKEN) {
                        const preview = output.substring(0, 300).trim();
                        await this.rateLimiter.throttle();
                        await sendNotification(
                            this.env.TELEGRAM_BOT_TOKEN,
                            this.env as any,
                            `✨ **Generation Complete**\n\nModel: \`${model}\`\nOutput: ${output.length} chars\n\n📝 **Preview:**\n${preview}${output.length > 300 ? '...' : ''}`,
                        );
                    }
                    break; // Success - exit loop
                } catch (modelError) {
                    lastError = modelError as Error;
                    const errorMsg = (modelError as Error).message;
                    if (errorMsg.includes('429') || errorMsg.includes('503') ||
                        errorMsg.includes('RESOURCE_EXHAUSTED')) {
                        console.log(`[BoardDO] Model ${model} failed, trying next...`);
                        continue;
                    }
                    throw modelError; // Non-rate-limit error - rethrow
                }
            }

            // If all models failed
            if (!output && lastError) {
                throw lastError;
            }

            const now = Date.now();

            // 1. Log Result
            const logId = crypto.randomUUID();
            this.ctx.storage.sql.exec(
                `
                INSERT INTO task_log (id, task_id, output, executed_at, duration, status)
                VALUES (?, ?, ?, ?, ?, 'success')
            `,
                logId,
                task.id,
                output,
                now,
                0, // Interactions API doesn't return executionTime
            );

            // 2. Update Prompt Version with output
            this.ctx.storage.sql.exec(
                `
                UPDATE prompt_versions SET output = ?, execution_time = ? WHERE id = ?
            `,
                output,
                0, // Interactions API doesn't return executionTime
                task.current_version_id,
            );

            // 3. Update Prompt Status to deployed/done
            this.ctx.storage.sql.exec(
                `
                UPDATE prompts SET status = 'deployed', deployed_at = ? WHERE id = ?
            `,
                now,
                task.id,
            );

            // 4. Update Scheduler Next Run (if it's a scheduled task)
            if (task.cron) {
                // For MVP, we recur every 5 minutes if a schedule is active
                // In a production app, we'd use a cron parser like 'croner'
                const nextRun = now + 5 * 60000;
                this.ctx.storage.sql.exec(
                    `
                    UPDATE scheduled_tasks SET last_run = ?, next_run = ? WHERE id = ?
                `,
                    now,
                    nextRun,
                    task.id,
                );
            }

            // 5. Notify via Telegram with Full Output
            if (this.env.TELEGRAM_BOT_TOKEN) {
                const promptTitle = task.title || 'Untitled Prompt';
                const outputPreview = output.substring(0, 800).trim();
                await this.rateLimiter.throttle();
                await sendNotification(
                    this.env.TELEGRAM_BOT_TOKEN,
                    this.env as any,
                    `✅ **Job Complete!**\n\nPrompt: **${promptTitle}**\nModel: \`${usedModel}\`\n\n📄 **Full Output:**\n${outputPreview}${output.length > 800 ? '\n\n_(truncated, use /latest for full)_' : ''}`,
                );
            }

            // Phase 4: Clarification Needed Detection
            if (output.match(/clarification needed/i) || output.match(/please clarify/i) || output.match(/missing information/i)) {
                if (this.env.TELEGRAM_BOT_TOKEN) {
                    await sendNotification(
                        this.env.TELEGRAM_BOT_TOKEN,
                        this.env as any,
                        `⚠️ **Clarification Needed**\n\nThe AI has a question regarding prompt "**${task.title}**".\n\n"${output.substring(0, 200)}..."`
                    );
                }
            }

            console.log(`[BoardDO] Task complete: ${task.id}`);
        } catch (error) {
            console.error(`[BoardDO] Task ${task.id} failed:`, error);
            // Move back to error status
            this.ctx.storage.sql.exec(
                `
                UPDATE prompts SET status = 'error' WHERE id = ?
            `,
                task.id,
            );

            if (task.cron) {
                this.ctx.storage.sql.exec(
                    `
                    UPDATE scheduled_tasks SET next_run = ? WHERE id = ?
                `,
                    Date.now() + 60000,
                    task.id,
                );
            }

            // Notify via Telegram
            if (this.env.TELEGRAM_BOT_TOKEN) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                await this.rateLimiter.throttle();
                await sendNotification(
                    this.env.TELEGRAM_BOT_TOKEN,
                    this.env as any,
                    `❌ **Job Failed!**\n\nPrompt: ${task.title || task.id}\nError: ${errorMsg}\n\nCheck /logs for details.`,
                );
            }
        }
    }
}
