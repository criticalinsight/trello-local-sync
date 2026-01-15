import { PGlite } from '@electric-sql/pglite';

export interface Mutation {
    id: string;
    type: 'EXECUTE_SQL';
    sql: string;
    params: any[];
    createdAt: number;
}

export class SyncManager {
    private pglite: PGlite | null = null;
    private socket: WebSocket | null = null;
    private boardId: string = '';
    private clientId: string = crypto.randomUUID();
    private isConnected: boolean = false;
    private flushInterval: any = null;

    constructor() { }

    async init(pglite: PGlite, boardId: string) {
        this.pglite = pglite;
        this.boardId = boardId;

        // Start connection
        this.connect();

        // Listen for online status
        window.addEventListener('online', () => {
            console.log('[SyncManager] Online detected');
            this.connect();
        });

        window.addEventListener('offline', () => {
            console.log('[SyncManager] Offline detected');
            this.isConnected = false;
            if (this.socket) this.socket.close();
        });

        // Start flush loop (in case of flaky connection / retry)
        this.flushInterval = setInterval(() => this.flushQueue(), 5000);
    }

    private connect() {
        if (!navigator.onLine) return;
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;

        console.log('[SyncManager] Connecting WS...');
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Using same API endpoint but maybe we need a param to distinguish prompt board?
        // Assuming BoardDO can handle multiple tables, so we just use the same boardId?
        // Wait, promptStore uses `prompt-board-${boardId}` for local DB name.
        // But the server might need to know it's for prompts?
        // If we use separate tables `prompts`, `prompt_versions`, it should be fine to use same DO.
        const wsUrl = `${protocol}//${location.host}/api?board=${this.boardId}`;

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('[SyncManager] WS Connected');
            this.isConnected = true;
            this.flushQueue();
        };

        this.socket.onclose = () => {
            console.log('[SyncManager] WS Closed');
            this.isConnected = false;
            // Retry handled by interval or next action
        };

        this.socket.onerror = (e) => {
            console.error('[SyncManager] WS Error', e);
        };

        // Handle incoming messages?
        // For now, we are focusing on outbound sync (mutation queue).
    }

    async enqueue(sql: string, params: any[]) {
        const id = crypto.randomUUID();
        const mutation: Mutation = {
            id,
            type: 'EXECUTE_SQL',
            sql,
            params,
            createdAt: Date.now()
        };

        // 1. Persist to Queue
        if (this.pglite) {
            await this.pglite.query(
                `INSERT INTO mutation_queue (id, board_id, type, data, created_at, synced)
                 VALUES ($1, $2, $3, $4, $5, 0)`,
                [id, this.boardId, 'EXECUTE_SQL', JSON.stringify({ sql, params }), mutation.createdAt]
            );
        }

        // 2. Try sending immediately
        if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
            this.send(mutation);
        }
    }

    private async send(mutation: Mutation) {
        if (!this.socket) return;

        try {
            this.socket.send(JSON.stringify({
                type: 'EXECUTE_SQL',
                sql: mutation.sql,
                params: mutation.params,
                clientId: this.clientId,
                mutationId: mutation.id
            }));

            // Mark as synced
            if (this.pglite) {
                await this.pglite.query(
                    'UPDATE mutation_queue SET synced = 1 WHERE id = $1',
                    [mutation.id]
                );
                // Optional: Delete immediately to keep table small
                await this.pglite.query('DELETE FROM mutation_queue WHERE id = $1', [mutation.id]);
            }
        } catch (e) {
            console.error('[SyncManager] Send failed', e);
            this.isConnected = false; // Assume broken pipe
        }
    }

    async flushQueue() {
        if (!this.pglite || !this.isConnected || this.socket?.readyState !== WebSocket.OPEN) return;

        try {
            const res = await this.pglite.query<{ id: string, data: string }>(
                'SELECT id, data FROM mutation_queue WHERE synced = 0 ORDER BY created_at ASC LIMIT 50'
            );

            if (res.rows.length === 0) return;

            console.log(`[SyncManager] Flushing ${res.rows.length} mutations...`);

            for (const row of res.rows) {
                const data = JSON.parse(row.data);
                const mutation: Mutation = {
                    id: row.id,
                    type: 'EXECUTE_SQL',
                    sql: data.sql,
                    params: data.params,
                    createdAt: 0 // Not needed for send
                };
                await this.send(mutation);
            }
        } catch (e) {
            console.error('[SyncManager] Flush failed', e);
        }
    }
}

export const syncManager = new SyncManager();
