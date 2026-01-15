// Worker entry point for Cloudflare
export { BoardDO } from './BoardDO';
export { ResearchDO } from './ResearchDO';

// Model configuration for Interactions API
const GEMINI_MODELS = [
    'deep-research-pro-preview-12-2025', // Agent (background mode)
    'gemini-3-pro-preview',               // Standard (sync)
] as const;

type GeminiModel = typeof GEMINI_MODELS[number];

const MODEL_CONFIG: Record<GeminiModel, { isAgent: boolean; requiresBackground: boolean }> = {
    'deep-research-pro-preview-12-2025': { isAgent: true, requiresBackground: true },
    'gemini-3-pro-preview': { isAgent: false, requiresBackground: false },
};

interface Env {
    BOARD_DO: DurableObjectNamespace;
    RESEARCH_DO: DurableObjectNamespace;
    ASSETS: Fetcher;
    MEDIA_BUCKET: R2Bucket;
    GEMINI_API_KEY: string;
}

interface InteractionRequest {
    model?: string;
    agent?: string;
    input: string;
    background?: boolean;
    generationConfig?: {
        temperature?: number;
        topP?: number;
        maxOutputTokens?: number;
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
        if (request.method === 'POST' && (url.pathname === '/api/ai/interact' || url.pathname === '/api/ai/generate')) {
            try {
                const body = await request.json() as InteractionRequest;
                const requestedModel = (body.model || body.agent || GEMINI_MODELS[0]) as GeminiModel;
                const config = MODEL_CONFIG[requestedModel];

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
                            // Check for rate limit errors - fallback to sync model
                            if (errorText.includes('429') || errorText.includes('503') || errorText.includes('RESOURCE_EXHAUSTED')) {
                                console.log('[Worker] Agent rate limited, falling back to sync model');
                                throw new Error('FALLBACK_TO_SYNC');
                            }
                            throw new Error(errorText);
                        }

                        const result = await doResponse.json();
                        return new Response(JSON.stringify(result), {
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Model-Used': requestedModel,
                                ...corsHeaders
                            }
                        });
                    } catch (agentError) {
                        const errorMsg = (agentError as Error).message;
                        // Fallback to sync model on rate limits
                        if (errorMsg === 'FALLBACK_TO_SYNC' ||
                            errorMsg.includes('429') ||
                            errorMsg.includes('503') ||
                            errorMsg.includes('RESOURCE_EXHAUSTED')) {
                            console.log('[Worker] Falling back to gemini-3-pro-preview');
                            const fallbackModel = 'gemini-3-pro-preview' as GeminiModel;
                            const result = await callInteractionsAPI(env.GEMINI_API_KEY, fallbackModel, body);
                            return new Response(JSON.stringify(result), {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-Model-Used': fallbackModel,
                                    'X-Fallback-Reason': 'rate_limited',
                                    ...corsHeaders
                                }
                            });
                        }
                        throw agentError;
                    }
                }

                // For standard models, use sync call with fallback
                try {
                    const result = await callInteractionsAPI(env.GEMINI_API_KEY, requestedModel, body);
                    return new Response(JSON.stringify(result), {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Model-Used': requestedModel,
                            ...corsHeaders
                        }
                    });
                } catch (syncError) {
                    const errorMsg = (syncError as Error).message;
                    // Try fallback if not already on fallback model
                    if (requestedModel !== 'gemini-3-pro-preview' &&
                        (errorMsg.includes('429') || errorMsg.includes('503'))) {
                        console.log('[Worker] Sync model rate limited, trying fallback');
                        const fallbackModel = 'gemini-3-pro-preview' as GeminiModel;
                        const result = await callInteractionsAPI(env.GEMINI_API_KEY, fallbackModel, body);
                        return new Response(JSON.stringify(result), {
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Model-Used': fallbackModel,
                                'X-Fallback-Reason': 'rate_limited',
                                ...corsHeaders
                            }
                        });
                    }
                    throw syncError;
                }
            } catch (error) {
                console.error('[Worker] Error:', error);
                return new Response(JSON.stringify({ error: (error as Error).message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
        }

        // Job Status Route: GET /api/ai/status/:jobId
        if (request.method === 'GET' && url.pathname.startsWith('/api/ai/status/')) {
            const jobId = url.pathname.split('/').pop();
            if (!jobId) {
                return new Response(JSON.stringify({ error: 'Missing job ID' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            const doId = env.RESEARCH_DO.idFromName(jobId);
            const stub = env.RESEARCH_DO.get(doId);

            const doResponse = await stub.fetch('http://do/status');
            const result = await doResponse.json();

            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Upload Route
        if (request.method === 'PUT' && url.pathname.startsWith('/api/upload/')) {
            const filename = url.pathname.split('/').pop();
            if (!filename) return new Response('Missing filename', { status: 400 });

            await env.MEDIA_BUCKET.put(filename, request.body, {
                httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' }
            });

            return new Response(JSON.stringify({ url: `/api/media/${filename}` }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
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

        return env.ASSETS.fetch(request);
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
    }
};

// Call Gemini Interactions API (sync models only - agent models use ResearchDO)
async function callInteractionsAPI(
    apiKey: string,
    model: GeminiModel,
    request: InteractionRequest
): Promise<unknown> {
    const config = MODEL_CONFIG[model];
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/interactions';

    // Build request payload - Interactions API only supports 'input' and agent/model
    const payload: Record<string, unknown> = {
        input: request.input,
    };

    // Use agent or model field
    if (config.isAgent) {
        payload.agent = model;
    } else {
        payload.model = model;
    }

    // Sync call for standard models
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

    const data = await response.json() as Record<string, unknown>;
    return formatInteractionResponse(data);
}



// Format response to standard output
function formatInteractionResponse(data: Record<string, unknown>): Record<string, unknown> {
    const outputs = data.outputs as Array<Record<string, unknown>> | undefined;

    // Extract text from outputs
    let text = '';
    if (outputs && outputs.length > 0) {
        const firstOutput = outputs[0];
        if (typeof firstOutput.text === 'string') {
            text = firstOutput.text;
        } else if (typeof firstOutput.content === 'string') {
            text = firstOutput.content;
        } else {
            // Try to find any string field
            for (const key of Object.keys(firstOutput)) {
                if (typeof firstOutput[key] === 'string' && firstOutput[key]) {
                    text = firstOutput[key] as string;
                    break;
                }
            }
        }
    }

    return {
        ...data,
        text,
        outputs: outputs || [],
    };
}

