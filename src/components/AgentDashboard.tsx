import { Component, For, Show, createMemo } from 'solid-js';
import { promptStore } from '../promptStore';
import type { PromptCard } from '../types';

export const AgentDashboard: Component = () => {
    // Get all active agents (generating or queued)
    const activeAgents = createMemo(() => {
        return Object.values(promptStore.prompts).filter(
            (p) => p.status === 'generating' || p.status === 'queued',
        );
    });

    // Get coordinators with their workers
    const coordinators = createMemo(() => {
        return Object.values(promptStore.prompts).filter(
            (p) => p.agentMode === 'coordinator' && p.childIds?.length,
        );
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'generating':
                return 'bg-amber-500';
            case 'queued':
                return 'bg-blue-500';
            case 'deployed':
                return 'bg-emerald-500';
            case 'error':
                return 'bg-red-500';
            default:
                return 'bg-slate-500';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'generating':
                return 'Running';
            case 'queued':
                return 'Queued';
            case 'deployed':
                return 'Complete';
            case 'error':
                return 'Failed';
            default:
                return status;
        }
    };

    return (
        <div class="fixed bottom-4 right-4 z-50">
            <Show when={activeAgents().length > 0 || coordinators().length > 0}>
                <div class="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 w-80 overflow-hidden animate-slide-up">
                    {/* Header */}
                    <div class="px-4 py-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-slate-700/50 flex items-center gap-3">
                        <div class="relative">
                            <div class="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                            <div class="absolute inset-0 w-3 h-3 bg-emerald-500 rounded-full animate-ping opacity-75" />
                        </div>
                        <span class="text-sm font-semibold text-white">Agent Activity</span>
                        <span class="ml-auto text-xs text-slate-400 font-mono">
                            {activeAgents().length} active
                        </span>
                    </div>

                    {/* Agent List */}
                    <div class="max-h-64 overflow-y-auto p-3 space-y-2">
                        <For each={activeAgents()}>
                            {(agent) => (
                                <AgentItem
                                    agent={agent}
                                    getStatusColor={getStatusColor}
                                    getStatusLabel={getStatusLabel}
                                />
                            )}
                        </For>

                        {/* Coordinator with Workers */}
                        <For each={coordinators()}>
                            {(coord) => (
                                <CoordinatorItem
                                    coordinator={coord}
                                    getStatusColor={getStatusColor}
                                    getStatusLabel={getStatusLabel}
                                />
                            )}
                        </For>
                    </div>
                </div>
            </Show>
        </div>
    );
};

const AgentItem: Component<{
    agent: PromptCard;
    getStatusColor: (s: string) => string;
    getStatusLabel: (s: string) => string;
}> = (props) => {
    return (
        <div class="p-3 bg-slate-800/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all group">
            <div class="flex items-center gap-3">
                <div
                    class={`w-2 h-2 rounded-full ${props.getStatusColor(props.agent.status)} ${props.agent.status === 'generating' ? 'animate-pulse' : ''}`}
                />
                <span class="text-sm text-white font-medium truncate flex-1">
                    {props.agent.title}
                </span>
                <span
                    class={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                        props.agent.status === 'generating'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-blue-500/20 text-blue-300'
                    }`}
                >
                    {props.getStatusLabel(props.agent.status)}
                </span>
            </div>
            <Show when={props.agent.status === 'generating'}>
                <div class="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-progress" />
                </div>
            </Show>
        </div>
    );
};

const CoordinatorItem: Component<{
    coordinator: PromptCard;
    getStatusColor: (s: string) => string;
    getStatusLabel: (s: string) => string;
}> = (props) => {
    const workers = createMemo(() => {
        return (props.coordinator.childIds || [])
            .map((id) => promptStore.prompts[id])
            .filter(Boolean);
    });

    const completedCount = createMemo(
        () => workers().filter((w) => w.status === 'deployed' || w.status === 'error').length,
    );

    return (
        <div class="p-3 bg-slate-800/50 rounded-xl border border-purple-500/30">
            <div class="flex items-center gap-3 mb-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4 text-purple-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                </svg>
                <span class="text-sm text-purple-300 font-semibold truncate flex-1">
                    {props.coordinator.title}
                </span>
                <span class="text-xs text-slate-400">
                    {completedCount()}/{workers().length}
                </span>
            </div>

            {/* Worker Progress */}
            <div class="space-y-1">
                <For each={workers()}>
                    {(worker) => (
                        <div class="flex items-center gap-2 text-xs">
                            <div
                                class={`w-1.5 h-1.5 rounded-full ${props.getStatusColor(worker.status)}`}
                            />
                            <span class="text-slate-400 truncate flex-1">
                                {worker.title.replace('[Worker] ', '')}
                            </span>
                            <span
                                class={`${worker.status === 'deployed' ? 'text-emerald-400' : 'text-slate-500'}`}
                            >
                                {props.getStatusLabel(worker.status)}
                            </span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};
