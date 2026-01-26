import { describe, test, expect, vi } from 'vitest';
import { mapToolsToGemini, WEB_SEARCH_TOOL } from '../mcpMapper';

describe('mcpMapper Comprehensive Coverage', () => {
    test('mapToolsToGemini return empty array for empty input', () => {
        expect(mapToolsToGemini([])).toEqual([]);
        expect(mapToolsToGemini(undefined as any)).toEqual([]);
    });

    test('mapToolsToGemini maps valid tool names', () => {
        const result = mapToolsToGemini(['web_search']);
        expect(result).toHaveLength(1);
        expect(result[0].function_declarations).toBeDefined();
        expect(result[0].function_declarations[0].name).toBe('web_search');
    });

    test('mapToolsToGemini filters out invalid tool names', () => {
        const result = mapToolsToGemini(['invalid_tool']);
        expect(result).toEqual([]);
    });
});
