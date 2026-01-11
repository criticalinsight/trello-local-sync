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

// History Stacks
const undoStack: Array<() => Promise<void>> = [];
const redoStack: Array<() => Promise<void>> = [];

// Helper to push to history
function addToHistory(undoAction: () => Promise<void>) {
    undoStack.push(undoAction);
    // Limit stack size if needed, e.g., 50 items
    if (undoStack.length > 50) undoStack.shift();
    // Clear redo stack on new action
    redoStack.length = 0;
}

// Undo Action
export async function undo() {
    const action = undoStack.pop();
    if (!action) return;

    console.log('↩️ Undoing...');

    // Create a logical inverse for redo (this is tricky with async closures, 
    // strictly speaking we should capture the 'redo' action before executing undo if we want proper redo.
    // For now, let's implement simple Undo first. 
    // To support Redo, the 'action' logs need to be pairs: { undo, redo }
    // Let's refactor:
    // See implementation below in PUBLIC ACTIONS

    await action();
}

// ... actually, let's restructure the stacks to store objects
interface HistoryEntry {
    undo: () => Promise<void>;
    redo: () => Promise<void>;
}

const history: { undo: HistoryEntry[], redo: HistoryEntry[] } = {
    undo: [],
    redo: []
};

export async function performUndo() {
    const entry = history.undo.pop();
    if (!entry) return;

    console.log('↩️ Undoing...');
    await entry.undo();
    history.redo.push(entry);
}

export async function performRedo() {
    const entry = history.redo.pop();
    if (!entry) return;

    console.log('↪️ Redoing...');
    await entry.redo();
    history.undo.push(entry);
}

// Wrapper for actions to log history (internal use)
function logAction(undo: () => Promise<void>, redo: () => Promise<void>) {
    history.undo.push({ undo, redo });
    if (history.undo.length > 50) history.undo.shift();
    history.redo = []; // Clear redo stack
}

// ============= PUBLIC ACTIONS =============

// Move card to new position
export async function moveCard(cardId: string, newListId: string, newPos: number, recordHistory = true) {
    const card = store.cards[cardId];
    if (!card) return;

    const oldListId = card.listId;
    const oldPos = card.pos;

    // Record history
    if (recordHistory) {
        logAction(
            () => moveCard(cardId, oldListId, oldPos, false), // Undo: move back
            () => moveCard(cardId, newListId, newPos, false)  // Redo: move forward
        );
    }

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
export async function addCard(listId: string, title: string, recordHistory = true) {
    const id = genId();
    const pos = Object.values(store.cards).filter(c => c && c.listId === listId).length;
    const createdAt = Date.now();

    const card: Card = { id, title, listId, pos, createdAt };

    // Record history
    if (recordHistory) {
        logAction(
            () => deleteCard(id, false), // Undo: delete it
            async () => { await restoreCard(card); } // Redo: restore it (complicated, need helper)
            // Actually redo for add is just creating it again with same ID?
            // Let's implement restoreCard helper
        );
    }

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

// Internal helper to restore a card (for Undo of Delete)
async function restoreCard(card: Card, recordHistory = false) {
    // Logic same as addCard but with existing ID/Data
    setStore('cards', card.id, card);

    if (pglite) {
        await pglite.query(
            'INSERT INTO cards (id, title, list_id, pos, created_at) VALUES ($1, $2, $3, $4, $5)',
            [card.id, card.title, card.listId, card.pos, card.createdAt]
        );
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'EXECUTE_SQL',
            sql: 'INSERT INTO cards (id, title, list_id, pos, created_at) VALUES (?, ?, ?, ?, ?)',
            params: [card.id, card.title, card.listId, card.pos, card.createdAt],
            clientId,
        }));
    }
}


// Delete card
export async function deleteCard(cardId: string, recordHistory = true) {
    const card = store.cards[cardId];
    if (!card) return;

    // Record history
    if (recordHistory) {
        logAction(
            () => restoreCard(card), // Undo: restore
            () => deleteCard(cardId, false) // Redo: delete again
        );
    }

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

// Update card title
export async function updateCardTitle(cardId: string, title: string, recordHistory = true) {
    const card = store.cards[cardId];
    if (!card) return;

    const oldTitle = card.title;

    // Record history
    if (recordHistory) {
        logAction(
            () => updateCardTitle(cardId, oldTitle, false),
            () => updateCardTitle(cardId, title, false)
        );
    }

    // 1. Instant UI
    setStore('cards', cardId, 'title', title);

    try {
        // 2. Persist
        if (pglite) {
            await pglite.query('UPDATE cards SET title = $1 WHERE id = $2', [title, cardId]);
        }

        // 3. Sync
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'EXECUTE_SQL',
                sql: 'UPDATE cards SET title = ? WHERE id = ?',
                params: [title, cardId],
                clientId,
            }));
        }
    } catch (error) {
        console.error('Update card failed:', error);
        setStore('cards', cardId, 'title', oldTitle);
    }
}

// Add new list (Undo/Redo not implemented yet for lists to keep it simple)
export async function addList(title: string) {
    const id = genId();
    const pos = Object.values(store.lists).length;
    const list: List = { id, title, pos };

    // 1. Instant UI
    setStore('lists', id, list);

    try {
        // 2. Persist
        if (pglite) {
            await pglite.query(
                'INSERT INTO lists (id, title, pos) VALUES ($1, $2, $3)',
                [id, title, pos]
            );
        }

        // 3. Sync
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'EXECUTE_SQL',
                sql: 'INSERT INTO lists (id, title, pos) VALUES (?, ?, ?)',
                params: [id, title, pos],
                clientId,
            }));
        }
    } catch (error) {
        console.error('Add list failed:', error);
        setStore('lists', id, undefined!);
    }

    return id;
}

// Update list title
export async function updateListTitle(listId: string, title: string) {
    const list = store.lists[listId];
    if (!list) return;

    const oldTitle = list.title;

    // 1. Instant UI
    setStore('lists', listId, 'title', title);

    try {
        // 2. Persist
        if (pglite) {
            await pglite.query('UPDATE lists SET title = $1 WHERE id = $2', [title, listId]);
        }

        // 3. Sync
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'EXECUTE_SQL',
                sql: 'UPDATE lists SET title = ? WHERE id = ?',
                params: [title, listId],
                clientId,
            }));
        }
    } catch (error) {
        console.error('Update list failed:', error);
        setStore('lists', listId, 'title', oldTitle);
    }
}

// Delete list
export async function deleteList(listId: string) {
    const list = store.lists[listId];
    if (!list) return;

    // 1. Instant UI
    setStore('lists', listId, undefined!);

    // Also delete associated cards from UI
    const cardIds = Object.values(store.cards)
        .filter(c => c && c.listId === listId)
        .map(c => c.id);

    // Batch update cards to undefined
    setStore(produce(s => {
        if (s.lists[listId]) delete s.lists[listId];
        cardIds.forEach(id => {
            if (s.cards[id]) delete s.cards[id];
        });
    }));

    try {
        // 2. Persist
        if (pglite) {
            await pglite.tx(async (tx) => {
                await tx.query('DELETE FROM cards WHERE list_id = $1', [listId]);
                await tx.query('DELETE FROM lists WHERE id = $1', [listId]);
            });
        }

        // 3. Sync
        if (socket && socket.readyState === WebSocket.OPEN) {
            // Send two commands or one transaction?
            // SQLite in DO handles these sequentially, but ideally we should batch.
            // For now, we'll send two commands.
            socket.send(JSON.stringify({
                type: 'EXECUTE_SQL',
                sql: 'DELETE FROM cards WHERE list_id = ?',
                params: [listId],
                clientId,
            }));
            socket.send(JSON.stringify({
                type: 'EXECUTE_SQL',
                sql: 'DELETE FROM lists WHERE id = ?',
                params: [listId],
                clientId,
            }));
        }
    } catch (error) {
        console.error('Delete list failed:', error);
        // Simplistic rollback - reload page might be better here due to complexity
        // For MVP, we'll just log
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
