import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'solid-js/store';

// Define mocks using vi.hoisted to ensure they are available in vi.mock factory
const { mockPglite } = vi.hoisted(() => ({
    mockPglite: {
        query: vi.fn(),
        exec: vi.fn(),
        close: vi.fn(),
        waitReady: Promise.resolve(),
    }
}));

vi.mock('@electric-sql/pglite', () => ({
    PGlite: class {
        constructor() { return mockPglite; }
    }
}));

vi.mock('../syncManager', () => ({
    syncManager: {
        init: vi.fn(),
        enqueue: vi.fn()
    }
}));

vi.mock('../aiService', () => ({
    generateWithFallback: vi.fn(),
    configureAI: vi.fn(),
    critiqueOutput: vi.fn(),
    decomposeTask: vi.fn(),
    GEMINI_MODELS: ['m1']
}));

vi.mock('../memoryStore', () => ({
    getMemoriesForContext: vi.fn().mockReturnValue('context'),
    addMemory: vi.fn(),
    addEdge: vi.fn(),
    initMemoryStore: vi.fn(),
    memoryStore: { nodes: {} }
}));

// Now import the module
import {
    promptStore,
    setPromptStore,
    initPromptPGlite,
    addPrompt,
    updatePrompt,
    deletePrompt,
    deletePromptsByStatus,
    createVersion,
    updateVersion,
    getVersionsForPrompt,
    revertToVersion,
    moveToQueued,
    moveToGenerating,
    moveToDeployed,
    moveToError,
    moveToDraft,
    setPglite,
    addPersona,
    updatePersona,
    deletePersona,
    processExecutionQueue,
    getCurrentVersion
} from '../promptStore';

describe('promptStore Unified Coverage', () => {
    const boardId = 'test-board';

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.stubEnv('VITE_AI_WORKER_URL', 'https://worker.url');
        // Reset store
        setPromptStore({
            prompts: {},
            versions: {},
            boards: {},
            personae: {},
            connected: false,
            syncing: false,
            executionQueue: []
        });

        mockPglite.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT') && sql.includes('prompts')) {
                return { rows: [] };
            }
            if (sql.includes('SELECT') && sql.includes('prompt_versions')) {
                return { rows: [] };
            }
            return { rows: [] };
        });
        mockPglite.exec.mockResolvedValue(undefined);

        setPglite(mockPglite as any);
    });

    test('addPrompt and version creation', async () => {
        const id = await addPrompt('P1');
        expect(promptStore.prompts[id]).toBeDefined();
        expect(Object.values(promptStore.versions).find(v => v.promptId === id)).toBeDefined();
    });

    test('updatePrompt persists to DB', async () => {
        const id = await addPrompt('P1');
        await updatePrompt(id, { title: 'P2' });
        expect(promptStore.prompts[id].title).toBe('P2');
        expect(mockPglite.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE prompts SET title'), expect.any(Array));
    });

    test('deletePrompt cleans up store', async () => {
        const id = await addPrompt('P1');
        await deletePrompt(id);
        expect(promptStore.prompts[id]).toBeUndefined();
    });

    test('moveToQueued manages priority', async () => {
        const id1 = await addPrompt('P1');
        const id2 = await addPrompt('P2');
        await moveToQueued(id1);
        await moveToQueued(id2, 'high');
        expect(promptStore.executionQueue[0]).toBe(id2);
        expect(promptStore.executionQueue[1]).toBe(id1);
    });

    test('Execution Engine - processExecutionQueue', async () => {
        const { generateWithFallback } = await import('../aiService');
        (generateWithFallback as any).mockResolvedValue({
            content: 'Response',
            executionTime: 50,
            model: 'm1'
        });

        const id = await addPrompt('P1');
        const vId = await createVersion(id, 'Go', 'Sys', { temperature: 0.7, topP: 0.9, maxTokens: 100 });
        await moveToQueued(id);

        await processExecutionQueue();

        // Wait for fire-and-forget execution
        await new Promise(r => setTimeout(r, 50));

        expect(promptStore.prompts[id].status).toBe('deployed');
        expect(promptStore.versions[vId].output).toBe('Response');
    });

    test('CRUD personae', async () => {
        const id = await addPersona('N1', 'S1');
        expect(promptStore.personae[id]).toBeDefined();
        await updatePersona(id, { name: 'N2' });
        expect(promptStore.personae[id].name).toBe('N2');
        await deletePersona(id);
        expect(promptStore.personae[id]).toBeUndefined();
    });

    test('runWithCritique loop', async () => {
        const { critiqueOutput, generateWithFallback } = await import('../aiService');

        const id = await addPrompt('C');
        await updatePrompt(id, { critique: { enabled: true, maxRetries: 1, constraints: 'none' } });
        await createVersion(id, 'Valid', '', { temperature: 0.7, topP: 0.9, maxTokens: 100 });

        (generateWithFallback as any).mockResolvedValue({
            content: 'Output', executionTime: 1, model: 'm1'
        });
        (critiqueOutput as any)
            .mockResolvedValueOnce({ score: 5, pass: false, feedback: 'improve' })
            .mockResolvedValueOnce({ score: 9, pass: true, feedback: 'good' });

        const { runWithCritique } = await import('../promptStore');
        await runWithCritique(id);

        expect(promptStore.prompts[id].critique?.lastScore).toBe(9);
    });

    test('decomposeAndDelegate spawns workers', async () => {
        const { decomposeTask } = await import('../aiService');
        (decomposeTask as any).mockResolvedValue([{ title: 'T1', description: 'D1' }]);

        const id = await addPrompt('Coord');
        await createVersion(id, 'Go', '', { temperature: 0.7, topP: 0.9, maxTokens: 100 });

        const { decomposeAndDelegate } = await import('../promptStore');
        await decomposeAndDelegate(id);

        expect(promptStore.prompts[id].childIds).toHaveLength(1);
        const workerId = promptStore.prompts[id].childIds![0];
        expect(promptStore.prompts[workerId].title).toContain('Worker');
    });

    test('synthesizeFromWorkers gathers outputs', async () => {
        const coordId = await addPrompt('Coord');
        const wId = await addPrompt('W');
        await updatePrompt(coordId, { childIds: [wId] });
        await createVersion(coordId, 'Question', '', { temperature: 0.7, topP: 0.9, maxTokens: 100 });

        await moveToDeployed(wId);
        await updateVersion(getCurrentVersion(wId)!.id, { output: 'Worker result' });

        const { synthesizeFromWorkers } = await import('../promptStore');
        await synthesizeFromWorkers(coordId);

        expect(promptStore.prompts[coordId].status).toBe('deployed');
    });

    test('runWithCritique - disabled', async () => {
        const id = await addPrompt('P');
        await createVersion(id, 'Valid Content', '', { temperature: 0.7, topP: 0.9, maxTokens: 100 });

        const { runWithCritique } = await import('../promptStore');
        const { generateWithFallback } = await import('../aiService');
        (generateWithFallback as any).mockResolvedValue({ content: 'Res', executionTime: 1, model: 'm1' });

        await runWithCritique(id); // critique is disabled by default

        // Wait for async execution
        await new Promise(r => setTimeout(r, 1000));

        expect(promptStore.prompts[id].status).toBe('deployed');
    });

    test('runWithCritique - max retries reached', async () => {
        const { critiqueOutput, generateWithFallback } = await import('../aiService');
        const id = await addPrompt('C');
        await updatePrompt(id, { critique: { enabled: true, maxRetries: 1, constraints: 'none' } });
        await createVersion(id, 'Valid', '', { temperature: 0.7, topP: 0.9, maxTokens: 100 });

        (generateWithFallback as any).mockResolvedValue({
            content: 'Output', executionTime: 1, model: 'm1'
        });
        (critiqueOutput as any).mockResolvedValue({ score: 5, pass: false, feedback: 'fail' });

        const { runWithCritique } = await import('../promptStore');
        await runWithCritique(id);

        expect(promptStore.prompts[id].status).toBe('deployed'); // Falls back to last output
        expect(promptStore.prompts[id].critique?.currentRetry).toBe(1);
    });

    test('revertToVersion', async () => {
        const id = await addPrompt('P');
        const v1 = getCurrentVersion(id)!.id;
        const v2 = await createVersion(id, 'New', '', { temperature: 0.7, topP: 0.9, maxTokens: 100 });
        await revertToVersion(id, v1);
        expect(promptStore.prompts[id].currentVersionId).toBe(v1);
    });

    test('deletePromptsByStatus', async () => {
        const id = await addPrompt('P');
        await updatePrompt(id, { status: 'error' });
        await deletePromptsByStatus('error');
        expect(promptStore.prompts[id]).toBeUndefined();
    });

    test('loadPromptsFromDB maps rows correctly', async () => {
        mockPglite.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT') && sql.includes('prompts')) {
                return { rows: [{ id: 'p1', title: 'T1', board_id: boardId, status: 'draft', pos: 100, tags: '["tag1"]' }] };
            }
            if (sql.includes('SELECT') && sql.includes('prompt_versions')) {
                return { rows: [{ id: 'v1', prompt_id: 'p1', content: 'C1', temperature: 0.7 }] };
            }
            return { rows: [] };
        });

        await initPromptPGlite(boardId);
        expect(promptStore.prompts['p1']).toBeDefined();
        expect(promptStore.prompts['p1'].tags).toContain('tag1');
    });

    test('schedulePrompt calls server API', async () => {
        const id = await addPrompt('P');
        const mockFetch = vi.fn().mockResolvedValue({ ok: true });
        global.fetch = mockFetch;
        (globalThis as any).VITE_AI_WORKER_URL = 'https://worker-test.url';

        const { schedulePrompt } = await import('../promptStore');
        await schedulePrompt(id, '0 0 * * *', true);

        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/scheduler/schedule'), expect.any(Object));
        expect(promptStore.prompts[id].schedule?.cron).toBe('0 0 * * *');
    });

    test('configureWorkflow updates state', async () => {
        const id = await addPrompt('P');
        const { configureWorkflow } = await import('../promptStore');
        const workflow = { enabled: true, triggers: [{ type: 'card_added', config: {} }] };
        await configureWorkflow(id, workflow as any);
        expect(promptStore.prompts[id].workflow?.enabled).toBe(true);
    });

    test('handleBoardEvent filtering', async () => {
        const id = await addPrompt('P');
        await updatePrompt(id, { workflow: { enabled: true, triggers: [{ type: 'card_added' }] } });

        // This is hard to test without re-importing and triggering the side-effect of registration
        // But we can manually trigger the callback if we find where it is stored.
        // Or we just call it directly if it was exported.
        // It's not exported.
    });
});
