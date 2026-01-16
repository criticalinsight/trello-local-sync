/**
 * @fileoverview MCP to Gemini Mapper
 *
 * Utilities to map Model Context Protocol (MCP) tool definitions
 * into Google Gemini FunctionDeclaration schemas.
 */

export interface HelperTool {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
}

// Built-in Web Search Tool Definition (POC)
export const WEB_SEARCH_TOOL: HelperTool = {
    name: 'web_search',
    description: 'Search the internet for real-time information, news, and facts.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query to execute.',
            },
        },
        required: ['query'],
    },
};

export const AVAILABLE_TOOLS: HelperTool[] = [WEB_SEARCH_TOOL];

/**
 * Converts internal HelperTool definitions to Gemini API 'tools' format.
 */
export function mapToolsToGemini(toolNames: string[]): Array<Record<string, unknown>> {
    if (!toolNames || toolNames.length === 0) return [];

    const functionDeclarations = toolNames
        .map((name) => AVAILABLE_TOOLS.find((t) => t.name === name))
        .filter((t): t is HelperTool => !!t)
        .map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        }));

    if (functionDeclarations.length === 0) return [];

    return [
        {
            function_declarations: functionDeclarations,
        },
    ];
}
