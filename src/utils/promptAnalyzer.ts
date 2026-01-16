import type { PromptParameters } from '../types';
import { GEMINI_MODELS } from '../aiService';

// Heuristics for prompt analysis
const PATTERNS = {
    // Coding / Structured Data / Exactness
    analytical: [
        /\b(json|xml|csv|sql|schema)\b/i,
        /\b(extract|convert|format|parse)\b/i,
        /\b(debug|fix|optimize|refactor)\b/i,
        /\b(code|function|class|api|endpoint)\b/i,
        /\b(strict|exact|compliant)\b/i,
    ],
    // Creative / Generative / Open-ended
    creative: [
        /\b(story|poem|haiku|screenplay|plot)\b/i,
        /\b(imagine|brainstorm|ideate|generate)\b/i,
        /\b(creative|fantasy|sci-fi|fiction)\b/i,
        /\b(tone|voice|style|persona)\b/i,
    ],
    // Reasoning / Explanation / Deep Dive
    reasoning: [
        /\b(why|how|explain|analyze|assess)\b/i,
        /\b(compare|contrast|evaluate|pros and cons)\b/i,
        /\b(summary|summarize|synthesis)\b/i,
        /\b(research|investigate|study)\b/i,
    ],
};

export interface AutoParams extends Partial<PromptParameters> {
    intent: 'analytical' | 'creative' | 'reasoning' | 'default';
}

export function analyzePromptForParams(content: string): AutoParams {
    const text = content.toLowerCase();

    // Score the prompt against categories
    let analyticalScore = 0;
    let creativeScore = 0;
    let reasoningScore = 0;

    PATTERNS.analytical.forEach((p) => { if (p.test(text)) analyticalScore++; });
    PATTERNS.creative.forEach((p) => { if (p.test(text)) creativeScore++; });
    PATTERNS.reasoning.forEach((p) => { if (p.test(text)) reasoningScore++; });

    // Determine dominant intent
    const maxScore = Math.max(analyticalScore, creativeScore, reasoningScore);

    // Default if no strong signal
    if (maxScore === 0) {
        return {
            intent: 'default',
            // Default to balanced
            temperature: 0.7,
            topP: 0.9,
            model: 'gemini-2.5-flash',
        };
    }

    if (analyticalScore === maxScore) {
        return {
            intent: 'analytical',
            temperature: 0.1,
            topP: 0.8,
            model: 'gemini-2.5-flash', // Speed & Precision
        };
    }

    if (creativeScore === maxScore) {
        return {
            intent: 'creative',
            temperature: 0.9,
            topP: 0.95,
            model: 'gemini-2.5-pro', // Quality & Creativity
        };
    }

    // Reasoning (fallback to this if tie with creative)
    return {
        intent: 'reasoning',
        temperature: 0.4,
        topP: 0.85,
        model: 'gemini-2.5-pro', // Quality & Reasoning
    };
}
