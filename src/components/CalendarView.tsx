import { Component, createSignal, For, Show } from 'solid-js';
import { store } from '../store';
import { Card } from '../types';

interface CalendarViewProps {
    onOpenCard: (cardId: string) => void;
}

export const CalendarView: Component<CalendarViewProps> = (props) => {
    const [currentDate, setCurrentDate] = createSignal(new Date());

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate().getFullYear(), currentDate().getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate().getFullYear(), currentDate().getMonth() + 1, 1));
    };

    const getCardsForDate = (day: number) => {
        const year = currentDate().getFullYear();
        const month = currentDate().getMonth();
        const startOfDay = new Date(year, month, day).setHours(0, 0, 0, 0);

        // Very basic equality check for now, can be improved to handle time zones better if needed
        // Stored dueDate is timestamp. We just check if it falls on this day.

        return Object.values(store.cards).filter(card => {
            if (!card?.dueDate) return false;
            const d = new Date(card.dueDate);
            return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
        });
    };

    return (
        <div class="h-full flex flex-col bg-slate-900 text-slate-100 p-4 overflow-hidden">
            {/* Calendar Header */}
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold">
                    {monthNames[currentDate().getMonth()]} {currentDate().getFullYear()}
                </h2>
                <div class="flex gap-2">
                    <button onClick={prevMonth} class="p-2 hover:bg-slate-700 rounded touch-manipulation">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                    <button onClick={nextMonth} class="p-2 hover:bg-slate-700 rounded touch-manipulation">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Week Headers */}
            <div class="grid grid-cols-7 gap-1 text-center font-semibold text-slate-400 mb-2">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>

            {/* Content Grid */}
            <div class="grid grid-cols-7 grid-rows-6 gap-1 flex-1 min-h-0">
                {/* Empty cells for start of month */}
                <For each={Array(getFirstDayOfMonth(currentDate()))}>
                    {() => <div class="bg-slate-800/30 rounded border border-slate-700/50"></div>}
                </For>

                {/* Days */}
                <For each={Array.from({ length: getDaysInMonth(currentDate()) }, (_, i) => i + 1)}>
                    {(day) => {
                        const cards = getCardsForDate(day);
                        return (
                            <div class="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded p-1 flex flex-col gap-1 overflow-hidden transition-colors">
                                <span class={`text-sm font-bold ${new Date().getDate() === day && new Date().getMonth() === currentDate().getMonth() && new Date().getFullYear() === currentDate().getFullYear() ? 'text-blue-400' : 'text-slate-400'}`}>
                                    {day}
                                </span>
                                <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                                    <For each={cards}>
                                        {(card) => (
                                            <div
                                                onClick={() => props.onOpenCard(card.id)}
                                                class="bg-slate-700 p-1 rounded text-xs truncate cursor-pointer hover:bg-blue-600 hover:text-white transition-colors"
                                            >
                                                {card.title}
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        );
                    }}
                </For>
            </div>
        </div>
    );
};
