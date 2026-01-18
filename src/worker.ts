// Worker entry point for Cloudflare
export { BoardDO } from './BoardDO';
export { ResearchDO } from './ResearchDO';
import { handleTelegramWebhook, registerWebhook } from './telegramBot';

export const APP_VERSION = '1.0.1';
export const STARTUP_TIME = new Date().toISOString();

// Model configuration for Interactions API
const GEMINI_MODELS = [
    'deep-research-pro-preview-12-2025', // Agent (background mode)
    'gemini-3-pro-preview', // Standard Pro (sync)
    'gemini-3-flash', // Fast Flash (sync)
    'gemini-2.5-pro', // Stable Pro (sync)
    'gemini-2.5-flash', // Stable Flash (sync) - highest free tier limits
] as const;

type GeminiModel = (typeof GEMINI_MODELS)[number];

const MODEL_CONFIG: Record<GeminiModel, { isAgent: boolean; requiresBackground: boolean }> = {
    'deep-research-pro-preview-12-2025': { isAgent: true, requiresBackground: true },
    'gemini-3-pro-preview': { isAgent: false, requiresBackground: false },
    'gemini-3-flash': { isAgent: false, requiresBackground: false },
    'gemini-2.5-pro': { isAgent: false, requiresBackground: false },
    'gemini-2.5-flash': { isAgent: false, requiresBackground: false },
};

import { Env } from './types';

interface InteractionRequest {
    model?: string;
    agent?: string;
    input: string | Record<string, unknown>[];
    background?: boolean;
    previous_interaction_id?: string;
    tools?: Array<Record<string, unknown>>;
    response_format?: Record<string, unknown>;
    generationConfig?: {
        temperature?: number;
        topP?: number;
        maxOutputTokens?: number;
        thinking_level?: 'minimal' | 'low' | 'medium' | 'high';
        thinking_summaries?: 'auto' | 'none';
    };
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Interactions API Route: POST /api/ai/interact
        if (
            request.method === 'POST' &&
            (url.pathname === '/api/ai/interact' || url.pathname === '/api/ai/generate')
        ) {
            try {
                const body = (await request.json()) as InteractionRequest;
                const requestedModel = (body.model ||
                    body.agent ||
                    GEMINI_MODELS[0]) as GeminiModel;
                const config = MODEL_CONFIG[requestedModel];

                // Helper function to try fallback chain
                const tryFallbackChain = async (startModel: GeminiModel, initialError: Error) => {
                    const fallbackChain: GeminiModel[] = [
                        'gemini-3-pro-preview',
                        'gemini-3-flash',
                        'gemini-2.5-pro',
                        'gemini-2.5-flash',
                    ];

                    let currentError = initialError;

                    // Find where to start in the chain (after the failed model)
                    let startIndex = fallbackChain.indexOf(startModel);
                    if (startIndex === -1 && startModel === 'deep-research-pro-preview-12-2025') {
                        startIndex = -1; // Start at beginning (index 0)
                    } else if (startIndex === -1) {
                        // Model not in chain, start at beginning
                        startIndex = -1;
                    }


                    for (let i = startIndex + 1; i < fallbackChain.length; i++) {
                        const fallbackModel = fallbackChain[i];
                        console.log(`[Worker] Falling back to ${fallbackModel}`);

                        try {
                            const result = await callInteractionsAPI(
                                env.GEMINI_API_KEY,
                                fallbackModel,
                                body,
                            );

                            return new Response(JSON.stringify(result), {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-Model-Used': fallbackModel,
                                    'X-Fallback-Reason': 'rate_limited',
                                    ...corsHeaders,
                                },
                            });
                        } catch (err) {
                            const errorMsg = (err as Error).message;
                            if (
                                errorMsg.includes('429') ||
                                errorMsg.includes('503') ||
                                errorMsg.includes('RESOURCE_EXHAUSTED') ||
                                errorMsg.includes('400') ||
                                errorMsg.includes('404')
                            ) {
                                currentError = err as Error;
                                continue; // Try next model in chain
                            }
                            throw err; // Non-rate-limit error
                        }
                    }
                    throw currentError; // All fallbacks failed
                };

                // For agent models, use ResearchDO for async processing
                if (config?.requiresBackground) {
                    try {
                        const jobId = crypto.randomUUID();
                        const doId = env.RESEARCH_DO.idFromName(jobId);
                        const stub = env.RESEARCH_DO.get(doId);

                        const doResponse = await stub.fetch('http://do/start', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ input: body.input, jobId }),
                        });

                        if (!doResponse.ok) {
                            const errorText = await doResponse.text();
                            if (
                                errorText.includes('429') ||
                                errorText.includes('503') ||
                                errorText.includes('RESOURCE_EXHAUSTED')
                            ) {
                                console.log('[Worker] Agent rate limited, starting fallback chain');
                                throw new Error('FALLBACK_TO_SYNC');
                            }
                            throw new Error(errorText);
                        }

                        const result = await doResponse.json();
                        return new Response(JSON.stringify(result), {
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Model-Used': requestedModel,
                                ...corsHeaders,
                            },
                        });
                    } catch (agentError) {
                        const errorMsg = (agentError as Error).message;
                        if (
                            errorMsg === 'FALLBACK_TO_SYNC' ||
                            errorMsg.includes('429') ||
                            errorMsg.includes('503') ||
                            errorMsg.includes('RESOURCE_EXHAUSTED')
                        ) {
                            return await tryFallbackChain(requestedModel, agentError as Error);
                        }
                        throw agentError;
                    }
                }

                // For standard models, use sync call with fallback
                try {
                    const result = await callInteractionsAPI(
                        env.GEMINI_API_KEY,
                        requestedModel,
                        body,
                    );
                    return new Response(JSON.stringify(result), {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Model-Used': requestedModel,
                            ...corsHeaders,
                        },
                    });
                } catch (syncError) {
                    const errorMsg = (syncError as Error).message;
                    if (
                        errorMsg.includes('429') ||
                        errorMsg.includes('503') ||
                        errorMsg.includes('RESOURCE_EXHAUSTED')
                    ) {
                        return await tryFallbackChain(requestedModel, syncError as Error);
                    }
                    throw syncError;
                }
            } catch (error) {
                console.error('[Worker] Error:', error);
                return new Response(JSON.stringify({ error: (error as Error).message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }
        }

        // Embedding Route: POST /api/ai/embedding
        if (request.method === 'POST' && url.pathname === '/api/ai/embedding') {
            try {
                const body = (await request.json()) as { text: string };
                if (!body.text) {
                    return new Response(JSON.stringify({ error: 'Missing text' }), { status: 400, headers: corsHeaders });
                }

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${env.GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: { parts: [{ text: body.text }] }
                        })
                    }
                );

                if (!response.ok) {
                    return new Response(await response.text(), { status: response.status, headers: corsHeaders });
                }

                const data = await response.json() as any;
                const embedding = data.embedding?.values || [];

                return new Response(JSON.stringify({ embedding }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });

            } catch (e) {
                return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
            }
        }

        // Telegram Webhook
        if (request.method === 'POST' && url.pathname === '/api/telegram/webhook') {
            return handleTelegramWebhook(request, env);
        }

        // Telegram Registration
        if (request.method === 'GET' && url.pathname === '/api/telegram/register') {
            return registerWebhook(env, url.host);
        }

        // Job Status Route: GET /api/ai/status/:jobId
        if (request.method === 'GET' && url.pathname.startsWith('/api/ai/status/')) {
            const jobId = url.pathname.split('/').pop();
            if (!jobId) {
                return new Response(JSON.stringify({ error: 'Missing job ID' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }

            const doId = env.RESEARCH_DO.idFromName(jobId);
            const stub = env.RESEARCH_DO.get(doId);

            const doResponse = await stub.fetch('http://do/status');
            const result = await doResponse.json();

            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // Version Route: GET /api/version
        if (request.method === 'GET' && url.pathname === '/api/version') {
            return new Response(JSON.stringify(getVersionInfo()), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // Gemini Files API Upload Proxy: POST /api/ai/upload_file
        if (request.method === 'POST' && url.pathname === '/api/ai/upload_file') {
            const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
            const contentLength = request.headers.get('Content-Length') || '0';
            const filename = url.searchParams.get('filename') || 'upload.bin';

            try {
                // Step 1: Initialize Resumable Upload
                const initResponse = await fetch(
                    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${env.GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: {
                            'X-Goog-Upload-Protocol': 'resumable',
                            'X-Goog-Upload-Command': 'start',
                            'X-Goog-Upload-Header-Content-Length': contentLength,
                            'X-Goog-Upload-Header-Content-Type': contentType,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ file: { display_name: filename } }),
                    },
                );

                if (!initResponse.ok) {
                    const errorText = await initResponse.text();
                    return new Response(`Upload init failed: ${errorText}`, { status: initResponse.status });
                }

                const uploadUrl = initResponse.headers.get('x-goog-upload-url');
                if (!uploadUrl) {
                    return new Response('Missing upload URL from Google', { status: 500 });
                }

                // Step 2: Stream content to Upload URL
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Length': contentLength,
                        'X-Goog-Upload-Offset': '0',
                        'X-Goog-Upload-Command': 'upload, finalize',
                    },
                    body: request.body, // Stream directory
                });

                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    return new Response(`Upload failed: ${errorText}`, { status: uploadResponse.status });
                }

                const result = await uploadResponse.json();
                return new Response(JSON.stringify(result), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            } catch (e) {
                return new Response(`Worker Error: ${(e as Error).message}`, { status: 500 });
            }
        }

        // Upload Route
        if (request.method === 'PUT' && url.pathname.startsWith('/api/upload/')) {
            const filename = url.pathname.split('/').pop();
            if (!filename) return new Response('Missing filename', { status: 400 });

            await env.MEDIA_BUCKET.put(filename, request.body, {
                httpMetadata: {
                    contentType: request.headers.get('Content-Type') || 'application/octet-stream',
                },
            });

            return new Response(JSON.stringify({ url: `/api/media/${filename}` }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // Media Route
        if (request.method === 'GET' && url.pathname.startsWith('/api/media/')) {
            const filename = url.pathname.split('/').pop();
            if (!filename) return new Response('Missing filename', { status: 400 });

            const object = await env.MEDIA_BUCKET.get(filename);
            if (!object) return new Response('Not found', { status: 404 });

            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);
            return new Response(object.body, { headers });
        }


        // Durable Object routes
        if (url.pathname.startsWith('/api') || request.headers.get('Upgrade') === 'websocket') {
            const boardId = url.searchParams.get('board') || 'default';
            const id = env.BOARD_DO.idFromName(boardId);
            const stub = env.BOARD_DO.get(id);
            return stub.fetch(request);
        }

        // Serve static assets with appropriate caching
        const response = await env.ASSETS.fetch(request);

        // if the asset fetch fails (404) and it's not an API route, fallback to index.html for SPA routing
        if (response.status === 404 && !url.pathname.startsWith('/api')) {
            const indexRequest = new Request(new URL('/', request.url).toString(), request);
            const indexResponse = await env.ASSETS.fetch(indexRequest);
            const headers = new Headers(indexResponse.headers);
            headers.set('Cache-Control', 'no-cache, must-revalidate');
            return new Response(indexResponse.body, {
                status: indexResponse.status,
                headers,
            });
        }

        // Add cache headers based on file type
        const responseUrl = new URL(request.url);
        const headers = new Headers(response.headers);

        // Hashed assets (e.g., index-abc123.js) can be cached forever
        if (responseUrl.pathname.match(/\.[a-f0-9]{8,}\.(js|css|wasm|data)$/)) {
            headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // HTML should always be revalidated to get latest version
        else if (responseUrl.pathname.endsWith('.html') || responseUrl.pathname === '/') {
            headers.set('Cache-Control', 'no-cache, must-revalidate');
        }
        // Other assets: short cache with revalidation
        else {
            headers.set('Cache-Control', 'public, max-age=3600, must-revalidate');
        }

        return new Response(response.body, {
            status: response.status,
            headers,
        });
    },

    // Handle Cron Triggers
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        // Iterate over all active boards (conceptually) or use a known list.
        // For this architecture, let's assume we check a primary board or all connected DOs.
        // Since listing DOs is hard without a registry, we might need a Registry DO.
        // Fallback: This is a demo, we'll try to tick a fixed set of "active" boards if known
        // or just log that the trigger fired.
        // Real implementation: Store list of board IDs with active schedules in KV or a Registry DO.

        console.log('[Worker] Cron Trigger fired:', event.cron, event.scheduledTime);

        // Example: Tick the 'default' board
        const id = env.BOARD_DO.idFromName('default');
        const stub = env.BOARD_DO.get(id);
        ctx.waitUntil(stub.fetch('http://do/api/scheduler/tick', { method: 'POST' }));
    },
};

export function getVersionInfo() {
    return {
        version: APP_VERSION,
        startupTime: STARTUP_TIME,
        environment: 'production' // Cloudflare Workers
    };
}

// Call Gemini Interactions API (sync models only - agent models use ResearchDO)
async function callInteractionsAPI(
    apiKey: string,
    model: GeminiModel,
    request: InteractionRequest,
): Promise<unknown> {
    const config = MODEL_CONFIG[model];
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/interactions';
    const MAX_TURNS = 5; // Prevent infinite loops

    let currentInput = request.input;
    let turnCount = 0;

    // Initial payload construction
    const basePayload: Record<string, unknown> = {};
    if (request.tools) basePayload.tools = request.tools;
    if (request.response_format) basePayload.response_format = request.response_format;
    if (request.previous_interaction_id) basePayload.previous_interaction_id = request.previous_interaction_id;
    if (request.generationConfig) basePayload.generation_config = request.generationConfig;

    if (config.isAgent) {
        basePayload.agent = model;
    } else {
        basePayload.model = model;
    }

    while (turnCount < MAX_TURNS) {
        const payload = { ...basePayload, input: currentInput };

        console.log(`[Worker] Turn ${turnCount + 1}: Calling API...`);
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as Record<string, unknown>;
        const outputs = data.outputs as Array<Record<string, unknown>> | undefined;

        // Check for function calls
        const functionCall = outputs?.find(o => o.type === 'function_call');

        if (functionCall) {
            const call = functionCall.function_call as { name: string; parameters: Record<string, unknown> };
            console.log(`[Worker] Tool Call Detected: ${call.name}`);

            let functionResult: Record<string, unknown> = {};

            // EXECUTE TOOL
            if (call.name === 'web_search') {
                const query = call.parameters.query as string;
                // Mock search for POC
                console.log(`[Worker] Executing Web Search: ${query}`);
                functionResult = {
                    content: `[Mock Search Result] Found 3 results for "${query}":
1. SolidJS v1.8.0 Released - Performance improvements and new hydration strategies.
2. SolidJS Docs: Signals are the cornerstone of reactivity.
3. Blog: Why SolidJS is faster than React in 2025.`,
                };
            } else {
                functionResult = { error: `Tool ${call.name} not found` };
            }

            // Prepare next turn input with function result
            currentInput = [
                // Original input is implicit in stateful session if interaction_id provided, 
                // but Interactions API might require just the result for the specific turn.
                // For stateless, we might need full history, but assuming interactions API handles state via ID?
                // The Interactions API documentation suggests sending the function result as the next 'input'.
                // If previous_interaction_id is returned, we use it.
                {
                    function_response: {
                        name: call.name,
                        response: functionResult
                    }
                }
            ];

            // Update interaction ID for continuity
            if (data.id && typeof data.id === 'string') {
                basePayload.previous_interaction_id = data.id;
            }

            turnCount++;
            continue; // Loop back to send tool output
        }

        // No tool call, return final response
        return formatInteractionResponse(data);
    }

    throw new Error('Max turns exceeded in tool loop');
}

// Format response to standard output
function formatInteractionResponse(data: Record<string, unknown>): Record<string, unknown> {
    const outputs = data.outputs as Array<Record<string, unknown>> | undefined;

    // Extract text from outputs
    let text = '';
    if (outputs && outputs.length > 0) {
        // Find the text part
        for (const output of outputs) {
            if (output.type === 'text' && typeof output.text === 'string') {
                text = output.text;
                break;
            }
            // Fallback for some models returning content field
            if (typeof output.content === 'string') {
                text = output.content;
                break;
            }
        }
    }

    return {
        ...data,
        text,
        outputs: outputs || [],
    };
}
