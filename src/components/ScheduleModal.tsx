import { Component, createSignal, Show } from 'solid-js';

interface ScheduleModalProps {
    promptId: string;
    initialCron?: string;
    initialEnabled?: boolean;
    onSave: (cron: string, enabled: boolean) => void;
    onClose: () => void;
}

export const ScheduleModal: Component<ScheduleModalProps> = (props) => {
    const [cron, setCron] = createSignal(props.initialCron || '0 0 * * *');
    const [enabled, setEnabled] = createSignal(props.initialEnabled ?? true);
    const [saving, setSaving] = createSignal(false);
    const [error, setError] = createSignal('');

    const validateCron = (val: string) => {
        const parts = val.trim().split(/\s+/);
        if (parts.length !== 5)
            return 'Cron must have exactly 5 segments (min hour day month weekday)';
        return '';
    };

    const handleSave = async () => {
        const err = validateCron(cron());
        if (err) {
            setError(err);
            return;
        }

        setSaving(true);
        try {
            await props.onSave(cron(), enabled());
            props.onClose();
        } catch (e) {
            setError('Failed to sync schedule with server');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && props.onClose()}
        >
            <div class="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div class="bg-slate-800/50 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-white flex items-center gap-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="w-5 h-5 text-purple-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        Schedule Prompt
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
                <div class="p-6 space-y-6">
                    <div class="space-y-2">
                        <label class="block text-sm font-medium text-slate-300">
                            CRON Expression
                        </label>
                        <input
                            type="text"
                            value={cron()}
                            onInput={(e) => {
                                setCron(e.currentTarget.value);
                                setError('');
                            }}
                            class={`w-full px-4 py-2.5 bg-slate-800 border rounded-xl text-white font-mono text-sm focus:outline-none transition-all
                                   ${error() ? 'border-red-500 ring-1 ring-red-500/50' : 'border-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'}`}
                            placeholder="* * * * *"
                        />
                        <Show when={error()}>
                            <p class="text-xs text-red-400 mt-1">{error()}</p>
                        </Show>
                        <div class="mt-3 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                            <p class="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-1">
                                Examples
                            </p>
                            <ul class="space-y-1 text-xs text-slate-400">
                                <li class="flex justify-between">
                                    <span>Every hour:</span>{' '}
                                    <code class="text-purple-300">0 * * * *</code>
                                </li>
                                <li class="flex justify-between">
                                    <span>Every midnight:</span>{' '}
                                    <code class="text-purple-300">0 0 * * *</code>
                                </li>
                                <li class="flex justify-between">
                                    <span>Every 15 mins:</span>{' '}
                                    <code class="text-purple-300">*/15 * * * *</code>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div class="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                        <div class="flex flex-col">
                            <span class="text-sm font-medium text-white">Enable Automation</span>
                            <span class="text-xs text-slate-500">Run this prompt on schedule</span>
                        </div>
                        <button
                            onClick={() => setEnabled(!enabled())}
                            class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none 
                                   ${enabled() ? 'bg-purple-600' : 'bg-slate-600'}`}
                        >
                            <span
                                class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled() ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </button>
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
                        disabled={saving()}
                        class="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl shadow-lg shadow-purple-900/20 transition-all disabled:opacity-50 flex items-center gap-2"
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
                        {saving() ? 'Syncing...' : 'Save Schedule'}
                    </button>
                </div>
            </div>
        </div>
    );
};
