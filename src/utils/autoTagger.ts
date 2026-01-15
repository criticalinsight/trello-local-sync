/**
 * Auto-Tagging Utility
 * Extracts standardized tags from prompt content based on keyword matching.
 */

const KEYWORD_MAP: Record<string, string[]> = {
    Coding: [
        'typescript',
        'javascript',
        'python',
        'react',
        'code',
        'function',
        'api',
        'class',
        'bug',
        'fix',
        'refactor',
        'css',
        'html',
        'sql',
    ],
    Data: [
        'sql',
        'database',
        'query',
        'dataset',
        'analytics',
        'statistics',
        'chart',
        'graph',
        'excel',
        'csv',
        'json',
    ],
    Writing: [
        'email',
        'blog',
        'article',
        'essay',
        'draft',
        'edit',
        'proofread',
        'summarize',
        'tone',
        'style',
    ],
    Creative: ['poem', 'story', 'idea', 'brainstorm', 'image', 'design', 'logo', 'color'],
    Analysis: ['analyze', 'compare', 'evaluate', 'pros', 'cons', 'report', 'insight', 'trend'],
    Product: ['user story', 'requirements', 'prd', 'roadmap', 'feature', 'acceptance criteria'],
};

export function generateTags(content: string): string[] {
    if (!content) return [];

    const lowerContent = content.toLowerCase();
    const tags = new Set<string>();

    for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
        if (keywords.some((k) => lowerContent.includes(k))) {
            tags.add(category);
        }
    }

    // Limit to 3 tags
    return Array.from(tags).slice(0, 3);
}
