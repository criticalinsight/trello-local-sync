import { DurableObject } from 'cloudflare:workers';
import { EPISTEMIC_ANALYST_PROMPT } from './data/prompts';

/**
 * ResearchDO - Durable Object for handling Deep Research Agent jobs
 *
 * Uses Cloudflare Durable Object Alarms to poll Gemini API without
 * exceeding the Worker subrequest limit.
 */

interface ResearchJob {
    id: string; // Our job ID
    interactionId: string; // Gemini interaction ID
    status: 'processing' | 'completed' | 'failed';
    input: string;
    outputs?: unknown[];
    text?: string;
    error?: string;
    createdAt: number;
    completedAt?: number;
}

interface Env {
    GEMINI_API_KEY: string;
}

const POLL_INTERVAL_MS = 10000; // 10 seconds
const MAX_POLL_DURATION_MS = 60 * 60 * 1000; // 1 hour max (for long Deep Research reports)

export class ResearchDO implements DurableObject {
    private state: DurableObjectState;
    private env: Env;

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.env = env;
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname;

        // Start a new research job
        if (request.method === 'POST' && path === '/start') {
            return this.handleStart(request);
        }

        // Get job status
        if (request.method === 'GET' && path === '/status') {
            return this.handleStatus();
        }

        return new Response('Not found', { status: 404 });
    }

    private async handleStart(request: Request): Promise<Response> {
        const body = (await request.json()) as { input: string; jobId: string; agentType?: string };
        const { input, jobId } = body;

        // Call Gemini API to start background interaction
        const geminiResponse = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/interactions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.env.GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    input,
                    agent: body.agentType || 'deep-research-pro-preview-12-2025',
                    background: true,
                }),
            },
        );

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            // Return 429/503 status to allow Worker to fallback
            const status = geminiResponse.status;
            if (status === 429 || status === 503) {
                return new Response(
                    JSON.stringify({ error: `Rate limited: ${status}`, code: status }),
                    { status: status, headers: { 'Content-Type': 'application/json' } },
                );
            }
            return new Response(JSON.stringify({ error: `Gemini API error: ${errorText}` }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const geminiData = (await geminiResponse.json()) as { id: string };
        const interactionId = geminiData.id;

        if (!interactionId) {
            return new Response(JSON.stringify({ error: 'No interaction ID returned' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Store job state
        const job: ResearchJob = {
            id: jobId,
            interactionId,
            status: 'processing',
            input,
            createdAt: Date.now(),
        };

        await this.state.storage.put('job', job);

        // Set alarm to poll for results
        await this.state.storage.setAlarm(Date.now() + POLL_INTERVAL_MS);

        console.log(`[ResearchDO] Started job ${jobId} with interaction ${interactionId}`);

        return new Response(
            JSON.stringify({
                jobId,
                interactionId,
                status: 'processing',
            }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    }

    private async handleStatus(): Promise<Response> {
        const job = await this.state.storage.get<ResearchJob>('job');

        if (!job) {
            return new Response(JSON.stringify({ error: 'No job found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(
            JSON.stringify({
                jobId: job.id,
                status: job.status,
                outputs: job.outputs,
                text: job.text,
                error: job.error,
                createdAt: job.createdAt,
                completedAt: job.completedAt,
            }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    }

    async alarm(): Promise<void> {
        const job = await this.state.storage.get<ResearchJob>('job');
        if (!job || job.status !== 'processing') {
            return;
        }

        // Check if we've exceeded max poll duration
        if (Date.now() - job.createdAt > MAX_POLL_DURATION_MS) {
            job.status = 'failed';
            job.error = 'Polling timeout exceeded';
            await this.state.storage.put('job', job);
            console.log(`[ResearchDO] Job ${job.id} timed out`);
            return;
        }

        if (job.interactionId === 'internal-epistemic') {
            await this.runEpistemicGeneration(job);
            return;
        }

        // Poll Gemini API for status
        try {
            const pollResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/interactions/${job.interactionId}`,
                {
                    method: 'GET',
                    headers: {
                        'x-goog-api-key': this.env.GEMINI_API_KEY,
                    },
                },
            );

            if (!pollResponse.ok) {
                const errorText = await pollResponse.text();
                console.error(`[ResearchDO] Poll error: ${errorText}`);
                // Continue polling on transient errors
                await this.state.storage.setAlarm(Date.now() + POLL_INTERVAL_MS);
                return;
            }

            const pollData = (await pollResponse.json()) as {
                status?: string;
                outputs?: Array<{ text?: string; type?: string }>;
            };

            console.log(`[ResearchDO] Job ${job.id} status: ${pollData.status}`);

            if (pollData.status === 'completed' || pollData.status === 'COMPLETED') {
                // Extract text from outputs
                let text = '';
                if (pollData.outputs && pollData.outputs.length > 0) {
                    const textOutput = pollData.outputs.find((o) => o.type === 'text');
                    text = textOutput?.text || '';
                }

                job.status = 'completed';
                job.outputs = pollData.outputs;
                job.text = text;
                job.completedAt = Date.now();
                await this.state.storage.put('job', job);
                console.log(`[ResearchDO] Job ${job.id} completed`);
                return;
            }

            if (
                pollData.status === 'failed' ||
                pollData.status === 'FAILED' ||
                pollData.status === 'cancelled' ||
                pollData.status === 'CANCELLED'
            ) {
                job.status = 'failed';
                job.error = `Job ${pollData.status}`;
                await this.state.storage.put('job', job);
                console.log(`[ResearchDO] Job ${job.id} failed`);
                return;
            }

            // Still processing, set next alarm
            await this.state.storage.setAlarm(Date.now() + POLL_INTERVAL_MS);
        } catch (error) {
            console.error(`[ResearchDO] Alarm error:`, error);
            // Continue polling on transient errors
            await this.state.storage.setAlarm(Date.now() + POLL_INTERVAL_MS);
        }
    }
    async runEpistemicGeneration(job: ResearchJob) {
        try {
            // Use Gemini 1.5 Pro for reasoning
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${this.env.GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            { role: 'user', parts: [{ text: job.input }] }
                        ],
                        systemInstruction: { parts: [{ text: EPISTEMIC_ANALYST_PROMPT }] },
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 8192
                        }
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`Gemini Error: ${response.statusText}`);
            }

            const data = await response.json() as any;
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            job.status = 'completed';
            job.text = text;
            job.completedAt = Date.now();
            await this.state.storage.put('job', job);

        } catch (e) {
            job.status = 'failed';
            job.error = String(e);
            await this.state.storage.put('job', job);
        }
    }
}
