
import { Component, createSignal } from 'solid-js';

interface ScheduleModalProps {
    promptId: string;
    initialCron?: string;
    initialEnabled?: boolean;
    onSave: (cron: string, enabled: boolean) => void;
    onClose: () => void;
}

export const ScheduleModal: Component<ScheduleModalProps> = (props) => {
    const [cron, setCron] = createSignal(props.initialCron || '* * * * *');
    const [enabled, setEnabled] = createSignal(props.initialEnabled ?? true);
    const [saving, setSaving] = createSignal(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await props.onSave(cron(), enabled());
            props.onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div class="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
            <div class="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div class="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-slate-800">Schedule Prompt</h2>
                    <button onClick={props.onClose} class="text-slate-400 hover:text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div class="p-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">CRON Expression</label>
                        <input
                            type="text"
                            value={cron()}
                            onInput={(e) => setCron(e.currentTarget.value)}
                            class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                            placeholder="* * * * *"
                        />
                        <p class="mt-1 text-xs text-slate-500">
                            Format: minute hour day month weekday. <br />
                            Example: <code class="bg-slate-100 px-1 rounded">*/15 * * * *</code> (every 15 mins)
                        </p>
                    </div>

                    <div class="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="enabled-check"
                            checked={enabled()}
                            onChange={(e) => setEnabled(e.currentTarget.checked)}
                            class="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                        />
                        <label for="enabled-check" class="text-sm font-medium text-slate-700">Enable Schedule</label>
                    </div>
                </div>

                <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        onClick={props.onClose}
                        class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving()}
                        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                    >
                        {saving() ? 'Saving...' : 'Save Schedule'}
                    </button>
                </div>
            </div>
        </div>
    );
};
