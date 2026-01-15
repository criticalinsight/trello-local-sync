import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
    initMemoryStore,
    addNode,
    addEdge,
    searchNodes,
    getMemoriesForContext,
    deleteNode,
    memoryStore
} from '../memoryStore';

// Mock PGlite
const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
const mockPglite = {
    query: mockQuery,
    waitReady: Promise.resolve(),
};

describe('MemoryStore (Relational Knowledge Graph)', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset store state manually for tests if needed, 
        // but initMemoryStore will handle most of it
        await initMemoryStore('test-board', mockPglite as any);
    });

    test('addNode stores a fact and updates state', async () => {
        const id = await addNode('user_role', 'Senior Developer', ['test']);

        expect(memoryStore.nodes[id]).toBeDefined();
        expect(memoryStore.nodes[id].key).toBe('user_role');
        expect(mockQuery).toHaveBeenCalled();
    });

    test('addEdge creates a relationship between nodes', async () => {
        const id1 = await addNode('node1', 'Value 1');
        const id2 = await addNode('node2', 'Value 2');

        const edgeId = await addEdge(id1, id2, 'related_to');

        expect(memoryStore.edges.length).toBe(1);
        expect(memoryStore.edges[0].sourceId).toBe(id1);
        expect(memoryStore.edges[0].targetId).toBe(id2);
        expect(memoryStore.edges[0].relation).toBe('related_to');
    });

    test('searchNodes finds relevant facts', async () => {
        await addNode('apple', 'A fruit');
        await addNode('banana', 'Another fruit');

        const results = searchNodes('apple');
        expect(results.length).toBe(1);
        expect(results[0].key).toBe('apple');
    });

    test('getMemoriesForContext builds context with relationship hints', async () => {
        const id1 = await addNode('A', 'Value A');
        const id2 = await addNode('B', 'Value B');
        await addEdge(id1, id2, 'links_to');

        const context = getMemoriesForContext();
        expect(context).toContain('[MEMORY: A] Value A');
        expect(context).toContain('(Related: links_to B)');
    });

    test('deleteNode removes node and associated edges', async () => {
        const id1 = await addNode('A', 'Value A');
        const id2 = await addNode('B', 'Value B');
        await addEdge(id1, id2, 'links_to');

        await deleteNode(id1);

        expect(memoryStore.nodes[id1]).toBeUndefined();
        expect(memoryStore.edges.length).toBe(0);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM nodes'), [id1]);
    });
});
