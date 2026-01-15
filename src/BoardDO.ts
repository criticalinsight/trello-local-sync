import { DurableObject } from 'cloudflare:workers';

interface Env {
    BOARD_DO: DurableObjectNamespace;
}

// Batch threshold - writes are batched if >50 requests/sec
const BATCH_THRESHOLD = 50;
const BATCH_WINDOW_MS = 1000;

export class BoardDO extends DurableObject {
    private sessions: Map<WebSocket, { id: string }> = new Map();
    private writeQueue: Array<{ sql: string; params: unknown[]; clientId: string }> = [];
    private lastFlush: number = Date.now();
    private requestCount: number = 0;
    private batchTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.initDatabase();
        this.initScheduler();
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
    `);

        // Migration for existing databases
        try {
            // SQLite doesn't support IF NOT EXISTS in ALTER COLUMN, so we catch errors
            // or checking pragma table_info would be cleaner but verbose.
            // Quick & dirty for this implementation: separate try/catches
            try { this.ctx.storage.sql.exec('ALTER TABLE cards ADD COLUMN description TEXT'); } catch { }
            try { this.ctx.storage.sql.exec('ALTER TABLE cards ADD COLUMN tags JSON'); } catch { }
            try { this.ctx.storage.sql.exec('ALTER TABLE cards ADD COLUMN checklist JSON'); } catch { }
            try { this.ctx.storage.sql.exec('ALTER TABLE cards ADD COLUMN due_date INTEGER'); } catch { }
        } catch (e) {
            console.warn('Migration warning:', e);
        }

        // Insert default lists if empty
        const listCount = this.ctx.storage.sql.exec('SELECT COUNT(*) as count FROM lists').one();
        if (listCount && (listCount.count as number) === 0) {
            this.ctx.storage.sql.exec(`
        INSERT INTO lists (id, title, pos) VALUES 
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
            const lists = [...this.ctx.storage.sql.exec('SELECT * FROM lists ORDER BY pos').toArray()];
            const cards = [...this.ctx.storage.sql.exec('SELECT * FROM cards ORDER BY pos').toArray()];
            return Response.json({ lists, cards });
        }

        // Scheduler API routing
        if (url.pathname.startsWith('/api/scheduler/')) {
            return this.handleSchedulerRequest(url, request);
        }

        return new Response('Not found', { status: 404 });
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
                if (this.requestCount > BATCH_THRESHOLD && (now - this.lastFlush) < BATCH_WINDOW_MS) {
                    // Add to batch queue
                    this.writeQueue.push({ sql: msg.sql, params: msg.params, clientId: msg.clientId });

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
            this.broadcast(JSON.stringify({
                type: 'SQL_RESULT',
                sql: 'BATCH',
                params: [],
                result: { affected: this.writeQueue.length }
            }), lastWrite.clientId);

        } catch (e) {
            this.ctx.storage.sql.exec('ROLLBACK');
            console.error('Batch write failed:', e);
        }

        this.writeQueue = [];
        this.batchTimeout = null;
        this.lastFlush = Date.now();
    }

    private async executeAndBroadcast(sql: string, params: unknown[], clientId: string, sender: WebSocket) {
        try {
            const result = await this.sql(sql, ...params);
            const rows = [...result.toArray()];

            // Broadcast to all OTHER clients (not the sender)
            this.broadcast(JSON.stringify({
                type: 'SQL_RESULT',
                sql,
                params,
                result: rows
            }), clientId);

        } catch (e) {
            console.error('SQL execution error:', e);
            sender.send(JSON.stringify({ type: 'ERROR', message: String(e) }));
        }
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
            const body = await request.json() as any;
            const { id, promptId, content, system, params, cron } = body;

            // Calculate next run
            // Note: Since we don't have a cron parser, we'll assume every minute/hour for MVP
            // or rely on the cron trigger frequency if passed.
            // For MVP: Set next_run to now.
            const nextRun = Date.now();

            this.ctx.storage.sql.exec(`
                INSERT INTO scheduled_tasks (id, prompt_id, prompt_content, system_instructions, parameters, cron, enabled, last_run, next_run, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                prompt_content = excluded.prompt_content,
                cron = excluded.cron,
                parameters = excluded.parameters,
                next_run = ?
            `, id, promptId, content, system, JSON.stringify(params), cron, nextRun, Date.now(), nextRun);

            return new Response('Scheduled', { status: 200 });
        }

        return new Response('Not found', { status: 404 });
    }

    private async processScheduledTasks() {
        const now = Date.now();
        // Fetch tasks due
        // Since we don't have sophisticated cron parsing in DO yet, we'll just check 'next_run' <= now
        // And for this MVP, we treat CRON as just "active". Real impl needs 'croner' or similar.
        const tasks = [...this.ctx.storage.sql.exec(`
            SELECT * FROM scheduled_tasks WHERE enabled = 1 AND next_run <= ?
        `, now).toArray()] as any[];

        console.log(`[Scheduler] Processing ${tasks.length} tasks`);

        for (const task of tasks) {
            try {
                // Execute Prompt
                const params = JSON.parse(task.parameters);

                // We need to call the AI service. 
                // Since 'aiService.ts' is likely not compatible with DO environment directly (imports config etc),
                // we should ideally fetch the worker's own API or use the binding if possible.
                // Re-using the Worker's Interaction API route via internal fetch.

                // Construct internal request to own worker
                const response = await fetch('http://127.0.0.1/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: task.prompt_content,
                        generationConfig: {
                            temperature: params.temperature,
                            topP: params.topP,
                            maxOutputTokens: params.maxTokens
                        }
                    })
                });

                const result = await response.json() as any;
                const output = result.text || result.content || JSON.stringify(result);

                // Log Result
                const logId = crypto.randomUUID();
                this.ctx.storage.sql.exec(`
                    INSERT INTO task_log (id, task_id, output, executed_at, duration, status)
                    VALUES (?, ?, ?, ?, ?, 'success')
                `, logId, task.id, output, Date.now(), result.executionTime || 0);

                // Update Next Run (Simple +1 minute for MVP since we lack Cron parser)
                const nextRun = now + 60000;
                this.ctx.storage.sql.exec(`
                    UPDATE scheduled_tasks SET last_run = ?, next_run = ? WHERE id = ?
                `, now, nextRun, task.id);

            } catch (error) {
                console.error(`[Scheduler] Task ${task.id} failed:`, error);
                this.ctx.storage.sql.exec(`
                    UPDATE scheduled_tasks SET next_run = ? WHERE id = ?
                `, now + 60000, task.id); // Retry in 1 min
            }
        }
    }
}
