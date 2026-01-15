import { Component, createMemo, For } from 'solid-js';
import { promptStore } from '../promptStore';

export const AnalyticsView: Component = () => {
    // Computed stats
    const stats = createMemo(() => {
        const versions = Object.values(promptStore.versions).filter((v) => v.output);
        const totalRuns = versions.length;
        const totalLatency = versions.reduce((sum, v) => sum + (v.executionTime || 0), 0);
        const avgLatency = totalRuns ? Math.round(totalLatency / totalRuns) : 0;

        const byModel: Record<string, number> = {};
        versions.forEach((v) => {
            const m = v.parameters.model || 'unknown';
            byModel[m] = (byModel[m] || 0) + 1;
        });

        // Compute success rate (versions without error)
        const successCount = versions.filter((v) => !v.error).length;
        const successRate = totalRuns ? Math.round((successCount / totalRuns) * 100) : 100;

        return { totalRuns, avgLatency, byModel, successRate };
    });

    return (
        <div class="p-8 space-y-8 text-slate-300 max-w-7xl mx-auto">
            <h2 class="text-3xl font-bold text-white mb-6">Operations Analytics</h2>

            {/* KPI Cards */}
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div class="bg-slate-800/80 backdrop-blur border border-slate-700 p-6 rounded-2xl shadow-lg">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                            </svg>
                        </div>
                        <span class="text-sm font-medium text-slate-400">Total Runs</span>
                    </div>
                    <div class="text-4xl font-bold text-white">{stats().totalRuns}</div>
                </div>

                <div class="bg-slate-800/80 backdrop-blur border border-slate-700 p-6 rounded-2xl shadow-lg">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                        <span class="text-sm font-medium text-slate-400">Avg Latency</span>
                    </div>
                    <div class="text-4xl font-bold text-white">{stats().avgLatency}ms</div>
                </div>

                <div class="bg-slate-800/80 backdrop-blur border border-slate-700 p-6 rounded-2xl shadow-lg">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                        <span class="text-sm font-medium text-slate-400">Success Rate</span>
                    </div>
                    <div class="text-4xl font-bold text-white">{stats().successRate}%</div>
                </div>

                <div class="bg-slate-800/80 backdrop-blur border border-slate-700 p-6 rounded-2xl shadow-lg">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                                />
                            </svg>
                        </div>
                        <span class="text-sm font-medium text-slate-400">Models Used</span>
                    </div>
                    <div class="text-4xl font-bold text-white">
                        {Object.keys(stats().byModel).length}
                    </div>
                </div>
            </div>

            {/* Detailed Charts */}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-slate-800/80 backdrop-blur border border-slate-700 p-6 rounded-2xl shadow-lg">
                    <h3 class="text-xl font-semibold text-white mb-6">Model Distribution</h3>
                    <div class="space-y-4">
                        <For each={Object.entries(stats().byModel)
                            .sort(([, a], [, b]) => b - a)}>{([model, count]) => (
                                <div>
                                    <div class="flex items-center justify-between mb-1">
                                        <span class="text-sm text-slate-300 font-medium">
                                            {model}
                                        </span>
                                        <span class="text-sm text-slate-400">{count} runs</span>
                                    </div>
                                    <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            class="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                                            style={{
                                                width: `${(count / stats().totalRuns) * 100}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            )}</For>
                    </div>
                </div>

                <div class="bg-slate-800/80 backdrop-blur border border-slate-700 p-6 rounded-2xl shadow-lg">
                    <h3 class="text-xl font-semibold text-white mb-6">Queue Health</h3>
                    <div class="text-slate-400 text-sm mb-4">
                        Currently processing and queued items.
                    </div>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                            <span>Queued Items</span>
                            <span class="font-mono text-white font-bold">
                                {
                                    Object.values(promptStore.prompts).filter(
                                        (p) => p.status === 'queued',
                                    ).length
                                }
                            </span>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                            <span>Generating Now</span>
                            <span class="font-mono text-emerald-400 font-bold">
                                {
                                    Object.values(promptStore.prompts).filter(
                                        (p) => p.status === 'generating',
                                    ).length
                                }
                            </span>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                            <span>Errors Last 24h</span>
                            <span class="font-mono text-red-400 font-bold">
                                {
                                    Object.values(promptStore.versions).filter(
                                        (v) => v.error && v.createdAt > Date.now() - 86400000,
                                    ).length
                                }
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
