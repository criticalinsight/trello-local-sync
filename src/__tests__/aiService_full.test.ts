import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as aiService from '../aiService';

describe('AI Service Full Coverage', () => {
    const mockFetch = vi.fn();

    beforeEach(async () => {
        vi.clearAllMocks();
        mockFetch.mockReset(); // Reset mock calls and implementations
        global.fetch = mockFetch; // Re-assign global.fetch in beforeEach

        // Default success response for tests that don't override
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ outputs: [{ text: 'Default' }] }) // Adjusted to match expected output format
        });

        // Configure AI service with default settings for tests
        await aiService.configureAI({
            workerUrl: 'https://test.url/api/ai/interact', // Original URL
            apiKey: 'test-key',
            defaultModel: 'gemini-2.5-flash',
            enableFallback: true, // Original setting
            timeout: 1000,
            pollInterval: 10,
            maxPollAttempts: 10
        });
    });

    test('generateWithFallback retries and extraction', async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: false,
                status: 429,
                text: () => Promise.resolve('Rate limit')
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ outputs: [{ text: 'Done [MEMORY: k] v' }] })
            });

        const result = await aiService.generateWithFallback({
            prompt: 'test',
            parameters: { temperature: 0.7, topP: 0.9, maxTokens: 100 }
        });

        expect(result.content).toBe('Done [MEMORY: k] v');
        expect(result.extractedMemories).toEqual([{ key: 'k', value: 'v' }]);
    });

    test('critique and decomposition', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ text: '{"score": 9, "pass": true, "feedback": "ok"}' })
        });
        const c = await aiService.critiqueOutput('out');
        expect(c.pass).toBe(true);

        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ text: '[{"title": "t1", "description": "d1"}]' })
        });
        const d = await aiService.decomposeTask('task');
        expect(d[0].title).toBe('t1');
    });

    test('embedding', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ embedding: [1, 2, 3] })
        });
        const e = await aiService.getEmbedding('text');
        expect(e).toEqual([1, 2, 3]);
    });

    test('embedding error cases', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
        const e = await aiService.getEmbedding('text');
        expect(e).toEqual([]);

        mockFetch.mockRejectedValueOnce(new Error('Network fail'));
        const e2 = await aiService.getEmbedding('text');
        expect(e2).toEqual([]);
    });

    test('critique error cases', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ text: 'invalid json' }) });
        const c = await aiService.critiqueOutput('out');
        expect(c.pass).toBe(true); // default fallback

        mockFetch.mockRejectedValueOnce(new Error('Fail'));
        const c2 = await aiService.critiqueOutput('out');
        expect(c2.pass).toBe(true);
    });

    test('decomposition error cases', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ text: 'invalid json' }) });
        const d = await aiService.decomposeTask('task');
        expect(d).toHaveLength(1);

        mockFetch.mockRejectedValueOnce(new Error('Fail'));
        const d2 = await aiService.decomposeTask('task');
        expect(d2).toHaveLength(1);
    });

    test('extractContent error cases', async () => {
        // We can test this indirectly via generate if we mock response differently
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ something: 'else' })
        });
        await expect(aiService.generate('p')).rejects.toThrow('Invalid response format');
    });

    test('generate utility', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ text: 'Hello' })
        });
        const res = await aiService.generate('hi');
        expect(res).toBe('Hello');
    });

    test('generateWithFallback with job polling - completion', async () => {
        mockFetch
            .mockResolvedValueOnce({ // Initial call
                ok: true,
                json: () => Promise.resolve({ jobId: 'j1', status: 'processing' })
            })
            .mockResolvedValueOnce({ // Poll 1
                ok: true,
                json: () => Promise.resolve({ status: 'completed', text: 'Success' })
            });

        const res = await aiService.generateWithFallback({
            prompt: 'p',
            model: 'deep-research-pro-preview-12-2025', // Triggers polling
            parameters: { maxTokens: 100 }
        });
        expect(res.content).toBe('Success');
    });

    test('generateWithFallback with job polling - failure', async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true, json: () => Promise.resolve({ jobId: 'j1', status: 'processing' })
            })
            .mockResolvedValueOnce({
                ok: true, json: () => Promise.resolve({ status: 'failed', error: 'Crashed' })
            });

        await expect(aiService.generateWithFallback({
            prompt: 'p',
            model: 'deep-research-pro-preview-12-2025',
            parameters: { maxTokens: 100 }
        })).rejects.toThrow('Crashed');
    });

    test('generateWithFallback fails on 400 without fallback', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: () => Promise.resolve('Bad Request')
        });

        await expect(aiService.generateWithFallback({
            prompt: 'p',
            parameters: { maxTokens: 10 }
        })).rejects.toThrow('Request failed: 400');
    });

    test('generateWithFallback retries internally then fails on 503', async () => {
        let callCount = 0;
        mockFetch.mockImplementation(() => {
            callCount++;
            if (callCount === 1) return Promise.resolve({ ok: false, status: 429, text: () => Promise.resolve('Rate') });
            if (callCount === 2) return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('Internal') });
            if (callCount === 3) return Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve('Overloaded') });
            return Promise.reject(new Error('Too many calls'));
        });

        await expect(aiService.generateWithFallback({
            prompt: 'p',
            parameters: { maxTokens: 10 }
        })).rejects.toThrow('gemini-2.5-flash overloaded');

        expect(callCount).toBe(3);
    });

    test('multimodal input handling', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ text: 'Seen file' })
        });

        await aiService.generate('p', 's', {
            files: [{ uri: 'gs://bug', mimeType: 'image/png' }]
        });

        const call = mockFetch.mock.calls[0];
        const body = JSON.parse(call[1].body);
        expect(body.input[1].file_data.file_uri).toBe('gs://bug');
    });
});
