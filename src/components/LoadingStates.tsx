import { Component, Show } from 'solid-js';

interface StreamingTextProps {
    text: string;
    isLoading?: boolean;
}

/**
 * StreamingText - Displays text with a streaming animation effect.
 */
export const StreamingText: Component<StreamingTextProps> = (props) => {
    return (
        <div class="relative">
            <Show when={props.isLoading}>
                <div class="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </Show>
            <div class={`whitespace-pre-wrap ${props.isLoading ? 'opacity-70' : ''}`}>
                {props.text}
                <Show when={props.isLoading}>
                    <span class="inline-block w-2 h-4 ml-1 bg-purple-400 animate-pulse" />
                </Show>
            </div>
        </div>
    );
};

/**
 * SkeletonLoader - Placeholder for loading content.
 */
export const SkeletonLoader: Component<{ lines?: number }> = (props) => {
    const lines = props.lines || 3;
    return (
        <div class="space-y-3 animate-pulse">
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    class={`h-4 bg-slate-700/50 rounded ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
                />
            ))}
        </div>
    );
};

/**
 * AgentStageIndicator - Shows the current stage of agent execution.
 */
export const AgentStageIndicator: Component<{ stage?: string }> = (props) => {
    const stages = ['Decomposing', 'Delegating', 'Synthesizing', 'Complete'];
    const currentIndex = stages.findIndex((s) =>
        props.stage?.toLowerCase().includes(s.toLowerCase()),
    );

    return (
        <div class="flex items-center gap-2 text-xs text-slate-400">
            {stages.map((stage, i) => (
                <>
                    <div
                        class={`flex items-center gap-1 ${i <= currentIndex ? 'text-purple-400' : ''}`}
                    >
                        <div
                            class={`w-1.5 h-1.5 rounded-full ${
                                i < currentIndex
                                    ? 'bg-emerald-500'
                                    : i === currentIndex
                                      ? 'bg-purple-500 animate-pulse'
                                      : 'bg-slate-600'
                            }`}
                        />
                        <span>{stage}</span>
                    </div>
                    {i < stages.length - 1 && (
                        <div
                            class={`w-4 h-px ${i < currentIndex ? 'bg-emerald-500' : 'bg-slate-600'}`}
                        />
                    )}
                </>
            ))}
        </div>
    );
};

/**
 * KeyboardShortcutHint - Subtle hint for keyboard shortcuts.
 */
export const KeyboardShortcutHint: Component<{ keys: string; action: string }> = (props) => {
    return (
        <div class="flex items-center gap-2 text-[10px] text-slate-500">
            <kbd class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400 font-mono">
                {props.keys}
            </kbd>
            <span>{props.action}</span>
        </div>
    );
};
