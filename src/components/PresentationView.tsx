
import { Component, createSignal, createEffect, onMount } from 'solid-js';
import { getCurrentVersion, getPromptsByStatus, promptStore } from '../promptStore';
import { convertToPresentation, PresentationTheme } from '../presentation/converter';

interface ViewProps {
    promptId: string;
    boardId: string;
    onClose: () => void;
}

export const PresentationView: Component<ViewProps> = (props) => {
    const [theme, setTheme] = createSignal<PresentationTheme>('document');
    const [html, setHtml] = createSignal<string>('');
    const [loading, setLoading] = createSignal(true);
    const [title, setTitle] = createSignal('');

    createEffect(async () => {
        setLoading(true);
        const prompt = promptStore.prompts[props.promptId];

        if (prompt) {
            setTitle(prompt.title);
            const version = getCurrentVersion(props.promptId);
            const content = version?.output || version?.content || '# No content';

            const generatedHtml = await convertToPresentation(content, prompt.title, theme());
            setHtml(generatedHtml);
        }
        setLoading(false);
    });

    const handleDownload = (format: 'html' | 'md') => {
        const prompt = promptStore.prompts[props.promptId];
        const version = getCurrentVersion(props.promptId);
        if (!prompt || !version) return;

        let content = '';
        let mimeType = '';
        let ext = '';

        if (format === 'html') {
            content = html();
            mimeType = 'text/html';
            ext = 'html';
        } else {
            content = version.output || version.content || '';
            mimeType = 'text/markdown';
            ext = 'md';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${prompt.title.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(html());
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        }
    };

    return (
        <div class="fixed inset-0 z-[100] bg-white text-slate-900 flex flex-col">
            {/* Toolbar */}
            <div class="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white shadow-sm shrink-0">
                <div class="flex items-center gap-4">
                    <button
                        onClick={props.onClose}
                        class="p-2 hover:bg-slate-100 rounded-full text-slate-500"
                        title="Close Presentation"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <h1 class="font-bold text-lg truncate max-w-md">{title()}</h1>
                </div>

                <div class="flex items-center gap-2">
                    <div class="flex bg-slate-100 rounded-lg p-1 mr-4">
                        <button
                            class={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${theme() === 'document' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setTheme('document')}
                        >
                            Document
                        </button>
                        <button
                            class={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${theme() === 'slides' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setTheme('slides')}
                        >
                            Slides
                        </button>
                    </div>

                    <button
                        onClick={() => handleDownload('md')}
                        class="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                    >
                        Download MD
                    </button>
                    <button
                        onClick={() => handleDownload('html')}
                        class="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                    >
                        Download HTML
                    </button>
                    <button
                        onClick={handlePrint}
                        class="px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md shadow-sm"
                    >
                        Print / PDF
                    </button>
                </div>
            </div>

            {/* Preview */}
            <div class="flex-1 bg-slate-50 overflow-hidden relative">
                {loading() ? (
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <iframe
                        srcdoc={html()}
                        class="w-full h-full border-none"
                        title="Presentation Preview"
                        sandbox="allow-same-origin allow-scripts"
                    />
                )}
            </div>
        </div>
    );
};
