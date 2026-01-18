import { Component, createSignal, Show, onCleanup } from 'solid-js';
import { startResearchJob, pollResearchStatus, ResearchJobStatus } from '../utils/researchService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onInsert: (text: string) => void;
}

export const ResearchModal: Component<Props> = (props) => {
    const [query, setQuery] = createSignal('');
    const [jobId, setJobId] = createSignal<string | null>(null);
    const [status, setStatus] = createSignal<ResearchJobStatus | null>(null);
    const [isStarting, setIsStarting] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    let pollTimer: number | undefined;

    const handleStart = async () => {
        if (!query().trim()) return;
        setIsStarting(true);
        setError(null);
        setStatus(null);
        setJobId(null);

        try {
            const id = await startResearchJob(query());
            setJobId(id);
            poll(id);
        } catch (e) {
            setError((e as Error).message);
            setIsStarting(false);
        }
    };

    const poll = async (id: string) => {
        try {
            const result = await pollResearchStatus(id);
            setStatus(result);

            if (result.status === 'completed' || result.status === 'failed') {
                setIsStarting(false);
                return; // Stop polling
            }

            // Continue polling
            pollTimer = setTimeout(() => poll(id), 5000) as unknown as number;
        } catch (e) {
            console.error('Poll error', e);
            // Don't stop polling on transient network errors, maybe?
            // For now, retry
            pollTimer = setTimeout(() => poll(id), 10000) as unknown as number;
        }
    };

    onCleanup(() => {
        if (pollTimer) clearTimeout(pollTimer);
    });

    const handleInsert = () => {
        const text = status()?.text;
        if (text) {
            props.onInsert(text);
            props.onClose();
        }
    };

    if (!props.isOpen) return null;

    return (
        <div class="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">🕵️‍♂️</span>
                        <h2 class="text-xl font-bold text-white">Deep Research Agent</h2>
                        <span class="text-xs bg-purple-900 text-purple-200 px-2 py-0.5 rounded border border-purple-500/30">Preview</span>
                    </div>
                    <button onClick={props.onClose} class="text-slate-400 hover:text-white">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div class="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Input Section */}
                    <div class="space-y-2">
                        <label class="block text-sm font-medium text-slate-300">
                            Research Goal
                        </label>
                        <div class="flex gap-2">
                            <textarea
                                value={query()}
                                onInput={(e) => setQuery(e.currentTarget.value)}
                                placeholder="E.g., Analyze the pricing strategy of Linear vs Jira..."
                                class="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none h-24"
                                disabled={!!jobId() && status()?.status === 'processing'}
                            />
                            <button
                                onClick={handleStart}
                                disabled={!query().trim() || isStarting() || (!!jobId() && status()?.status === 'processing')}
                                class="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg transition-colors flex flex-col items-center justify-center min-w-[120px]"
                            >
                                <Show when={isStarting() || (jobId() && status()?.status === 'processing')} fallback={<span>Start Research</span>}>
                                    <svg class="animate-spin h-5 w-5 text-white mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                    </svg>
                                    <span class="text-[10px] opacity-80">Process...</span>
                                </Show>
                            </button>
                        </div>
                    </div>

                    {/* Progress / Result Section */}
                    <Show when={error()}>
                        <div class="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                            Error: {error()}
                        </div>
                    </Show>

                    <Show when={jobId()}>
                        <div class="space-y-2">
                            <div class="flex items-center justify-between">
                                <h3 class="text-lg font-semibold text-white">Research Report</h3>
                                <div class="text-xs text-slate-400">
                                    ID: {jobId()?.slice(0, 8)}... • Status:
                                    <span class={`ml-1 font-mono uppercase ${status()?.status === 'completed' ? 'text-green-400' : status()?.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                                        {status()?.status || 'INIT'}
                                    </span>
                                </div>
                            </div>

                            <div class="bg-slate-950 rounded-lg border border-slate-800 min-h-[300px] p-4 font-mono text-sm text-slate-300 overflow-x-auto">
                                <Show
                                    when={status()?.outputs && status()?.outputs!.length > 0}
                                    fallback={
                                        status()?.text || (
                                            <div class="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 pt-10">
                                                <div class="animate-pulse text-4xl">🧬</div>
                                                <p>Analyzing web sources... This may take up to 2 minutes.</p>
                                            </div>
                                        )
                                    }
                                >
                                    <EpistemicView
                                        outputs={status()!.outputs!}
                                        logs={status()?.logs}
                                        isProcessing={status()?.status === 'processing'}
                                    />
                                </Show>
                            </div>
                        </div>
                    </Show>
                </div>

                {/* Footer */}
                <div class="p-4 border-t border-slate-700 bg-slate-800 flex justify-end gap-3">
                    <button
                        onClick={props.onClose}
                        class="px-4 py-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleInsert}
                        disabled={!status()?.text}
                        class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Insert to Prompt
                    </button>
                </div>
            </div>
        </div>
    );
};
