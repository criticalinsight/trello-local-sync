export interface PromptTemplate {
        id: string;
        trigger: string;
        description: string;
        content: string;
        systemInstructions?: string;
        category: 'coding' | 'writing' | 'analysis' | 'agent' | 'marketing' | 'product';
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
        // --- CODING (15) ---
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
                systemInstructions:
                        'You are an expert Senior Software Engineer. Prioritize clean, efficient, and idiomatic code.',
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
                systemInstructions:
                        'You are a QA Automation Expert. Focus on robustness and high code coverage.',
        },
        {
                id: 'debug-code',
                trigger: 'Debug Code',
                description: 'Identify and fix bugs in a provided code snippet.',
                category: 'coding',
                content: `I have a bug in the following code.
Expected Behavior: [DESCRIBE EXPECTED]
Actual Behavior: [DESCRIBE ACTUAL]

Code:
[PASTE CODE HERE]

Please identify the root cause and provide a fixed version.`,
                systemInstructions: 'You are a debugging specialist. Be precise about the root cause and side effects.',
        },
        {
                id: 'doc-gen',
                trigger: 'Generate Documentation',
                description: 'Create JSDoc/TSDoc and Markdown documentation for code.',
                category: 'coding',
                content: `Generate comprehensive documentation for the following code.
Include:
1. Function/Class descriptions
2. Parameter and Return value details
3. Usage examples
4. Edge cases

Code:
[PASTE CODE HERE]`,
                systemInstructions: 'You are a Technical Writer specializing in API documentation.',
        },
        {
                id: 'sql-optimize',
                trigger: 'Optimize SQL',
                description: 'Analyze SQL query for performance and index usage.',
                category: 'coding',
                content: `Optimize the following SQL query for performance.
Explain the execution plan implications and suggest indexes.

Query:
[PASTE SQL HERE]`,
                systemInstructions: 'You are a Database Administrator expert in query optimization.',
        },
        {
                id: 'regex-gen',
                trigger: 'Regex Generator',
                description: 'Create and explain complex Regular Expressions.',
                category: 'coding',
                content: `Create a Regular Expression to match:
[DESCRIBE PATTERN REQUIREMENTS]

- Explain each part of the regex.
- Provide test cases (match vs no-match).`,
                systemInstructions: 'You are a Regex Wizard. Always provide the regex pattern wrapped in code blocks.',
        },
        {
                id: 'commit-msg',
                trigger: 'Commit Message',
                description: 'Generate a Conventional Commits compliant message from a diff.',
                category: 'coding',
                content: `Generate a Conventional Commits (feat, fix, docs, chore, etc.) message for the following diff:

[PASTE DIFF HERE]`,
                systemInstructions: 'You are a Git expert. Keep the header under 50 chars and body wrapped at 72.',
        },
        {
                id: 'ts-types',
                trigger: 'Generate Types',
                description: 'Convert JSON data or JS code into TypeScript interfaces.',
                category: 'coding',
                content: `Generate TypeScript interfaces for the following data/code.
Ensure strict typing (avoid 'any').

Input:
[PASTE JSON OR JS HERE]`,
                systemInstructions: 'You are a TypeScript Architect. Prefer interfaces over types for object shapes.',
        },
        {
                id: 'security-audit',
                trigger: 'Security Audit',
                description: 'Scan code for common vulnerabilities (OWASP Top 10).',
                category: 'coding',
                content: `Perform a security audit on this code. Look for:
- Injection attacks (SQL/XSS)
- Auth bypasses
- Sensitive data exposure
- Insecure dependencies

Code:
[PASTE CODE HERE]`,
                systemInstructions: 'You are a Cybersecurity Researcher. Be paranoid and thorough.',
        },
        {
                id: 'react-component',
                trigger: 'React Component',
                description: 'Generate a functional React component with Tailwind CSS.',
                category: 'coding',
                content: `Create a React component for: [COMPONENT NAME]
Requirements:
- Use Functional Components with Hooks
- Use Tailwind CSS for styling
- Ensure accessibility (ARIA)
- Fully typed (TypeScript)

Description:
[DESCRIBE UI/BEHAVIOR]`,
                systemInstructions: 'You are a Frontend Expert specializing in React and Accessibility.',
        },
        {
                id: 'api-client',
                trigger: 'API Client Helper',
                description: 'Generate a fetch wrapper for an API endpoint.',
                category: 'coding',
                content: `Create a TypeScript function to call this API endpoint:
Method: [GET/POST/PUT]
URL: [URL]
Payload: [JSON STRUCTURE]
Response: [JSON STRUCTURE]

Include error handling and type definitions.`,
                systemInstructions: 'You are a Backend Integrator. Focus on type safety and error handling.',
        },
        {
                id: 'cron-expression',
                trigger: 'Explain/Gen Cron',
                description: 'Translate natural language to Crontab syntax or vice versa.',
                category: 'coding',
                content: `Convert this schedule to a Cron expression:
"[SCHEDULE DESCRIPTION, e.g., Every Monday at 3am]"

OR explain this Cron expression:
"[CRON STRING]"`,
                systemInstructions: 'You are a System Administrator.',
        },
        {
                id: 'bash-script',
                trigger: 'Bash Script',
                description: 'Write a shell script for automation tasks.',
                category: 'coding',
                content: `Write a bash script to:
[DESCRIBE TASK]

Ensure:
- 'set -e' usage
- Error verification
- Comments`,
                systemInstructions: 'You are a DevOps Engineer.',
        },
        {
                id: 'dockerfile',
                trigger: 'Optimize Dockerfile',
                description: 'Review Dockerfile for layer caching and size.',
                category: 'coding',
                content: `Optimize this Dockerfile for build speed and image size.

Dockerfile:
[PASTE HERE]`,
                systemInstructions: 'You are a Containerization Expert.',
        },
        {
                id: 'explain-code',
                trigger: 'Explain Code',
                description: 'Explain complex code in plain English.',
                category: 'coding',
                content: `Explain how this code works line-by-line to a junior developer.

Code:
[PASTE CODE HERE]`,
                systemInstructions: 'You are a helpful Senior Mentor.',
        },

        // --- WRITING (10) ---
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
                systemInstructions:
                        'You are a Tech Blogger with a flair for engaging storytelling and clear, concise explanations.',
        },
        {
                id: 'cold-email',
                trigger: 'Cold Email',
                description: 'Write a persuasive B2B cold outreach email.',
                category: 'writing',
                content: `Write a cold email to: [TARGET ROLE] at [COMPANY TYPE].
Goal: [GOAL, e.g., Book a demo]
Value Prop: [KEY BENEFIT]

Keep it under 150 words. Use a pattern interrupt in the subject line.`,
                systemInstructions: 'You are a Top-Performing Sales Development Rep.',
        },
        {
                id: 'newsletter',
                trigger: 'Newsletter Issue',
                description: 'Draft a weekly newsletter intro and curated links.',
                category: 'writing',
                content: `Draft a newsletter issue about [TOPIC].
Sections:
1. Personal Intro (Storytelling)
2. 3 Key Trends/News items
3. "Tool of the Week"
4. Closing thought`,
                systemInstructions: 'You are a minimal and engaging Newsletter Writer.',
        },
        {
                id: 'press-release',
                trigger: 'Press Release',
                description: 'Official announcement for a new product or feature.',
                category: 'writing',
                content: `Write a press release for: [PRODUCT NAME]
Key Features: [FEATURE LIST]
Quote: [CEO QUOTE IDEA]
Date: [DATE]

Follow standard PR format (FOR IMMEDIATE RELEASE).`,
                systemInstructions: 'You are a Public Relations specialist.',
        },
        {
                id: 'tweet-thread',
                trigger: 'Viral Tweet Thread',
                description: 'Convert a topic or article into a Twitter/X thread.',
                category: 'writing',
                content: `Turn this topic into a 10-tweet thread:
Topic: [TOPIC OR TEXT]

Require:
- Hook in tweet 1
- Value in every tweet
- Call to Action in final tweet`,
                systemInstructions: 'You are a Social Media Ghostwriter skilled in viral hooks.',
        },
        {
                id: 'linkedin-post',
                trigger: 'LinkedIn Post',
                description: 'Professional "Thought Leadership" post.',
                category: 'writing',
                content: `Write a LinkedIn post about [TOPIC].
Style: "Bro-etry" (Short lines, white space) OR Professional Narrative.
Goal: Engagement and Comments.`,
                systemInstructions: 'You are a LinkedIn Influencer.',
        },
        {
                id: 'creative-story',
                trigger: 'Short Story',
                description: 'Generate a creative fiction story based on a prompt.',
                category: 'writing',
                content: `Write a short story (500 words) about:
Protagonist: [NAME/ROLE]
Setting: [PLACE]
Conflict: [PROBLEM]
Genre: [GENRE]`,
                systemInstructions: 'You are a Hugo Award-winning fiction author.',
        },
        {
                id: 'script-video',
                trigger: 'YouTube Script',
                description: 'Script for an educational or entertainment video.',
                category: 'writing',
                content: `Write a script for a [LENGTH] YouTube video about [TOPIC].
Include:
- Hook (0:00-0:30)
- Intro Animation
- Body Paragraphs
- Mid-roll Call to Action
- Conclusion`,
                systemInstructions: 'You are a YouTuber with 1M+ subscribers.',
        },
        {
                id: 'rewrite-concise',
                trigger: 'Rewrite (Concise)',
                description: 'Make text more concise and punchy.',
                category: 'writing',
                content: `Rewrite the following text to be more concise, punchy, and active voice. Remove fluff.

Text:
[PASTE TEXT HERE]`,
                systemInstructions: 'You comprise a ruthlessly efficient editor.',
        },
        {
                id: 'speech-write',
                trigger: 'Write Speech',
                description: 'Draft a speech for a wedding, conference, or event.',
                category: 'writing',
                content: `Write a [LENGTH] minute speech for [EVENT].
Speaker: [ROLE]
Audience: [WHO]
Key Message: [MESSAGE]`,
                systemInstructions: 'You are a Presidential Speechwriter.',
        },

        // --- MARKETING (10) ---
        {
                id: 'ad-copy-fb',
                trigger: 'Facebook Ad Copy',
                description: 'Generate high-converting Facebook/Instagram ad variations.',
                category: 'marketing',
                content: `Write 3 variations of Facebook Ad copy for: [PRODUCT].
Target Audience: [AUDIENCE]
Pain Point: [PAIN]

include:
- Primary Text
- Headline
- Link Description`,
                systemInstructions: 'You are a Direct Response Copywriter.',
        },
        {
                id: 'google-ads',
                trigger: 'Google Ads (Search)',
                description: 'Create headlines and descriptions for SEM.',
                category: 'marketing',
                content: `Generate Google Search Ad copy for: [KEYWORD].
- 5 Headlines (30 chars max)
- 4 Descriptions (90 chars max)

Focus on CTR and relevance.`,
                systemInstructions: 'You are an SEM Specialist.',
        },
        {
                id: 'landing-page',
                trigger: 'Landing Page Structure',
                description: 'Outline a high-converting landing page.',
                category: 'marketing',
                content: `Outline a Landing Page for [PRODUCT].
Section order:
1. Hero (H1, Sub, CTA)
2. Social Proof
3. Features/Benefits
4. How it Works
5. FAQ
6. Footer CTA

Write the copy for the Hero section.`,
                systemInstructions: 'You are a Conversion Rate Optimization (CRO) expert.',
        },
        {
                id: 'seo-keywords',
                trigger: 'SEO Keyword Strategy',
                description: 'Generate keyword clusters for a topic.',
                category: 'marketing',
                content: `Generate a keyword strategy for: [TOPIC/NICHE].
Group into:
1. High Volume / Head terms
2. Long-tail / Intent-based
3. Questions (People Also Ask)

Format as a table.`,
                systemInstructions: 'You are an SEO Strategist.',
        },
        {
                id: 'value-prop',
                trigger: 'Value Proposition',
                description: 'Refine value props and positioning statements.',
                category: 'marketing',
                content: `Create 5 value proposition statements for [PRODUCT].
Format: "For [Target], who [Need], [Product] is a [Category] that [Benefit]. Unlike [Competitor], we [Differentiator]."`,
                systemInstructions: 'You are a Product Marketing Manager.',
        },
        {
                id: 'customer-persona',
                trigger: 'Customer Persona',
                description: 'Create a detailed user persona for marketing.',
                category: 'marketing',
                content: `Create a customer persona for [PRODUCT].
Name: [NAME]
Demographics: ...
Psychographics: ...
Goals: ...
Frustrations: ...`,
                systemInstructions: 'You are a Market Researcher.',
        },
        {
                id: 'email-drip',
                trigger: 'Email Drip Campaign',
                description: 'Outline a 5-email welcome sequence.',
                category: 'marketing',
                content: `Outline a 5-day email welcome sequence for a new subscriber to [PRODUCT/LIST].
Day 1: Welcome + Value
Day 2: Problem Awareness
Day 3: Social Proof
Day 4: Objection Handling
Day 5: Hard Offer`,
                systemInstructions: 'You are an Email Marketing Specialist.',
        },
        {
                id: 'tagline-gen',
                trigger: 'Tagline Generator',
                description: 'Brainstorm catchy slogans and taglines.',
                category: 'marketing',
                content: `Brainstorm 20 taglines for [PRODUCT].
Mix:
- Punny/Witty
- Short/Punchy
- Benefit-driven
- Abstract`,
                systemInstructions: 'You are a Creative Director at a top ad agency.',
        },
        {
                id: 'swot-analysis',
                trigger: 'SWOT Analysis',
                description: 'Analyze Strengths, Weaknesses, Opportunities, Threats.',
                category: 'marketing',
                content: `Perform a SWOT analysis for [COMPANY/PRODUCT] competing in the [MARKET] space.`,
                systemInstructions: 'You are a Strategic Business Consultant.',
        },
        {
                id: 'influencer-brief',
                trigger: 'Influencer Brief',
                description: 'Create a brief for influencer collaboration.',
                category: 'marketing',
                content: `Draft a creative brief for an Instagram Influencer to promote [PRODUCT].
Key Messages: ...
Do's and Don'ts: ...
Deliverables: (Reel, Story, etc)`,
                systemInstructions: 'You are an Influencer Marketing Manager.',
        },

        // --- ANALYSIS (10) ---
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
                systemInstructions:
                        'You are an Executive Assistant specializing in information synthesis and brevity.',
        },
        {
                id: 'sentiment-analysis',
                trigger: 'Sentiment Analysis',
                description: 'Analyze the tone and sentiment of text/feedback.',
                category: 'analysis',
                content: `Analyze the sentiment of the following customer reviews.
 categorize as: Positive, Neutral, Negative.
Identify common themes or complaints.

Reviews:
[PASTE REVIEWS HERE]`,
                systemInstructions: 'You are a Data Analyst.',
        },
        {
                id: 'data-extract',
                trigger: 'Extract Data (JSON)',
                description: 'Extract structured data from unstructured text.',
                category: 'analysis',
                content: `Extract the following entities from the text below and format as JSON:
- Name
- date
- Price
- Location

Text:
[PASTE TEXT HERE]`,
                systemInstructions: 'You are a Data Entry automation bot. Output strict JSON only.',
        },
        {
                id: 'meeting-minutes',
                trigger: 'Meeting Minutes',
                description: 'Convert transcript into structured minutes.',
                category: 'analysis',
                content: `Convert this meeting transcript into minutes.
Sections:
- Attendees
- Discussion Points
- Decisions Made
- Action Items (Who, What, When)

Transcript:
[PASTE TRANSCRIPT]`,
                systemInstructions: 'You are a professional Secretary.',
        },
        {
                id: 'contract-review',
                trigger: 'Contract Review',
                description: 'Scan legal documents for risky clauses.',
                category: 'analysis',
                content: `Review the following contract clause for risks related to:
- IP Ownership
- Termination rights
- Liability caps

Clause:
[PASTE TEXT]`,
                systemInstructions: 'You are a Corporate Lawyer. (Disclaimer: Not legal advice)',
        },
        {
                id: 'resume-review',
                trigger: 'Resume Review',
                description: ' critique a resume against job requirements.',
                category: 'analysis',
                content: `Review this resume for the role of [JOB TITLE].
Highlight:
- Strengths
- Missing keywords
- Formatting issues

Resume:
[PASTE RESUME TEXT]`,
                systemInstructions: 'You are a Technical Recruiter.',
        },
        {
                id: 'explain-complex',
                trigger: 'Explain Concept',
                description: 'Explain a complex topic (ELI5 or Professional).',
                category: 'analysis',
                content: `Explain [TOPIC] to [AUDIENCE LEVEL].
Use analogies.`,
                systemInstructions: 'You are a master educator.',
        },
        {
                id: 'pros-cons',
                trigger: 'Pros & Cons',
                description: 'Objective comparison of two options.',
                category: 'analysis',
                content: `Compare [OPTION A] vs [OPTION B].
List Pros and Cons for each.
Provide a final recommendation based on [CRITERIA].`,
                systemInstructions: 'You are an objective decision analyst.',
        },
        {
                id: 'financial-analysis',
                trigger: 'Financial Insight',
                description: 'Analyze basic financial data or trends.',
                category: 'analysis',
                content: `Analyze these financial metrics:
[DATA POINTS]

What are the trends? Any red flags?`,
                systemInstructions: 'You are a Financial Analyst.',
        },
        {
                id: 'translation',
                trigger: 'Translate',
                description: 'Translate text preserving nuance and tone.',
                category: 'analysis',
                content: `Translate the following to [TARGET LANGUAGE].
Context: [CONTEXT, e.g., formal business email]

Text:
[PASTE TEXT]`,
                systemInstructions: 'You are a native speaker of both languages.',
        },

        // --- PRODUCT/AGENT (8) ---
        {
                id: 'prd-gen',
                trigger: 'Generate PRD',
                description: 'Create a Product Requirements Document.',
                category: 'product',
                content: `Write a PRD for: [FEATURE NAME].
Sections:
1. Problem Statement
2. Goals/Success Metrics
3. User Stories
4. Functional Requirements
5. Non-functional Requirements
6. Risks`,
                systemInstructions: 'You are a Senior Product Manager.',
        },
        {
                id: 'user-stories',
                trigger: 'User Stories',
                description: 'Generate Gherkin/Agile user stories.',
                category: 'product',
                content: `Generate 5 User Stories for [FEATURE] using the format:
"As a [Role], I want to [Action], so that [Benefit]."

Add Acceptance Criteria for the most complex one.`,
                systemInstructions: 'You are an Agile Product Owner.',
        },
        {
                id: 'release-notes',
                trigger: 'Release Notes',
                description: 'Draft release notes for a software update.',
                category: 'product',
                content: `Draft release notes for Version [X.Y.Z].
Features:
- [Item 1]
- [Item 2]

Bug Fixes:
- [Fix 1]`,
                systemInstructions: 'You are a Product Marketing Manager.',
        },
        {
                id: 'roadmap-gen',
                trigger: 'Product Roadmap',
                description: 'Suggest a phased roadmap for a project.',
                category: 'product',
                content: `Create a 3-phase roadmap for [PROJECT].
Phase 1: MVP
Phase 2: Growth
Phase 3: Scale

Include estimated timelines (t-shirt sizing).`,
                systemInstructions: 'You are a Product Strategist.',
        },
        {
                id: 'feedback-synthesis',
                trigger: 'Synthesize Feedback',
                description: 'Group user feedback into product themes.',
                category: 'product',
                content: `Group the following user feedback items into Product Themes/Epics.
Prioritize by frequency.

Feedback:
[LIST FEEDBACK]`,
                systemInstructions: 'You are a User Researcher.',
        },
        {
                id: 'agent-planner',
                trigger: 'Agent Loop Plan',
                description: 'Create a step-by-step plan for an autonomous agent.',
                category: 'agent',
                content: `Create a detailed execution plan for the following objective:
[OBJECTIVE]

Break down the task into:
1. Research/Discovery Phase
2. Implementation Steps
3. Verification/Testing Strategy

Format as a checklist in Markdown.`,
                systemInstructions:
                        'You are a Project Manager Agent designed to break down complex goals into actionable, atomic steps.',
        },
        {
                id: 'agent-persona',
                trigger: 'Agent Persona',
                description: 'Define a system prompt for a new AI Agent.',
                category: 'agent',
                content: `Design a System Prompt for an AI Agent whose purpose is: [PURPOSE].
Define:
- Role/Persona
- Tone/Voice
- Constraints/Rules
- Fallback behaviors`,
                systemInstructions: 'You are an AI Prompt Engineer.',
        },
        {
                id: 'mcp-tool-def',
                trigger: 'MCP Tool Def',
                description: 'Draft a Model Context Protocol tool definition.',
                category: 'agent',
                content: `Write a JSON Schema definition for an MCP tool called: [TOOL NAME].
Description: [DESC]
Args:
- [ARG 1]
- [ARG 2]`,
                systemInstructions: 'You are an MCP Architect.',
        },
];
