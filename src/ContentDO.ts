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

        if (url.pathname === '/process' && request.method === 'POST') {
            // Manual trigger for testing
            await this.processBatch();
            return Response.json({ success: true, message: 'Batch processing triggered' });
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
            const currentAlarm = await this.ctx.storage.getAlarm();
            if (!currentAlarm) {
                // Process in 1 minute to gather batch
                await this.ctx.storage.setAlarm(Date.now() + 60 * 1000);
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

        const systemPrompt = `You are a High-Frequency News Analyst. 
        Your input is a batch of raw Telegram messages from a single channel.
        
        Tasks:
        1. FILTER: Ignore conversational noise ("k", "lol"), spam, or irrelevant updates.
        2. EXTRACT: Identify specific financial signals (Tickers, Earnings, Macro Events).
        3. SYNTHESIZE: Combine related messages into a single "Intel Card".
        
        Output valid JSON array:
        [{
            "summary": "Safaricom declares 0.50 dividend",
            "tickers": ["$SAFCOM"],
            "sentiment": "bullish" | "bearish" | "neutral",
            "relevance_score": 0-100,
            "source_ids": ["msg_id_1", "msg_id_2"]
        }]
        If mainly noise, return empty array.`;

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

        // Updates DB
        // In a real app, we might merge rows or update them. 
        // Here, we update the original rows with the processed result (mapping back might be tricky if aggregated).
        // implementation simplification: Update all processed rows as 'processed'

        const updates = items.map(i => i.id);
        for (const id of updates) {
            this.ctx.storage.sql.exec("UPDATE content_items SET processed_json = ? WHERE id = ?", JSON.stringify({ batch_processed: true }), id);
        }

        // Logic to push "Signals" to BoardDO would go here
        // For now, valid signals > 70 relevance get a notification or stored as special "Signal"
        for (const intel of analysis) {
            if (intel.relevance_score > 70) {
                await this.notifySignal(intel, sourceId);
            }
        }
    }

    private async notifySignal(intel: any, sourceId: string) {
        const relevance = intel.relevance_score || 0;

        // 1. Send to Telegram immediately (Alert)
        if (this.env.TELEGRAM_BOT_TOKEN) {
            const msg = `🚨 **Intel: ${intel.summary}**\n` +
                `📈 Sentiment: ${intel.sentiment.toUpperCase()}\n` +
                `🎯 Tickers: ${intel.tickers.join(', ')}\n` +
                `🎯 Relevance: ${relevance}%`;

            await this.env.BOARD_DO.get(this.env.BOARD_DO.idFromName('default')).fetch('http://do/api/admin/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg })
            });
        }

        // 2. Auto-Create Kanban Card if High Relevance
        if (relevance >= 80) {
            console.log(`[ContentDO] High relevance signal (${relevance}%), creating card...`);

            const cardId = crypto.randomUUID();
            const now = Date.now();
            const description = `📈 **Sentiment:** ${intel.sentiment.toUpperCase()}\n` +
                `🎯 **Tickers:** ${intel.tickers.join(', ')}\n` +
                `📊 **Relevance:** ${relevance}%\n\n` +
                `Source: Telegram Batch\n` +
                `Refined by: Content Refinery (Gemini)`;

            const sql = `
                INSERT INTO cards (id, title, list_id, pos, created_at, description, tags) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            // Assume list-1 is "To Do"
            const params = [
                cardId,
                `⚡ Intel: ${intel.summary}`,
                'list-1',
                now,
                now,
                description,
                JSON.stringify(['intel', ...intel.tickers])
            ];

            await this.env.BOARD_DO.get(this.env.BOARD_DO.idFromName('default')).fetch('http://do/api/sql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql, params })
            });

            // Log activity
            await this.env.BOARD_DO.get(this.env.BOARD_DO.idFromName('default')).fetch('http://do/api/log_activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'card_auto_created',
                    entityId: cardId,
                    details: `Auto-created Intel Card: ${intel.summary}`
                })
            });
        }
    }
}
