import { Component, For, createSignal } from 'solid-js';
import { SavedPrompt } from '../types';

interface Props {
    prompts: SavedPrompt[];
    onUpdateStatus: (id: string, newStatus: SavedPrompt['status']) => void;
    onSelect: (prompt: SavedPrompt) => void;
    onDelete: (id: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

const COLUMNS: { id: SavedPrompt['status']; label: string; color: string }[] = [
    { id: 'draft', label: 'Drafts', color: 'bg-slate-700/50' },
    { id: 'review', label: 'In Review', color: 'bg-yellow-900/20' },
    { id: 'approved', label: 'Approved', color: 'bg-green-900/20' },
];

export const PromptManager: Component<Props> = (props) => {
    // Drag State
    const [draggedId, setDraggedId] = createSignal<string | null>(null);

    const handleDragStart = (e: DragEvent, id: string) => {
        setDraggedId(id);
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', id);
        }
    };

    const handleDrop = (e: DragEvent, status: SavedPrompt['status']) => {
        e.preventDefault();
        const id = e.dataTransfer?.getData('text/plain');
        if (id && id !== draggedId()) {
            props.onUpdateStatus(id, status);
        }
        setDraggedId(null);
    };

    const getPromptsByStatus = (status: SavedPrompt['status']) => {
        return props.prompts.filter((p) => p.status === status).sort((a, b) => b.updatedAt - a.updatedAt);
    };

    return (
        <div
            class={`fixed inset-y-0 right-0 w-[500px] bg-slate-900 border-l border-slate-700 shadow-2xl transform transition-transform z-50 flex flex-col ${props.isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
            <div class="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                <h2 class="font-bold text-white">Prompt Library</h2>
                <button onClick={props.onClose} class="text-slate-400 hover:text-white">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="flex-1 overflow-x-auto p-4 flex gap-4">
                <For each={COLUMNS}>
                    {(col) => (
                        <div
                            class={`flex-1 min-w-[200px] rounded-xl border border-slate-700/50 flex flex-col ${col.color}`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer!.dropEffect = 'move';
                            }}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            <div class="p-3 font-semibold text-xs text-slate-300 uppercase tracking-wider border-b border-slate-700/50 bg-slate-800/30 rounded-t-xl">
                                {col.label} ({getPromptsByStatus(col.id).length})
                            </div>
                            <div class="flex-1 p-2 space-y-2 overflow-y-auto">
                                <For each={getPromptsByStatus(col.id)}>
                                    {(item) => (
                                        <div
                                            draggable={true}
                                            onDragStart={(e) => handleDragStart(e, item.id)}
                                            class="p-3 bg-slate-800 rounded border border-slate-700 cursor-move hover:border-purple-500 transition-colors shadow-sm group"
                                        >
                                            <div class="flex justify-between items-start mb-1">
                                                <h4
                                                    class="font-medium text-sm text-white truncate cursor-pointer hover:underline"
                                                    onClick={() => props.onSelect(item)}
                                                >
                                                    {item.title || 'Untitled Prompt'}
                                                </h4>
                                                <button
                                                    onClick={() => props.onDelete(item.id)}
                                                    class="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            <p class="text-xs text-slate-500 line-clamp-2">{item.content}</p>
                                            <div class="mt-2 flex items-center justify-between text-[10px] text-slate-600">
                                                <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
                                                <span class="bg-slate-700 px-1.5 py-0.5 rounded">{item.settings?.model || 'default'}</span>
                                            </div>
                                        </div>
                                    )}
                                </For>
                                {getPromptsByStatus(col.id).length === 0 && (
                                    <div class="text-center py-4 text-xs text-slate-500 border-2 border-dashed border-slate-700/50 rounded-lg">
                                        Drop here
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};
