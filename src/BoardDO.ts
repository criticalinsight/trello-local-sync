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
        FOREIGN KEY (list_id) REFERENCES lists(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_cards_list ON cards(list_id);
      CREATE INDEX IF NOT EXISTS idx_cards_pos ON cards(pos);
    `);

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

    private executeAndBroadcast(sql: string, params: unknown[], clientId: string, sender: WebSocket) {
        try {
            const result = this.ctx.storage.sql.exec(sql, ...params);
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

    private broadcast(message: string, excludeClientId?: string) {
        for (const [ws, session] of this.sessions) {
            if (session.id !== excludeClientId) {
                try {
                    ws.send(message);
                } catch {
                    this.sessions.delete(ws);
                }
            }
        }
    }
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Route to Durable Object
        if (url.pathname.startsWith('/api') || request.headers.get('Upgrade') === 'websocket') {
            const boardId = url.searchParams.get('board') || 'default';
            const id = env.BOARD_DO.idFromName(boardId);
            const stub = env.BOARD_DO.get(id);
            return stub.fetch(request);
        }

        return new Response('OK');
    }
};
