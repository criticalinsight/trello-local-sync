export interface PromptTemplate {
    id: string;
    trigger: string;
    description: string;
    content: string;
    systemInstructions?: string;
    category: 'coding' | 'writing' | 'analysis' | 'agent';
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
    {
        id: 'code-refactor',
        trigger: 'Refactor Code',
        description: 'Analyze and improve code quality, performance, and readability.',
        category: 'coding',
        content: `Analyze the following code for improvements in:
1. Readability and Maintainability
2. Performance optimizations
3. Security vulnerabilities
4. Adherence to best practices (SOLID, DRY)

Provide the refactored code with comments explaining key changes.

Code to refactor:
[PASTE CODE HERE]`,
        systemInstructions: 'You are an expert Senior Software Engineer. Prioritize clean, efficient, and idiomatic code.'
    },
    {
        id: 'unit-tests',
        trigger: 'Generate Unit Tests',
        description: 'Create comprehensive unit tests with edge case coverage.',
        category: 'coding',
        content: `Generate unit tests for the following code.
Ensure coverage for:
- Happy paths
- Edge cases (null/undefined/empty)
- Error handling

Use [FRAMEWORK NAME] syntax.

Code:
[PASTE CODE HERE]`,
        systemInstructions: 'You are a QA Automation Expert. Focus on robustness and high code coverage.'
    },
    {
        id: 'blog-post',
        trigger: 'Blog Post',
        description: 'Write an engaging technical blog post with SEO optimization.',
        category: 'writing',
        content: `Write a technical blog post about: [TOPIC].

Target Audience: [AUDIENCE]
Tone: Professional yet accessible

Structure:
1. Hook/Introduction
2. Key Problem/Challenge
3. Solution/Approach
4. Technical Deep Dive
5. Conclusion/Call to Action

Include SEO-optimized title and meta description.`,
        systemInstructions: 'You are a Tech Blogger with a flair for engaging storytelling and clear, concise explanations.'
    },
    {
        id: 'summarize',
        trigger: 'Summarize Text',
        description: 'Condense long text into key takeaways and action items.',
        category: 'analysis',
        content: `Summarize the following text into:
1. Executive Summary (2-3 sentences)
2. Key Takeaways (Bullet points)
3. Action Items / Next Steps

Text:
[PASTE TEXT HERE]`,
        systemInstructions: 'You are an Executive Assistant specializing in information synthesis and brevity.'
    },
    {
        id: 'agent-planner',
        trigger: 'Agent Plan',
        description: 'Create a step-by-step plan for an autonomous agent.',
        category: 'agent',
        content: `Create a detailed execution plan for the following objective:
[OBJECTIVE]

Break down the task into:
1. Research/Discovery Phase
2. Implementation Steps
3. Verification/Testing Strategy

Format as a checklist in Markdown.`,
        systemInstructions: 'You are a Project Manager Agent designed to break down complex goals into actionable, atomic steps.'
    }
];
