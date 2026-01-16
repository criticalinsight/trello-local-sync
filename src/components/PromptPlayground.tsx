import { Component, createSignal, createEffect, createMemo, Show, For, onMount, onCleanup } from 'solid-js';
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
import { TemplateModal } from './TemplateModal';
import { GEMINI_MODELS, generate, type GeminiModel } from '../aiService';
import { VersionDiff } from './VersionDiff';
import { estimateTokens, estimateCost, formatCost } from '../utils/tokenEstimator';
import { PromptHistoryView } from './PromptHistoryView';
import { AVAILABLE_TOOLS, type HelperTool } from '../utils/mcpMapper';
import { analyzePromptForParams } from '../utils/promptAnalyzer';

// Simple markdown to HTML converter (basic subset)
// In production, use 'marked' library for full support
function renderMarkdown(text: string): string {
    if (!text) return '';

    return (
        text
            // Thought Process Blocks
            .replace(
                /<thought>([\s\S]*?)<\/thought>/gim,
                `<details class="mb-4 border border-blue-800/50 bg-blue-900/10 rounded-lg overflow-hidden group">
                    <summary class="px-4 py-2 bg-blue-900/20 text-blue-300 text-xs font-semibold uppercase tracking-wider cursor-pointer flex items-center gap-2 hover:bg-blue-900/30 transition-colors select-none">
                        <span class="opacity-70 group-open:rotate-90 transition-transform">▸</span>
                        Thought Process
                    </summary>
                    <div class="p-4 text-slate-300 text-sm font-mono whitespace-pre-wrap overflow-x-auto border-t border-blue-800/30 bg-slate-900/50">$1</div>
                </details>`,
            )
            // Headers
            .replace(
                /^### (.*$)/gim,
                '<h3 class="text-lg font-semibold mt-4 mb-2 text-white">$1</h3>',
            )
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-4 mb-2 text-white">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-3 text-white">$1</h1>')
            // Bold
            .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold text-white">$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            // Code blocks
            .replace(
                /```(\w+)?\n([\s\S]*?)```/gim,
                '<pre class="bg-slate-900 rounded-lg p-3 my-2 overflow-x-auto"><code class="text-emerald-400 text-sm">$2</code></pre>',
            )
            // Inline code
            .replace(
                /`(.*?)`/gim,
                '<code class="bg-slate-700 text-purple-300 px-1 rounded text-sm">$1</code>',
            )
            // Lists
            .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
            // Line breaks
            .replace(/\n/gim, '<br>')
            // Links
            .replace(
                /\[(.*?)\]\((.*?)\)/gim,
                '<a href="$2" class="text-blue-400 underline hover:text-blue-300" target="_blank">$1</a>',
            )
    );
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
    const [activeTab, setActiveTab] = createSignal<'output' | 'compare' | 'history'>('output');
    const [isCompareMode, setIsCompareMode] = createSignal(false);
    const [content, setContent] = createSignal('');
    const [systemInstructions, setSystemInstructions] = createSignal('');
    const [model, setModel] = createSignal<string>('gemini-2.5-flash'); // Track model selection
    const [temperature, setTemperature] = createSignal(0.7);
    const [topP, setTopP] = createSignal(0.9);
    const [maxTokens, setMaxTokens] = createSignal(2048);
    const [thinkingLevel, setThinkingLevel] = createSignal<'minimal' | 'low' | 'medium' | 'high' | undefined>(undefined);
    const [responseSchema, setResponseSchema] = createSignal('');
    const [attachedFiles, setAttachedFiles] = createSignal<{ uri: string; name: string }[]>([]);
    const [allowedTools, setAllowedTools] = createSignal<string[]>([]);
    const [refineInput, setRefineInput] = createSignal('');
    const [isUploading, setIsUploading] = createSignal(false);
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
        // TODO: Load schema from template if supported
        setHasUnsavedChanges(true);
        setShowTemplates(false);
        showSnackbar(`Loaded template: ${template.trigger}`, 'success');
    };

    // Version history state
    const [showVersionPanel, setShowVersionPanel] = createSignal(false);
    const [compareMode, setCompareMode] = createSignal(false);
    const [compareVersionId, setCompareVersionId] = createSignal<string | null>(null);

    // Model Comparison State (Phase 13)
    const [showModelComparison, setShowModelComparison] = createSignal(false);
    const [comparisonModel, setComparisonModel] = createSignal<GeminiModel>(
        GEMINI_MODELS[0] === 'deep-research-pro-preview-12-2025'
            ? 'gemini-3-pro-preview'
            : GEMINI_MODELS[0],
    );
    const [comparisonOutput, setComparisonOutput] = createSignal('');
    const [comparisonIsRunning, setComparisonIsRunning] = createSignal(false);
    const [comparisonError, setComparisonError] = createSignal('');
    const [showDiff, setShowDiff] = createSignal(false);

    // Auto-Detect Mode (Phase 17)
    const [isAutoMode, setIsAutoMode] = createSignal(false);
    const [detectedIntent, setDetectedIntent] = createSignal<string>('');

    // Auto-Tuning Effect
    createEffect(() => {
        if (!isAutoMode()) {
            setDetectedIntent('');
            return;
        }

        const text = content();
        // Simple debounce via timeout not easily done in createEffect without primitives, 
        // relying on Solid's batching or effectively running on every keypress is fine for this lightweight regex.
        // For production, use a proper debounced signal.

        const analysis = analyzePromptForParams(text);

        if (analysis.intent !== 'default') {
            setDetectedIntent(analysis.intent);
            // Only update if changed to avoid loopiness? 
            // Actually signals check equality, so setting same value is no-op.
            if (analysis.model) setModel(analysis.model);
            if (analysis.temperature !== undefined) setTemperature(analysis.temperature);
            if (analysis.topP !== undefined) setTopP(analysis.topP);
        } else {
            setDetectedIntent('default');
        }
    });

    // Initialize from current version
    createEffect(() => {
        const v = currentVersion();
        if (v) {
            setContent(v.content || '');
            setSystemInstructions(v.systemInstructions || '');
            setTemperature(v.parameters.temperature);
            setTopP(v.parameters.topP);
            setMaxTokens(v.parameters.maxTokens);
            setThinkingLevel(v.parameters.thinkingLevel);
            setResponseSchema(v.parameters.responseSchema || '');
            setModel(v.parameters.model || 'gemini-2.5-flash');
            setAttachedFiles(v.parameters.files || []);
            setAllowedTools(v.parameters.allowedTools || []);
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
        thinkingLevel: thinkingLevel(),
        responseSchema: responseSchema() || undefined,
        model: model(),
        files: attachedFiles().length > 0 ? attachedFiles() : undefined,
        allowedTools: allowedTools().length > 0 ? allowedTools() : undefined,
    });

    // Save current state as new version
    const handleSave = async () => {
        await createVersion(props.promptId, content(), systemInstructions(), getParams());
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

        try {
            // Validate schema if present
            if (responseSchema()) {
                try {
                    JSON.parse(responseSchema());
                } catch (e) {
                    showSnackbar('Invalid JSON Schema', 'error');
                    setIsRunning(false);
                    return;
                }
            }

            if (showModelComparison()) {
                // Parallel execution
                setComparisonIsRunning(true);
                setComparisonError('');

                const primaryPromise = runSinglePrompt(props.promptId);

                const comparisonPromise = (async () => {
                    try {
                        const output = await generate(content(), systemInstructions(), {
                            ...getParams(),
                            model: comparisonModel(), // Use selected model override
                        } as any);
                        setComparisonOutput(output);
                    } catch (e) {
                        setComparisonError((e as Error).message);
                    } finally {
                        setComparisonIsRunning(false);
                    }
                })();

                await primaryPromise;
            } else {
                await runSinglePrompt(props.promptId);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsRunning(false);
        }
        showSnackbar('Generation complete', 'success');
    };

    const handleRefine = async () => {
        const v = currentVersion();
        if (!v || !v.interactionId || !refineInput().trim()) return;

        setIsRunning(true);
        // Create a new version for the refinement
        // We set the previousInteractionId to link the context
        createVersion(
            props.promptId,
            refineInput(),
            v.systemInstructions || '',
            {
                ...v.parameters,
                previousInteractionId: v.interactionId,
            }
        );

        // Execute immediately
        await runSinglePrompt(props.promptId);
        setRefineInput('');
        setIsRunning(false);
    };

    // Handle File Upload for Multimodal
    const handleFileUpload = async (event: Event) => {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        const file = input.files[0];
        setIsUploading(true);
        showSnackbar('Uploading file...', 'info');

        try {
            const response = await fetch(`/api/ai/upload_file?filename=${encodeURIComponent(file.name)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': file.type || 'application/octet-stream',
                    'Content-Length': file.size.toString(),
                },
                body: file,
            });

            if (!response.ok) throw new Error(await response.text());

            const data = (await response.json()) as { file?: { uri: string } };
            if (data.file?.uri) {
                // Use functional update or simpler spread-append
                const newFiles = [...(attachedFiles() || []), { uri: data.file.uri as string, name: file.name }];
                setAttachedFiles(newFiles);
                setHasUnsavedChanges(true);
                showSnackbar('File attached', 'success');
            }
        } catch (e) {
            console.error(e);
            showSnackbar(`Upload failed: ${(e as Error).message}`, 'error');
        } finally {
            setIsUploading(false);
            input.value = ''; // Reset input to allow same file selection again
        }
    };

    const handleRemoveFile = (index: number) => {
        const current = attachedFiles();
        const next = [...current];
        next.splice(index, 1);
        setAttachedFiles(next);
        setHasUnsavedChanges(true);
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

    // Token and Cost Estimation
    const stats = createMemo(() => {
        const promptContent = content();
        const model = currentVersion()?.parameters?.model || 'gemini-1.5-pro'; // Default model for estimation

        const tokens = estimateTokens(promptContent);
        const cost = estimateCost(tokens, model);
        return { tokens, cost };
    });

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
                                <svg
                                    class="animate-spin w-3 h-3"
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
                                {model() === 'deep-research-pro-preview-12-2025' ? 'Polling Agent...' : 'Running'}
                            </span>
                        </Show>
                    </div>

                    {/* Comparison Control */}
                    <div class="flex items-center gap-3 px-4 border-l border-slate-700 mx-2">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showModelComparison()}
                                onChange={(e) => setShowModelComparison(e.currentTarget.checked)}
                                class="w-4 h-4 rounded border-slate-600 text-purple-600 focus:ring-purple-500 bg-slate-700"
                            />
                            <span class="text-sm text-slate-300">Compare Models</span>
                        </label>

                        <Show when={showModelComparison()}>
                            <select
                                value={comparisonModel()}
                                onChange={(e) =>
                                    setComparisonModel(e.currentTarget.value as GeminiModel)
                                }
                                class="bg-slate-800 border border-slate-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-purple-500"
                            >
                                <For
                                    each={[
                                        'gemini-3-pro-preview',
                                        'deep-research-pro-preview-12-2025',
                                    ]}
                                >
                                    {(model) => <option value={model}>{model}</option>}
                                </For>
                            </select>
                        </Show>
                    </div>

                    <div class="flex items-center gap-2">
                        {/* Token Badge */}
                        <div class="flex items-center gap-2 mr-4 px-3 py-1.5 bg-slate-800 rounded border border-slate-700 text-xs shadow-sm">
                            <span
                                class={`font-medium ${stats().tokens > 30000 ? 'text-red-400' : stats().tokens > 10000 ? 'text-yellow-400' : 'text-emerald-400'}`}
                            >
                                ~{stats().tokens.toLocaleString()} tokens
                            </span>
                            <span class="text-slate-500">|</span>
                            <span class="text-slate-400">{formatCost(stats().cost)}</span>
                        </div>

                        <Show when={props.onPresent}>
                            <button
                                onClick={props.onPresent}
                                class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                title="Present Output"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="w-5 h-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    stroke-width="2"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                    />
                                </svg>
                            </button>
                        </Show>

                        {/* Automation Buttons (Phase 11) */}
                        <button
                            onClick={() => setShowSchedule(true)}
                            class={`p-2 rounded-lg transition-colors ${prompt()?.schedule?.enabled ? 'text-purple-400 bg-purple-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            title={prompt()?.schedule?.enabled ? 'Scheduled' : 'Schedule Prompt'}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-5 h-5"
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
                        </button>

                        <button
                            onClick={() => setShowWorkflow(true)}
                            class={`p-2 rounded-lg transition-colors ${prompt()?.workflow?.enabled ? 'text-emerald-400 bg-emerald-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            title={prompt()?.workflow?.enabled ? 'Workflow Active' : 'Configure Workflow'}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-5 h-5"
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
                        </button>
                        <button
                            onClick={props.onClose}
                            class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="w-5 h-5"
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
                </div>

                {/* Split View Content */}
                <div class="flex-1 flex overflow-hidden">
                    {/* Left Panel - Editor */}
                    <div
                        class={`${showModelComparison() ? 'w-1/3 min-w-[300px]' : 'w-1/2'} flex flex-col border-r border-slate-700 overflow-y-auto transition-all`}
                    >
                        {/* Prompt Content - VISIBLE FIRST */}
                        <div class="flex-1 p-4 flex flex-col">
                            <div class="flex justify-between items-center mb-2">
                                <label class="block text-sm font-medium text-slate-400">
                                    Prompt
                                </label>
                                <div class="flex items-center gap-2">
                                    <For each={attachedFiles()}>
                                        {(file, i) => (
                                            <div class="flex items-center gap-1 px-2 py-1 bg-slate-700/50 rounded border border-slate-600 text-xs text-slate-300">
                                                <span class="truncate max-w-[100px]" title={file.name}>
                                                    {file.name}
                                                </span>
                                                <button
                                                    onClick={() => handleRemoveFile(i())}
                                                    class="text-slate-500 hover:text-red-400 ml-1"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        )}
                                    </For>
                                    <label
                                        class={`cursor-pointer p-1.5 rounded hover:bg-slate-700 transition-colors ${isUploading() ? 'opacity-50 pointer-events-none' : 'text-slate-400 hover:text-white'}`}
                                        title="Attach file (Multimodal)"
                                    >
                                        <input
                                            type="file"
                                            class="hidden"
                                            onChange={handleFileUpload}
                                            disabled={isUploading()}
                                        />
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            class={`w-4 h-4 ${isUploading() ? 'animate-pulse' : ''}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                stroke-width="2"
                                                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                            />
                                        </svg>
                                    </label>
                                </div>
                            </div>
                            <textarea
                                value={content()}
                                onInput={(e) => {
                                    setContent(e.currentTarget.value);
                                    markChanged();
                                }}
                                placeholder="Enter your prompt here..."
                                class="w-full flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg
                                       text-white placeholder-slate-500 resize-none focus:outline-none
                                       focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                            />
                        </div>

                        {/* System Instructions - Collapsible */}
                        <details class="border-t border-slate-700">
                            <summary
                                class="p-4 cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-300 
                                           flex items-center gap-2 select-none"
                            >
                                <svg
                                    class="w-4 h-4 transition-transform details-open:rotate-90"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                                System Instructions
                                <Show when={systemInstructions()}>
                                    <span class="px-1.5 py-0.5 text-xs bg-purple-600/30 text-purple-300 rounded">
                                        set
                                    </span>
                                </Show>
                            </summary>
                            <div class="px-4 pb-4">
                                <textarea
                                    value={systemInstructions()}
                                    onInput={(e) => {
                                        setSystemInstructions(e.currentTarget.value);
                                        markChanged();
                                    }}
                                    placeholder="Optional system context..."
                                    class="w-full h-20 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                                           text-white placeholder-slate-500 resize-none focus:outline-none
                                           focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm"
                                />
                            </div>
                        </details>

                        {/* Generation Settings (Phase 16) */}
                        <details class="border-t border-slate-700" open>
                            <summary
                                class="p-4 cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-300 
                                           flex items-center gap-2 select-none"
                            >
                                <svg
                                    class="w-4 h-4 transition-transform details-open:rotate-90"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                                Generation Settings
                                <span class="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-300 rounded font-mono">
                                    {model().replace('gemini-', '')}
                                </span>

                                <div class="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <span class="text-xs text-slate-500 font-medium uppercase tracking-wider">
                                        Auto
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsAutoMode(!isAutoMode())}
                                        class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${isAutoMode() ? 'bg-blue-600' : 'bg-slate-600'
                                            }`}
                                    >
                                        <span
                                            class={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isAutoMode() ? 'translate-x-4.5' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                            </summary>
                            <div class="px-4 pb-4 space-y-4">
                                {/* Auto-Mode Indicator */}
                                <Show when={isAutoMode() && detectedIntent()}>
                                    <div class="p-2 bg-blue-900/20 border border-blue-800/50 rounded flex items-center gap-2">
                                        <svg class="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <span class="text-xs text-blue-300">
                                            Optimized for: <span class="font-bold uppercase">{detectedIntent()}</span>
                                        </span>
                                    </div>
                                </Show>

                                {/* Model Selector */}
                                <div class={isAutoMode() ? 'opacity-50 pointer-events-none' : ''}>
                                    <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Model</label>
                                    <select
                                        value={model()}
                                        onChange={(e) => {
                                            setModel(e.currentTarget.value);
                                            markChanged();
                                        }}
                                        class="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                    >
                                        <For each={GEMINI_MODELS}>
                                            {(m) => (
                                                <option value={m}>{m}</option>
                                            )}
                                        </For>
                                    </select>
                                </div>

                                {/* Temperature */}
                                <div class={isAutoMode() ? 'opacity-50 pointer-events-none' : ''}>
                                    <div class="flex justify-between mb-1.5">
                                        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Temperature</label>
                                        <span class="text-xs font-mono text-slate-300">{temperature()}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="2"
                                        step="0.1"
                                        value={temperature()}
                                        onInput={(e) => {
                                            setTemperature(parseFloat(e.currentTarget.value));
                                            markChanged();
                                        }}
                                        class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>

                                {/* Top P */}
                                <div class={isAutoMode() ? 'opacity-50 pointer-events-none' : ''}>
                                    <div class="flex justify-between mb-1.5">
                                        <label class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Top P</label>
                                        <span class="text-xs font-mono text-slate-300">{topP()}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={topP()}
                                        onInput={(e) => {
                                            setTopP(parseFloat(e.currentTarget.value));
                                            markChanged();
                                        }}
                                        class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>

                                {/* Max Tokens */}
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Max Output Tokens</label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={maxTokens()}
                                        onInput={(e) => {
                                            setMaxTokens(parseInt(e.currentTarget.value));
                                            markChanged();
                                        }}
                                        class="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                </div>
                            </div>
                        </details>

                        {/* Tools Configuration (Phase 14) */}
                        <details class="border-t border-slate-700">
                            <summary
                                class="p-4 cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-300 
                                           flex items-center gap-2 select-none"
                            >
                                <svg
                                    class="w-4 h-4 transition-transform details-open:rotate-90"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                                Tools & Capabilities
                                <Show when={allowedTools().length > 0}>
                                    <span class="px-1.5 py-0.5 text-xs bg-blue-600/30 text-blue-300 rounded">
                                        {allowedTools().length} active
                                    </span>
                                </Show>
                            </summary>
                            <div class="px-4 pb-4">
                                <div class="space-y-2">
                                    <For each={AVAILABLE_TOOLS}>
                                        {(tool) => (
                                            <div class="flex items-center justify-between p-3 bg-slate-800 border border-slate-600 rounded-lg">
                                                <div>
                                                    <div class="text-sm font-medium text-white">{tool.name}</div>
                                                    <div class="text-xs text-slate-400">{tool.description}</div>
                                                </div>
                                                <label class="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        class="sr-only peer"
                                                        checked={allowedTools().includes(tool.name)}
                                                        onChange={(e) => {
                                                            const checked = e.currentTarget.checked;
                                                            const current = allowedTools();
                                                            let next;
                                                            if (checked) {
                                                                next = [...current, tool.name];
                                                            } else {
                                                                next = current.filter((t) => t !== tool.name);
                                                            }
                                                            setAllowedTools(next);
                                                            markChanged();
                                                        }}
                                                    />
                                                    <div class="w-9 h-5 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>
                                        )}
                                    </For>
                                    <Show when={AVAILABLE_TOOLS.length === 0}>
                                        <div class="text-center text-slate-500 text-xs py-2">
                                            No tools available.
                                        </div>
                                    </Show>
                                </div>
                            </div>
                        </details>

                        {/* Response Schema - Collapsible (Phase 12) */}
                        <details class="border-t border-slate-700">
                            <summary
                                class="p-4 cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-300 
                                           flex items-center gap-2 select-none"
                            >
                                <svg
                                    class="w-4 h-4 transition-transform details-open:rotate-90"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                                Response Schema (JSON)
                                <Show when={responseSchema()}>
                                    <span class="px-1.5 py-0.5 text-xs bg-emerald-600/30 text-emerald-300 rounded">
                                        active
                                    </span>
                                </Show>
                            </summary>
                            <div class="px-4 pb-4">
                                <textarea
                                    value={responseSchema()}
                                    onInput={(e) => {
                                        setResponseSchema(e.currentTarget.value);
                                        markChanged();
                                    }}
                                    placeholder='{ "type": "object", "properties": { ... } }'
                                    class="w-full h-40 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                                           text-emerald-300 font-mono text-xs placeholder-slate-600 resize-y focus:outline-none
                                           focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                />
                                <div class="mt-2 flex justify-between items-center text-xs text-slate-500">
                                    <span>Define a strictly typed output schema</span>
                                    <button
                                        onClick={() => {
                                            try {
                                                const parsed = JSON.parse(responseSchema());
                                                setResponseSchema(JSON.stringify(parsed, null, 2));
                                                showSnackbar('JSON formatted', 'success');
                                            } catch (e) {
                                                showSnackbar('Invalid JSON', 'error');
                                            }
                                        }}
                                        class="text-blue-400 hover:text-blue-300 hover:underline"
                                    >
                                        Format JSON
                                    </button>
                                </div>
                            </div>
                        </details>
                    </div>

                    {/* Right Panel - Output Preview */}
                    <div
                        class={`${showModelComparison() ? 'w-1/3' : 'w-1/2'} flex flex-col bg-slate-850 overflow-y-auto border-l border-slate-700`}
                    >
                        <div class="p-4 border-b border-slate-700 flex justify-between items-center">
                            <label class="block text-sm font-medium text-slate-400">
                                Primary Output
                            </label>
                            <span class="text-xs text-slate-500 px-2 py-1 bg-slate-800 rounded">
                                {promptStore.versions[prompt()?.currentVersionId || '']?.parameters
                                    ?.model || 'Default'}
                            </span>
                        </div>

                        <div class="flex-1 p-4 overflow-y-auto">
                            <Show
                                when={currentVersion()?.output}
                                fallback={
                                    <div class="text-center py-12 text-slate-500">
                                        <p class="mb-2">No output yet</p>
                                        <p class="text-sm">
                                            Press{' '}
                                            <kbd class="px-2 py-1 bg-slate-700 rounded text-xs">
                                                ⌘+Enter
                                            </kbd>{' '}
                                            to run
                                        </p>
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
                                    <p class="text-red-300 text-sm mt-1">
                                        {currentVersion()?.error}
                                    </p>
                                </div>
                            </Show>
                        </div>

                        {/* Refine / Follow-up (Phase 15) */}
                        <Show when={currentVersion()?.interactionId && currentVersion()?.output}>
                            <div class="p-4 border-t border-slate-700 bg-slate-800/50">
                                <div class="flex flex-col gap-2">
                                    <div class="flex items-center justify-between">
                                        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Refine / Follow-up</span>
                                        <span class="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono" title={currentVersion()?.interactionId}>
                                            ID: {currentVersion()?.interactionId?.slice(0, 8)}...
                                        </span>
                                    </div>
                                    <div class="flex gap-2">
                                        <input
                                            type="text"
                                            value={refineInput()}
                                            onInput={(e) => setRefineInput(e.currentTarget.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleRefine()}
                                            placeholder="Make it shorter, add more detail, fix the bug..."
                                            class="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            disabled={isRunning()}
                                        />
                                        <button
                                            onClick={handleRefine}
                                            disabled={!refineInput().trim() || isRunning()}
                                            class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors flex items-center gap-2"
                                        >
                                            <Show when={isRunning()} fallback={<span>Refine</span>}>
                                                <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            </Show>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Show>
                    </div>

                    {/* Comparison Panel */}
                    <Show when={showModelComparison()}>
                        <div class="w-1/3 flex flex-col bg-slate-900 overflow-y-auto border-l border-slate-700">
                            <div class="p-4 border-b border-slate-700 flex justify-between items-center">
                                <label class="block text-sm font-medium text-amber-400">
                                    Comparison Output
                                </label>
                                <div class="flex items-center gap-2">
                                    <Show when={comparisonOutput()}>
                                        <button
                                            onClick={() => setShowDiff(!showDiff())}
                                            class={`px-2 py-0.5 text-xs rounded border transition-colors ${showDiff() ? 'bg-amber-900/50 border-amber-500 text-amber-200' : 'border-slate-600 text-slate-400 hover:text-white'}`}
                                        >
                                            {showDiff() ? 'Hide Diff' : 'Diff'}
                                        </button>
                                    </Show>
                                    <span class="text-xs text-amber-500/80 px-2 py-1 bg-amber-900/10 rounded border border-amber-900/30">
                                        {comparisonModel()}
                                    </span>
                                </div>
                            </div>

                            <div class="flex-1 p-4 overflow-y-auto">
                                <Show when={comparisonIsRunning()}>
                                    <div class="flex flex-col items-center justify-center h-full text-amber-500/50 gap-3">
                                        <svg
                                            class="animate-spin w-6 h-6"
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
                                        <span class="text-xs animate-pulse">Comparing...</span>
                                    </div>
                                </Show>

                                <Show when={!comparisonIsRunning() && comparisonOutput()}>
                                    <Show
                                        when={showDiff()}
                                        fallback={
                                            <div
                                                class="prose prose-invert prose-slate max-w-none text-slate-300"
                                                innerHTML={renderMarkdown(comparisonOutput())}
                                            />
                                        }
                                    >
                                        <VersionDiff
                                            oldText={currentVersion()?.output || ''}
                                            newText={comparisonOutput()}
                                            mode="words"
                                        />
                                    </Show>
                                </Show>

                                <Show when={comparisonError()}>
                                    <div class="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg">
                                        <p class="text-red-400 text-sm font-medium">
                                            Comparison Error
                                        </p>
                                        <p class="text-red-300 text-sm mt-1">{comparisonError()}</p>
                                    </div>
                                </Show>

                                <Show
                                    when={
                                        !comparisonIsRunning() &&
                                        !comparisonOutput() &&
                                        !comparisonError()
                                    }
                                >
                                    <div class="text-center py-12 text-slate-600">
                                        <p>Ready to compare</p>
                                    </div>
                                </Show>
                            </div>
                        </div>
                    </Show>
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
                                onInput={(e) => {
                                    setTemperature(parseFloat(e.currentTarget.value));
                                    markChanged();
                                }}
                                class="w-32 accent-purple-500"
                            />
                            <span class="text-sm text-white font-mono w-10">
                                {temperature().toFixed(1)}
                            </span>
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
                                onInput={(e) => {
                                    setTopP(parseFloat(e.currentTarget.value));
                                    markChanged();
                                }}
                                class="w-32 accent-purple-500"
                            />
                            <span class="text-sm text-white font-mono w-10">
                                {topP().toFixed(2)}
                            </span>
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
                                onInput={(e) => {
                                    setMaxTokens(parseInt(e.currentTarget.value) || 2048);
                                    markChanged();
                                }}
                                class="w-24 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        {/* Reasoning Level (New) */}
                        <Show when={currentVersion()?.parameters?.model?.includes('gemini-2.5') || currentVersion()?.parameters?.model?.includes('gemini-3')}>
                            <div class="flex items-center gap-3 pl-8 border-l border-slate-700">
                                <label class="text-sm text-slate-400">Reasoning</label>
                                <select
                                    value="low" // TODO: Bind to actual state once added to PromptParameters
                                    onChange={(e) => {
                                        // Placeholder for future binding
                                        console.log('Thinking level set to:', e.currentTarget.value);
                                    }}
                                    class="bg-slate-700 border border-slate-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-purple-500"
                                >
                                    <option value="minimal">Minimal</option>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                        </Show>

                        {/* Agent Mode Toggle (Phase 12) */}
                        <div class="flex items-center gap-3 pl-8 border-l border-slate-700">
                            <label class="text-sm text-slate-400">Agent Mode</label>
                            <label class="relative inline-flex items-center cursor-pointer group">
                                <input
                                    type="checkbox"
                                    class="sr-only peer"
                                    checked={model() === 'deep-research-pro-preview-12-2025'}
                                    onChange={(e) => {
                                        const isAgent = e.currentTarget.checked;
                                        setModel(isAgent ? 'deep-research-pro-preview-12-2025' : 'gemini-2.5-flash');
                                        markChanged();
                                    }}
                                />
                                <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                <span class="ml-2 text-xs font-medium text-slate-400 group-hover:text-blue-300 transition-colors">
                                    Deep Research
                                </span>
                            </label>
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
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M9 5l7 7-7 7"
                                    />
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
                                        const isCurrent = () =>
                                            version.id === prompt()?.currentVersionId;
                                        const hasOutput = () => !!version.output;
                                        const isCompare = () => compareVersionId() === version.id;

                                        return (
                                            <button
                                                onClick={() => handleRevert(version.id)}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setCompareVersionId(version.id);
                                                }}
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
                                v
                                {versions().findIndex((v) => v.id === prompt()?.currentVersionId) +
                                    1}{' '}
                                of {versions().length}
                            </span>
                        </div>
                    </div>

                    {/* Expanded Version Cards */}
                    <Show when={showVersionPanel()}>
                        <div class="px-6 pb-4 max-h-48 overflow-y-auto">
                            <div class="grid grid-cols-4 gap-2">
                                <For each={versions()}>
                                    {(version, index) => {
                                        const isCurrent = () =>
                                            version.id === prompt()?.currentVersionId;
                                        const hasOutput = () => !!version.output;
                                        const isCompare = () => compareVersionId() === version.id;

                                        return (
                                            <button
                                                onClick={() =>
                                                    compareMode()
                                                        ? setCompareVersionId(version.id)
                                                        : handleRevert(version.id)
                                                }
                                                class={`p-2 rounded-lg text-left transition-all border ${isCompare()
                                                    ? 'bg-amber-900/30 border-amber-500/50'
                                                    : isCurrent()
                                                        ? 'bg-purple-900/30 border-purple-500/50'
                                                        : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                                                    }`}
                                            >
                                                <div class="flex items-center justify-between mb-1">
                                                    <span class="text-xs font-medium text-white">
                                                        v{index() + 1}
                                                    </span>
                                                    <Show when={hasOutput()}>
                                                        <span
                                                            class="w-2 h-2 rounded-full bg-emerald-500"
                                                            title="Has output"
                                                        />
                                                    </Show>
                                                </div>
                                                <div class="text-xs text-slate-500 truncate">
                                                    {new Date(version.createdAt).toLocaleString(
                                                        [],
                                                        {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        },
                                                    )}
                                                </div>
                                                <Show when={version.output}>
                                                    <div class="text-xs text-slate-400 truncate mt-1">
                                                        {version.output?.slice(0, 40)}...
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
                                    v{versions().findIndex((v) => v.id === compareVersionId()) + 1}
                                </span>
                                <span class="text-xs text-slate-500">vs</span>
                                <span class="px-2 py-0.5 text-xs bg-purple-900/30 text-purple-300 rounded">
                                    v
                                    {versions().findIndex(
                                        (v) => v.id === prompt()?.currentVersionId,
                                    ) + 1}{' '}
                                    (current)
                                </span>
                            </div>
                            <div class="grid grid-cols-2 gap-4 max-h-40 overflow-y-auto">
                                <div class="p-3 bg-slate-900 rounded-lg border border-amber-800/30">
                                    <div class="text-xs text-amber-400 mb-2">Previous Output</div>
                                    <div class="text-sm text-slate-300 whitespace-pre-wrap">
                                        {promptStore.versions[compareVersionId()!]?.output ||
                                            'No output'}
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
                            onClick={() => setShowTemplates(true)}
                            class="px-4 py-2 text-sm font-medium rounded-lg transition-colors border bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600 border-slate-600"
                        >
                            Templates
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
                                <svg
                                    class="animate-spin w-4 h-4"
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
                            <Show when={!(isRunning() || prompt()?.status === 'generating')}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    stroke-width="2"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                    />
                                </svg>
                            </Show>
                            {isRunning() || prompt()?.status === 'generating'
                                ? 'Running...'
                                : 'Run Prompt'}
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

            <TemplateModal
                isOpen={showTemplates()}
                onClose={() => setShowTemplates(false)}
                onSelect={handleLoadTemplate}
            />
        </div>
    );
};

export default PromptPlayground;
