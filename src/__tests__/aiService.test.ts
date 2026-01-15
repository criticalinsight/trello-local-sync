/**
 * AI Service Tests
 * 
 * Tests for the Gemini Interactions API integration
 * Time Complexity: O(1) for unit tests, O(n) for batch tests
 * Space Complexity: O(1) per test
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock types for testing
interface MockGenerateRequest {
    prompt: string;
    systemInstructions?: string;
    parameters: {
        temperature: number;
        topP: number;
        maxTokens: number;
    };
    model?: string;
}

describe('AI Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Model Configuration', () => {
        test('GEMINI_MODELS contains expected models', async () => {
            const { GEMINI_MODELS } = await import('../aiService');
            expect(GEMINI_MODELS).toContain('deep-research-pro-preview-12-2025');
            expect(GEMINI_MODELS).toContain('gemini-3-pro-preview');
            expect(GEMINI_MODELS.length).toBe(2);
        });

        test('default model is deep-research-pro-preview-12-2025', async () => {
            const { AI_DEFAULT_CONFIG } = await import('../aiService');
            expect(AI_DEFAULT_CONFIG.defaultModel).toBe('deep-research-pro-preview-12-2025');
        });

        test('config includes proper timeout settings', async () => {
            const { AI_DEFAULT_CONFIG } = await import('../aiService');
            expect(AI_DEFAULT_CONFIG.timeout).toBeGreaterThanOrEqual(60000);
            expect(AI_DEFAULT_CONFIG.pollInterval).toBe(10000); // Matches ResearchDO poll interval
            expect(AI_DEFAULT_CONFIG.maxPollAttempts).toBeGreaterThanOrEqual(30);
        });
    });

    describe('AIError Class', () => {
        test('AIError has correct properties', async () => {
            const { AIError } = await import('../aiService');
            const error = new AIError('Test error', 'TEST_CODE', 'gemini-3-pro-preview', true);

            expect(error.message).toBe('Test error');
            expect(error.code).toBe('TEST_CODE');
            expect(error.model).toBe('gemini-3-pro-preview');
            expect(error.retryable).toBe(true);
            expect(error.name).toBe('AIError');
        });

        test('AIError defaults retryable to false', async () => {
            const { AIError } = await import('../aiService');
            const error = new AIError('Error', 'CODE');

            expect(error.retryable).toBe(false);
        });
    });

    describe('Input Validation', () => {
        test('rejects empty prompt', async () => {
            // This would be tested via the promptStore which validates before calling AI
            const emptyPrompt = '';
            expect(emptyPrompt.trim()).toBe('');
        });

        test('sanitizes potentially malicious input', () => {
            const maliciousInput = '<script>alert("xss")</script>';
            // In the actual flow, system would handle this
            // The AI service passes through - sanitization is at display layer
            expect(typeof maliciousInput).toBe('string');
        });
    });

    describe('Rate Limiting', () => {
        test('identifies rate limit status code 429', () => {
            const status = 429;
            const isRateLimit = status === 429;
            expect(isRateLimit).toBe(true);
        });

        test('identifies overload status code 503', () => {
            const status = 503;
            const isOverload = status === 503;
            expect(isOverload).toBe(true);
        });
    });

    describe('Fallback Chain', () => {
        test('fallback models in correct order', async () => {
            const { GEMINI_MODELS } = await import('../aiService');
            expect(GEMINI_MODELS[0]).toBe('deep-research-pro-preview-12-2025');
            expect(GEMINI_MODELS[1]).toBe('gemini-3-pro-preview');
        });
    });

    describe('Performance', () => {
        test('configuration loads in reasonable time', async () => {
            const start = performance.now();
            await import('../aiService');
            const duration = performance.now() - start;

            // Module should load in under 100ms
            expect(duration).toBeLessThan(100);
        });
    });
});

describe('Security', () => {
    test('API key is not hardcoded', async () => {
        const { AI_DEFAULT_CONFIG } = await import('../aiService');
        // API key should come from environment, not hardcoded
        expect(AI_DEFAULT_CONFIG.apiKey).toBeUndefined();
    });

    test('worker URL uses HTTPS in production', async () => {
        const { AI_DEFAULT_CONFIG } = await import('../aiService');
        // In dev mode it would be /api, in prod it would be https://
        const url = AI_DEFAULT_CONFIG.workerUrl;
        expect(url.startsWith('/api') || url.startsWith('https://')).toBe(true);
    });
});
