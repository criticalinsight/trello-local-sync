import { describe, test, expect } from 'vitest';
import { convertToPresentation } from '../presentation/converter';

describe('Presentation Converter', () => {
    test('should convert markdown to document HTML', async () => {
        const md = '# Title\nPara 1\n* Item 1';
        const html = await convertToPresentation(md, 'My Presentation', 'document');

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<h1>Title</h1>');
        expect(html).toContain('<title>My Presentation</title>');
        expect(html).toContain('document-container');
    });

    test('should convert markdown to slides HTML', async () => {
        const md = '# Slide 1\nContent 1\n---\n# Slide 2\nContent 2';
        const html = await convertToPresentation(md, 'My Slides', 'slides');

        expect(html).toContain('slides-container');
        expect(html).toContain('<div class="slide">');
        // Check for split
        const slideCount = (html.match(/class="slide"/g) || []).length;
        expect(slideCount).toBeGreaterThanOrEqual(2);
    });
});
