import { Component, createMemo, Show } from 'solid-js';
import { promptStore } from '../promptStore';

/**
 * Global Agent Bar - Persistent progress indicator visible across all views.
 * Shows active agent count and provides quick access to agent activity.
 */
export const GlobalAgentBar: Component = () => {
    const activeAgents = createMemo(() => {
        return Object.values(promptStore.prompts).filter(
            (p) => p.status === 'generating' || p.status === 'queued',
        );
    });

    const generatingCount = createMemo(
        () => activeAgents().filter((p) => p.status === 'generating').length,
    );

    const queuedCount = createMemo(
        () => activeAgents().filter((p) => p.status === 'queued').length,
    );

    return (
        <Show when={activeAgents().length > 0}>
            <div class="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-purple-600/90 to-pink-600/90 backdrop-blur-sm">
                <div class="h-1 bg-white/20 overflow-hidden">
                    <div class="h-full bg-white/60 animate-progress" />
                </div>
                <div class="flex items-center justify-center gap-4 py-1.5 text-xs text-white/90">
                    <div class="flex items-center gap-2">
                        <div class="relative">
                            <div class="w-2 h-2 bg-white rounded-full animate-pulse" />
                            <div class="absolute inset-0 w-2 h-2 bg-white rounded-full animate-ping opacity-50" />
                        </div>
                        <span class="font-medium">{generatingCount()} running</span>
                    </div>
                    <Show when={queuedCount() > 0}>
                        <span class="text-white/60">•</span>
                        <span class="text-white/70">{queuedCount()} queued</span>
                    </Show>
                    <span class="text-white/50 text-[10px] ml-2">Press ESC to view details</span>
                </div>
            </div>
        </Show>
    );
};
