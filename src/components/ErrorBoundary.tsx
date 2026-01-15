import { Component, JSX, ErrorBoundary as SolidErrorBoundary, createSignal } from 'solid-js';
import { showSnackbar } from './Snackbar';

/**
 * Global error boundary that catches runtime errors and failed module loads.
 * Displays a user-friendly recovery UI instead of crashing the app.
 */

interface ErrorFallbackProps {
    error: Error;
    reset: () => void;
}

const ErrorFallback: Component<ErrorFallbackProps> = (props) => {
    const isModuleError = () =>
        props.error.message.includes('Failed to fetch dynamically imported module') ||
        props.error.message.includes('Loading chunk') ||
        props.error.message.includes('Loading module');

    return (
        <div class="min-h-screen bg-slate-900 flex items-center justify-center p-6">
            <div class="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center">
                <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg class="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>

                <h2 class="text-xl font-semibold text-white mb-2">
                    {isModuleError() ? 'Connection Issue' : 'Something went wrong'}
                </h2>

                <p class="text-slate-400 mb-6 text-sm">
                    {isModuleError()
                        ? 'Failed to load application resources. This usually happens due to a network issue or a new deployment.'
                        : props.error.message || 'An unexpected error occurred.'
                    }
                </p>

                <div class="flex flex-col gap-3">
                    <button
                        onClick={() => window.location.reload()}
                        class="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 
                               text-white font-medium rounded-lg transition-all"
                    >
                        Reload Page
                    </button>

                    <button
                        onClick={props.reset}
                        class="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 
                               font-medium rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </div>

                <details class="mt-6 text-left">
                    <summary class="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                        Technical Details
                    </summary>
                    <pre class="mt-2 p-3 bg-slate-900 rounded-lg text-xs text-red-400 overflow-auto max-h-32">
                        {props.error.stack || props.error.message}
                    </pre>
                </details>
            </div>
        </div>
    );
};

interface ErrorBoundaryProps {
    children: JSX.Element;
}

export const ErrorBoundary: Component<ErrorBoundaryProps> = (props) => {
    const [errorKey, setErrorKey] = createSignal(0);

    const handleError = (error: Error) => {
        console.error('[ErrorBoundary] Caught error:', error);
        showSnackbar('An error occurred. See details on screen.', 'error');
    };

    const handleReset = () => {
        setErrorKey(k => k + 1);
    };

    return (
        <SolidErrorBoundary
            fallback={(err, reset) => {
                handleError(err);
                return <ErrorFallback error={err} reset={() => { reset(); handleReset(); }} />;
            }}
        >
            {props.children}
        </SolidErrorBoundary>
    );
};

export default ErrorBoundary;
