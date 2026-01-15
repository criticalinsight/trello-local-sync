import { PGlite } from '@electric-sql/pglite';
import { createStore, produce } from 'solid-js/store';

// ============= TYPES =============

export interface Node {
    id: string;
    key: string;       // Unique key/topic
    value: string;     // The fact/memory content
    tags: string[];    // Tags for categorization
    createdAt: number;
    updatedAt: number;
    usageCount: number;
}

export interface Edge {
    id: string;
    sourceId: string;
    targetId: string;
    relation: string;  // e.g., 'related_to', 'part_of', 'defined_by'
    weight: number;    // Strength of relationship
    createdAt: number;
}

export interface MemoryStoreState {
    nodes: Record<string, Node>;
    edges: Edge[];
    initialized: boolean;
}

// ============= STATE =============

export const [memoryStore, setMemoryStore] = createStore<MemoryStoreState>({
    nodes: {},
    edges: [],
    initialized: false,
});

let pglite: PGlite | null = null;
let currentBoardId: string = '';

// ============= INITIALIZATION =============

export async function initMemoryStore(boardId: string, pgliteInstance?: PGlite) {
    currentBoardId = boardId;

    if (pgliteInstance) {
        pglite = pgliteInstance;
    } else {
        // Fallback or standalone initialization if needed
        pglite = new PGlite(`idb://prompt-board-${boardId}`);
        await pglite.waitReady;
    }

    // Create nodes table (migrating from memories if exists)
    await pglite.query(`
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            tags TEXT NOT NULL, -- JSON array
            board_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            usage_count INTEGER DEFAULT 0,
            UNIQUE(board_id, key)
        );
    `);

    // Create edges table
    await pglite.query(`
        CREATE TABLE IF NOT EXISTS edges (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            relation TEXT NOT NULL,
            weight REAL DEFAULT 1.0,
            board_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            UNIQUE(board_id, source_id, target_id, relation)
        );
    `);

    // Migration logic: if old memories table exists, move data to nodes
    try {
        const tableCheck = await pglite.query(`SELECT 1 FROM memories LIMIT 1;`);
        if (tableCheck.rows.length >= 0) {
            console.log('[Memory] Migrating legacy memories to nodes...');
            await pglite.query(`
                INSERT INTO nodes (id, key, value, tags, board_id, created_at, updated_at, usage_count)
                SELECT id, key, value, tags, board_id, created_at, updated_at, usage_count
                FROM memories
                ON CONFLICT DO NOTHING;
            `);
            await pglite.query(`DROP TABLE IF EXISTS memories;`);
        }
    } catch (e) {
        // Table probably doesn't exist, which is fine
    }

    await loadMemories();

    setMemoryStore('initialized', true);
}

async function loadMemories() {
    if (!pglite) return;

    // Load nodes
    const nodesResult = await pglite.query<any>(
        `SELECT id, key, value, tags, created_at, updated_at, usage_count 
         FROM nodes WHERE board_id = $1 ORDER BY updated_at DESC`,
        [currentBoardId]
    );

    // Load edges
    const edgesResult = await pglite.query<any>(
        `SELECT id, source_id, target_id, relation, weight, created_at 
         FROM edges WHERE board_id = $1`,
        [currentBoardId]
    );

    setMemoryStore(produce((s) => {
        s.nodes = {};
        for (const row of nodesResult.rows) {
            s.nodes[row.id] = {
                id: row.id,
                key: row.key,
                value: row.value,
                tags: JSON.parse(row.tags),
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                usageCount: row.usage_count,
            };
        }

        s.edges = edgesResult.rows.map(row => ({
            id: row.id,
            sourceId: row.source_id,
            targetId: row.target_id,
            relation: row.relation,
            weight: row.weight,
            createdAt: row.created_at,
        }));
    }));
}

// ============= CRUD OPERATIONS =============

export async function addNode(key: string, value: string, tags: string[] = []): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();

    const node: Node = {
        id,
        key: key.trim(),
        value: value.trim(),
        tags,
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
    };

    // Optimistic update
    setMemoryStore(produce((s) => {
        s.nodes[id] = node;
    }));

    if (pglite) {
        await pglite.query(
            `INSERT INTO nodes (id, key, value, tags, board_id, created_at, updated_at, usage_count)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT(board_id, key) DO UPDATE SET
             value = EXCLUDED.value,
             tags = EXCLUDED.tags,
             updated_at = EXCLUDED.updated_at`,
            [id, node.key, node.value, JSON.stringify(tags), currentBoardId, now, now, 0]
        );
    }

    return id;
}

// Legacy alias
export const addMemory = addNode;

export async function updateNode(id: string, updates: Partial<Node>) {
    setMemoryStore(produce((s) => {
        if (s.nodes[id]) {
            Object.assign(s.nodes[id], { ...updates, updatedAt: Date.now() });
        }
    }));

    if (pglite) {
        const node = memoryStore.nodes[id];
        if (node) {
            await pglite.query(
                `UPDATE nodes SET value = $1, tags = $2, updated_at = $3 WHERE id = $4`,
                [node.value, JSON.stringify(node.tags), node.updatedAt, id]
            );
        }
    }
}

// Legacy alias
export const updateMemory = updateNode;

export async function deleteNode(id: string) {
    setMemoryStore(produce((s) => {
        delete s.nodes[id];
        s.edges = s.edges.filter(e => e.sourceId !== id && e.targetId !== id);
    }));

    if (pglite) {
        await pglite.query(`DELETE FROM nodes WHERE id = $1`, [id]);
    }
}

// Legacy alias
export const deleteMemory = deleteNode;

export async function addEdge(sourceId: string, targetId: string, relation: string, weight = 1.0): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();

    const edge: Edge = {
        id,
        sourceId,
        targetId,
        relation,
        weight,
        createdAt: now,
    };

    setMemoryStore(produce((s) => {
        s.edges.push(edge);
    }));

    if (pglite) {
        await pglite.query(
            `INSERT INTO edges (id, source_id, target_id, relation, weight, board_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT(board_id, source_id, target_id, relation) DO UPDATE SET
             weight = EXCLUDED.weight`,
            [id, sourceId, targetId, relation, weight, currentBoardId, now]
        );
    }

    return id;
}

export async function incrementUsage(id: string) {
    if (pglite) {
        await pglite.query(
            `UPDATE nodes SET usage_count = usage_count + 1 WHERE id = $1`,
            [id]
        );
    }
}

// ============= SEARCH =============

export function searchMemories(query: string): Memory[] {
    const term = query.toLowerCase();
    return Object.values(memoryStore.memories)
        .filter(m =>
            m.key.toLowerCase().includes(term) ||
            m.value.toLowerCase().includes(term) ||
            m.tags.some(t => t.toLowerCase().includes(term))
        )
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getMemoriesForContext(limit = 10): string {
    // Simple strategy: return mostly recently used/updated memories
    // In future: use embeddings for semantic relevance
    const topMemories = Object.values(memoryStore.memories)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit);

    if (topMemories.length === 0) return '';

    return topMemories
        .map(m => `[MEMORY: ${m.key}] ${m.value}`)
        .join('\n');
}
