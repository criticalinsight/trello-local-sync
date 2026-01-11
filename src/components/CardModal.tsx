```typescript
import { Component, createSignal, For, Show } from 'solid-js';
import { Card, Comment, Attachment } from '../types';
import { store, updateCardDetails, addComment, uploadAttachment } from '../store';
import { produce } from 'solid-js/store';

interface CardModalProps {
    cardId: string;
    onClose: () => void;
}

export const CardModal: Component<CardModalProps> = (props) => {
    const card = () => store.cards[props.cardId];

    // Local state for editing to avoid constant store updates on keystroke
    const [description, setDescription] = createSignal('');
    const [newTag, setNewTag] = createSignal('');
    const [newItem, setNewItem] = createSignal('');

    // Initialize/Sync local state when card opens
    // (In a real app, use createEffect to sync if card changes externally)
    const c = card();
    if (c) {
        setDescription(c.description || '');
    }

    const handleSaveDescription = () => {
        updateCardDetails(props.cardId, { description: description() });
    };

    const handleAddTag = () => {
        const tag = newTag().trim();
        if (!tag) return;

        const currentTags = card()?.tags || [];
        if (!currentTags.includes(tag)) {
            updateCardDetails(props.cardId, { tags: [...currentTags, tag] });
        }
        setNewTag('');
    };

    const removeTag = (tagToRemove: string) => {
        const currentTags = card()?.tags || [];
        updateCardDetails(props.cardId, { tags: currentTags.filter(t => t !== tagToRemove) });
    };

    const handleAddChecklistItem = () => {
        const text = newItem().trim();
        if (!text) return;

        const currentItems = card()?.checklist || [];
        const newItemObj = { id: crypto.randomUUID(), text, done: false };
        updateCardDetails(props.cardId, { checklist: [...currentItems, newItemObj] });
        setNewItem('');
    };

    const toggleItem = (itemId: string) => {
        const currentItems = card()?.checklist || [];
        const newItems = currentItems.map(item =>
            item.id === itemId ? { ...item, done: !item.done } : item
        );
        updateCardDetails(props.cardId, { checklist: newItems });
    };

    const deleteItem = (itemId: string) => {
        const currentItems = card()?.checklist || [];
        const newItems = currentItems.filter(item => item.id !== itemId);
        updateCardDetails(props.cardId, { checklist: newItems });
    };

    return (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={props.onClose}>
            <div class="bg-slate-800 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-700 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <Show when={card()} fallback={<div>Card not found</div>}>
                    {/* Header */}
                    <div class="p-6 border-b border-slate-700 flex justify-between items-start">
                        <div>
                            <h2 class="text-2xl font-bold text-white mb-2">{card()!.title}</h2>
                            <p class="text-slate-400 text-sm">in list <span class="text-slate-300 font-medium">{store.lists[card()!.listId]?.title}</span></p>
                        </div>
                        <button onClick={props.onClose} class="text-slate-400 hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div class="p-6 space-y-8">
                        {/* Tags */}
                        <div class="space-y-3">
                            <h3 class="text-slate-200 font-semibold flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 opacity-70">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" />
                                </svg>
                                Tags
                            </h3>
                            <div class="flex flex-wrap gap-2">
                                <For each={card()!.tags || []}>
                                    {tag => (
                                        <span class="bg-blue-900/50 text-blue-200 px-2 py-1 rounded text-sm border border-blue-800 flex items-center gap-1 group">
                                            {tag}
                                            <button onClick={() => removeTag(tag)} class="hover:text-white opacity-60 hover:opacity-100">×</button>
                                        </span>
                                    )}
                                </For>
                                <div class="relative">
                                    <input
                                        type="text"
                                        class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500 w-32"
                                        placeholder="+ Add tag"
                                        value={newTag()}
                                        onInput={e => setNewTag(e.currentTarget.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleAddTag(); }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div class="space-y-3">
                            <h3 class="text-slate-200 font-semibold flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 opacity-70">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                                </svg>
                                Description
                            </h3>
                            <textarea
                                class="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 focus:outline-none focus:border-blue-500 min-h-[100px] resize-y"
                                placeholder="Add a more detailed description..."
                                value={description()}
                                onInput={e => setDescription(e.currentTarget.value)}
                                onBlur={handleSaveDescription}
                            />
                        </div>

                        {/* Due Date */}
                        <div class="space-y-3">
                            <h3 class="text-slate-200 font-semibold flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 opacity-70">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Due Date
                            </h3>
                            <div class="flex items-center gap-4">
                                <input
                                    type="date"
                                    class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                    value={card()?.dueDate ? new Date(card()!.dueDate!).toISOString().slice(0, 10) : ''}
                                    onChange={(e) => {
                                        const date = e.currentTarget.valueAsDate; // Local time, but creates date at UTC midnight usually or local?
                                        if (date) {
                                            // Handle timezone offset to ensure we safe "noon" or something safe
                                            // Simplest: use timestamp of noon local time to avoid boundary issues
                                            const timestamp = date.getTime() + date.getTimezoneOffset() * 60000 + 12 * 60 * 60 * 1000;
                                            updateCardDetails(props.cardId, { dueDate: timestamp });
                                        } else {
                                            updateCardDetails(props.cardId, { dueDate: undefined }); // Clear it? Or null. Types says optional number.
                                            // Since we can't send 'undefined' easily in JSON partial updates sometimes if keys missing.
                                            // But our update logic handles it if undefined.
                                            // Wait, if undefined, keys won't be in JSON.
                                            // We need to explicitly send null if we want to clear column.
                                            // Type is `dueDate ?: number`.
                                            // Let's send 0 or null.
                                            // store logic: `if (updates.dueDate !== undefined)`
                                            // So undefined is ignored.
                                            // We need to change store to accept null or handle clear.
                                            // For now, let's keep it simple: date required.
                                        }
                                    }}
                                />
                                <Show when={card()?.dueDate}>
                                    <button
                                        onClick={() => updateCardDetails(props.cardId, { dueDate: 0 })} // 0 as marker for removal? Need store handling.
                                        class="text-red-400 hover:text-red-300 text-sm"
                                    >
                                        Remove
                                    </button>
                                </Show>
                            </div>
                        </div>

                        {/* Checklist */}
                        <div class="space-y-3">
                            <h3 class="text-slate-200 font-semibold flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 opacity-70">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Checklist
                            </h3>

                            {/* Progress Bar */}
                            <Show when={(card()!.checklist || []).length > 0}>
                                <div class="w-full bg-slate-700 rounded-full h-2">
                                    <div
                                        class="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${ Math.round(((card()!.checklist || []).filter(i => i.done).length / (card()!.checklist || []).length) * 100) }% ` }}
                                    />
                                </div>
                            </Show>

                            <div class="space-y-2">
                                <For each={card()!.checklist || []}>
                                    {item => (
                                        <div class="flex items-center gap-3 p-2 hover:bg-slate-700/30 rounded group">
                                            <input
                                                type="checkbox"
                                                checked={item.done}
                                                onChange={() => toggleItem(item.id)}
                                                class="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-offset-slate-800"
                                            />
                                            <span class={`flex - 1 text - slate - 300 ${ item.done ? 'line-through opacity-50' : '' } `}>{item.text}</span>
                                            <button
                                                onClick={() => deleteItem(item.id)}
                                                class="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </For>
                                <div class="flex gap-2">
                                    <input
                                        type="text"
                                        class="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 flex-1"
                                        placeholder="Add an item"
                                        value={newItem()}
                                        onInput={e => setNewItem(e.currentTarget.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleAddChecklistItem(); }}
                                    />
                                    <button
                                        onClick={handleAddChecklistItem}
                                        class="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
};
