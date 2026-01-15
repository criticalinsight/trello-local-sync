import { Component, createSignal, createEffect, Show, For, onMount, onCleanup } from 'solid-js';
import {
    promptStore,
    getCurrentVersion,
    getVersionsForPrompt,
    createVersion,
    updateVersion,
    runSinglePrompt,
    revertToVersion,
    updatePrompt,
    schedulePrompt,
    configureWorkflow,
} from '../promptStore';
import type { PromptVersion, PromptParameters, PromptWorkflow } from '../types';
import { ScheduleModal } from './ScheduleModal';
import { WorkflowModal } from './WorkflowModal';
import { showSnackbar } from './Snackbar';
import { PROMPT_TEMPLATES, type PromptTemplate } from '../data/templates';

// Simple markdown to HTML converter (basic subset)
// In production, use 'marked' library for full support
function renderMarkdown(text: string): string {
    if (!text) return '';

    return text
        // Headers
        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2 text-white">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-4 mb-2 text-white">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-3 text-white">$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold text-white">$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        // Code blocks
        .replace(/```(\w+)?\n([\s\S]*?)```/gim, '<pre class="bg-slate-900 rounded-lg p-3 my-2 overflow-x-auto"><code class="text-emerald-400 text-sm">$2</code></pre>')
        // Inline code
        .replace(/`(.*?)`/gim, '<code class="bg-slate-700 text-purple-300 px-1 rounded text-sm">$1</code>')
        // Lists
        .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
        // Line breaks
        .replace(/\n/gim, '<br>')
        // Links
        .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" class="text-blue-400 underline hover:text-blue-300" target="_blank">$1</a>');
}

interface PromptPlaygroundProps {
    promptId: string;
    onClose: () => void;
    onPresent?: () => void;
}

export const PromptPlayground: Component<PromptPlaygroundProps> = (props) => {
    // Get the prompt and current version
    const prompt = () => promptStore.prompts[props.promptId];
    const currentVersion = () => getCurrentVersion(props.promptId);
    const versions = () => getVersionsForPrompt(props.promptId);

    // Local editing state
    const [content, setContent] = createSignal('');
    const [systemInstructions, setSystemInstructions] = createSignal('');
    const [temperature, setTemperature] = createSignal(0.7);
    const [topP, setTopP] = createSignal(0.9);
    const [maxTokens, setMaxTokens] = createSignal(2048);
    const [hasUnsavedChanges, setHasUnsavedChanges] = createSignal(false);
    const [isRunning, setIsRunning] = createSignal(false);
    const [showSchedule, setShowSchedule] = createSignal(false);
    const [showWorkflow, setShowWorkflow] = createSignal(false);
    const [showTemplates, setShowTemplates] = createSignal(false);

    const handleLoadTemplate = (template: PromptTemplate) => {
        setContent(template.content);
        if (template.systemInstructions) {
            setSystemInstructions(template.systemInstructions);
        }
        setHasUnsavedChanges(true);
        setShowTemplates(false);
        showSnackbar({ message: `Loaded template: ${template.trigger}`, type: 'success' });
    };

    // Version history state
    const [showVersionPanel, setShowVersionPanel] = createSignal(false);
    const [compareMode, setCompareMode] = createSignal(false);
    const [compareVersionId, setCompareVersionId] = createSignal<string | null>(null);

    // Initialize from current version
    createEffect(() => {
        const v = currentVersion();
        if (v) {
            setContent(v.content || '');
            setSystemInstructions(v.systemInstructions || '');
            setTemperature(v.parameters.temperature);
            setTopP(v.parameters.topP);
            setMaxTokens(v.parameters.maxTokens);
            setHasUnsavedChanges(false);
        }
    });

    // Track changes
    const markChanged = () => setHasUnsavedChanges(true);

    // Get current parameters object
    const getParams = (): PromptParameters => ({
        temperature: temperature(),
        topP: topP(),
        maxTokens: maxTokens(),
    });

    // Save current state as new version
    const handleSave = async () => {
        await createVersion(
            props.promptId,
            content(),
            systemInstructions(),
            getParams()
        );
        setHasUnsavedChanges(false);
        showSnackbar('Prompt saved', 'success');
    };

    // Run the prompt (creates new version with output)
    const handleRun = async () => {
        setIsRunning(true);
        if (hasUnsavedChanges()) {
            await handleSave();
        }
        showSnackbar('Agent started', 'info');
        await runSinglePrompt(props.promptId);
        setIsRunning(false);
        showSnackbar('Generation complete', 'success');
    };

    // Revert to a specific version
    const handleRevert = async (versionId: string) => {
        await revertToVersion(props.promptId, versionId);
    };

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleRun();
        } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            props.onClose();
        }
    };

    onMount(() => {
        document.addEventListener('keydown', handleKeyDown);
    });

    onCleanup(() => {
        document.removeEventListener('keydown', handleKeyDown);
    });

    // Close on backdrop click
    const handleBackdropClick = (e: MouseEvent) => {
        if (e.target === e.currentTarget) {
            props.onClose();
        }
    };

    return (
        <div
            class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleBackdropClick}
        >
            <div class="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
                    <div class="flex items-center gap-3">
                        <h2 class="text-lg font-semibold text-white">Prompt Playground</h2>
                        <Show when={hasUnsavedChanges()}>
                            <span class="px-2 py-0.5 text-xs bg-amber-600/20 text-amber-400 rounded-full">
                                Unsaved changes
                            </span>
                        </Show>
                        <Show when={prompt()?.status === 'generating'}>
                            <span class="px-2 py-0.5 text-xs bg-blue-600 text-blue-100 rounded-full animate-pulse flex items-center gap-1">
                                <svg class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                                Running
                            </span>
                        </Show>
                    </div>

                    <div class="flex items-center gap-2">
                        <Show when={props.onPresent}>
                            <button
                                onClick={props.onPresent}
                                class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                title="Present Output"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </button>
                        </Show>
                        <button
                            onClick={props.onClose}
                            class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Split View Content */}
                <div class="flex-1 flex overflow-hidden">
                    {/* Left Panel - Editor */}
                    <div class="w-1/2 flex flex-col border-r border-slate-700 overflow-y-auto">
                        {/* Prompt Content - VISIBLE FIRST */}
                        <div class="flex-1 p-4">
                            <label class="block text-sm font-medium text-slate-400 mb-2">Prompt</label>
                            <textarea
                                value={content()}
                                onInput={(e) => { setContent(e.currentTarget.value); markChanged(); }}
                                placeholder="Enter your prompt here..."
                                class="w-full h-full min-h-[200px] px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg
                                       text-white placeholder-slate-500 resize-none focus:outline-none
                                       focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                            />
                        </div>

                        {/* System Instructions - Collapsible */}
                        <details class="border-t border-slate-700">
                            <summary class="p-4 cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-300 
                                           flex items-center gap-2 select-none">
                                <svg class="w-4 h-4 transition-transform details-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                                System Instructions
                                <Show when={systemInstructions()}>
                                    <span class="px-1.5 py-0.5 text-xs bg-purple-600/30 text-purple-300 rounded">set</span>
                                </Show>
                            </summary>
                            <div class="px-4 pb-4">
                                <textarea
                                    value={systemInstructions()}
                                    onInput={(e) => { setSystemInstructions(e.currentTarget.value); markChanged(); }}
                                    placeholder="Optional system context..."
                                    class="w-full h-20 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                                           text-white placeholder-slate-500 resize-none focus:outline-none
                                           focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm"
                                />
                            </div>
                        </details>
                    </div>

                    {/* Right Panel - Output Preview */}
                    <div class="w-1/2 flex flex-col bg-slate-850 overflow-y-auto">
                        <div class="p-4 border-b border-slate-700">
                            <label class="block text-sm font-medium text-slate-400">Output Preview</label>
                        </div>

                        <div class="flex-1 p-4 overflow-y-auto">
                            <Show
                                when={currentVersion()?.output}
                                fallback={
                                    <div class="text-center py-12 text-slate-500">
                                        <p class="mb-2">No output yet</p>
                                        <p class="text-sm">Press <kbd class="px-2 py-1 bg-slate-700 rounded text-xs">⌘+Enter</kbd> to run</p>
                                    </div>
                                }
                            >
                                <div
                                    class="prose prose-invert prose-slate max-w-none text-slate-300"
                                    innerHTML={renderMarkdown(currentVersion()?.output || '')}
                                />
                            </Show>

                            <Show when={currentVersion()?.error}>
                                <div class="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg">
                                    <p class="text-red-400 text-sm font-medium">Error</p>
                                    <p class="text-red-300 text-sm mt-1">{currentVersion()?.error}</p>
                                </div>
                            </Show>
                        </div>
                    </div>
                </div>

                {/* Parameter Controls */}
                <div class="px-6 py-4 border-t border-slate-700 bg-slate-800/50">
                    <div class="flex items-center gap-8">
                        {/* Temperature */}
                        <div class="flex items-center gap-3">
                            <label class="text-sm text-slate-400 w-24">Temperature</label>
                            <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={temperature()}
                                onInput={(e) => { setTemperature(parseFloat(e.currentTarget.value)); markChanged(); }}
                                class="w-32 accent-purple-500"
                            />
                            <span class="text-sm text-white font-mono w-10">{temperature().toFixed(1)}</span>
                        </div>

                        {/* Top-P */}
                        <div class="flex items-center gap-3">
                            <label class="text-sm text-slate-400 w-12">Top-P</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={topP()}
                                onInput={(e) => { setTopP(parseFloat(e.currentTarget.value)); markChanged(); }}
                                class="w-32 accent-purple-500"
                            />
                            <span class="text-sm text-white font-mono w-10">{topP().toFixed(2)}</span>
                        </div>

                        {/* Max Tokens */}
                        <div class="flex items-center gap-3">
                            <label class="text-sm text-slate-400 w-24">Max Tokens</label>
                            <input
                                type="number"
                                min="1"
                                max="128000"
                                step="256"
                                value={maxTokens()}
                                onInput={(e) => { setMaxTokens(parseInt(e.currentTarget.value) || 2048); markChanged(); }}
                                class="w-24 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Enhanced Version History Panel */}
                <div class="border-t border-slate-700 bg-slate-800/30">
                    {/* Header Row */}
                    <div class="px-6 py-3 flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <button
                                onClick={() => setShowVersionPanel(!showVersionPanel())}
                                class="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                            >
                                <svg
                                    class={`w-4 h-4 transition-transform ${showVersionPanel() ? 'rotate-90' : ''}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                                Version History
                                <span class="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                                    {versions().length}
                                </span>
                            </button>

                            {/* Quick dots */}
                            <div class="flex items-center gap-1">
                                <For each={versions().slice(-8)}>
                                    {(version, index) => {
                                        const isCurrent = () => version.id === prompt()?.currentVersionId;
                                        const hasOutput = () => !!version.output;
                                        const isCompare = () => compareVersionId() === version.id;

                                        return (
                                            <button
                                                onClick={() => handleRevert(version.id)}
                                                onContextMenu={(e) => { e.preventDefault(); setCompareVersionId(version.id); }}
                                                title={`v${versions().length - 7 + index()} - ${new Date(version.createdAt).toLocaleTimeString()}${hasOutput() ? ' ✓' : ''}`}
                                                class={`w-2.5 h-2.5 rounded-full transition-all ${isCompare()
                                                    ? 'bg-amber-500 ring-2 ring-amber-400/50'
                                                    : isCurrent()
                                                        ? 'bg-purple-500 ring-2 ring-purple-400/50'
                                                        : hasOutput()
                                                            ? 'bg-emerald-500/60 hover:bg-emerald-400'
                                                            : 'bg-slate-700 hover:bg-slate-600'
                                                    }`}
                                            />
                                        );
                                    }}
                                </For>
                            </div>
                        </div>

                        <div class="flex items-center gap-3">
                            <Show when={versions().length > 1}>
                                <button
                                    onClick={() => setCompareMode(!compareMode())}
                                    class={`px-2 py-1 text-xs font-medium rounded transition-colors ${compareMode()
                                        ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                                        : 'bg-slate-700 text-slate-400 hover:text-white border border-slate-600'
                                        }`}
                                >
                                    {compareMode() ? 'Exit Compare' : 'Compare'}
                                </button>
                            </Show>
                            <span class="text-xs text-slate-500">
                                v{versions().findIndex(v => v.id === prompt()?.currentVersionId) + 1} of {versions().length}
                            </span>
                        </div>
                    </div>

                    {/* Expanded Version Cards */}
                    <Show when={showVersionPanel()}>
                        <div class="px-6 pb-4 max-h-48 overflow-y-auto">
                            <div class="grid grid-cols-4 gap-2">
                                <For each={versions()}>
                                    {(version, index) => {
                                        const isCurrent = () => version.id === prompt()?.currentVersionId;
                                        const hasOutput = () => !!version.output;
                                        const isCompare = () => compareVersionId() === version.id;

                                        return (
                                            <button
                                                onClick={() => compareMode() ? setCompareVersionId(version.id) : handleRevert(version.id)}
                                                class={`p-2 rounded-lg text-left transition-all border ${isCompare()
                                                    ? 'bg-amber-900/30 border-amber-500/50'
                                                    : isCurrent()
                                                        ? 'bg-purple-900/30 border-purple-500/50'
                                                        : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                                                    }`}
                                            >
                                                <div class="flex items-center justify-between mb-1">
                                                    <span class="text-xs font-medium text-white">v{index() + 1}</span>
                                                    <Show when={hasOutput()}>
                                                        <span class="w-2 h-2 rounded-full bg-emerald-500" title="Has output" />
                                                    </Show>
                                                </div>
                                                <div class="text-xs text-slate-500 truncate">
                                                    {new Date(version.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <Show when={version.output}>
                                                    <div class="text-xs text-slate-400 truncate mt-1">
                                                        {version.output.slice(0, 40)}...
                                                    </div>
                                                </Show>
                                            </button>
                                        );
                                    }}
                                </For>
                            </div>
                        </div>
                    </Show>

                    {/* Comparison View */}
                    <Show when={compareMode() && compareVersionId()}>
                        <div class="px-6 pb-4 border-t border-slate-700 pt-3">
                            <div class="flex items-center gap-2 mb-3">
                                <span class="text-xs text-amber-400 font-medium">Comparing:</span>
                                <span class="px-2 py-0.5 text-xs bg-amber-900/30 text-amber-300 rounded">
                                    v{versions().findIndex(v => v.id === compareVersionId()) + 1}
                                </span>
                                <span class="text-xs text-slate-500">vs</span>
                                <span class="px-2 py-0.5 text-xs bg-purple-900/30 text-purple-300 rounded">
                                    v{versions().findIndex(v => v.id === prompt()?.currentVersionId) + 1} (current)
                                </span>
                            </div>
                            <div class="grid grid-cols-2 gap-4 max-h-40 overflow-y-auto">
                                <div class="p-3 bg-slate-900 rounded-lg border border-amber-800/30">
                                    <div class="text-xs text-amber-400 mb-2">Previous Output</div>
                                    <div class="text-sm text-slate-300 whitespace-pre-wrap">
                                        {promptStore.versions[compareVersionId()!]?.output || 'No output'}
                                    </div>
                                </div>
                                <div class="p-3 bg-slate-900 rounded-lg border border-purple-800/30">
                                    <div class="text-xs text-purple-400 mb-2">Current Output</div>
                                    <div class="text-sm text-slate-300 whitespace-pre-wrap">
                                        {currentVersion()?.output || 'No output'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Show>
                </div>

                {/* Footer Actions */}
                <div class="px-6 py-4 border-t border-slate-700 bg-slate-800 flex items-center justify-between">
                    <div class="text-sm text-slate-500">
                        <kbd class="px-2 py-1 bg-slate-700 rounded text-xs mr-1">⌘+Enter</kbd> Run
                        <span class="mx-3">|</span>
                        <kbd class="px-2 py-1 bg-slate-700 rounded text-xs mr-1">⌘+S</kbd> Save
                        <span class="mx-3">|</span>
                        <kbd class="px-2 py-1 bg-slate-700 rounded text-xs mr-1">Esc</kbd> Close
                    </div>

                    <div class="flex items-center gap-3">
                        <button
                            onClick={() => setShowSchedule(true)}
                            class={`px-4 py-2 text-sm font-medium rounded-lg transition-colors border ${prompt()?.schedule?.enabled
                                ? 'bg-amber-900/30 border-amber-500/50 text-amber-200 hover:bg-amber-900/50'
                                : 'bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600 border-slate-600'
                                }`}
                        >
                            {prompt()?.schedule?.enabled ? 'Scheduled' : 'Schedule'}
                        </button>
                        <button
                            onClick={() => setShowWorkflow(true)}
                            class={`px-4 py-2 text-sm font-medium rounded-lg transition-colors border ${prompt()?.workflow?.enabled
                                ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-200 hover:bg-emerald-900/50'
                                : 'bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600 border-slate-600'
                                }`}
                        >
                            {prompt()?.workflow?.enabled ? 'Workflow' : 'Workflow'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasUnsavedChanges()}
                            class="px-4 py-2 text-sm font-medium rounded-lg transition-colors
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   bg-slate-700 text-white hover:bg-slate-600"
                        >
                            Save Draft
                        </button>
                        <button
                            onClick={handleRun}
                            disabled={isRunning() || prompt()?.status === 'generating'}
                            class="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white"
                        >
                            <Show when={isRunning() || prompt()?.status === 'generating'}>
                                <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                            </Show>
                            <Show when={!(isRunning() || prompt()?.status === 'generating')}>
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                </svg>
                            </Show>
                            {isRunning() || prompt()?.status === 'generating' ? 'Running...' : 'Run Prompt'}
                        </button>
                    </div>
                </div>
            </div>

            <Show when={showSchedule()}>
                <ScheduleModal
                    promptId={props.promptId}
                    initialCron={prompt()?.schedule?.cron}
                    initialEnabled={prompt()?.schedule?.enabled}
                    onClose={() => setShowSchedule(false)}
                    onSave={(cron, enabled) => schedulePrompt(props.promptId, cron, enabled)}
                />
            </Show>

            <Show when={showWorkflow()}>
                <WorkflowModal
                    promptId={props.promptId}
                    initialWorkflow={prompt()?.workflow}
                    onClose={() => setShowWorkflow(false)}
                    onSave={(workflow) => configureWorkflow(props.promptId, workflow)}
                />
            </Show>
        </div>
    );
};

export default PromptPlayground;
