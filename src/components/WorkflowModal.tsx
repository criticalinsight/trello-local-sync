import { Component, createSignal, For, Show } from 'solid-js';
import type { PromptWorkflow, TriggerType, WorkflowTrigger } from '../types';
import { store } from '../store';

interface WorkflowModalProps {
    promptId: string;
    initialWorkflow?: PromptWorkflow;
    onSave: (workflow: PromptWorkflow) => void;
    onClose: () => void;
}

export const WorkflowModal: Component<WorkflowModalProps> = (props) => {
    const [enabled, setEnabled] = createSignal(props.initialWorkflow?.enabled ?? true);
    const [triggers, setTriggers] = createSignal<WorkflowTrigger[]>(
        props.initialWorkflow?.triggers || [{ type: 'card_added', config: {} }],
    );
    const [saving, setSaving] = createSignal(false);

    const lists = () => Object.values(store.lists).sort((a, b) => a.pos - b.pos);
    const allTags = () => {
        const tags = new Set<string>();
        Object.values(store.cards).forEach((c) => {
            if (c.tags) c.tags.forEach((t) => tags.add(t));
        });
        return Array.from(tags).sort();
    };

    const addTrigger = () => {
        setTriggers([...triggers(), { type: 'card_added', config: {} }]);
    };

    const removeTrigger = (index: number) => {
        setTriggers(triggers().filter((_, i) => i !== index));
    };

    const updateTrigger = (index: number, updates: Partial<WorkflowTrigger>) => {
        setTriggers(triggers().map((t, i) => (i === index ? { ...t, ...updates } : t)));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await props.onSave({
                enabled: enabled(),
                triggers: triggers(),
            });
            props.onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && props.onClose()}
        >
            <div class="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div class="bg-slate-800/50 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-white flex items-center gap-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="w-5 h-5 text-emerald-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                        </svg>
                        Triggered Workflows
                    </h2>
                    <button
                        onClick={props.onClose}
                        class="text-slate-400 hover:text-white transition-colors"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="w-6 h-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div class="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    {/* Master Toggle */}
                    <div class="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <div class="flex flex-col">
                            <span class="text-sm font-medium text-white">Enable Workflow</span>
                            <span class="text-xs text-slate-500">
                                Run this prompt on board events
                            </span>
                        </div>
                        <button
                            onClick={() => setEnabled(!enabled())}
                            class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none 
                                   ${enabled() ? 'bg-emerald-600' : 'bg-slate-600'}`}
                        >
                            <span
                                class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled() ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </button>
                    </div>

                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <label class="text-sm font-medium text-slate-300">Triggers</label>
                            <button
                                onClick={addTrigger}
                                class="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="w-4 h-4"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                                Add Trigger
                            </button>
                        </div>

                        <For each={triggers()}>
                            {(trigger, index) => (
                                <div class="p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-4 group">
                                    <div class="flex items-center justify-between">
                                        <select
                                            value={trigger.type}
                                            onChange={(e) =>
                                                updateTrigger(index(), {
                                                    type: e.currentTarget.value as TriggerType,
                                                })
                                            }
                                            class="bg-slate-700 border-none text-sm text-white rounded-lg focus:ring-1 focus:ring-emerald-500"
                                        >
                                            <option value="card_added">When card is added</option>
                                            <option value="card_moved">When card is moved</option>
                                            <option value="card_tagged">When card is tagged</option>
                                        </select>
                                        <button
                                            onClick={() => removeTrigger(index())}
                                            class="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                class="w-5 h-5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                />
                                            </svg>
                                        </button>
                                    </div>

                                    <Show
                                        when={
                                            trigger.type === 'card_added' ||
                                            trigger.type === 'card_moved'
                                        }
                                    >
                                        <div class="space-y-2">
                                            <label class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                                To List (Optional)
                                            </label>
                                            <select
                                                value={trigger.config?.listId || ''}
                                                onChange={(e) =>
                                                    updateTrigger(index(), {
                                                        config: {
                                                            ...trigger.config,
                                                            listId:
                                                                e.currentTarget.value || undefined,
                                                        },
                                                    })
                                                }
                                                class="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-lg px-3 py-2"
                                            >
                                                <option value="">Any List</option>
                                                <For each={lists()}>
                                                    {(list) => (
                                                        <option value={list.id}>
                                                            {list.title}
                                                        </option>
                                                    )}
                                                </For>
                                            </select>
                                        </div>
                                    </Show>

                                    <Show when={trigger.type === 'card_tagged'}>
                                        <div class="space-y-2">
                                            <label class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                                With Tag
                                            </label>
                                            <select
                                                value={trigger.config?.tag || ''}
                                                onChange={(e) =>
                                                    updateTrigger(index(), {
                                                        config: {
                                                            ...trigger.config,
                                                            tag: e.currentTarget.value || undefined,
                                                        },
                                                    })
                                                }
                                                class="w-full bg-slate-900 border border-slate-700 text-sm text-white rounded-lg px-3 py-2"
                                            >
                                                <option value="">Select Tag...</option>
                                                <For each={allTags()}>
                                                    {(tag) => <option value={tag}>{tag}</option>}
                                                </For>
                                            </select>
                                        </div>
                                    </Show>
                                </div>
                            )}
                        </For>
                    </div>
                </div>

                {/* Footer */}
                <div class="px-6 py-4 bg-slate-800/20 border-t border-slate-700 flex justify-end gap-3">
                    <button
                        onClick={props.onClose}
                        class="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving() || triggers().length === 0}
                        class="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        <Show when={saving()}>
                            <svg
                                class="animate-spin h-4 w-4"
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
                                 />
                                <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                 />
                            </svg>
                        </Show>
                        {saving() ? 'Syncing...' : 'Save Workflow'}
                    </button>
                </div>
            </div>
        </div>
    );
};
