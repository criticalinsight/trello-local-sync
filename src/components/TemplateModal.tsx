import { Component, For, createSignal } from 'solid-js';
import { PROMPT_TEMPLATES, type PromptTemplate } from '../data/templates';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (template: PromptTemplate) => void;
}

export const TemplateModal: Component<Props> = (props) => {
    const [selectedCategory, setSelectedCategory] = createSignal<string>('all');
    const [searchQuery, setSearchQuery] = createSignal('');

    const categories = ['all', 'coding', 'writing', 'analysis', 'agent'];

    const filteredTemplates = () => {
        return PROMPT_TEMPLATES.filter(t => {
            const matchesCategory = selectedCategory() === 'all' || t.category === selectedCategory();
            const matchesSearch = t.trigger.toLowerCase().includes(searchQuery().toLowerCase()) ||
                t.description.toLowerCase().includes(searchQuery().toLowerCase());
            return matchesCategory && matchesSearch;
        });
    };

    if (!props.isOpen) return null;

    return (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div class="bg-slate-800 rounded-xl border border-slate-700 w-[600px] max-h-[80vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div class="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50 rounded-t-xl">
                    <h2 class="text-lg font-semibold text-white">Load Template</h2>
                    <button onClick={props.onClose} class="text-slate-400 hover:text-white">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Filters */}
                <div class="p-4 border-b border-slate-700 flex gap-4">
                    <div class="flex-1">
                        <div class="relative">
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchQuery()}
                                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                                class="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:border-purple-500 focus:outline-none"
                            />
                            <svg class="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                    <select
                        value={selectedCategory()}
                        onChange={(e) => setSelectedCategory(e.currentTarget.value)}
                        class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none capitalize"
                    >
                        <For each={categories}>
                            {(cat) => <option value={cat}>{cat}</option>}
                        </For>
                    </select>
                </div>

                {/* List */}
                <div class="flex-1 overflow-y-auto p-4 space-y-3">
                    <For each={filteredTemplates()}>
                        {(template) => (
                            <button
                                onClick={() => props.onSelect(template)}
                                class="w-full text-left p-3 rounded-lg border border-slate-700 bg-slate-700/30 hover:bg-slate-700 hover:border-slate-600 transition-all group"
                            >
                                <div class="flex items-center justify-between mb-1">
                                    <span class="font-medium text-white group-hover:text-purple-300 transition-colors">
                                        {template.trigger}
                                    </span>
                                    <span class="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 capitalize border border-slate-700">
                                        {template.category}
                                    </span>
                                </div>
                                <p class="text-sm text-slate-400 line-clamp-2">
                                    {template.description}
                                </p>
                            </button>
                        )}
                    </For>

                    {filteredTemplates().length === 0 && (
                        <div class="text-center py-8 text-slate-500">
                            No templates found matching your criteria.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div class="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl text-center">
                    <p class="text-xs text-slate-500">
                        Loading a template will overwrite current prompt content.
                    </p>
                </div>
            </div>
        </div>
    );
};
