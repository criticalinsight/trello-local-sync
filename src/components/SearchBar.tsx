import { Component, createSignal } from 'solid-js';

export const SearchBar: Component<{ onSearch: (query: string) => void }> = (props) => {
    const [query, setQuery] = createSignal('');

    return (
        <div class="relative w-64">
            <input
                type="text"
                class="w-full bg-slate-800 border border-slate-700 rounded-full py-1.5 pl-9 pr-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="Search cards..."
                value={query()}
                onInput={(e) => {
                    const val = e.currentTarget.value;
                    setQuery(val);
                    props.onSearch(val);
                }}
            />
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
            </svg>
            <Show when={query()}>
                <button
                    onClick={() => {
                        setQuery('');
                        props.onSearch('');
                    }}
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="2"
                        stroke="currentColor"
                        class="w-3 h-3"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </Show>
        </div>
    );
};

// Add global Show import if missing in context, or import locally
import { Show } from 'solid-js';
