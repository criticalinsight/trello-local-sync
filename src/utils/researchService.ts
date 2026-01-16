/**
 * Research Service
 * Handles interaction with the Cloudflare Worker's ResearchDO endpoints.
 */

const WORKER_URL = import.meta.env.VITE_AI_WORKER_URL || '/api/ai';

export interface ResearchJobStatus {
    id: string;
    interactionId: string;
    status: 'processing' | 'completed' | 'failed';
    input: string;
    text?: string;
    error?: string;
    createdAt: number;
    completedAt?: number;
}

export async function startResearchJob(query: string): Promise<string> {
    const response = await fetch(`${WORKER_URL}/interact`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'deep-research-pro-preview-12-2025',
            input: query,
            background: true, // Critical for ResearchDO routing
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to start research: ${await response.text()}`);
    }

    const data = (await response.json()) as any;
    // flexible handling: returns { id: ... } or { jobId: ... } depending on implementation
    return data.id || data.jobId;
}

export async function pollResearchStatus(jobId: string): Promise<ResearchJobStatus> {
    const response = await fetch(`${WORKER_URL}/status/${jobId}`);

    if (!response.ok) {
        throw new Error(`Failed to poll status: ${await response.text()}`);
    }

    return response.json();
}
