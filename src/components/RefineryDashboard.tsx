import { createSignal, onMount, createEffect, For, Show } from 'solid-js';

interface Channel {
    id: string;
    name: string;
    config: string;
    created_at: number;
    success_count: number;
    failure_count: number;
    last_ingested_at: number | null;
}

interface RefineryStats {
    totalItems: number;
    processedItems: number;
    signals: number;
    last24Hours: number;
    timestamp: string;
}

interface HealthStatus {
    status: 'healthy' | 'error';
    channels: number;
    pendingItems: number;
    timestamp: string;
}

interface Props {
    onNavigateHome: () => void;
}

export function RefineryDashboard(props: Props) {
    const [health, setHealth] = createSignal<HealthStatus | null>(null);
    const [stats, setStats] = createSignal<RefineryStats | null>(null);
    const [channels, setChannels] = createSignal<Channel[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);
    const [lastRefresh, setLastRefresh] = createSignal(Date.now());

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [healthRes, statsRes, channelsRes] = await Promise.all([
                fetch('/api/refinery/health'),
                fetch('/api/refinery/stats'),
                fetch('/api/refinery/channels')
            ]);

            if (healthRes.ok) {
                setHealth(await healthRes.json());
            }
            if (statsRes.ok) {
                setStats(await statsRes.json());
            }
            if (channelsRes.ok) {
                const data = await channelsRes.json() as { result: Channel[] };
                setChannels(data.result || []);
            }

            setLastRefresh(Date.now());
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    onMount(() => {
        fetchData();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    });

    const getHealthColor = () => {
        const h = health();
        if (!h) return 'bg-slate-600';
        return h.status === 'healthy' ? 'bg-emerald-500' : 'bg-red-500';
    };

    const getChannelHealth = (channel: Channel) => {
        const total = channel.success_count + channel.failure_count;
        if (total === 0) return 100;
        return Math.round((channel.success_count / total) * 100);
    };

    const formatTime = (timestamp: number | null) => {
        if (!timestamp) return 'Never';
        const diff = Date.now() - timestamp;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    return (
        <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
            {/* Header */}
            <div class="flex items-center justify-between mb-8">
                <div class="flex items-center gap-4">
                    <button
                        onClick={props.onNavigateHome}
                        class="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-colors"
                        title="Back to Home"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 class="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                            AI Refinery
                        </h1>
                        <p class="text-slate-400 text-sm">Content Intelligence Pipeline</p>
                    </div>
                </div>

                <div class="flex items-center gap-4">
                    {/* Health Indicator */}
                    <div class="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-lg">
                        <div class={`w-3 h-3 rounded-full ${getHealthColor()} animate-pulse`} />
                        <span class="text-sm font-medium">
                            {health()?.status?.toUpperCase() || 'LOADING'}
                        </span>
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={fetchData}
                        disabled={loading()}
                        class="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-colors disabled:opacity-50"
                        title="Refresh"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class={`w-5 h-5 ${loading() ? 'animate-spin' : ''}`}>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            <Show when={error()}>
                <div class="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
                    ⚠️ {error()}
                </div>
            </Show>

            {/* Stats Grid */}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div class="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-4">
                    <div class="text-3xl font-bold text-cyan-400">{stats()?.totalItems || 0}</div>
                    <div class="text-sm text-slate-400">Total Items</div>
                </div>
                <div class="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-4">
                    <div class="text-3xl font-bold text-emerald-400">{stats()?.processedItems || 0}</div>
                    <div class="text-sm text-slate-400">Processed</div>
                </div>
                <div class="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-4">
                    <div class="text-3xl font-bold text-purple-400">{stats()?.signals || 0}</div>
                    <div class="text-sm text-slate-400">Signals Generated</div>
                </div>
                <div class="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-4">
                    <div class="text-3xl font-bold text-amber-400">{stats()?.last24Hours || 0}</div>
                    <div class="text-sm text-slate-400">Last 24 Hours</div>
                </div>
            </div>

            {/* Pipeline Status */}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Pending Queue */}
                <div class="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-6">
                    <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-amber-400">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Processing Queue
                    </h2>
                    <div class="flex items-center justify-center h-32">
                        <div class="text-center">
                            <div class="text-5xl font-bold text-amber-400">
                                {health()?.pendingItems || 0}
                            </div>
                            <div class="text-sm text-slate-400 mt-2">Items Pending Analysis</div>
                        </div>
                    </div>
                </div>

                {/* Connected Sources */}
                <div class="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-6">
                    <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-cyan-400">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
                        </svg>
                        Connected Sources
                    </h2>
                    <div class="flex items-center justify-center h-32">
                        <div class="text-center">
                            <div class="text-5xl font-bold text-cyan-400">
                                {health()?.channels || 0}
                            </div>
                            <div class="text-sm text-slate-400 mt-2">Active Channels</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Channels List */}
            <div class="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-6">
                <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-purple-400">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                    Source Channels
                </h2>

                <Show when={channels().length === 0}>
                    <div class="text-center py-12 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="w-16 h-16 mx-auto mb-4 opacity-50">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                        </svg>
                        <p>No channels connected yet</p>
                        <p class="text-sm mt-2">Connect Telegram channels or RSS feeds to start ingesting content</p>
                    </div>
                </Show>

                <Show when={channels().length > 0}>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="text-left text-slate-400 text-sm border-b border-slate-700">
                                    <th class="pb-3 font-medium">Channel</th>
                                    <th class="pb-3 font-medium">Health</th>
                                    <th class="pb-3 font-medium">Success</th>
                                    <th class="pb-3 font-medium">Failed</th>
                                    <th class="pb-3 font-medium">Last Activity</th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={channels()}>
                                    {(channel) => (
                                        <tr class="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                                            <td class="py-3">
                                                <div class="font-medium">{channel.name}</div>
                                                <div class="text-xs text-slate-500">{channel.id}</div>
                                            </td>
                                            <td class="py-3">
                                                <div class="flex items-center gap-2">
                                                    <div class="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            class={`h-full ${getChannelHealth(channel) > 80 ? 'bg-emerald-500' : getChannelHealth(channel) > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                            style={`width: ${getChannelHealth(channel)}%`}
                                                        />
                                                    </div>
                                                    <span class="text-sm">{getChannelHealth(channel)}%</span>
                                                </div>
                                            </td>
                                            <td class="py-3 text-emerald-400">{channel.success_count}</td>
                                            <td class="py-3 text-red-400">{channel.failure_count}</td>
                                            <td class="py-3 text-slate-400">{formatTime(channel.last_ingested_at)}</td>
                                        </tr>
                                    )}
                                </For>
                            </tbody>
                        </table>
                    </div>
                </Show>
            </div>

            {/* Footer */}
            <div class="mt-8 text-center text-sm text-slate-500">
                Last updated: {new Date(lastRefresh()).toLocaleTimeString()}
            </div>
        </div>
    );
}
