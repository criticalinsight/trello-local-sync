
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { generateWithFallback } from '../aiService';
import { initMemoryStore, addMemory, getMemoriesForContext, memoryStore } from '../memoryStore';
import { PGlite } from '@electric-sql/pglite';

// Mock PGlite
vi.mock('@electric-sql/pglite', () => {
    return {
        PGlite: class {
            waitReady = Promise.resolve();
            query = vi.fn().mockResolvedValue({ rows: [] });
            exec = vi.fn().mockResolvedValue(undefined);
        }
    };
});

// Mock fetch for AI Service
global.fetch = vi.fn();

describe('Memory System Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should store and retrieve memories', async () => {
        // Initialize
        await initMemoryStore('test-board');

        // Add memory
        const id = await addMemory('project_name', 'Trello Sync', ['test']);
        expect(id).toBeDefined();

        // Verify in store state
        const stored = Object.values(memoryStore.nodes).find(m => m.key === 'project_name');
        expect(stored).toBeDefined();
        expect(stored?.value).toBe('Trello Sync');

        // Verify retrieval for context
        const context = getMemoriesForContext();
        expect(context).toContain('[MEMORY: project_name] Trello Sync');
    });

    test('should parse extracted memories from AI response', async () => {
        const mockResponse = {
            id: '123',
            outputs: [{
                text: 'Here is the plan.\n[MEMORY: user_role] Developer\n[MEMORY: framework] SolidJS'
            }]
        };

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockResponse)
        });

        const result = await generateWithFallback({
            prompt: 'Test prompt',
            parameters: { temperature: 0.7, topP: 0.9, maxTokens: 100 },
            systemInstructions: 'System',
            contextMemories: ''
        });

        expect(result.extractedMemories).toHaveLength(2);
        expect(result.extractedMemories).toEqual([
            { key: 'user_role', value: 'Developer' },
            { key: 'framework', value: 'SolidJS' }
        ]);
    });
});
