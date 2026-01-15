/**
 * @fileoverview AI Service - Gemini Interactions API Integration
 * 
 * Provides a client for the Gemini Interactions API via Cloudflare Worker proxy.
 * Supports multiple models with automatic fallback on rate limiting.
 * 
 * @module aiService
 * @version 1.0.0
 * @author Gemini Ops
 * 
 * Time Complexity: O(n) where n = number of models in fallback chain (typically 2)
 * Space Complexity: O(1) - no significant memory allocation
 */

import type { PromptParameters } from './types';

// ============= CONSTANTS =============

/** Available Gemini models in priority order */
export const GEMINI_MODELS = [
    'deep-research-pro-preview-12-2025', // Agent model (requires background mode)
    'gemini-3-pro-preview',               // Standard model (sync)
] as const;

/** Type for supported Gemini model identifiers */
export type GeminiModel = typeof GEMINI_MODELS[number];

/** HTTP status codes for error handling */
const HTTP_STATUS = {
    RATE_LIMIT: 429,
    SERVICE_UNAVAILABLE: 503,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
} as const;

/** Model configuration - determines sync vs background execution */
const MODEL_CONFIG: Readonly<Record<GeminiModel, { isAgent: boolean; requiresBackground: boolean }>> = {
    'deep-research-pro-preview-12-2025': { isAgent: true, requiresBackground: true },
    'gemini-3-pro-preview': { isAgent: false, requiresBackground: false },
};

// ============= CONFIGURATION =============

/**
 * AI Service configuration interface
 * @interface AIConfig
 */
export interface AIConfig {
    /** Worker proxy URL endpoint */
    workerUrl: string;
    /** Optional API key for direct authentication */
    apiKey?: string;
    /** Default model to use if none specified */
    defaultModel: GeminiModel;
    /** Whether to try fallback models on failure */
    enableFallback: boolean;
    /** Request timeout in milliseconds */
    timeout: number;
    /** Polling interval for background jobs (ms) */
    pollInterval: number;
    /** Maximum poll attempts before timeout */
    maxPollAttempts: number;
}

const DEFAULT_CONFIG: AIConfig = {
    workerUrl: import.meta.env.VITE_AI_WORKER_URL ||
        (import.meta.env.PROD ? 'https://work.moecapital.com/api/ai/interact' : '/api/ai/interact'),
    apiKey: import.meta.env.VITE_GEMINI_API_KEY,
    defaultModel: 'deep-research-pro-preview-12-2025',
    enableFallback: true,
    timeout: 60 * 60 * 1000, // 1 hour for deep research reports
    pollInterval: 10000, // Poll every 10 seconds (matches ResearchDO)
    maxPollAttempts: 360, // 360 * 10s = 1 hour of polling
};

let config: AIConfig = { ...DEFAULT_CONFIG };

/**
 * Updates AI service configuration
 * 
 * @param newConfig - Partial configuration to merge
 * 
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export function configureAI(newConfig: Partial<AIConfig>): void {
    config = { ...config, ...newConfig };
}

// Request/Response types
interface GenerateRequest {
    prompt: string;
    systemInstructions?: string;
    parameters: PromptParameters;
    model?: GeminiModel;
    contextMemories?: string;
}

interface GenerateResponse {
    content: string;
    model: GeminiModel;
    interactionId?: string;
    executionTime: number;
    extractedMemories?: Array<{ key: string; value: string }>;
    extractedRelations?: Array<{ sourceKey: string; relationType: string; targetKey: string }>;
}

interface InteractionRequest {
    model?: string;
    agent?: string;
    input: string;
    generationConfig?: {
        temperature?: number;
        topP?: number;
        maxOutputTokens?: number;
    };
}

// Error types
export class AIError extends Error {
    constructor(
        message: string,
        public code: string,
        public model?: GeminiModel,
        public retryable: boolean = false
    ) {
        super(message);
        this.name = 'AIError';
    }
}

// Main generation function with fallback
export async function generateWithFallback(
    request: GenerateRequest
): Promise<GenerateResponse> {
    const startModel = request.model || config.defaultModel;
    const startIndex = GEMINI_MODELS.indexOf(startModel);
    const modelsToTry = config.enableFallback
        ? GEMINI_MODELS.slice(startIndex)
        : [startModel];

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
        try {
            console.log(`[AI] Attempting with ${model}...`);
            const modelConfig = MODEL_CONFIG[model];
            const result = await generateWithModel(model, request, modelConfig);
            console.log(`[AI] Success with ${model}`);
            return result;
        } catch (error) {
            lastError = error as Error;
            console.warn(`[AI] ${model} failed:`, error);
            if (error instanceof AIError && !error.retryable) {
                throw error;
            }
        }
    }

    throw lastError || new AIError('All models failed', 'ALL_MODELS_FAILED');
}

// Helper to extract memories from content
function parseMemories(content: string): Array<{ key: string; value: string }> {
    const memories: Array<{ key: string; value: string }> = [];
    const regex = /\[MEMORY:\s*([^\]]+)\]\s*([^\n]+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        if (match[1] && match[2]) {
            memories.push({ key: match[1].trim(), value: match[2].trim() });
        }
    }
    return memories;
}

// Helper to extract relations from content
function parseRelations(content: string): Array<{ sourceKey: string; relationType: string; targetKey: string }> {
    const relations: Array<{ sourceKey: string; relationType: string; targetKey: string }> = [];
    const regex = /\[RELATION:\s*([^ ]+)\s*->\s*([^ ]+)\s*->\s*([^\]]+)\]/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        if (match[1] && match[2] && match[3]) {
            relations.push({
                sourceKey: match[1].trim(),
                relationType: match[2].trim(),
                targetKey: match[3].trim()
            });
        }
    }
    return relations;
}

// Generate with a specific model
async function generateWithModel(
    model: GeminiModel,
    request: GenerateRequest,
    modelConfig: { isAgent: boolean; requiresBackground: boolean }
): Promise<GenerateResponse> {
    const startTime = Date.now();

    // Prepare system instruction with memory handling
    let systemInstruction = request.systemInstructions || '';

    // 1. Inject Context
    if (request.contextMemories) {
        systemInstruction += `\n\n=== RELEVANT CONTEXT ===\n${request.contextMemories}\nUse this context to inform your response.`;
    }

    // 2. Add Extraction Instruction
    systemInstruction += `\n\n=== MEMORY EXTRACTION ===
If the user provides important facts, preferences, or project details that should be remembered, 
output them at the END of your response in this format:
[MEMORY: key] value
[RELATION: source_key -> relation_type -> target_key] (Optional)

Example:
[MEMORY: user_role] Senior Developer
[MEMORY: project_goal] Build a local-first Kanban app
[RELATION: user_role -> owns -> project_goal]`;

    const payload: InteractionRequest = {
        input: request.prompt,
        // Note: generationConfig is NOT supported by Interactions API
    };

    // Use agent or model field based on model type
    if (modelConfig.isAgent) {
        payload.agent = model;
    } else {
        payload.model = model;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
        const response = await fetch(config.workerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorBody = await response.text();
            if (response.status === 429) {
                throw new AIError(`Rate limit for ${model}`, 'RATE_LIMIT', model, true);
            }
            if (response.status === 503) {
                throw new AIError(`${model} overloaded`, 'OVERLOADED', model, true);
            }
            throw new AIError(`Request failed: ${response.status} - ${errorBody}`, 'REQUEST_FAILED', model, response.status >= 500);
        }

        const data = await response.json() as {
            id?: string;
            jobId?: string;
            status?: string;
            outputs?: unknown[];
            text?: string;
        };

        // For agent models with async jobs, poll for completion
        if (modelConfig.requiresBackground && data.jobId && data.status === 'processing') {
            console.log(`[AI] Agent job started: ${data.jobId}, polling for completion...`);
            const result = await pollJobStatus(data.jobId, model, startTime);
            return result;
        }

        // For sync models, return immediately
        const executionTime = Date.now() - startTime;
        const content = extractContent(data);
        const extractedMemories = parseMemories(content);

        return {
            content,
            model,
            interactionId: data.id,
            executionTime,
            extractedMemories,
        };
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof AIError) throw error;
        if ((error as Error).name === 'AbortError') {
            throw new AIError(`Timeout for ${model}`, 'TIMEOUT', model, true);
        }
        throw new AIError(`Network error: ${(error as Error).message}`, 'NETWORK_ERROR', model, true);
    }
}

// Poll job status for async agent models
async function pollJobStatus(
    jobId: string,
    model: GeminiModel,
    startTime: number
): Promise<GenerateResponse> {
    const statusUrl = config.workerUrl.replace('/interact', `/status/${jobId}`);
    const maxPollTime = config.timeout;

    while (Date.now() - startTime < maxPollTime) {
        await new Promise(resolve => setTimeout(resolve, config.pollInterval));

        try {
            const response = await fetch(statusUrl);
            if (!response.ok) {
                console.warn(`[AI] Poll failed: ${response.status}`);
                continue;
            }

            const data = await response.json() as {
                status: string;
                text?: string;
                outputs?: unknown[];
                error?: string;
            };

            console.log(`[AI] Job ${jobId} status: ${data.status}`);

            if (data.status === 'completed') {
                const executionTime = Date.now() - startTime;
                const content = data.text || extractContent(data);
                const extractedMemories = parseMemories(content);

                return {
                    content,
                    model,
                    interactionId: jobId,
                    executionTime,
                    extractedMemories,
                };
            }

            if (data.status === 'failed') {
                throw new AIError(
                    data.error || 'Job failed',
                    'JOB_FAILED',
                    model,
                    false
                );
            }

            // Still processing, continue polling
        } catch (error) {
            if (error instanceof AIError) throw error;
            console.warn(`[AI] Poll error:`, error);
        }
    }

    throw new AIError(`Job ${jobId} timed out`, 'TIMEOUT', model, false);
}

// Extract content from Interactions API response
function extractContent(response: unknown): string {
    try {
        const r = response as {
            outputs?: Array<{ text?: string; content?: string }>;
            output?: { text?: string };
            text?: string;
            content?: string;
        };

        // Interactions API format
        if (r.outputs?.[0]?.text) return r.outputs[0].text;
        if (r.outputs?.[0]?.content) return r.outputs[0].content;
        if (r.output?.text) return r.output.text;
        if (r.text) return r.text;
        if (r.content) return String(r.content);

        // Fallback: look for any text field in outputs
        if (Array.isArray(r.outputs) && r.outputs.length > 0) {
            const first = r.outputs[0] as Record<string, unknown>;
            for (const key of Object.keys(first)) {
                if (typeof first[key] === 'string' && first[key]) {
                    return first[key] as string;
                }
            }
        }

        throw new Error('Unable to extract content');
    } catch {
        console.error('[AI] Failed to parse response:', response);
        throw new AIError('Invalid response format', 'PARSE_ERROR', undefined, false);
    }
}

// Simple generate function
export async function generate(
    prompt: string,
    systemInstructions?: string,
    parameters?: Partial<PromptParameters>
): Promise<string> {
    const defaultParams: PromptParameters = {
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 4096,
    };

    const result = await generateWithFallback({
        prompt: systemInstructions ? `${systemInstructions}\n\n${prompt}` : prompt,
        parameters: { ...defaultParams, ...parameters },
    });

    return result.content;
}

export { DEFAULT_CONFIG as AI_DEFAULT_CONFIG };

