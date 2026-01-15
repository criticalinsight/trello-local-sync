import { CSS_RESET, DOC_CSS, SLIDE_CSS } from './styles';

export type PresentationTheme = 'document' | 'slides';

export async function convertToPresentation(
    markdown: string,
    title: string,
    theme: PresentationTheme
): Promise<string> {
    const contentHtml = await parseMarkdown(markdown);

    if (theme === 'slides') {
        // Split by HR (---) to create slides
        const slides = contentHtml.split('<hr>');
        const slidesHtml = slides.map(s => `<div class="slide">${s}</div>`).join('');

        return wrapHtml(title, slidesHtml, SLIDE_CSS, 'slides-container');
    }

    return wrapHtml(title, contentHtml, DOC_CSS, 'document-container');
}

function wrapHtml(title: string, body: string, css: string, containerClass: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        ${CSS_RESET}
        ${css}
    </style>
</head>
<body>
    <div class="${containerClass}">
        ${body}
    </div>
</body>
</html>`;
}

// Simple fallback markdown parser since 'marked' is not installed
async function parseMarkdown(md: string): Promise<string> {
    let html = md
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>')
        .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
        .replace(/\*(.*)\*/gim, '<i>$1</i>')
        .replace(/---/g, '<hr>')
        .replace(/\n\n/g, '<p></p>');

    // Fix lists: join adjacent </ul><ul> to make contiguous lists
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    return html;
}
