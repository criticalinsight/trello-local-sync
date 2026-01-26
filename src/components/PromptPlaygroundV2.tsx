import { Component, createSignal, Show, onMount } from 'solid-js';
import { promptStore, updatePrompt, updateVersion, createVersion, getCurrentVersion, runSinglePrompt } from '../promptStore';
import type { PromptCard, Persona } from '../types';
import { PersonaLibrary } from './PersonaLibrary';

interface PromptPlaygroundV2Props {
    promptId: string;
    onClose: () => void;
}

export const PromptPlaygroundV2: Component<PromptPlaygroundV2Props> = (props) => {
    const [showPersonaLibrary, setShowPersonaLibrary] = createSignal(false);

    const prompt = () => promptStore.prompts[props.promptId];
    const version = () => promptStore.versions[prompt()?.currentVersionId || ''];

    const handleRun = async () => {
        if (!prompt()) return;
        await runSinglePrompt(props.promptId);
    };

    const handleSelectPersona = (p: Persona) => {
        if (!version()) return;
        updateVersion(version().id, { systemInstructions: p.systemInstructions });
        setShowPersonaLibrary(false);
    };

    return (
        <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
            <div class="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">P</div>
                        <h2 class="text-lg font-bold text-white truncate max-w-md">{prompt()?.title}</h2>
                    </div>
                    <div class="flex items-center gap-2">
                        <button
                            onClick={handleRun}
                            class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Run Prompt
                        </button>
                        <button onClick={props.onClose} class="p-2 text-slate-500 hover:text-white transition-colors ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Editor Layout */}
                <div class="flex-1 flex overflow-hidden">
                    {/* Input Side */}
                    <div class="flex-1 flex flex-col p-6 space-y-4 border-r border-slate-800">
                        <div class="flex items-center justify-between">
                            <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Instructions</label>
                            <button
                                onClick={() => setShowPersonaLibrary(true)}
                                class="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors"
                            >
                                Persona Library
                            </button>
                        </div>
                        <textarea
                            class="w-full h-32 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-300 font-mono focus:outline-none focus:border-blue-500/50 resize-none transition-all"
                            value={version()?.systemInstructions || ''}
                            onInput={e => updateVersion(version().id, { systemInstructions: e.currentTarget.value })}
                            placeholder="Set the persona and context for the AI..."
                        />

                        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">User Prompt</label>
                        <textarea
                            class="flex-1 w-full bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-4 text-slate-100 font-sans focus:outline-none focus:border-blue-500/50 resize-none transition-all"
                            value={version()?.content || ''}
                            onInput={e => updateVersion(version().id, { content: e.currentTarget.value })}
                            placeholder="What do you want to generate?"
                        />
                    </div>

                    {/* Output Side */}
                    <div class="flex-1 flex flex-col bg-slate-950/20 p-6 space-y-4">
                        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Output</label>

                        <div class="flex-1 w-full bg-slate-900/50 rounded-2xl p-6 overflow-y-auto border border-slate-800/50 relative">
                            <Show when={version()?.output} fallback={
                                <div class="h-full flex flex-col items-center justify-center text-slate-600 animate-pulse">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <p class="text-sm font-medium">Ready for execution</p>
                                </div>
                            }>
                                <div class="prose prose-invert prose-sm max-w-none text-slate-300 font-mono">
                                    <pre class="whitespace-pre-wrap">{version()!.output}</pre>
                                </div>
                            </Show>
                        </div>

                        <Show when={version()?.executionTime || version()?.error}>
                            <div class="flex items-center justify-between text-[10px] font-mono p-1">
                                <div class="flex items-center gap-3">
                                    <span class="text-slate-500">Execution: <span class="text-slate-300">{(version()?.executionTime || 0) / 1000}s</span></span>
                                    <span class="text-slate-500">Model: <span class="text-blue-400 uppercase">{version()?.parameters.model || 'flash'}</span></span>
                                </div>
                                <Show when={version()?.error}>
                                    <span class="text-red-400 font-bold">Error Occurred</span>
                                </Show>
                            </div>
                        </Show>
                    </div>
                </div>

                {/* Modals */}
                <Show when={showPersonaLibrary()}>
                    <PersonaLibrary
                        onClose={() => setShowPersonaLibrary(false)}
                        onSelect={handleSelectPersona}
                    />
                </Show>

            </div>
        </div>
    );
};
