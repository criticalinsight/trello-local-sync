import { Component, For, createSignal, onMount } from 'solid-js';

export const Home: Component<{ onNavigate: (boardId: string) => void }> = (props) => {
    const [recentBoards, setRecentBoards] = createSignal<string[]>([]);

    onMount(() => {
        const saved = localStorage.getItem('recent_boards');
        if (saved) {
            setRecentBoards(JSON.parse(saved));
        } else {
            setRecentBoards(['default']);
        }
    });

    const handleCreate = () => {
        const id = crypto.randomUUID();
        saveBoard(id);
        props.onNavigate(id);
    };

    const saveBoard = (id: string) => {
        const distinct = Array.from(new Set([id, ...recentBoards()])).slice(0, 10);
        localStorage.setItem('recent_boards', JSON.stringify(distinct));
        setRecentBoards(distinct);
    };

    return (
        <div class="min-h-screen bg-slate-900 text-white p-8">
            <div class="max-w-4xl mx-auto">
                <header class="mb-12 text-center">
                    <h1 class="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4">
                        Local-First Trello
                    </h1>
                    <p class="text-slate-400">Offline-capable, 0ms latency, collaborative boards.</p>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* New Board Card */}
                    <button
                        onClick={handleCreate}
                        class="h-32 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 transition-all transform hover:scale-105 flex items-center justify-center shadow-lg group"
                    >
                        <span class="font-semibold text-lg flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 group-hover:rotate-90 transition-transform">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Create New Board
                        </span>
                    </button>

                    {/* Recent Boards */}
                    <For each={recentBoards()}>
                        {(id) => (
                            <button
                                onClick={() => { saveBoard(id); props.onNavigate(id); }}
                                class="h-32 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-750 hover:border-blue-500/50 transition-all p-6 text-left relative group overflow-hidden"
                            >
                                <div class="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <h3 class="font-semibold text-lg mb-1 relative z-10 truncate">
                                    {id === 'default' ? 'Demo Board' : `Board ${id.slice(0, 8)}...`}
                                </h3>
                                <p class="text-xs text-slate-500 font-mono relative z-10">{id}</p>
                            </button>
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
};
