import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

vi.mock('@electric-sql/pglite', () => ({
    PGlite: vi.fn().mockImplementation(() => ({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        waitReady: Promise.resolve(),
    })),
}));

import {
    initMemoryStore,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    getMemoriesForContext,
    searchNodes,
    incrementUsage,
    getPersonae,
    savePersona,
    deletePersona,
    memoryStore,
    setMemoryStore
} from '../memoryStore';

describe('memoryStore Full Coverage', () => {
    const mockPglite = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        waitReady: Promise.resolve(),
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        setMemoryStore({ nodes: {}, edges: [], initialized: false });
        await initMemoryStore('board', mockPglite as any);
    });

    test('CRUD operations', async () => {
        const id = await addNode('Key', 'Value', ['tag']);
        expect(memoryStore.nodes[id]).toBeDefined();
        await updateNode(id, { value: 'NewValue' });
        expect(memoryStore.nodes[id].value).toBe('NewValue');

        await addEdge(id, id, 'self');
        expect(memoryStore.edges).toHaveLength(1);

        await deleteNode(id);
        expect(memoryStore.nodes[id]).toBeUndefined();
        expect(memoryStore.edges).toHaveLength(0);
    });

    test('initMemoryStore loads nodes and edges', async () => {
        mockPglite.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT') && sql.includes('nodes')) {
                return { rows: [{ id: 'n1', key: 'K1', value: 'V1', tags: '["T1"]', created_at: 100, updated_at: 100, usage_count: 5 }] };
            }
            if (sql.includes('SELECT') && sql.includes('edges')) {
                return { rows: [{ id: 'e1', source_id: 'n1', target_id: 'n1', relation: 'rel', weight: 0.5, created_at: 100 }] };
            }
            return { rows: [] };
        });

        await initMemoryStore('board', mockPglite as any);
        expect(memoryStore.nodes['n1']).toBeDefined();
        expect(memoryStore.nodes['n1'].usageCount).toBe(5);
        expect(memoryStore.edges[0].relation).toBe('rel');
    });

    test('searchNodes handles tags', async () => {
        await addNode('Apple', 'fruit', ['healthy']);
        expect(searchNodes('healthy')).toHaveLength(1);
    });

    test('search and context', async () => {
        await addNode('Apple', 'fruit');
        await addNode('Rich Hickey', 'Clojure');

        expect(searchNodes('apple')).toHaveLength(1);
        expect(getMemoriesForContext(5, 'rich')).toContain('Rich');
    });

    test('persona operations', async () => {
        mockPglite.query.mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'N1', system_instructions: 'S1', updated_at: 1 }] });
        const p = await getPersonae();
        expect(p[0].name).toBe('N1');

        await savePersona({ id: 'p1', name: 'N2' } as any);
        await deletePersona('p1');
        expect(mockPglite.query).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['p1']);
    });

    test('increment usage', async () => {
        await incrementUsage('123');
        expect(mockPglite.query).toHaveBeenCalledWith(expect.stringContaining('usage_count + 1'), ['123']);
    });
});
