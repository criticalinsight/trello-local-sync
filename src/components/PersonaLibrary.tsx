import { Component, createSignal, For, Show } from 'solid-js';
import { promptStore, addPersona, updatePersona, deletePersona } from '../promptStore';
import type { Persona } from '../types';

interface PersonaLibraryProps {
    onSelect?: (persona: Persona) => void;
    onClose: () => void;
}

export const PersonaLibrary: Component<PersonaLibraryProps> = (props) => {
    const [searchQuery, setSearchQuery] = createSignal('');
    const [editingPersona, setEditingPersona] = createSignal<Partial<Persona> | null>(null);

    const filteredPersonae = () => {
        const query = searchQuery().toLowerCase();
        return Object.values(promptStore.personae).filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.description?.toLowerCase().includes(query)
        );
    };

    const handleSave = async () => {
        const p = editingPersona();
        if (!p || !p.name || !p.systemInstructions) return;

        if (p.id) {
            await updatePersona(p.id, p);
        } else {
            await addPersona(p.name, p.systemInstructions, p.description);
        }
        setEditingPersona(null);
    };

    return (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
            <div class="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div class="px-6 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
                    <h2 class="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        Persona Library
                    </h2>
                    <button onClick={props.onClose} class="p-2 text-slate-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div class="flex-1 flex overflow-hidden">
                    {/* Sidebar / List */}
                    <div class="w-1/3 border-r border-slate-700 flex flex-col bg-slate-800/30">
                        <div class="p-4 border-b border-slate-700">
                            <input
                                type="text"
                                placeholder="Search personae..."
                                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                value={searchQuery()}
                                onInput={e => setSearchQuery(e.currentTarget.value)}
                            />
                        </div>
                        <div class="flex-1 overflow-y-auto p-2 space-y-1">
                            <button
                                onClick={() => setEditingPersona({ name: '', systemInstructions: '', description: '' })}
                                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors border border-dashed border-blue-400/30 mb-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                </svg>
                                New Persona
                            </button>
                            <For each={filteredPersonae()}>
                                {(p) => (
                                    <button
                                        onClick={() => setEditingPersona(p)}
                                        class={`w-full text-left px-3 py-2 rounded-lg transition-all ${editingPersona()?.id === p.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                                    >
                                        <div class="font-medium truncate">{p.name}</div>
                                        <div class={`text-xs truncate ${editingPersona()?.id === p.id ? 'text-blue-100' : 'text-slate-500'}`}>
                                            {p.description || 'No description'}
                                        </div>
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* Editor / Content */}
                    <div class="flex-1 flex flex-col bg-slate-900/50">
                        <Show
                            when={editingPersona()}
                            fallback={
                                <div class="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                                    <div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <h3 class="text-lg font-medium text-slate-400 mb-2">Select a Persona</h3>
                                    <p class="max-w-xs text-sm">Choose a persona from the list to edit or select it for your current prompt.</p>
                                </div>
                            }
                        >
                            <div class="flex-1 overflow-y-auto p-6 space-y-6">
                                <div class="space-y-2">
                                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Name</label>
                                    <input
                                        type="text"
                                        class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                        placeholder="e.g. Senior Rust Engineer"
                                        value={editingPersona()?.name || ''}
                                        onInput={e => setEditingPersona({ ...editingPersona()!, name: e.currentTarget.value })}
                                    />
                                </div>
                                <div class="space-y-2">
                                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                                    <input
                                        type="text"
                                        class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                        placeholder="Short summary of this persona's expertise..."
                                        value={editingPersona()?.description || ''}
                                        onInput={e => setEditingPersona({ ...editingPersona()!, description: e.currentTarget.value })}
                                    />
                                </div>
                                <div class="flex-1 min-h-[300px] flex flex-col space-y-2">
                                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">System Instructions</label>
                                    <textarea
                                        class="flex-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500 resize-none h-[250px]"
                                        placeholder="You are an expert software engineer... Always prioritize safety and performance."
                                        value={editingPersona()?.systemInstructions || ''}
                                        onInput={e => setEditingPersona({ ...editingPersona()!, systemInstructions: e.currentTarget.value })}
                                    />
                                </div>
                            </div>

                            <div class="px-6 py-4 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between">
                                <button
                                    onClick={() => editingPersona()?.id && deletePersona(editingPersona()!.id!)}
                                    class="text-sm text-red-400 hover:text-red-300 transition-colors"
                                >
                                    Delete Persona
                                </button>
                                <div class="flex items-center gap-3">
                                    <Show when={props.onSelect && editingPersona()?.id}>
                                        <button
                                            onClick={() => props.onSelect!(editingPersona() as Persona)}
                                            class="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-600 transition-all"
                                        >
                                            Select Persona
                                        </button>
                                    </Show>
                                    <button
                                        onClick={handleSave}
                                        class="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 hover:from-blue-500 hover:to-blue-400 transition-all"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </Show>
                    </div>
                </div>
            </div>
        </div>
    );
};
