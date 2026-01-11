import { createStore, produce } from 'solid-js/store';
import { PGlite } from '@electric-sql/pglite';
import type { Card, List, StoreState, SyncMessage } from './types';

// Initialize PGlite (Postgres WASM)
let pglite: PGlite | null = null;
let socket: WebSocket | null = null;
let clientId: string = '';

// Create reactive store with default lists for immediate render
export const [store, setStore] = createStore<StoreState>({
    lists: {},
    cards: {},
    comments: {}, // New comments state
    connected: false,
    syncing: false,
});

// Generate unique ID
const genId = () => crypto.randomUUID();

// Initialize PGlite database
async function initPGlite(boardId: string) {
    try {
        console.log('🔄 Initializing PGlite...');
        pglite = new PGlite('idb://trello-local');

        await pglite.exec(`
      CREATE TABLE IF NOT EXISTS lists (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        pos REAL NOT NULL,
        board_id TEXT
      );
      
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        list_id TEXT NOT NULL,
        pos REAL NOT NULL,
        created_at BIGINT NOT NULL,
        description TEXT,
        tags JSON,
        checklist JSON
      );
    `);

        // Migration: Add columns
        try {
            await pglite.exec(`
                ALTER TABLE cards ADD COLUMN IF NOT EXISTS description TEXT;
                ALTER TABLE cards ADD COLUMN IF NOT EXISTS tags JSON;
                ALTER TABLE cards ADD COLUMN IF NOT EXISTS checklist JSON;
                ALTER TABLE cards ADD COLUMN IF NOT EXISTS due_date BIGINT;
                ALTER TABLE lists ADD COLUMN IF NOT EXISTS board_id TEXT;
            `);
            // Default NULL board_id (legacy data) to 'default' if we are loading 'default' board
            // Or update all nulls to 'default' once
            await pglite.exec("UPDATE lists SET board_id = 'default' WHERE board_id IS NULL");

        } catch (e) { }

        // Load existing cards for this board
        // JOIN lists to filter cards by board_id? Or just load all cards and filter in memory?
        // Better: filtering in SQL.
        // We need lists first.

        const lists = await pglite.query<{ id: string; title: string; pos: number }>('SELECT id, title, pos FROM lists WHERE board_id = $1 ORDER BY pos', [boardId]);

        const listIds = lists.rows.map(l => l.id);

        let cards: any[] = [];
        if (listIds.length > 0) {
            // Parameterized IN clause is tricky, let's just get all cards for now or construct query string
            // Simplest for now: Get all cards where list_id IN (...)
            const placeholders = listIds.map((_, i) => '$' + (i + 1)).join(',');
            const result = await pglite.query<{
                id: string;
                title: string;
                list_id: string;
                pos: number;
                created_at: number;
                description?: string;
                tags?: string;
                checklist?: string;
                due_date?: number;
            }>(`SELECT * FROM cards WHERE list_id IN (${placeholders}) ORDER BY pos`, listIds);
            cards = result.rows;
        }

        setStore(produce((s) => {
            // Clear current state first? Or merge?
            // Since we are switching boards, we should likely clear or reset.
            const listMap: Record<string, List> = {};
            lists.forEach(l => listMap[l.id] = l);

            const cardMap: Record<string, Card> = {};
            cards.forEach(c => cardMap[c.id] = {
                ...c,
                tags: c.tags ? JSON.parse(c.tags as any) : [],
                checklist: c.checklist ? JSON.parse(c.checklist as any) : [],
                dueDate: (c as any).due_date
            });

            const commentMap: Record<string, Comment> = {};
            comments.forEach(c => commentMap[c.id] = {
                ...c,
                cardId: (c as any).card_id,
                createdAt: (c as any).created_at
            });

            s.lists = listMap;
            s.cards = cardMap;
            s.comments = commentMap;
        }));
        console.log(`✅ PGlite initialized for board ${boardId}`);
    } catch (error) {
        console.error('❌ PGlite initialization failed:', error);
    }
}

// Connect to Cloudflare Durable Object
function connectWebSocket(boardId: string) {
    try {
        if (socket) {
            socket.close();
        }

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
                        description: (card as any).description || '',
                        tags: typeof (card as any).tags === 'string' ? JSON.parse((card as any).tags) : (card.tags || []),
                        checklist: typeof (card as any).checklist === 'string' ? JSON.parse((card as any).checklist) : (card.checklist || []),
                        dueDate: (card as any).due_date || card.dueDate,
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

// Update card details (description, tags, checklist)
export async function updateCardDetails(cardId: string, updates: Partial<Card>, recordHistory = true) {
    const card = store.cards[cardId];
    if (!card) return;

    const oldCard = { ...card };

    // Record history
    if (recordHistory) {
        logAction(
            () => updateCardDetails(cardId, oldCard, false),
            () => updateCardDetails(cardId, updates, false)
        );
    }

    // 1. Instant UI
    setStore('cards', cardId, updates);

    try {
        // Prepare arrays for batch update if needed
        const keys = [];
        const values = [];
        const setClauses = [];

        if (updates.description !== undefined) {
            setClauses.push('description = $' + (values.length + 1));
            values.push(updates.description);
        }
        if (updates.tags !== undefined) {
            setClauses.push('tags = $' + (values.length + 1));
            values.push(JSON.stringify(updates.tags));
        }
        if (updates.checklist !== undefined) {
            setClauses.push('checklist = $' + (values.length + 1));
            values.push(JSON.stringify(updates.checklist));
        }
        if (updates.dueDate !== undefined) {
            setClauses.push('due_date = $' + (values.length + 1));
            // Treat 0 as null for clearing
            values.push(updates.dueDate === 0 ? null : updates.dueDate);
        }

        if (setClauses.length === 0) return;

        const sql = `UPDATE cards SET ${setClauses.join(', ')} WHERE id = $${values.length + 1}`;
        const params = [...values, cardId];

        // 2. Persist
        if (pglite) {
            await pglite.query(sql, params);
        }

        // 3. Sync
        if (socket && socket.readyState === WebSocket.OPEN) {
            // Convert $1 to ? for sync (assuming common format or handling in DO)
            const syncSql = `UPDATE cards SET ${setClauses.map(c => c.split('=')[0] + '= ?').join(', ')} WHERE id = ?`;
            socket.send(JSON.stringify({
                type: 'EXECUTE_SQL',
                sql: syncSql,
                params: params,
                clientId,
            }));
        }
    } catch (error) {
        console.error('Update card details failed:', error);
        setStore('cards', cardId, oldCard);
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
            setStore('lists', listId, 'pos', newPos);

            // Rebalance client-side immediately for smoother feel?
            // Actually, let's just update and let CSS handle order if we use flex order or sort.
            // Board.tsx sorts by pos.

            try {
                // 2. Persist
                if (pglite) {
                    await pglite.query('UPDATE lists SET pos = $1 WHERE id = $2', [newPos, listId]);
                }

                // 3. Sync
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        type: 'EXECUTE_SQL',
                        sql: 'UPDATE lists SET pos = ? WHERE id = ?',
                        params: [newPos, listId],
                        clientId,
                    }));
                }
            } catch (error) {
                console.error('Move list failed:', error);
                setStore('lists', listId, 'pos', oldPos);
            }
        }
        // Global variable to track current board
        let currentBoardId = 'default';

        // Initialize
        export async function initStore(boardId: string) {
            console.log(`🚀 Starting store initialization for board: ${boardId}`);
            currentBoardId = boardId;

            // Reset store
            setStore({
                lists: {},
                cards: {},
                connected: false,
                syncing: false
            });

            // PGlite init runs in background
            await initPGlite(boardId);

            // Connect WS
            if (import.meta.env.PROD) {
                connectWebSocket(boardId);
            } else {
                // Dev: still connect if you want to test sync locally?
                // Ideally yes.
                connectWebSocket(boardId);
            }
            console.log('✅ Store ready');
        }

        // Export store for components
        export { store };
