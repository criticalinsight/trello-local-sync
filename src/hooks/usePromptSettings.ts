import { createEffect, createSignal } from 'solid-js';

const STORAGE_KEY = 'prompt_playground_settings';

export interface PromptSettings {
    model: string;
    temperature: number;
    topP: number;
    maxTokens: number;
    isAutoMode: boolean;
}

const DEFAULT_SETTINGS: PromptSettings = {
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 2048,
    isAutoMode: false,
};

export function usePromptSettings() {
    // Initialize from storage or default
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;

    const [settings, setSettings] = createSignal<PromptSettings>(initial);

    // Persist whenever settings change
    createEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings()));
    });

    const updateSetting = <K extends keyof PromptSettings>(key: K, value: PromptSettings[K]) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    return {
        settings,
        updateSetting,
        resetSettings: () => setSettings(DEFAULT_SETTINGS),
    };
}
