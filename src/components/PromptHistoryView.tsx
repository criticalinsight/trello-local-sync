import { Component, createMemo, For, Show } from 'solid-js';
import { promptStore } from '../promptStore';
import { formatCost } from '../utils/tokenEstimator';

interface PromptHistoryViewProps {
    promptId: string;
}

export const PromptHistoryView: Component<PromptHistoryViewProps> = (props) => {
    // Get all versions for this prompt, sorted by date (newest first for list, oldest first for chart)
    const versions = createMemo(() => {
        return Object.values(promptStore.versions)
            .filter((v) => v.promptId === props.promptId)
            .sort((a, b) => b.createdAt - a.createdAt);
    });

    const chartData = createMemo(() => {
        // Reverse for chronological chart (oldest -> newest)
        return [...versions()].reverse().map((v, i) => ({
            index: i + 1,
            latency: v.executionTime || 0,
            error: !!v.error,
            tokenCount: v.content?.length ? Math.ceil(v.content.length / 4) : 0
        }));
    });

    // Simple SVG Sparkline
    const maxLatency = createMemo(() => Math.max(...chartData().map(d => d.latency), 100));

    return (
        <div class="h-full flex flex-col bg-slate-900 overflow-hidden">
            {/* Charts Header */}
            <div class="p-4 bg-slate-800 border-b border-slate-700 shrink-0">
                <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Performance Trends</h3>

                <div class="flex gap-4 h-32 items-end pb-2 px-2 border-l border-b border-slate-700 relative">
                    <Show when={chartData().length > 1} fallback={<div class="w-full text-center text-slate-500 self-center">Not enough data</div>}>
                        <For each={chartData()}>
                            {(d) => (
                                <div class="flex-1 flex flex-col justify-end items-center gap-1 group relative">
                                    {/* Tooltip */}
                                    <div class="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-700 text-xs px-2 py-1 rounded whitespace-nowrap z-10 transition-opacity">
                                        v{d.index}: {d.latency}ms / {d.tokenCount}t
                                    </div>

                                    {/* Bar */}
                                    <div
                                        class={`w-full max-w-[20px] rounded-t ${d.error ? 'bg-red-500/50' : 'bg-blue-500/50 hover:bg-blue-400'}`}
                                        style={{ height: `${Math.max((d.latency / maxLatency()) * 100, 5)}%` }}
                                    />
                                    <span class="text-[10px] text-slate-500">{d.index}</span>
                                </div>
                            )}
                        </For>
                    </Show>
                </div>
                <div class="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>Oldest</span>
                    <span>Latency (ms)</span>
                    <span>Newest</span>
                </div>
            </div>

            {/* Version List */}
            <div class="flex-1 overflow-y-auto p-4 space-y-3">
                <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Version History</h3>
                <For each={versions()}>
                    {(v, i) => (
                        <div class="p-3 bg-slate-800 rounded border border-slate-700 hover:border-slate-600 transition-colors">
                            <div class="flex justify-between items-start mb-1">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs font-mono text-purple-400">v{versions().length - i()}</span>
                                    <span class="text-xs text-slate-500">
                                        {new Date(v.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                <Show when={v.executionTime}>
                                    <span class="text-xs font-mono text-blue-400">{(v.executionTime! / 1000).toFixed(2)}s</span>
                                </Show>
                            </div>

                            <div class="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                <span class="px-1.5 py-0.5 bg-slate-900 rounded">{v.parameters.model || 'Unknown Model'}</span>
                                <span class="px-1.5 py-0.5 bg-slate-900 rounded">Temp: {v.parameters.temperature}</span>
                            </div>

                            <div class="text-xs text-slate-500 font-mono line-clamp-2">
                                {v.content || '(No output)'}
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};
