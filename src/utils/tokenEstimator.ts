/**
 * Token Estimation Utility
 * Provides rough estimations for token counts and costs for Gemini models.
 */

export const PRICING = {
    'gemini-3-pro-preview': { input: 1.25, output: 5.00 }, // $ per 1M tokens
    'gemini-3-flash-preview': { input: 0.10, output: 0.40 },
    'deep-research-pro-preview-12-2025': { input: 10.00, output: 30.00 } // Estimated premium pricing
} as const;

export type PricingModel = keyof typeof PRICING;

/**
 * Estimates token count using character count approximation.
 * Rule of thumb: ~4 characters per token for English text.
 */
export function estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

/**
 * Calculates estimated cost for input tokens.
 * @param tokens Number of tokens
 * @param model Model identifier
 * @returns Cost in USD
 */
export function estimateCost(tokens: number, model: string): number {
    const pricing = PRICING[model as PricingModel] || PRICING['gemini-3-pro-preview'];
    return (tokens / 1_000_000) * pricing.input;
}

/**
 * Formats cost as currency string.
 * Shows small fractions for low costs.
 */
export function formatCost(cost: number): string {
    if (cost === 0) return '$0.00';
    if (cost < 0.01) return '<$0.01';
    return `$${cost.toFixed(2)}`;
}
