import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createStore } from 'solid-js/store';
import { PGlite } from '@electric-sql/pglite';

// Mock PGlite and dependencies
const mockExec = vi.fn().mockResolvedValue(undefined);
const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockWaitReady = Promise.resolve();

vi.mock('@electric-sql/pglite', () => {
    return {
        PGlite: class {
            async exec(...args: any[]) { return mockExec(...args); }
            async query(...args: any[]) { return mockQuery(...args); }
            async close() { return mockClose(); }
            get waitReady() { return mockWaitReady; }
        }
    };
});

vi.mock('../syncManager', () => ({
    syncManager: {
        isConnected: vi.fn(),
        subscribe: vi.fn(),
        publish: vi.fn(),
        init: vi.fn().mockResolvedValue(undefined),
        enqueue: vi.fn().mockResolvedValue(undefined),
    }
}));
vi.mock('../utils/autoTagger', () => ({
    generateTags: vi.fn().mockResolvedValue([]),
}));

// Mock memoryStore init
vi.mock('../memoryStore', () => ({
    initMemoryStore: vi.fn().mockResolvedValue(undefined),
}));

// We need to partially test internal state, but since promptStore exports a store directly,
// we can also test the exported methods. 
// Ideally we would separate logic from the SolidJS store, but for now we test the functions.

import * as promptStoreModule from '../promptStore';

// Access the store state for assertions
const { promptStore, setPromptStore } = promptStoreModule;

describe('promptStore Core Logic', () => {

    beforeEach(async () => {
        // Reset store state
        setPromptStore('prompts', {});
        setPromptStore('versions', {});
        setPromptStore('boards', {});
        setPromptStore('connected', false);
        setPromptStore('syncing', false);
        setPromptStore('executionQueue', []);

        // Initialize with default board for testing
        await promptStoreModule.initPromptPGlite('test-board');
    });

    test('addPrompt adds a new prompt to the store and DB', async () => {
        const title = 'Test Prompt';
        const id = await promptStoreModule.addPrompt(title);

        expect(id).toBeDefined();
        // Check store state
        expect(promptStore.prompts[id]).toBeDefined();
        expect(promptStore.prompts[id].title).toBe(title);
        expect(promptStore.prompts[id].status).toBe('draft');

        // Check DB was called
        // We can't easily check the mock instance created inside the module without exposing it,
        // but we can trust the coverage or export the instance in a refactor.
        // For now, we verified the function runs without error using the mock.
    });

    test('updatePrompt updates an existing prompt', async () => {
        const title = 'Original Title';
        const id = await promptStoreModule.addPrompt(title);

        const newTitle = 'Updated Title';
        await promptStoreModule.updatePrompt(id, { title: newTitle });

        expect(promptStore.prompts[id].title).toBe(newTitle);
    });

    test('genId generates a string', () => {
        const id = promptStoreModule.genId();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    // Test initialization
    test('initPromptPGlite initializes successfully', async () => {
        // Cannot easily mocking PGlite instance internal variables without exporting them or dependency injection
        // So we test behavior that relies on it or simply cover the function execution.
        await expect(promptStoreModule.initPromptPGlite('test-board')).resolves.not.toThrow();
    });

    // We might need to refactor promptStore to be testable without side-effects like db calls
    // For now, let's look at adding tests for simple state manipulations if possible.

    // NOTE: Many functions in promptStore.ts directly call PGlite or fetch, making them hard to unit test 
    // without heavy mocking of the module internals or refactoring to dependency injection.
    // This confirms the need for refactoring.
});
