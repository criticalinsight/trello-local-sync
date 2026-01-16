import { PROMPT_TEMPLATES, type PromptTemplate } from '../data/templates';

export function findBestMatchingTemplate(userText: string): PromptTemplate | null {
    if (!userText || userText.length < 10) return null;

    const normalizedText = userText.toLowerCase();
    const tokens = new Set(normalizedText.split(/\W+/).filter((t) => t.length > 3));

    let bestMatch: PromptTemplate | null = null;
    let maxScore = 0;

    for (const template of PROMPT_TEMPLATES) {
        let score = 0;
        const trigger = template.trigger.toLowerCase();
        const description = template.description.toLowerCase();

        // 1. Exact trigger phrase match (High confidence)
        if (normalizedText.includes(trigger)) {
            score += 50;
        }

        // 2. Keyword matching from trigger
        const triggerTokens = trigger.split(/\W+/);
        triggerTokens.forEach((t) => {
            if (t.length > 3 && normalizedText.includes(t)) {
                score += 10;
            }
        });

        // 3. Keyword matching from description (Lower weight)
        if (tokens.size > 0) {
            const descTokens = description.split(/\W+/).filter((t) => t.length > 3);
            let matches = 0;
            descTokens.forEach((t) => {
                if (tokens.has(t)) matches++;
            });
            // Jaccard-ish component
            score += (matches / (tokens.size + descTokens.length)) * 20;
        }

        // 4. Specific heuristic overrides
        if (template.id === 'sql-optimize' && (normalizedText.includes('select') || normalizedText.includes('query'))) score += 15;
        if (template.id === 'code-refactor' && (normalizedText.includes('clean up') || normalizedText.includes('improve code'))) score += 15;
        if (template.id === 'unit-tests' && (normalizedText.includes('test') || normalizedText.includes('coverage'))) score += 15;
        if (template.id === 'landing-page' && (normalizedText.includes('website') || normalizedText.includes('hero section'))) score += 15;

        if (score > maxScore) {
            maxScore = score;
            bestMatch = template;
        }
    }

    // Threshold (tune as needed)
    return maxScore > 15 ? bestMatch : null;
}
