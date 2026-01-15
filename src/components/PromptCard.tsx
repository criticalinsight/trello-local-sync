import { Component, Show, For } from 'solid-js';
import type { PromptCard as PromptCardType, PromptStatus } from '../types';
import { promptStore, getCurrentVersion, deletePrompt } from '../promptStore';

interface PromptCardProps {
    prompt: PromptCardType;
    onOpen: (promptId: string) => void;
    onDragStart?: (e: DragEvent, promptId: string) => void;
    onDragEnd?: (e: DragEvent) => void;
}

// Status colors and labels
const statusConfig: Record<
    PromptStatus,
    { bg: string; text: string; label: string; pulse?: boolean }
> = {
    draft: { bg: 'bg-slate-600', text: 'text-slate-100', label: 'Draft' },
    queued: { bg: 'bg-amber-600', text: 'text-amber-100', label: 'Queued' },
    generating: { bg: 'bg-blue-600', text: 'text-blue-100', label: 'Generating', pulse: true },
    deployed: { bg: 'bg-emerald-600', text: 'text-emerald-100', label: 'Deployed' },
    error: { bg: 'bg-red-600', text: 'text-red-100', label: 'Error' },
};

// Icons
const TrashIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-4 h-4"
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
);

const PlayIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
    >
        <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
        />
        <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
    </svg>
);

const SpinnerIcon = () => (
    <svg
        class="animate-spin w-4 h-4"
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
);

export const PromptCard: Component<PromptCardProps> = (props) => {
    const version = () => getCurrentVersion(props.prompt.id);
    const config = () => statusConfig[props.prompt.status];

    const handleDragStart = (e: DragEvent) => {
        e.dataTransfer?.setData('text/plain', props.prompt.id);
        e.dataTransfer!.effectAllowed = 'move';
        (e.target as HTMLElement).classList.add('opacity-50', 'scale-95');
        props.onDragStart?.(e, props.prompt.id);
    };

    const handleDragEnd = (e: DragEvent) => {
        (e.target as HTMLElement).classList.remove('opacity-50', 'scale-95');
        props.onDragEnd?.(e);
    };

    const handleDelete = async (e: MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete this prompt?')) {
            await deletePrompt(props.prompt.id);
        }
    };

    const truncatedContent = () => {
        const content = version()?.content || '';
        if (content.length <= 120) return content;
        return content.slice(0, 120) + '...';
    };

    return (
        <div
            class="group bg-slate-800 border border-slate-700 rounded-lg p-3 cursor-pointer
                   hover:border-blue-500/50 hover:bg-slate-750 transition-all
                   shadow-sm hover:shadow-md"
            draggable={props.prompt.status === 'draft'}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={() => props.onOpen(props.prompt.id)}
        >
            {/* Header with status and actions */}
            <div class="flex items-center justify-between mb-2">
                <span
                    class={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1.5
                              ${config().bg} ${config().text} ${config().pulse ? 'animate-pulse' : ''}`}
                >
                    <Show when={props.prompt.status === 'generating'}>
                        <SpinnerIcon />
                    </Show>
                    {config().label}
                </span>

                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Show when={props.prompt.status === 'draft' || props.prompt.status === 'error'}>
                        <button
                            onClick={handleDelete}
                            class="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700"
                            title="Delete prompt"
                        >
                            <TrashIcon />
                        </button>
                    </Show>
                </div>
            </div>

            {/* Title */}
            <h3 class="font-medium text-white mb-2 truncate">{props.prompt.title}</h3>

            {/* Content Preview */}
            <Show when={truncatedContent()}>
                <p class="text-sm text-slate-400 line-clamp-3 mb-2">{truncatedContent()}</p>
                <p class="text-sm text-slate-400 line-clamp-3 mb-2">{truncatedContent()}</p>
            </Show>

            {/* Tags */}
            <Show when={props.prompt.tags && props.prompt.tags.length > 0}>
                <div class="flex flex-wrap gap-1 mb-2">
                    <For each={props.prompt.tags}>
                        {(tag) => (
                            <span class="px-1.5 py-0.5 text-[10px] bg-slate-700 text-slate-300 rounded border border-slate-600">
                                {tag}
                            </span>
                        )}
                    </For>
                </div>
            </Show>

            {/* Footer with metadata */}
            <div class="flex items-center justify-between text-xs text-slate-500">
                <Show when={version()?.executionTime}>
                    <span>{(version()!.executionTime! / 1000).toFixed(1)}s</span>
                </Show>
                <Show when={props.prompt.starred}>
                    <span class="text-yellow-400">★</span>
                </Show>
            </div>

            {/* Error indicator */}
            <Show when={props.prompt.status === 'error' && version()?.error}>
                <div class="mt-2 text-xs text-red-400 bg-red-900/20 rounded p-2 truncate">
                    {version()?.error}
                </div>
            </Show>
        </div>
    );
};

export default PromptCard;
