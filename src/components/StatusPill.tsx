import { Component, Show } from 'solid-js';
import { store } from '../store';

export const StatusPill: Component = () => {
    return (
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 shadow-sm transition-all duration-300">
            <Show
                when={store.connected}
                fallback={
                    <>
                        <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span class="text-xs font-medium text-slate-300">Offline</span>
                    </>
                }
            >
                <div class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span class="text-xs font-medium text-slate-300">Syncing Live</span>
            </Show>

            <Show when={store.syncing}>
                <svg
                    class="animate-spin h-3 w-3 text-blue-500 ml-1"
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
                    ></circle>
                    <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
            </Show>
        </div>
    );
};
