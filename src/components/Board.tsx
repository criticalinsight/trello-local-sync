import { Component, For, createSignal, createMemo } from 'solid-js';
import { store, moveCard, addCard } from '../store';
import type { Card as CardType, List as ListType } from '../types';

// Card component with drag support
const Card: Component<{ card: CardType }> = (props) => {
    const handleDragStart = (e: DragEvent) => {
        e.dataTransfer!.setData('text/plain', props.card.id);
        e.dataTransfer!.effectAllowed = 'move';
        (e.target as HTMLElement).classList.add('opacity-50');
    };

    const handleDragEnd = (e: DragEvent) => {
        (e.target as HTMLElement).classList.remove('opacity-50');
    };

    return (
        <div
            class="bg-board-card p-3 rounded-lg shadow-md cursor-grab active:cursor-grabbing
             hover:bg-board-hover transition-colors duration-150 select-none"
            draggable={true}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <p class="text-slate-100 text-sm">{props.card.title}</p>
        </div>
    );
};

// List component with drop zone
const List: Component<{ list: ListType }> = (props) => {
    const [isOver, setIsOver] = createSignal(false);
    const [newCardTitle, setNewCardTitle] = createSignal('');
    const [isAdding, setIsAdding] = createSignal(false);

    // Get cards for this list, sorted by position
    const listCards = createMemo(() => {
        return Object.values(store.cards)
            .filter((c) => c && c.listId === props.list.id)
            .sort((a, b) => a.pos - b.pos);
    });

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        setIsOver(true);
    };

    const handleDragLeave = () => {
        setIsOver(false);
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        setIsOver(false);

        const cardId = e.dataTransfer!.getData('text/plain');
        if (!cardId) return;

        // Calculate new position (end of list)
        const newPos = listCards().length;

        // Use requestAnimationFrame to ensure smooth 60fps
        requestAnimationFrame(() => {
            moveCard(cardId, props.list.id, newPos);
        });
    };

    const handleAddCard = async () => {
        const title = newCardTitle().trim();
        if (!title) return;

        await addCard(props.list.id, title);
        setNewCardTitle('');
        setIsAdding(false);
    };

    return (
        <div
            class={`bg-board-list rounded-xl p-3 min-w-[280px] max-w-[280px] flex flex-col max-h-[calc(100vh-120px)]
              transition-all duration-200 ${isOver() ? 'ring-2 ring-blue-500' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* List Header */}
            <h2 class="text-slate-100 font-semibold mb-3 px-1">{props.list.title}</h2>

            {/* Cards Container */}
            <div class="flex flex-col gap-2 overflow-y-auto flex-1 min-h-[50px]">
                <For each={listCards()}>
                    {(card) => <Card card={card} />}
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
                    class="mt-2 p-2 text-slate-400 text-sm text-left rounded hover:bg-board-card hover:text-slate-200 transition-colors"
                    onClick={() => setIsAdding(true)}
                >
                    + Add a card
                </button>
            )}
        </div>
    );
};

// Main Board component
export const Board: Component = () => {
    // Get lists sorted by position
    const lists = createMemo(() => {
        return Object.values(store.lists)
            .filter(Boolean)
            .sort((a, b) => a.pos - b.pos);
    });

    return (
        <div class="min-h-screen bg-board-bg">
            {/* Board Header */}
            <header class="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 px-6 py-4">
                <h1 class="text-xl font-bold text-white">Trello Clone</h1>
                <p class="text-slate-400 text-sm mt-1">
                    Local-First • 0ms Latency • {store.connected ? '🟢 Synced' : '🔴 Offline'}
                </p>
            </header>

            {/* Lists Container */}
            <main class="p-6 overflow-x-auto">
                <div class="flex gap-4">
                    <For each={lists()}>
                        {(list) => <List list={list} />}
                    </For>
                </div>
            </main>
        </div>
    );
};
