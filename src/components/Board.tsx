import { Component, For, createSignal, createMemo, onMount, onCleanup, Show } from 'solid-js';
import {
    store,
    moveCard,
    addCard,
    deleteCard,
    updateCardTitle,
    deleteList,
    updateListTitle,
    addList,
    performUndo,
    performRedo,
    moveList,
    switchBoard,
} from '../store';
import { StatusPill } from './StatusPill';
import { CardModal } from './CardModal';
import { ThemeToggle } from './ThemeToggle';
import { SearchBar } from './SearchBar';
import { CalendarView } from './CalendarView';
import type { Card as CardType, List as ListType } from '../types';

// Icons
const TrashIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-4 h-4"
    >
        <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
        />
    </svg>
);

const PencilIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-4 h-4"
    >
        <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
        />
    </svg>
);

const PlusIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="w-5 h-5"
    >
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

// Card component
const Card: Component<{ card: CardType; onOpenModal: () => void }> = (props) => {
    const [isEditing, setIsEditing] = createSignal(false);

    const handleDragStart = (e: DragEvent) => {
        if (isEditing()) {
            e.preventDefault();
            return;
        }
        e.dataTransfer!.setData('card-id', props.card.id);
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
                    <p class="text-slate-100 text-sm break-words whitespace-pre-wrap">
                        {props.card.title}
                    </p>
                    <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                            class="absolute top-2 right-2 p-2 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity rounded touch-manipulation"
                            onClick={(e) => {
                                e.stopPropagation();
                                props.onOpenModal();
                            }}
                            title="Edit details"
                        >
                            <PencilIcon />
                        </button>
                        <button
                            class="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded"
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteCard(props.card.id);
                            }}
                            title="Delete card"
                        >
                            <TrashIcon />
                        </button>
                    </div>
                    {/* Tiny badges for description/checklist */}
                    <div class="flex gap-2 mt-2 text-xs text-slate-400">
                        {props.card.description && <span>≡</span>}
                        {(props.card.checklist || []).length > 0 && (
                            <span>
                                ☑ {(props.card.checklist || []).filter((i) => i.done).length}/
                                {(props.card.checklist || []).length}
                            </span>
                        )}
                        {(props.card.tags || []).length > 0 && (
                            <span class="flex gap-1">
                                <For each={props.card.tags}>
                                    {(t) => (
                                        <span
                                            class="w-2 h-2 rounded-full bg-blue-500"
                                            title={t}
                                        />
                                    )}
                                </For>
                            </span>
                        )}
                        {props.card.dueDate && props.card.dueDate > 0 && (
                            <span
                                class="flex items-center gap-1 bg-slate-700/50 px-1.5 py-0.5 rounded"
                                title={new Date(props.card.dueDate).toLocaleDateString()}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="1.5"
                                    stroke="currentColor"
                                    class="w-3 h-3"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                {new Date(props.card.dueDate).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// List component with drop zone and draggable support
const List: Component<{ list: ListType; onOpenCard: (id: string) => void; searchQuery: string }> = (
    props,
) => {
    const [isOver, setIsOver] = createSignal(false);
    const [isAdding, setIsAdding] = createSignal(false);
    const [newCardTitle, setNewCardTitle] = createSignal('');

    const handleAddCard = () => {
        if (newCardTitle().trim()) {
            addCard(props.list.id, newCardTitle().trim());
            setNewCardTitle('');
            setIsAdding(false);
        }
    };

    // Get cards for this list, sorted by position, AND filtered
    const sortedListCards = createMemo(() => {
        let cards = Object.values(store.cards).filter((c) => c && c.listId === props.list.id);

        // Filter logic
        if (props.searchQuery) {
            const lowerQ = props.searchQuery.toLowerCase();
            cards = cards.filter((c) => {
                const textMatch =
                    c.title.toLowerCase().includes(lowerQ) ||
                    (c.description || '').toLowerCase().includes(lowerQ);
                const tagMatch = (c.tags || []).some((t) => t.toLowerCase().includes(lowerQ));
                return textMatch || tagMatch;
            });
        }

        return cards.sort((a, b) => a.pos - b.pos);
    });

    const [isEditingTitle, setIsEditingTitle] = createSignal(false);

    const handleUpdateTitle = (e: Event) => {
        const input = e.target as HTMLInputElement;
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== props.list.title) {
            updateListTitle(props.list.id, newTitle);
        }
        setIsEditingTitle(false);
    };

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
            const newPos = sortedListCards().length; // Append to end
            requestAnimationFrame(() => {
                moveCard(cardId, props.list.id, newPos);
            });
            return;
        }

        // Case 2: Dropping a List
        const droppedListId = e.dataTransfer!.getData('list-id');
        if (droppedListId && droppedListId !== props.list.id) {
            // Correct usage of moveList (shift)
            const allLists = Object.values(store.lists).sort((a, b) => a.pos - b.pos);
            const oldIndex = allLists.findIndex((l) => l.id === droppedListId);
            const newIndex = allLists.findIndex((l) => l.id === props.list.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                moveList(droppedListId, oldIndex, newIndex);
            }
        }
    };

    // --- List Dragging ---
    const handleListDragStart = (e: DragEvent) => {
        e.dataTransfer!.setData('list-id', props.list.id);
        e.dataTransfer!.effectAllowed = 'move';
        (e.target as HTMLElement).style.opacity = '0.5';
    };

    const handleListDragEnd = (e: DragEvent) => {
        (e.target as HTMLElement).style.opacity = '1';
    };

    return (
        <div
            class={`flex flex-col w-72 max-h-full rounded-xl transition-colors duration-200 border border-slate-700/50 shadow-xl
                ${isOver() ? 'bg-slate-700/50 ring-2 ring-blue-500/50' : 'bg-board-list'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            draggable="true"
            onDragStart={handleListDragStart}
            onDragEnd={handleListDragEnd}
        >
            {/* List Header */}
            <div class="flex justify-between items-center p-3 shrink-0 cursor-grab active:cursor-grabbing">
                {isEditingTitle() ? (
                    <input
                        class="bg-slate-700 text-slate-100 px-2 py-1 rounded w-full font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={props.list.title}
                        onBlur={handleUpdateTitle}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        autofocus
                    />
                ) : (
                    <h3
                        class="font-semibold text-slate-200 px-2 py-1 flex-1 cursor-text"
                        onClick={() => setIsEditingTitle(true)}
                    >
                        {props.list.title}
                    </h3>
                )}
                <button
                    class="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-700 transition-colors"
                    onClick={() => {
                        if (confirm('Delete list?')) deleteList(props.list.id);
                    }}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="w-5 h-5"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>

            {/* Cards Container */}
            <div class="flex flex-col gap-2 overflow-y-auto flex-1 p-2 custom-scrollbar">
                <For each={sortedListCards()}>
                    {(card) => <Card card={card} onOpenModal={() => props.onOpenCard(card.id)} />}
                </For>
            </div>

            {/* Footer / Add Card */}
            <div class="p-3 shrink-0">
                {isAdding() ? (
                    <div class="bg-board-card p-2 rounded shadow-sm">
                        <textarea
                            class="w-full bg-slate-700 text-slate-100 text-sm rounded p-2 border border-blue-500 focus:outline-none resize-none mb-2"
                            placeholder="Enter a title for this card..."
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
                        <div class="flex gap-2">
                            <button
                                class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                onClick={handleAddCard}
                            >
                                Add
                            </button>
                            <button
                                class="px-3 py-1.5 text-slate-400 text-sm hover:text-slate-200 transition-colors"
                                onClick={() => {
                                    setIsAdding(false);
                                    setNewCardTitle('');
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        class="w-full text-left px-2 py-1.5 text-slate-400 text-sm rounded hover:bg-white/10 hover:text-slate-200 transition-colors flex items-center gap-2"
                        onClick={() => setIsAdding(true)}
                    >
                        <PlusIcon /> Add a card
                    </button>
                )}
            </div>
        </div>
    );
};

// Main Board component
export const Board: Component = () => {
    const [openCardId, setOpenCardId] = createSignal<string | null>(null);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [viewMode, setViewMode] = createSignal<'board' | 'calendar'>('board');
    const [newListTitle, setNewListTitle] = createSignal('');

    // Undo/Redo Shortcuts
    onMount(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
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

    const lists = createMemo(() => {
        return Object.values(store.lists)
            .filter(Boolean)
            .sort((a, b) => a.pos - b.pos);
    });

    const handleOpenModal = (card: CardType, listId: string) => {
        setOpenCardId(card.id);
    };

    const handleExport = () => {
        const data = {
            lists: store.lists,
            cards: store.cards,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `board-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleAddList = (e: Event) => {
        e.preventDefault();
        if (newListTitle().trim()) {
            addList(newListTitle().trim());
            setNewListTitle('');
        }
    };

    return (
        <div class="min-h-screen bg-board-bg flex flex-col">
            <Show when={openCardId()}>
                <CardModal cardId={openCardId()!} onClose={() => setOpenCardId(null)} />
            </Show>

            {/* Board Header */}
            <header class="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 px-6 py-4 flex justify-between items-center z-10 relative shrink-0">
                <div>
                    <h1 class="text-xl font-bold text-white flex items-center gap-2">
                        {store.boards[store.activeBoardId]?.icon || '📋'} {store.boards[store.activeBoardId]?.title || 'Work'}
                    </h1>
                    <p class="text-slate-400 text-sm mt-1">Refinery Engine • Multi-Board</p>
                </div>

                {/* Board Tabs */}
                <div class="flex-1 px-8 hidden md:flex gap-1">
                    <For each={Object.values(store.boards)}>
                        {(board) => (
                            <button
                                onClick={() => switchBoard(board.id)}
                                class={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2
                                    ${store.activeBoardId === board.id
                                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                            >
                                <span>{board.icon}</span>
                                <span>{board.title}</span>
                            </button>
                        )}
                    </For>
                </div>
                <div class="flex items-center gap-2 sm:gap-4">
                    {/* View Toggle */}
                    <div class="flex bg-slate-800 rounded p-1">
                        <button
                            onClick={() => setViewMode('board')}
                            class={`px-3 py-1 rounded text-sm font-medium transition-colors ${viewMode() === 'board' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Board
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            class={`px-3 py-1 rounded text-sm font-medium transition-colors ${viewMode() === 'calendar' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Calendar
                        </button>
                    </div>

                    <button
                        onClick={handleExport}
                        class="p-3 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 touch-manipulation"
                        title="Export to JSON"
                    >
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
                                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                            />
                        </svg>
                    </button>
                    <div class="hidden sm:block">
                        <SearchBar onSearch={setSearchQuery} />
                    </div>
                    <div class="scale-110">
                        <ThemeToggle />
                    </div>
                    <StatusPill />
                </div>
            </header>

            {/* Content Area */}
            <div class="flex-1 overflow-hidden relative">
                <Show
                    when={viewMode() === 'board'}
                    fallback={
                        <CalendarView
                            onOpenCard={(id) => {
                                const card = store.cards[id];
                                if (card) {
                                    handleOpenModal(card, card.listId);
                                }
                            }}
                        />
                    }
                >
                    <div class="h-full overflow-x-auto p-6">
                        <div class="flex items-start gap-6 min-w-max h-full">
                            <For each={lists()}>
                                {(list) => (
                                    <div class="w-80 shrink-0">
                                        <List
                                            list={list}
                                            searchQuery={searchQuery()}
                                            onOpenCard={(id) => {
                                                const card = store.cards[id];
                                                if (card) handleOpenModal(card, list.id);
                                            }}
                                        />
                                    </div>
                                )}
                            </For>

                            {/* Add List Button */}
                            <div class="w-72 shrink-0">
                                <form
                                    onSubmit={handleAddList}
                                    class="bg-slate-900/50 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors"
                                >
                                    <input
                                        type="text"
                                        placeholder="+ Add another list"
                                        class="w-full bg-transparent text-slate-100 placeholder-slate-400 focus:outline-none focus:placeholder-slate-500 font-medium"
                                        value={newListTitle()}
                                        onInput={(e) => setNewListTitle(e.currentTarget.value)}
                                    />
                                </form>
                            </div>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
};
