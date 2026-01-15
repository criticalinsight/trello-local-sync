import { Component, For, createSignal, onMount } from 'solid-js';

interface HomeProps {
    onNavigate: (boardId: string) => void;
    onNavigatePrompts: (boardId: string) => void;
}

export const Home: Component<HomeProps> = (props) => {
    const [recentBoards, setRecentBoards] = createSignal<string[]>([]);
    const [recentPromptBoards, setRecentPromptBoards] = createSignal<string[]>([]);

    onMount(() => {
        // Load regular boards
        const saved = localStorage.getItem('recent_boards');
        if (saved) {
            setRecentBoards(JSON.parse(saved));
        } else {
            setRecentBoards(['default']);
        }

        // Load prompt boards
        const savedPrompts = localStorage.getItem('recent_prompt_boards');
        if (savedPrompts) {
            setRecentPromptBoards(JSON.parse(savedPrompts));
        }
    });

    const handleCreate = () => {
        const id = crypto.randomUUID();
        saveBoard(id);
        props.onNavigate(id);
    };

    const handleCreatePromptBoard = () => {
        const id = crypto.randomUUID();
        savePromptBoard(id);
        props.onNavigatePrompts(id);
    };

    const saveBoard = (id: string) => {
        const distinct = Array.from(new Set([id, ...recentBoards()])).slice(0, 10);
        localStorage.setItem('recent_boards', JSON.stringify(distinct));
        setRecentBoards(distinct);
    };

    const savePromptBoard = (id: string) => {
        const distinct = Array.from(new Set([id, ...recentPromptBoards()])).slice(0, 10);
        localStorage.setItem('recent_prompt_boards', JSON.stringify(distinct));
        setRecentPromptBoards(distinct);
    };

    return (
        <div class="min-h-screen bg-slate-900 text-white p-8">
            <div class="max-w-5xl mx-auto">
                <header class="mb-12 text-center">
                    <h1 class="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4">
                        Local-First Workspace
                    </h1>
                    <p class="text-slate-400">Offline-capable, 0ms latency, collaborative boards.</p>
                </header>

                {/* Prompt Engineering Boards Section */}
                <section class="mb-12">
                    <h2 class="text-xl font-semibold text-purple-400 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                        </svg>
                        AI Prompt Engineering
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* New Prompt Board Card */}
                        <button
                            onClick={handleCreatePromptBoard}
                            class="h-28 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 transition-all transform hover:scale-105 flex items-center justify-center shadow-lg group"
                        >
                            <span class="font-semibold flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 group-hover:rotate-90 transition-transform">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                New Prompt Board
                            </span>
                        </button>

                        {/* Recent Prompt Boards */}
                        <For each={recentPromptBoards()}>
                            {(id) => (
                                <button
                                    onClick={() => { savePromptBoard(id); props.onNavigatePrompts(id); }}
                                    class="h-28 rounded-xl bg-slate-800 border border-purple-900/50 hover:border-purple-500/50 transition-all p-4 text-left relative group overflow-hidden"
                                >
                                    <div class="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div class="flex items-start gap-2">
                                        <span class="text-purple-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                                            </svg>
                                        </span>
                                        <div>
                                            <h3 class="font-medium mb-1 relative z-10 truncate">
                                                Prompt Board
                                            </h3>
                                            <p class="text-xs text-slate-500 font-mono relative z-10">{id.slice(0, 8)}...</p>
                                        </div>
                                    </div>
                                </button>
                            )}
                        </For>
                    </div>
                </section>

                {/* Task Boards Section */}
                <section>
                    <h2 class="text-xl font-semibold text-blue-400 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                        </svg>
                        Task Boards
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* New Board Card */}
                        <button
                            onClick={handleCreate}
                            class="h-28 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 transition-all transform hover:scale-105 flex items-center justify-center shadow-lg group"
                        >
                            <span class="font-semibold flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 group-hover:rotate-90 transition-transform">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                New Task Board
                            </span>
                        </button>

                        {/* Recent Boards */}
                        <For each={recentBoards()}>
                            {(id) => (
                                <button
                                    onClick={() => { saveBoard(id); props.onNavigate(id); }}
                                    class="h-28 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-750 hover:border-blue-500/50 transition-all p-4 text-left relative group overflow-hidden"
                                >
                                    <div class="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <h3 class="font-medium mb-1 relative z-10 truncate">
                                        {id === 'default' ? 'Demo Board' : `Board ${id.slice(0, 8)}...`}
                                    </h3>
                                    <p class="text-xs text-slate-500 font-mono relative z-10">{id}</p>
                                </button>
                            )}
                        </For>
                    </div>
                </section>
            </div>
        </div>
    );
};

