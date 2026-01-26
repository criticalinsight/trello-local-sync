import { Component, For, createSignal, Show, createEffect, onMount } from 'solid-js';
import {
    promptStore,
    getPromptsByStatus,
    addPrompt,
    runAllDrafts,
    runSinglePrompt,
    updatePrompt,
    initPromptStore,
    deletePromptsByStatus,
} from '../promptStore';
import type { PromptCard as PromptCardType, PromptStatus } from '../types';
import { PromptCard } from './PromptCard';
import { PromptPlaygroundV2 } from './PromptPlaygroundV2';
import { ThemeToggle } from './ThemeToggle';

// Column configuration
const columns: {
    status: PromptStatus;
    title: string;
    color: string;
    headerAction?: 'add' | 'runAll';
    wipLimit?: number;
}[] = [
        {
            status: 'draft',
            title: 'Draft Prompts',
            color: 'from-slate-600 to-slate-700',
            headerAction: 'add',
        },
        { status: 'queued', title: 'Queued', color: 'from-amber-600 to-amber-700' },
        { status: 'generating', title: 'Generating', color: 'from-blue-600 to-blue-700', wipLimit: 5 },
        { status: 'deployed', title: 'Deployed', color: 'from-emerald-600 to-emerald-700' },
    ];

// Icons
const PlusIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
    >
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
    </svg>
);

const PlayAllIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
    >
        <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
        />
    </svg>
);

const HomeIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-6 h-6"
    >
        <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
        />
    </svg>
);

interface PromptBoardProps {
    boardId: string;
    onNavigateHome: () => void;
}

export const PromptBoard: Component<PromptBoardProps> = (props) => {
    // View state simplified
    const [selectedPromptId, setSelectedPromptId] = createSignal<string | null>(null);
    const [newPromptTitle, setNewPromptTitle] = createSignal('');
    const [showAddInput, setShowAddInput] = createSignal(false);
    const [dragOverStatus, setDragOverStatus] = createSignal<PromptStatus | null>(null);
    const [isLoading, setIsLoading] = createSignal(true);

    onMount(() => {
        // Initial setup
    });

    // Re-initialize when boardId changes
    createEffect(async () => {
        const id = props.boardId;
        console.log(`[PromptBoard] boardId changed: ${id}`);
        if (!id) {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            await initPromptStore(id);
            console.log(`[PromptBoard] initPromptStore complete for ${id}`);
        } catch (err) {
            console.error('[PromptBoard] Failed to load board:', err);
        } finally {
            setIsLoading(false);
        }
    });

    // Get prompts grouped by status
    const getDrafts = () => getPromptsByStatus('draft');
    const getQueued = () => getPromptsByStatus('queued');
    const getGenerating = () => getPromptsByStatus('generating');
    const getDeployed = () => getPromptsByStatus('deployed');

    const getPromptsForColumn = (status: PromptStatus) => {
        switch (status) {
            case 'draft':
                return getDrafts();
            case 'queued':
                return getQueued();
            case 'generating':
                return getGenerating();
            case 'deployed':
                return getDeployed();
            default:
                return [];
        }
    };

    const handleAddPrompt = async () => {
        const title = newPromptTitle().trim();
        if (!title) return;

        await addPrompt(title);
        setNewPromptTitle('');
        setShowAddInput(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddPrompt();
        } else if (e.key === 'Escape') {
            setShowAddInput(false);
            setNewPromptTitle('');
        }
    };

    const handleRunAll = async () => {
        const drafts = getDrafts();
        if (drafts.length === 0) return;
        await runAllDrafts();
    };

    const handleOpenPlayground = (promptId: string) => {
        setSelectedPromptId(promptId);
    };

    const handleClosePlayground = () => {
        setSelectedPromptId(null);
    };

    const handleDeleteAll = async (status: PromptStatus) => {
        const count = getPromptsForColumn(status).length;
        if (count === 0) return;

        if (
            confirm(
                `Are you sure you want to delete ALL ${count} ${status} prompts? This action cannot be undone.`,
            )
        ) {
            await deletePromptsByStatus(status);
        }
    };

    // Drag and drop handlers
    const handleDragOver = (e: DragEvent, status: PromptStatus) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        setDragOverStatus(status);
    };

    const handleDragLeave = () => {
        setDragOverStatus(null);
    };

    const handleDrop = async (e: DragEvent, targetStatus: PromptStatus) => {
        e.preventDefault();
        setDragOverStatus(null);

        const promptId = e.dataTransfer?.getData('text/plain');
        if (!promptId) return;

        const prompt = promptStore.prompts[promptId];
        if (!prompt) return;

        // Only allow certain transitions
        if (prompt.status === 'draft' && targetStatus === 'draft') {
            // Reorder within draft (TODO: implement position calculation)
        } else if (prompt.status === 'deployed' && targetStatus === 'draft') {
            // Re-draft a deployed prompt
            await updatePrompt(promptId, { status: 'draft' });
        } else if (prompt.status === 'error' && targetStatus === 'draft') {
            // Move error back to draft
            await updatePrompt(promptId, { status: 'draft' });
        }
    };

    return (
        <Show
            when={!isLoading()}
            fallback={
                <div class="h-screen flex items-center justify-center text-slate-400">
                    <svg
                        class="animate-spin h-8 w-8 text-blue-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                        />
                        <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    <span class="ml-3">Loading prompts...</span>
                </div>
            }
        >
            <div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900">
                {/* Header */}
                <header class="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 px-6 py-4 sticky top-0 z-40">
                    <div class="flex items-center justify-between max-w-full">
                        <div class="flex items-center gap-4">
                            <button
                                onClick={props.onNavigateHome}
                                class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                title="Back to Home"
                            >
                                <HomeIcon />
                            </button>
                            <div>
                                <h1 class="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                                    Prompt Engineering Board
                                </h1>
                                <p class="text-sm text-slate-500 font-mono">
                                    {props.boardId.slice(0, 8)}...
                                </p>
                            </div>
                        </div>

                        <div class="flex items-center gap-3">
                            {/* View Switcher Removed */}

                            {/* Stats */}
                            <div class="flex items-center gap-4 text-sm">
                                <span class="text-slate-400">
                                    <span class="font-semibold text-white">
                                        {getDrafts().length}
                                    </span>{' '}
                                    drafts
                                </span>
                                <span class="text-slate-400">
                                    <span class="font-semibold text-amber-400">
                                        {getQueued().length}
                                    </span>{' '}
                                    queued
                                </span>
                                <span class="text-slate-400">
                                    <span class="font-semibold text-blue-400">
                                        {getGenerating().length}
                                    </span>{' '}
                                    running
                                </span>
                                <span class="text-slate-400">
                                    <span class="font-semibold text-emerald-400">
                                        {getDeployed().length}
                                    </span>{' '}
                                    deployed
                                </span>
                            </div>

                            <ThemeToggle />
                        </div>
                    </div>
                </header>

                {/* Board Columns */}
                <div class="flex gap-4 p-6 overflow-x-auto min-h-[calc(100vh-80px)]">
                    <For each={columns}>
                        {(col) => {
                            const count = getPromptsForColumn(col.status).length;
                            const isOverLimit = col.wipLimit && count > col.wipLimit;

                            return (
                                <div
                                    class={`flex-shrink-0 w-80 flex flex-col rounded-xl bg-slate-800/50 border transition-colors
                                    ${isOverLimit
                                            ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                            : dragOverStatus() === col.status
                                                ? 'border-blue-500 bg-blue-900/20'
                                                : 'border-slate-700'
                                        }`}
                                    onDragOver={(e) => handleDragOver(e, col.status)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, col.status)}
                                >
                                    {/* Column Header */}
                                    <div
                                        class={`px-4 py-3 rounded-t-xl bg-gradient-to-r ${col.color} flex items-center justify-between`}
                                    >
                                        <div class="flex items-center gap-2">
                                            <h2 class="font-semibold text-white">
                                                {col.title}
                                            </h2>
                                            <div class="flex items-center gap-2">
                                                <span
                                                    class={`px-2 py-0.5 text-xs font-medium rounded-full ${isOverLimit ? 'bg-red-500 text-white animate-pulse' : 'bg-white/20'}`}
                                                >
                                                    {count}
                                                </span>
                                                <Show when={isOverLimit}>
                                                    <span class="text-xs text-red-200 font-medium whitespace-nowrap">
                                                        (Limit: {col.wipLimit})
                                                    </span>
                                                </Show>
                                            </div>
                                        </div>

                                        <div class="flex items-center gap-1">
                                            <Show when={col.status === 'draft'}>
                                                <Show when={getDrafts().length > 0}>
                                                    <button
                                                        onClick={() => handleDeleteAll('draft')}
                                                        class="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition-colors"
                                                        title="Delete all drafts"
                                                    >
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            class="w-5 h-5"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            stroke-width="2"
                                                        >
                                                            <path
                                                                stroke-linecap="round"
                                                                stroke-linejoin="round"
                                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                            />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={handleRunAll}
                                                        class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1"
                                                        title="Run all drafts"
                                                    >
                                                        <PlayAllIcon />
                                                        <span class="text-xs font-medium">
                                                            Run All
                                                        </span>
                                                    </button>
                                                </Show>
                                                <button
                                                    onClick={() => setShowAddInput(true)}
                                                    class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                                                    title="Add new prompt"
                                                >
                                                    <PlusIcon />
                                                </button>
                                            </Show>
                                        </div>
                                    </div>

                                    {/* Add New Prompt Input */}
                                    <Show when={showAddInput() && col.status === 'draft'}>
                                        <div class="p-3 border-b border-slate-700">
                                            <input
                                                type="text"
                                                placeholder="Enter prompt title..."
                                                value={newPromptTitle()}
                                                onInput={(e) =>
                                                    setNewPromptTitle(e.currentTarget.value)
                                                }
                                                onKeyDown={handleKeyDown}
                                                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg
                                               text-white placeholder-slate-400 focus:outline-none focus:border-purple-500
                                               focus:ring-1 focus:ring-purple-500"
                                                autofocus
                                            />
                                            <div class="flex justify-end gap-2 mt-2">
                                                <button
                                                    onClick={() => {
                                                        setShowAddInput(false);
                                                        setNewPromptTitle('');
                                                    }}
                                                    class="px-3 py-1 text-sm text-slate-400 hover:text-white transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleAddPrompt}
                                                    class="px-3 py-1 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                    </Show>

                                    {/* Cards */}
                                    <div class="flex-1 p-3 space-y-3 overflow-y-auto">
                                        <For each={getPromptsForColumn(col.status)}>
                                            {(prompt) => (
                                                <PromptCard
                                                    prompt={prompt}
                                                    onOpen={handleOpenPlayground}
                                                />
                                            )}
                                        </For>

                                        {/* Empty state */}
                                        <Show
                                            when={getPromptsForColumn(col.status).length === 0}
                                        >
                                            <div class="text-center py-8 text-slate-500 text-sm">
                                                <Show when={col.status === 'draft'}>
                                                    Click + to create your first prompt
                                                </Show>
                                                <Show when={col.status !== 'draft'}>
                                                    No prompts yet
                                                </Show>
                                            </div>
                                        </Show>
                                    </div>
                                </div>
                            );
                        }}
                    </For>

                    {/* Error Column (shown only if there are errors) */}
                    <Show when={getPromptsByStatus('error').length > 0}>
                        <div
                            class="flex-shrink-0 w-80 flex flex-col rounded-xl bg-slate-800/50 border border-red-900/50"
                            onDragOver={(e) => handleDragOver(e, 'error')}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, 'error')}
                        >
                            <div class="px-4 py-3 rounded-t-xl bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <h2 class="font-semibold text-white">Errors</h2>
                                    <span class="px-2 py-0.5 text-xs font-medium bg-white/20 rounded-full">
                                        {getPromptsByStatus('error').length}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleDeleteAll('error')}
                                    class="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition-colors"
                                    title="Clear all errors"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="w-5 h-5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <div class="flex-1 p-3 space-y-3 overflow-y-auto">
                                <For each={getPromptsByStatus('error')}>
                                    {(prompt) => (
                                        <PromptCard
                                            prompt={prompt}
                                            onOpen={handleOpenPlayground}
                                        />
                                    )}
                                </For>
                            </div>
                        </div>
                    </Show>
                </div>


            </div >
            <Show when={selectedPromptId()}>
                <PromptPlaygroundV2
                    promptId={selectedPromptId()!}
                    onClose={handleClosePlayground}
                />
            </Show>
        </Show >
    );
};

export default PromptBoard;
