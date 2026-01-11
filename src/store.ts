import { createStore, produce } from 'solid-js/store';
import { PGlite } from '@electric-sql/pglite';
import type { Card, List, StoreState, SyncMessage } from './types';

// Initialize PGlite (Postgres WASM)
let pglite: PGlite | null = null;
let socket: WebSocket | null = null;
let clientId: string = '';

// Create reactive store with default lists for immediate render
const [store, setStore] = createStore<StoreState>({
    lists: {
        'list-1': { id: 'list-1', title: 'To Do', pos: 0 },
        'list-2': { id: 'list-2', title: 'In Progress', pos: 1 },
        'list-3': { id: 'list-3', title: 'Done', pos: 2 },
    },
    cards: {},
    connected: false,
    syncing: false,
});

// Generate unique ID
const genId = () => crypto.randomUUID();

// Initialize PGlite database
async function initPGlite() {
    try {
        console.log('🔄 Initializing PGlite...');
        pglite = new PGlite('idb://trello-local');

        await pglite.exec(`
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
        created_at BIGINT NOT NULL
      );
    `);

        // Load existing cards from PGlite
        const cards = await pglite.query<{ id: string; title: string; list_id: string; pos: number; created_at: number }>('SELECT id, title, list_id, pos, created_at FROM cards ORDER BY pos');

        if (cards.rows.length > 0) {
            setStore(produce((s) => {
                for (const card of cards.rows) {
                    s.cards[card.id] = {
                        id: card.id,
                        title: card.title,
                        listId: card.list_id,
                        pos: card.pos,
                        createdAt: card.created_at,
                    };
                }
            }));
        }

        console.log('✅ PGlite initialized, loaded', cards.rows.length, 'cards');
    } catch (error) {
        console.error('❌ PGlite initialization failed:', error);
        // App still works with in-memory store
    }
}

// Connect to Cloudflare Durable Object
function connectWebSocket(boardId = 'default') {
    try {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.host}/api?board=${boardId}`;

        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            setStore('connected', true);
            console.log('🔌 Connected to sync server');
        };

        socket.onclose = () => {
            setStore('connected', false);
            // Reconnect after 2 seconds
            setTimeout(() => connectWebSocket(boardId), 2000);
        };

        socket.onmessage = (event) => {
            const msg: SyncMessage = JSON.parse(event.data);
            handleSyncMessage(msg);
        };
    } catch (error) {
        console.error('WebSocket connection failed:', error);
    }
}

// Handle incoming sync messages
function handleSyncMessage(msg: SyncMessage) {
    switch (msg.type) {
        case 'CLIENT_ID':
            clientId = msg.id;
            break;

        case 'SYNC_STATE':
            setStore(produce((s) => {
                for (const list of msg.lists) {
                    s.lists[list.id] = list;
                }
                for (const card of msg.cards) {
                    s.cards[card.id] = {
                        id: card.id,
                        title: card.title,
                        listId: (card as any).list_id || card.listId,
                        pos: card.pos,
                        createdAt: (card as any).created_at || card.createdAt,
                    };
                }
            }));
            break;

        case 'SQL_RESULT':
            // Another client made a change - refetch state
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'REQUEST_STATE' }));
            }
            break;
    }
}

// ============= PUBLIC ACTIONS =============

// Move card to new position (0ms latency pattern)
export async function moveCard(cardId: string, newListId: string, newPos: number) {
    const card = store.cards[cardId];
    if (!card) return;

    const oldListId = card.listId;
    const oldPos = card.pos;

    // 1. INSTANT UI UPDATE (0ms)
    setStore('cards', cardId, { listId: newListId, pos: newPos });

    try {
        // 2. PERSIST TO BROWSER DB
        if (pglite) {
            await pglite.query(
                'UPDATE cards SET list_id = $1, pos = $2 WHERE id = $3',
                [newListId, newPos, cardId]
            );
        }

        // 3. SYNC TO CLOUD
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'EXECUTE_SQL',
                sql: 'UPDATE cards SET list_id = ?, pos = ? WHERE id = ?',
                params: [newListId, newPos, cardId],
                clientId,
            }));
        }
    } catch (error) {
        // 4. ROLLBACK ON FAILURE
        console.error('Move failed, rolling back:', error);
        setStore('cards', cardId, { listId: oldListId, pos: oldPos });
    }
}

// Add new card
export async function addCard(listId: string, title: string) {
    const id = genId();
    const pos = Object.values(store.cards).filter(c => c && c.listId === listId).length;
    const createdAt = Date.now();

    const card: Card = { id, title, listId, pos, createdAt };

    // 1. Instant UI
    setStore('cards', id, card);

    try {
        // 2. Persist
        if (pglite) {
            await pglite.query(
                'INSERT INTO cards (id, title, list_id, pos, created_at) VALUES ($1, $2, $3, $4, $5)',
                [id, title, listId, pos, createdAt]
            );
        }

        // 3. Sync
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'EXECUTE_SQL',
                sql: 'INSERT INTO cards (id, title, list_id, pos, created_at) VALUES (?, ?, ?, ?, ?)',
                params: [id, title, listId, pos, createdAt],
                clientId,
            }));
        }
    } catch (error) {
        console.error('Add card failed:', error);
        setStore('cards', id, undefined!);
    }

    return id;
}

// Delete card
export async function deleteCard(cardId: string) {
    const card = store.cards[cardId];
    if (!card) return;

    // 1. Instant UI
    setStore('cards', cardId, undefined!);

    try {
        // 2. Persist
        if (pglite) {
            await pglite.query('DELETE FROM cards WHERE id = $1', [cardId]);
        }

        // 3. Sync
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'EXECUTE_SQL',
                sql: 'DELETE FROM cards WHERE id = ?',
                params: [cardId],
                clientId,
            }));
        }
    } catch (error) {
        console.error('Delete failed:', error);
        setStore('cards', cardId, card);
    }
}

// Initialize
export async function initStore() {
    console.log('🚀 Starting store initialization...');
    // PGlite init runs in background - lists already rendered from default state
    initPGlite().catch(console.error);

    // Only connect to WS in production (when deployed to Cloudflare)
    if (import.meta.env.PROD) {
        connectWebSocket();
    }
    console.log('✅ Store ready');
}

// Export store for components
export { store };
