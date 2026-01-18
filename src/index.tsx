/* @refresh reload */
import { render } from 'solid-js/web';
import { createSignal, onMount, Show } from 'solid-js';
import { Home } from './components/Home';
import { Board } from './components/Board';
import { PromptBoard } from './components/PromptBoard';
import { PresentationView } from './components/PresentationView';
import { AgentDashboard } from './components/AgentDashboard';
import { RefineryDashboard } from './components/RefineryDashboard';
import { SnackbarContainer } from './components/Snackbar';
import { GlobalAgentBar } from './components/GlobalAgentBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initStore } from './store';
import { initPromptStore } from './promptStore';
import './index.css';
import { polyfill } from 'mobile-drag-drop';
// import "mobile-drag-drop/default.css"; // We'll add custom minimal css or use default if needed

// Initialize Drag & Drop Polyfill for touch devices
polyfill({
    dragImageCenterOnTouch: true,
    forceApply: false, // Only on touch need
});

// Fix for iOS scrolling while dragging
window.addEventListener('touchmove', function () { }, { passive: false });

const App = () => {
    // Simple routing state
    const [page, setPage] = createSignal<'home' | 'board' | 'prompts' | 'presentation' | 'refinery'>('home');
    const [boardId, setBoardId] = createSignal<string>('');
    const [promptId, setPromptId] = createSignal<string>('');

    const navigate = (path: string) => {
        window.history.pushState({}, '', path);
        handleRoute();
    };

    const handleRoute = async () => {
        const path = window.location.pathname;

        if (path === '/' || path === '') {
            setPage('home');
        } else if (path === '/r' || path.startsWith('/r/')) {
            // Refinery route: /r
            setPage('refinery');
        } else if (path.includes('/present/')) {
            // Presentation route: /prompts/:boardId/present/:promptId
            const parts = path.split('/');
            // /prompts/123/present/456 -> ["", "prompts", "123", "present", "456"]
            const bId = parts[2];
            const pId = parts[4];

            if (bId && pId) {
                setBoardId(bId);
                setPromptId(pId);
                setPage('presentation');
                await initPromptStore(bId);
            }
        } else if (path.startsWith('/prompts/')) {
            // Prompt board route: /prompts/:id
            const id = path.substring('/prompts/'.length);
            if (id) {
                setBoardId(id);
                setPage('prompts');
                // initialization moved to PromptBoard component
            } else {
                setPage('home');
            }
        } else {
            // Regular board route: /:id
            const id = path.substring(1);
            if (id && !id.includes('/')) {
                setBoardId(id);
                setPage('board');
                initStore(id);
            } else {
                setPage('home');
            }
        }
    };

    onMount(async () => {
        handleRoute();
        window.addEventListener('popstate', handleRoute);

        if ('serviceWorker' in navigator && import.meta.env.PROD) {
            navigator.serviceWorker.register('/sw.js');
        }
    });

    return (
        <>
            <Show when={page() === 'home'}>
                <Home
                    onNavigate={(id) => navigate('/' + id)}
                    onNavigatePrompts={(id) => navigate('/prompts/' + id)}
                />
            </Show>
            <Show when={page() === 'board'}>
                <Board />
                <button
                    class="fixed bottom-4 left-4 p-2 bg-slate-800 text-slate-400 hover:text-white rounded-full shadow-lg z-50 border border-slate-700 transition-colors"
                    onClick={() => navigate('/')}
                    title="Back to Home"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="w-6 h-6"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                        />
                    </svg>
                </button>
            </Show>
            <Show when={page() === 'prompts'}>
                <PromptBoard
                    boardId={boardId()}
                    onNavigateHome={() => navigate('/')}
                    onNavigatePresent={(promptId) =>
                        navigate(`/prompts/${boardId()}/present/${promptId}`)
                    }
                />
            </Show>
            <Show when={page() === 'presentation'}>
                <PresentationView
                    boardId={boardId()}
                    promptId={promptId()}
                    onClose={() => navigate('/prompts/' + boardId())}
                />
            </Show>
            <Show when={page() === 'refinery'}>
                <RefineryDashboard onNavigateHome={() => navigate('/')} />
            </Show>

            {/* Global UX Components */}
            <GlobalAgentBar />
            <AgentDashboard />
            <SnackbarContainer />
        </>
    );
};

const root = document.getElementById('root');
if (root) {
    render(
        () => (
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        ),
        root,
    );
}
