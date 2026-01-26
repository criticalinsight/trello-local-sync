import { PGlite } from '@electric-sql/pglite';
import { createStore, produce } from 'solid-js/store';

// ============= TYPES =============

export interface Node {
    id: string;
    key: string; // Unique key/topic
    value: string; // The fact/memory content
    tags: string[]; // Tags for categorization
    createdAt: number;
    updatedAt: number;
    usageCount: number;
}

export interface Edge {
    id: string;
    sourceId: string;
    targetId: string;
    relation: string; // e.g., 'related_to', 'part_of', 'defined_by'
    weight: number; // Strength of relationship
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
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL,
            usage_count INTEGER DEFAULT 0,
            UNIQUE(board_id, key)
        );
    `);

    // Create personae table
    await pglite.query(`
        CREATE TABLE IF NOT EXISTS personae (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            system_instructions TEXT NOT NULL,
            description TEXT,
            updated_at BIGINT NOT NULL
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
            created_at BIGINT NOT NULL,
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
        [currentBoardId],
    );

    // Load edges
    const edgesResult = await pglite.query<any>(
        `SELECT id, source_id, target_id, relation, weight, created_at 
         FROM edges WHERE board_id = $1`,
        [currentBoardId],
    );

    setMemoryStore(
        produce((s) => {
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

            s.edges = edgesResult.rows.map((row) => ({
                id: row.id,
                sourceId: row.source_id,
                targetId: row.target_id,
                relation: row.relation,
                weight: row.weight,
                createdAt: row.created_at,
            }));
        }),
    );
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
    setMemoryStore(
        produce((s) => {
            s.nodes[id] = node;
        }),
    );

    if (pglite) {
        await pglite.query(
            `INSERT INTO nodes (id, key, value, tags, board_id, created_at, updated_at, usage_count)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT(board_id, key) DO UPDATE SET
             value = EXCLUDED.value,
             tags = EXCLUDED.tags,
             updated_at = EXCLUDED.updated_at`,
            [id, node.key, node.value, JSON.stringify(tags), currentBoardId, now, now, 0],
        );
    }

    return id;
}

// Legacy alias
export const addMemory = addNode;

export async function updateNode(id: string, updates: Partial<Node>) {
    setMemoryStore(
        produce((s) => {
            if (s.nodes[id]) {
                Object.assign(s.nodes[id], { ...updates, updatedAt: Date.now() });
            }
        }),
    );

    if (pglite) {
        const node = memoryStore.nodes[id];
        if (node) {
            await pglite.query(
                `UPDATE nodes SET value = $1, tags = $2, updated_at = $3 WHERE id = $4`,
                [node.value, JSON.stringify(node.tags), node.updatedAt, id],
            );
        }
    }
}

// Legacy alias
export const updateMemory = updateNode;

export async function deleteNode(id: string) {
    setMemoryStore(
        produce((s) => {
            delete s.nodes[id];
            s.edges = s.edges.filter((e) => e.sourceId !== id && e.targetId !== id);
        }),
    );

    if (pglite) {
        await pglite.query(`DELETE FROM nodes WHERE id = $1`, [id]);
    }
}

// Legacy alias
export const deleteMemory = deleteNode;

export async function addEdge(
    sourceId: string,
    targetId: string,
    relation: string,
    weight = 1.0,
): Promise<string> {
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

    setMemoryStore(
        produce((s) => {
            s.edges.push(edge);
        }),
    );

    if (pglite) {
        await pglite.query(
            `INSERT INTO edges (id, source_id, target_id, relation, weight, board_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT(board_id, source_id, target_id, relation) DO UPDATE SET
             weight = EXCLUDED.weight`,
            [id, sourceId, targetId, relation, weight, currentBoardId, now],
        );
    }

    return id;
}

export async function incrementUsage(id: string) {
    if (pglite) {
        await pglite.query(`UPDATE nodes SET usage_count = usage_count + 1 WHERE id = $1`, [id]);
    }
}

// ============= SEARCH & CONTEXT =============

export function searchNodes(query: string): Node[] {
    const term = query.toLowerCase();
    return Object.values(memoryStore.nodes)
        .filter(
            (m) =>
                m.key.toLowerCase().includes(term) ||
                m.value.toLowerCase().includes(term) ||
                m.tags.some((t) => t.toLowerCase().includes(term)),
        )
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

// Legacy alias
export const searchMemories = searchNodes;

/**
 * Retrieves a context string for the AI, prioritizing recently updated and related nodes.
 * If a query is provided, it uses keyword matching and relationship traversal.
 *
 * Time Complexity (Query): O(N * K + E) where N = nodes, K = keywords, E = edges
 * Time Complexity (Default): O(N log N) for sorting
 * Space Complexity: O(N) for relationship traversal clusters
 */
export function getMemoriesForContext(limit = 10, query?: string): string {
    let targetNodes: Node[] = [];

    if (query && query.trim()) {
        const keywords = query
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter((k) => k.length > 2); // Filter out short stop-words

        if (keywords.length > 0) {
            // 1. Find directly matching nodes with scores
            const matches = Object.values(memoryStore.nodes)
                .map((node) => {
                    let baseScore = 0;
                    let keywordMatches = 0;
                    const nodeText =
                        `${node.key} ${node.value} ${node.tags.join(' ')}`.toLowerCase();

                    for (const kw of keywords) {
                        let matched = false;
                        if (nodeText.includes(kw)) {
                            baseScore += 1;
                            matched = true;
                        }
                        if (node.key.toLowerCase().includes(kw)) {
                            baseScore += 4;
                            matched = true;
                        }
                        if (matched) keywordMatches++;
                    }

                    // Square the keywordMatches to heavily favor nodes matching multiple terms
                    const finalScore = baseScore * (keywordMatches * keywordMatches);
                    return { node, score: finalScore };
                })
                .filter((m) => m.score > 0)
                .sort((a, b) => b.score - a.score);

            if (matches.length > 0) {
                // Determine a threshold (favoring top results)
                const maxScore = matches[0].score;
                const threshold = Math.max(2, maxScore * 0.4);

                const highConfidenceMatches = matches.filter((m) => m.score >= threshold);

                // 2. Traversal: Find neighbors of high-confidence matches
                const clusters = new Set<string>();
                for (const match of highConfidenceMatches) {
                    clusters.add(match.node.id);

                    // Add first-degree connections
                    const relatedIds = memoryStore.edges
                        .filter((e) => e.sourceId === match.node.id || e.targetId === match.node.id)
                        .map((e) => (e.sourceId === match.node.id ? e.targetId : e.sourceId));

                    for (const id of relatedIds) clusters.add(id);
                }

                // 3. Final collection, sorted by recency among the relevant set
                targetNodes = Array.from(clusters)
                    .map((id) => memoryStore.nodes[id])
                    .filter(Boolean)
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .slice(0, limit);
            }
        }
    }

    // Default to most recent if no query or no matches
    if (targetNodes.length === 0) {
        targetNodes = Object.values(memoryStore.nodes)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, limit);
    }

    if (targetNodes.length === 0) return '';

    // Build context with simple relationship hints
    return targetNodes
        .map((node) => {
            const contextLine = `[MEMORY: ${node.key}] ${node.value}`;

            // Find related nodes
            const related = memoryStore.edges
                .filter((e) => e.sourceId === node.id || e.targetId === node.id)
                .map((e) => {
                    const otherId = e.sourceId === node.id ? e.targetId : e.sourceId;
                    const otherNode = memoryStore.nodes[otherId];
                    return otherNode ? `${e.relation} ${otherNode.key}` : null;
                })
                .filter(Boolean)
                .join(', ');

            return related ? `${contextLine} (Related: ${related})` : contextLine;
        })
        .join('\n');
}
// ============= PERSONA OPERATIONS =============

export async function getPersonae(): Promise<import('./types').Persona[]> {
    if (!pglite) return [];
    const res = await pglite.query<any>(`SELECT * FROM personae ORDER BY updated_at DESC`);
    return res.rows.map(row => ({
        id: row.id,
        name: row.name,
        systemInstructions: row.system_instructions,
        description: row.description,
        updatedAt: row.updated_at
    }));
}

export async function savePersona(persona: import('./types').Persona) {
    if (!pglite) return;
    await pglite.query(
        `INSERT INTO personae (id, name, system_instructions, description, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT(id) DO UPDATE SET
         name = EXCLUDED.name,
         system_instructions = EXCLUDED.system_instructions,
         description = EXCLUDED.description,
         updated_at = EXCLUDED.updated_at`,
        [persona.id, persona.name, persona.systemInstructions, persona.description, persona.updatedAt]
    );
}

export async function deletePersona(id: string) {
    if (!pglite) return;
    await pglite.query(`DELETE FROM personae WHERE id = $1`, [id]);
}
