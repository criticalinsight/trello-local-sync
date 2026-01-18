import { Component, For, Show } from 'solid-js';

interface EpistemicOutput {
    hypothesis?: string;
    evidence_needed?: string[];
    step_by_step_reasoning?: string[];
    synthesis?: string;
    confidence_score?: number;
    grounding?: { web: { title?: string; uri?: string } }[];
    implications?: string[];
    raw?: string;
}

interface Props {
    outputs: EpistemicOutput[];
    logs?: string[];
    isProcessing?: boolean;
}

export const EpistemicView: Component<Props> = (props) => {
    return (
        <div class="space-y-6 animate-in fade-in duration-500">
            <For each={props.outputs}>
                {(step, i) => (
                    <div class="relative pl-8 border-l-2 border-slate-700 last:border-emerald-500/50">
                        {/* Step Marker */}
                        <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-purple-500 z-10 flex items-center justify-center">
                            <span class="text-[8px] font-bold text-white">{i() + 1}</span>
                        </div>

                        <div class="space-y-4 mb-8">
                            {/* Raw Flag */}
                            <Show when={step.raw}>
                                <div class="bg-amber-900/20 border border-amber-600/30 p-3 rounded text-amber-200 text-sm font-mono whitespace-pre-wrap">
                                    {step.raw}
                                </div>
                            </Show>

                            <Show when={!step.raw}>
                                {/* Header: Hypothesis */}
                                <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                    <h4 class="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-1">Hypothesis</h4>
                                    <p class="text-slate-200 font-medium">{step.hypothesis || 'Formulating hypothesis...'}</p>
                                </div>

                                {/* Evidence Needed */}
                                <Show when={step.evidence_needed?.length}>
                                    <div class="pl-4">
                                        <h5 class="text-xs font-semibold text-slate-400 mb-2">Evidence Gap</h5>
                                        <ul class="list-disc text-sm text-slate-300 space-y-1">
                                            <For each={step.evidence_needed}>
                                                {(item) => <li>{item}</li>}
                                            </For>
                                        </ul>
                                    </div>
                                </Show>

                                {/* Reasoning Chain */}
                                <Show when={step.step_by_step_reasoning?.length}>
                                    <div class="bg-black/20 rounded-lg p-3 border border-slate-800/50">
                                        <details class="group">
                                            <summary class="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-300 flex items-center gap-2 select-none">
                                                <span class="group-open:rotate-90 transition-transform">▸</span>
                                                Chain of Thought ({step.step_by_step_reasoning!.length} steps)
                                            </summary>
                                            <div class="mt-3 space-y-2 pl-4 border-l border-slate-700/50">
                                                <For each={step.step_by_step_reasoning}>
                                                    {(reason) => <p class="text-xs text-slate-400 font-mono">{reason}</p>}
                                                </For>
                                            </div>
                                        </details>
                                    </div>
                                </Show>

                                {/* Grounding / Sources */}
                                <Show when={step.grounding?.length}>
                                    <div class="flex flex-wrap gap-2">
                                        <For each={step.grounding}>
                                            {(source) => (
                                                <a
                                                    href={source.web.uri}
                                                    target="_blank"
                                                    class="px-2 py-1 bg-blue-900/20 hover:bg-blue-900/40 text-blue-300 border border-blue-800/30 rounded text-xs truncate max-w-[200px] transition-colors flex items-center gap-1"
                                                >
                                                    🌍 {source.web.title || 'Source'}
                                                </a>
                                            )}
                                        </For>
                                    </div>
                                </Show>

                                {/* Synthesis / Conclusion */}
                                <div class="relative">
                                    <div class="absolute inset-0 bg-emerald-500/5 blur-xl rounded-full"></div>
                                    <div class="relative bg-emerald-900/10 border border-emerald-500/30 rounded-lg p-4">
                                        <div class="flex justify-between items-start mb-2">
                                            <h4 class="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Synthesis</h4>
                                            <Show when={step.confidence_score}>
                                                <span class={`text-xs px-2 py-0.5 rounded-full border ${step.confidence_score! > 0.8 ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-300' : 'bg-amber-900/30 border-amber-500/50 text-amber-300'}`}>
                                                    {(step.confidence_score! * 100).toFixed(0)}% Conf
                                                </span>
                                            </Show>
                                        </div>
                                        <p class="text-white leading-relaxed">{step.synthesis}</p>
                                    </div>
                                </div>
                            </Show>
                        </div>
                    </div>
                )}
            </For>

            {/* Processing Indicator */}
            <Show when={props.isProcessing}>
                <div class="relative pl-8 border-l-2 border-slate-700 border-dashed">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-600 animate-pulse"></div>
                    <div class="text-sm text-slate-500 italic animate-pulse">
                        Analyzing next step...
                    </div>
                </div>
            </Show>
        </div>
    );
};
