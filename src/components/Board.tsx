import { Component, For, createSignal, createMemo, onMount, onCleanup, Show } from 'solid-js';
import { store, moveCard, addCard, deleteCard, updateCardTitle, deleteList, updateListTitle, addList, performUndo, performRedo, moveList } from '../store';
import { StatusPill } from './StatusPill';
import { CardModal } from './CardModal';
import { ThemeToggle } from './ThemeToggle';
import { SearchBar } from './SearchBar';
import type { Card as CardType, List as ListType } from '../types';

// Icons
const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

const PencilIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
);

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

// Card component with drag support and inline editing
const Card: Component<{ card: CardType; onOpenModal: () => void }> = (props) => {
    const [isEditing, setIsEditing] = createSignal(false);

    const handleDragStart = (e: DragEvent) => {
        if (isEditing()) {
            e.preventDefault();
            return;
        }
        e.dataTransfer!.setData('text/plain', props.card.id);
        e.dataTransfer!.effectAllowed = 'move';
        (e.target as HTMLElement).classList.add('opacity-50');
    };

    const handleDragEnd = (e: DragEvent) => {
        (e.target as HTMLElement).classList.remove('opacity-50');
    };

    const handleUpdateTitle = (e: Event) => {
        const input = e.target as HTMLInputElement;
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== props.card.title) {
            updateCardTitle(props.card.id, newTitle);
        }
        setIsEditing(false);
    };

    return (
        <div
            class="group relative bg-board-card p-3 rounded-lg shadow-md cursor-grab active:cursor-grabbing
             hover:bg-board-hover transition-colors duration-150 select-none min-h-[44px]"
            draggable={!isEditing()}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDblClick={() => setIsEditing(true)}
        >
            {isEditing() ? (
                <textarea
                    class="w-full bg-slate-700 text-slate-100 text-sm rounded p-1 border border-blue-500 focus:outline-none resize-none"
                    value={props.card.title}
                    onBlur={handleUpdateTitle}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            (e.target as HTMLTextAreaElement).blur();
                        }
                    }}
                    autofocus
                    rows={Math.max(2, Math.ceil(props.card.title.length / 30))}
                />
            ) : (
                <>
                    <p class="text-slate-100 text-sm break-words whitespace-pre-wrap">{props.card.title}</p>
                    <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                            class="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded"
                            onClick={(e) => { e.stopPropagation(); props.onOpenModal(); }}
                            title="Edit details"
                        >
                            <PencilIcon />
                        </button>
                        <button
                            class="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded"
                            onClick={(e) => { e.stopPropagation(); deleteCard(props.card.id); }}
                            title="Delete card"
                        >
                            <TrashIcon />
                        </button>
                    </div>
                    {/* Tiny badges for description/checklist */}
                    <div class="flex gap-2 mt-2 text-xs text-slate-400">
                        {props.card.description && <span>≡</span>}
                        {(props.card.checklist || []).length > 0 && (
                            <span>☑ {(props.card.checklist || []).filter(i => i.done).length}/{(props.card.checklist || []).length}</span>
                        )}
                        {(props.card.tags || []).length > 0 && (
                            <span class="flex gap-1">
                                <For each={props.card.tags}>
                                    {t => <span class="w-2 h-2 rounded-full bg-blue-500" title={t}></span>}
                                </For>
                            </span>
                        )}
                        {props.card.dueDate && props.card.dueDate > 0 && (
                            <span
                                class="flex items-center gap-1 bg-slate-700/50 px-1.5 py-0.5 rounded"
                                title={new Date(props.card.dueDate).toLocaleDateString()}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {new Date(props.card.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// List component with drop zone and draggable support
const List: Component<{ list: ListType; onOpenCard: (id: string) => void; searchQuery: string }> = (props) => {
    const [isOver, setIsOver] = createSignal(false);
    // ...

    // Get cards for this list, sorted by position, AND filtered
    const listCards = createMemo(() => {
        let cards = Object.values(store.cards)
            .filter((c) => c && c.listId === props.list.id);

        // Filter logic
        if (props.searchQuery) {
            const lowerQ = props.searchQuery.toLowerCase();
            cards = cards.filter(c => {
                const textMatch = c.title.toLowerCase().includes(lowerQ) ||
                    (c.description || '').toLowerCase().includes(lowerQ);
                const tagMatch = (c.tags || []).some(t => t.toLowerCase().includes(lowerQ));
                return textMatch || tagMatch;
            });
        }

        return cards.sort((a, b) => a.pos - b.pos);
    });

    // ... (rest is same)

    // --- Card Drop Zone ---
    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent bubbling to Board (which handles List filtering)
        // Only accept cards here
        if (e.dataTransfer?.types.includes('card-id')) {
            e.dataTransfer!.dropEffect = 'move';
            setIsOver(true);
        }
    };

    const handleDragLeave = () => {
        setIsOver(false);
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOver(false);

        // Case 1: Dropping a Card
        const cardId = e.dataTransfer!.getData('card-id');
        if (cardId) {
            const newPos = listCards().length; // Append to end
            requestAnimationFrame(() => {
                moveCard(cardId, props.list.id, newPos);
            });
            return;
        }

        // Case 2: Dropping a List
        const droppedListId = e.dataTransfer!.getData('list-id');
        if (droppedListId && droppedListId !== props.list.id) {
            // Swap positions or insert?
            // Swap is easiest to implement without complex coord calcs
            const droppedList = store.lists[droppedListId];
            if (droppedList) {
                const targetPos = props.list.pos;
                const sourcePos = droppedList.pos;
                // Ideally we shift everything, but swapping works for v1
                moveList(droppedListId, targetPos);
                moveList(props.list.id, sourcePos);
            }
        }
    };

    // --- List Dragging ---
    const handleListDragStart = (e: DragEvent) => {
        e.dataTransfer!.setData('list-id', props.list.id);
        e.dataTransfer!.effectAllowed = 'move';
        // Make ephemeral
        (e.target as HTMLElement).style.opacity = '0.5';
    };

    const handleListDragEnd = (e: DragEvent) => {
        (e.target as HTMLElement).style.opacity = '1';
    };

    const handleAddCard = async () => {
        // ... (unchanged)
        const title = newCardTitle().trim();
        if (!title) return;

        await addCard(props.list.id, title);
        setNewCardTitle('');
        setIsAdding(false);
    };

    const handleUpdateListTitle = (e: Event) => {
        // ... (unchanged)
        const input = e.target as HTMLInputElement;
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== props.list.title) {
            updateListTitle(props.list.id, newTitle);
        }
        setIsEditingTitle(false);
    };

    return (
        <div
            draggable={!isEditingTitle() && !isAdding()}
            onDragStart={handleListDragStart}
            onDragEnd={handleListDragEnd}
            class={`bg-board-list rounded-xl p-3 min-w-[280px] max-w-[280px] flex flex-col max-h-[calc(100vh-120px)]
              transition-all duration-200 cursor-default ${isOver() ? 'ring-2 ring-blue-500' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* List Header */}
            <div class="flex justify-between items-start mb-3 px-1 group">
                {isEditingTitle() ? (
                    <input
                        class="w-full bg-slate-700 text-slate-100 font-semibold px-1 rounded border border-blue-500 focus:outline-none"
                        value={props.list.title}
                        onBlur={handleUpdateListTitle}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        autofocus
                    />
                ) : (
                    <h2
                        class="text-slate-100 font-semibold cursor-pointer w-full"
                        onDblClick={() => setIsEditingTitle(true)}
                    >
                        {props.list.title}
                    </h2>
                )}

                <button
                    class="ml-2 p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-all"
                    onClick={() => {
                        if (confirm('Delete this list and all cards?')) {
                            deleteList(props.list.id);
                        }
                    }}
                    title="Delete list"
                >
                    <TrashIcon />
                </button>
            </div>

            {/* Cards Container */}
            <div class="flex flex-col gap-2 overflow-y-auto flex-1 min-h-[50px] custom-scrollbar">
                <For each={listCards()}>
                    {(card) => <Card card={card} onOpenModal={() => props.onOpenCard(card.id)} />}
                </For>
            </div>

            {/* Add Card Form */}
            {isAdding() ? (
                <div class="mt-2">
                    <textarea
                        class="w-full p-2 rounded bg-board-card text-slate-100 text-sm resize-none
                   border border-slate-600 focus:border-blue-500 focus:outline-none"
                        placeholder="Enter card title..."
                        rows={2}
                        value={newCardTitle()}
                        onInput={(e) => setNewCardTitle(e.currentTarget.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddCard();
                            }
                            if (e.key === 'Escape') {
                                setIsAdding(false);
                                setNewCardTitle('');
                            }
                        }}
                        autofocus
                    />
                    <div class="flex gap-2 mt-2">
                        <button
                            class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                            onClick={handleAddCard}
                        >
                            Add
                        </button>
                        <button
                            class="px-3 py-1.5 text-slate-400 text-sm hover:text-slate-200 transition-colors"
                            onClick={() => { setIsAdding(false); setNewCardTitle(''); }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    class="mt-2 p-2 text-slate-400 text-sm text-left rounded hover:bg-board-card hover:text-slate-200 transition-colors flex items-center gap-2"
                    onClick={() => setIsAdding(true)}
                >
                    <PlusIcon /> Add a card
                </button>
            )}
        </div>
    );
};

// Main Board component
export const Board: Component = () => {
    const [openCardId, setOpenCardId] = createSignal<string | null>(null);
    const [searchQuery, setSearchQuery] = createSignal(''); // New state

    // Keyboard shortcuts...

    // ...

    return (
        <div class="min-h-screen bg-board-bg" onDragOver={handleBoardDragOver} onDrop={handleBoardDrop}>
            <Show when={openCardId()}>
                <CardModal cardId={openCardId()!} onClose={() => setOpenCardId(null)} />
            </Show>

            {/* Board Header */}
            <header class="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 px-6 py-4 flex justify-between items-center z-10 relative">
                <div>
                    <h1 class="text-xl font-bold text-white">Trello Clone</h1>
                    <p class="text-slate-400 text-sm mt-1">Local-First • 0ms Latency</p>
                </div>
                <div class="flex items-center gap-4">
                    <SearchBar onSearch={setSearchQuery} />
                    <ThemeToggle />
                    <StatusPill />
                </div>
            </header>

            {/* Lists Container */}
            <main class="p-6 overflow-x-auto">
                <div class="flex gap-4 items-start">
                    <For each={lists()}>
                        {(list) => <List list={list} onOpenCard={setOpenCardId} searchQuery={searchQuery()} />}
                    </For>

                    {/* ... */}
                </div>
            </main>
        </div>
    );
};
// Undo: Ctrl+Z
if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    performUndo();
}
// Redo: Ctrl+Y or Ctrl+Shift+Z
if (
    ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
    ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey)
) {
    e.preventDefault();
    performRedo();
}
        };

window.addEventListener('keydown', handleKeyDown);
onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
    });

// Get lists sorted by position
const lists = createMemo(() => {
    return Object.values(store.lists)
        .filter(Boolean)
        .sort((a, b) => a.pos - b.pos);
});

// List Drop Zone on Board
const handleBoardDragOver = (e: DragEvent) => {
    if (e.dataTransfer?.types.includes('list-id')) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
    }
};

const handleBoardDrop = (e: DragEvent) => {
    if (e.dataTransfer?.types.includes('list-id')) {
        e.preventDefault();
        const listId = e.dataTransfer!.getData('list-id');
        // Logic to find new position could be complex (between lists)
        // For simplicity, let's just make it the last list or crude swapping?
        // "Real" sortable lists usually use mouse position relative to other lists.
        // Simplified approach: If dropped on the *container*, move to end?
        // Better: If dropped *on another list*, that logic should be in List component or a wrapper.

        // Actually, let's skip complex sortable logic for now and just allow dropping on the whiteboard to move to end?
        // Or better, handle drop on list to swap? 
        // Let's implement a simple "move to end if dropped on board background" for now, 
        // but fully robust sortables need a lot of calculate.

        // BETTER: Add `onDrop` to List component to handle "insert before/after".
        // But List component `onDrop` is currently hijacking for Cards.
        // We need to distinguish types.
    }
};

return (
    <div class="min-h-screen bg-board-bg" onDragOver={handleBoardDragOver} onDrop={handleBoardDrop}>
        <Show when={openCardId()}>
            <CardModal cardId={openCardId()!} onClose={() => setOpenCardId(null)} />
        </Show>

        {/* Board Header */}
        <header class="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 px-6 py-4 flex justify-between items-center z-10 relative">
            <div>
                <h1 class="text-xl font-bold text-white">Trello Clone</h1>
                <p class="text-slate-400 text-sm mt-1">Local-First • 0ms Latency</p>
            </div>
            <div class="flex items-center gap-4">
                <ThemeToggle />
                <StatusPill />
            </div>
        </header>

        {/* Lists Container */}
        <main class="p-6 overflow-x-auto">
            <div class="flex gap-4 items-start">
                <For each={lists()}>
                    {(list) => <List list={list} onOpenCard={setOpenCardId} searchQuery={searchQuery()} />}
                </For>

                {/* Add List Button */}
                <button
                    class="min-w-[280px] bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl transition-colors text-left font-medium flex items-center gap-2"
                    onClick={() => {
                        const title = prompt('Enter list title:');
                        if (title && title.trim()) {
                            addList(title.trim());
                        }
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add another list
                </button>
            </div>
        </main>
    </div>
);
};
