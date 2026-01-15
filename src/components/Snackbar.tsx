import { Component, createSignal, onCleanup, Show, For } from 'solid-js';
import { createStore, produce } from 'solid-js/store';

interface SnackbarMessage {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    duration?: number;
}

const [snackbars, setSnackbars] = createStore<SnackbarMessage[]>([]);

// Global function to show snackbars
export function showSnackbar(
    message: string,
    type: SnackbarMessage['type'] = 'info',
    duration: number = 4000
) {
    const id = crypto.randomUUID();
    setSnackbars(produce(s => s.push({ id, type, message, duration })));

    // Auto-dismiss
    setTimeout(() => {
        setSnackbars(s => s.filter(m => m.id !== id));
    }, duration);
}

export const SnackbarContainer: Component = () => {
    const getTypeStyles = (type: SnackbarMessage['type']) => {
        switch (type) {
            case 'success': return 'bg-emerald-600 border-emerald-500';
            case 'error': return 'bg-red-600 border-red-500';
            case 'warning': return 'bg-amber-600 border-amber-500';
            default: return 'bg-slate-700 border-slate-600';
        }
    };

    const getIcon = (type: SnackbarMessage['type']) => {
        switch (type) {
            case 'success':
                return <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>;
            case 'error':
                return <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>;
            case 'warning':
                return <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>;
            default:
                return <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>;
        }
    };

    const dismiss = (id: string) => {
        setSnackbars(s => s.filter(m => m.id !== id));
    };

    return (
        <div class="fixed bottom-4 left-4 z-50 space-y-2">
            <For each={snackbars}>
                {(snackbar) => (
                    <div
                        class={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-white animate-slide-up ${getTypeStyles(snackbar.type)}`}
                        onClick={() => dismiss(snackbar.id)}
                    >
                        {getIcon(snackbar.type)}
                        <span class="text-sm font-medium">{snackbar.message}</span>
                    </div>
                )}
            </For>
        </div>
    );
};
