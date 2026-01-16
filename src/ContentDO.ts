import { DurableObject } from 'cloudflare:workers';
import { Env } from './types';

interface ChannelConfig {
    id: string; // Telegram Chat ID
    name: string;
    targetBoardId?: string;
    targetListMap?: Record<string, string>; // e.g. { "bullish": "list-1", "action": "list-2" }
}

interface ContentItem {
    id: string;
    sourceId: string;
    rawText: string;
    processed?: any;
    createdAt: number;
}

export class ContentDO extends DurableObject {
    env: Env;
    ctx: DurableObjectState;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.env = env;
        this.ctx = ctx;
        this.initDatabase();
    }

    private initDatabase() {
        this.ctx.storage.sql.exec(`
            CREATE TABLE IF NOT EXISTS channels (
                id TEXT PRIMARY KEY,
                name TEXT,
                config JSON,
                created_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS content_items (
                id TEXT PRIMARY KEY,
                source_id TEXT,
                source_name TEXT,
                raw_text TEXT,
                processed_json JSON,
                sentiment TEXT,
                is_signal INTEGER DEFAULT 0,
                created_at INTEGER
            );
        `);
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/ingest' && request.method === 'POST') {
            return this.handleIngest(request);
        }

        if (url.pathname === '/sql' && request.method === 'POST') {
            const body = await request.json() as any;
            const result = this.ctx.storage.sql.exec(body.sql, ...(body.params || [])).toArray();
            return Response.json({ result });
        }

        if (url.pathname === '/process' && request.method === 'POST') {
            // Manual trigger for testing
            await this.processBatch();
            return Response.json({ success: true, message: 'Batch processing triggered' });
        }

        if (url.pathname === '/rss' && request.method === 'POST') {
            return this.handleRSSIngest(request);
        }

        if (url.pathname === '/channels' && request.method === 'GET') {
            const channels = this.ctx.storage.sql.exec('SELECT * FROM channels').toArray();
            return Response.json({ result: channels });
        }

        return new Response('Not found', { status: 404 });
    }

    async handleIngest(request: Request): Promise<Response> {
        try {
            const body = await request.json() as { chatId: string; title: string; text: string; full: any };
            const id = crypto.randomUUID();

            // 1. Auto-register channel if new
            const channels = this.ctx.storage.sql.exec('SELECT id FROM channels WHERE id = ?', body.chatId).toArray();
            if (channels.length === 0) {
                this.ctx.storage.sql.exec(
                    'INSERT INTO channels (id, name, config, created_at) VALUES (?, ?, ?, ?)',
                    body.chatId,
                    body.title,
                    JSON.stringify({ mode: 'auto' }),
                    Date.now()
                );
            }

            // 2. Buffer content
            this.ctx.storage.sql.exec(
                'INSERT INTO content_items (id, source_id, source_name, raw_text, created_at) VALUES (?, ?, ?, ?, ?)',
                id,
                body.chatId,
                body.title,
                body.text,
                Date.now()
            );

            // 3. Schedule processing (debounce/batch)
            if (!currentAlarm) {
                // Process in 5 seconds to gather batch
                await this.ctx.storage.setAlarm(Date.now() + 5 * 1000);
            }

            return Response.json({ success: true, id });
        } catch (e) {
            console.error('Ingest error:', e);
            return new Response('Error', { status: 500 });
        }
    }

    async alarm() {
        await this.processBatch();
    }

    private async processBatch() {
        // Fetch unprocessed items
        const items = this.ctx.storage.sql.exec('SELECT * FROM content_items WHERE processed_json IS NULL LIMIT 20').toArray() as any[];

        if (items.length === 0) return;

        console.log(`[ContentDO] Processing batch of ${items.length} items...`);

        // Group by Source
        const bySource: Record<string, any[]> = {};
        for (const item of items) {
            if (!bySource[item.source_id]) bySource[item.source_id] = [];
            bySource[item.source_id].push(item);
        }

        // Process per source
        for (const [sourceId, sourceItems] of Object.entries(bySource)) {
            await this.analyzeSourceBatch(sourceId, sourceItems);
        }
    }

    private async analyzeSourceBatch(sourceId: string, items: any[]) {
        const texts = items.map(i => `- ${i.raw_text}`).join('\n');

        // Call Gemini (NewsAnalyst Agent)
        // Note: In real implementation, strict JSON mode or tool use is best.
        // Importing NEWS_ANALYST_PROMPT from data/prompts would be ideal, or hardcoding temporarily.

        const systemPrompt = `You are an Institutional-Grade Financial News Analyst. 
        Your input is a batch of raw Telegram messages from a single channel.
        
        Tasks:
        1. FILTER: Ignore conversational noise, spam, and unverified rumors unless high-impact.
        2. EXTRACT: Identify specific stickers ($TICKER), sentiment, and macro relevance.
        3. CLASSIFY: Determine Urgency (low, med, high) and Impact Radius (narrow, wide).
        
        Output valid JSON array:
        [{
            "summary": "Full technical digest of the news",
            "tickers": ["$TICKER"],
            "sentiment": "bullish" | "bearish" | "neutral",
            "relevance_score": 0-100,
            "urgency": "low" | "med" | "high",
            "impact_analysis": "One sentence reasoning for the score",
            "source_ids": ["msg_id_1"]
        }]
        Strict JSON only. If primarily noise, return empty array [].`;

        const response = await this.env.RESEARCH_DO.get(this.env.RESEARCH_DO.idFromName('default')).fetch('http://do/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: texts,
                system: systemPrompt,
                model: 'gemini-2.5-flash' // Fast model for batching
            })
        });

        const result = await response.json() as any;
        let analysis: any[] = [];
        try {
            // Clean code block if present
            const clean = result.output.replace(/```json/g, '').replace(/```/g, '').trim();
            analysis = JSON.parse(clean);
        } catch (e) {
            console.error('Failed to parse AI response', e);
        }

        const sourceName = items[0]?.source_name || 'Unknown Channel';

        // Updates DB
        const updates = items.map(i => i.id);
        for (const id of updates) {
            this.ctx.storage.sql.exec("UPDATE content_items SET processed_json = ? WHERE id = ?", JSON.stringify({ batch_processed: true }), id);
        }

        // Logic to push "Signals" to BoardDO would go here
        for (const intel of analysis) {
            if (intel.relevance_score > 70) {
                await this.notifySignal(intel, sourceId, sourceName);
            }
        }
    }

    private async notifySignal(intel: any, sourceId: string, sourceName: string) {
        const relevance = intel.relevance_score || 0;
        const tickers = Array.isArray(intel.tickers) ? intel.tickers : [];

        // 1. Generate Fingerprint (Normalized summary + tickers)
        const sortedTickers = [...tickers].sort();
        const fingerprint = `${(intel.summary || "").toLowerCase().trim()}:${sortedTickers.join(',')}`;

        // 2. Check for Duplicates in BoardDO (within last 6 hours)
        const boardStub = this.env.BOARD_DO.get(this.env.BOARD_DO.idFromName('default'));
        const checkSql = `SELECT id FROM signals WHERE fingerprint = ? AND created_at > ?`;
        const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);

        try {
            const checkResponse = await boardStub.fetch('http://do/api/sql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: checkSql, params: [fingerprint, sixHoursAgo] })
            });
            const checkResult = await checkResponse.json() as any;
            if (checkResult.result && checkResult.result.length > 0) {
                const existing = checkResult.result[0];
                console.log(`[ContentDO] Duplicate signal detected. Consolidating source ${sourceName}...`);

                // Consolidation Logic: Update existing signal with new source
                const updateSql = `
                    UPDATE signals 
                    SET additional_sources = CASE 
                        WHEN additional_sources IS NULL OR additional_sources = '' THEN ? 
                        ELSE additional_sources || ',' || ? 
                    END,
                    relevance = MIN(relevance + 5, 100)
                    WHERE id = ?
                `;
                await boardStub.fetch('http://do/api/sql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sql: updateSql, params: [sourceName, sourceName, existing.id] })
                });
                return;
            }
        } catch (e) {
            console.error('[ContentDO] Consolidation failed:', e);
        }

        // 3. Persist to signals table
        const signalId = crypto.randomUUID();
        const saveSql = `
            INSERT INTO signals (id, fingerprint, summary, sentiment, tickers, relevance, source_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        try {
            await boardStub.fetch('http://do/api/sql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sql: saveSql,
                    params: [
                        signalId,
                        fingerprint,
                        intel.summary,
                        intel.sentiment,
                        JSON.stringify(tickers),
                        relevance,
                        sourceId,
                        Date.now()
                    ]
                })
            });
        } catch (e) {
            console.error('[ContentDO] Persistence failed:', e);
        }

        // 4. Send to Telegram immediately (Alert)
        if (this.env.TELEGRAM_BOT_TOKEN) {
            const msg = `🚨 **Intel: ${intel.summary}**\n` +
                `📈 Sentiment: ${(intel.sentiment || "").toUpperCase()}\n` +
                `🎯 Tickers: ${tickers.join(', ')}\n` +
                `🎯 Relevance: ${relevance}%`;

            try {
                await boardStub.fetch('http://do/api/admin/broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg })
                });
            } catch (e) {
                console.error('[ContentDO] Broadcast failed:', e);
            }
        }

        // 5. Multi-Agent Vetting (Epistemic Analyst) for High-Relevance signals
        let isValidated = true;
        let analysisNotes = "";

        if (relevance >= 80) {
            console.log(`[ContentDO] High-relevance signal (${relevance}%). Fetching Relational Context...`);

            // Fetch Relational Context (recent activities on these tickers)
            let contextText = "No previous context found.";
            try {
                if (tickers.length > 0) {
                    const contextSql = `
                        SELECT s.summary, s.sentiment, s.created_at 
                        FROM signals s 
                        WHERE s.tickers LIKE ? AND s.created_at > ?
                        ORDER BY s.created_at DESC LIMIT 3
                    `;
                    const contextRes = await boardStub.fetch('http://do/api/sql', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sql: contextSql,
                            params: [`%${tickers[0]}%`, Date.now() - (48 * 60 * 60 * 1000)]
                        })
                    });
                    const contextData = await contextRes.json() as any;
                    if (contextData.result && contextData.result.length > 0) {
                        contextText = contextData.result.map((r: any) => `- [${new Date(r.created_at).toLocaleDateString()}] ${r.summary}`).join('\n');
                    }
                }
            } catch (e) {
                console.error('[ContentDO] Context fetch failed:', e);
            }

            const vettingPrompt = `Analyze the following financial signal for accuracy and depth.
            Signal: ${intel.summary}
            Tickers: ${tickers.join(', ')}
            
            Previous Relational Context (Last 48h):
            ${contextText}
            
            Tasks:
            1. Cross-reference with context. Is this a duplicate or a new development?
            2. Verify if this looks factual.
            3. Decision: Should this be promoted to a Kanban Card? (REPLY ONLY WITH 'PROCEED' OR 'DISCARD').
            
            Notes:`;

            try {
                const res = await (this.env.RESEARCH_DO.get(this.env.RESEARCH_DO.idFromName('default'))).fetch('http://do/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: vettingPrompt,
                        system: "Epistemic Analyst (Critical Vetting Agent)"
                    })
                });

                if (res.ok) {
                    const data = await res.json() as any;
                    const output = data.output || "";
                    isValidated = output.includes('PROCEED');
                    analysisNotes = output.split('\n').pop() || "";
                    console.log(`[ContentDO] Epistemic Vetting Result: ${isValidated ? 'PROCEED' : 'DISCARD'}`);
                }
            } catch (e) {
                console.error('[ContentDO] Vetting failed:', e);
                isValidated = true; // Fail-safe
            }
        }

        if (!isValidated) {
            console.log(`[ContentDO] Signal discarded by Epistemic Analyst.`);
            return;
        }

        // 6. Save to Knowledge Graph (Entities & Relationships)
        try {
            for (const ticker of tickers) {
                // Insert entity
                await boardStub.fetch('http://do/api/refinery/knowledge/insert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'entity',
                        name: ticker,
                        entityType: 'TICKER',
                        description: `Financial Asset: ${ticker}`
                    })
                });

                // Insert relationship
                await boardStub.fetch('http://do/api/refinery/knowledge/insert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'relationship',
                        sourceId: signalId,
                        targetId: ticker,
                        relationType: 'MENTIONS',
                        strength: relevance / 100
                    })
                });
            }
        } catch (e) {
            console.error('[ContentDO] Knowledge Graph insertion failed:', e);
        }

        // 7. Auto-Create Kanban Card
        if (relevance >= 80) {
            console.log(`[ContentDO] Creating card for validated signal from ${sourceName}...`);

            let targetBoardId = 'board-intel';
            let targetListId = 'list-intel-todo';

            // Route to channel-specific boards
            const name = sourceName.toLowerCase();
            const isHighUrgency = intel.urgency === 'high';

            if (name.includes('americamoe')) {
                targetBoardId = 'board-americamoe';
                targetListId = isHighUrgency ? 'list-americamoe-critical' : 'list-americamoe-todo';
            } else if (name.includes('moneyacademy')) {
                targetBoardId = 'board-moneyacademy';
                targetListId = isHighUrgency ? 'list-moneyacademy-critical' : 'list-moneyacademy-todo';
            } else if (name.includes('gotrythis')) {
                targetBoardId = 'board-gotrythis';
                targetListId = isHighUrgency ? 'list-gotrythis-critical' : 'list-gotrythis-todo';
            } else if (name.includes('moecrypto')) {
                targetBoardId = 'board-moecrypto';
                targetListId = isHighUrgency ? 'list-moecrypto-critical' : 'list-moecrypto-todo';
            } else if (isHighUrgency) {
                targetListId = 'list-intel-critical';
            }

            const cardId = crypto.randomUUID();
            const now = Date.now();
            const description = `📈 **Sentiment:** ${(intel.sentiment || "").toUpperCase()}\n` +
                `🎯 **Tickers:** ${tickers.join(', ')}\n` +
                `📊 **Relevance:** ${relevance}%\n` +
                `🚨 **Urgency:** ${(intel.urgency || "med").toUpperCase()}\n\n` +
                `🧠 **Impact Analysis:** ${intel.impact_analysis || "No analysis provided."}\n\n` +
                `Source: ${sourceName}\n` +
                `Refined by: Content Refinery (Gemini)`;

            const sql = `
                INSERT INTO cards (id, board_id, list_id, title, pos, created_at, description, tags) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                cardId,
                targetBoardId,
                targetListId,
                `⚡ Intel: ${intel.summary}`,
                now,
                now,
                description,
                JSON.stringify(['intel', ...tickers])
            ];

            try {
                await boardStub.fetch('http://do/api/sql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sql, params })
                });

                // Log activity
                await boardStub.fetch('http://do/api/log_activity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'card_auto_created',
                        entityId: cardId,
                        details: `Auto-created Intel Card: ${intel.summary}`
                    })
                });
            } catch (e) {
                console.error('[ContentDO] Card creation failed:', e);
            }
        }
    }


    async handleRSSIngest(request: Request): Promise<Response> {
        try {
            const body = await request.json() as { url: string; sourceName?: string };
            const response = await fetch(body.url);
            if (!response.ok) throw new Error(`Failed to fetch RSS: ${response.statusText}`);

            const xml = await response.text();
            // Simple regex extraction for POC (in real apps, use a proper RSS parser)
            const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

            let count = 0;
            for (const match of items.slice(0, 10)) { // Limit to 10 for safety
                const itemXml = match[1];
                const title = itemXml.match(/<title>(.*?)<\/title>/)?.[1] || "";
                const description = itemXml.match(/<description>(.*?)<\/description>/)?.[1] || "";
                const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || "";

                await this.handleIngest(new Request('http://do/ingest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: body.url,
                        title: body.sourceName || 'RSS Feed',
                        text: `${title}\n\n${description}\n\nLink: ${link}`,
                        full: { source: 'rss', url: body.url }
                    })
                }));
                count++;
            }

            return Response.json({ success: true, itemsIngested: count });
        } catch (e) {
            console.error('RSS Ingest error:', e);
            return new Response('Error', { status: 500 });
        }
    }
}
