export const CSS_RESET = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
img { max-width: 100%; height: auto; }
code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
pre { background: #f4f4f4; padding: 1em; overflow-x: auto; border-radius: 5px; }
blockquote { border-left: 4px solid #ddd; padding-left: 1em; color: #666; }
`;

export const SLIDE_CSS = `
html, body { height: 100%; overflow: hidden; }
.slides-container {
    height: 100vh;
    overflow-y: scroll;
    scroll-snap-type: y mandatory;
    scroll-behavior: smooth;
}
.slide {
    height: 100vh;
    scroll-snap-align: start;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 2rem 4rem;
    max-width: 900px;
    margin: 0 auto;
}
.slide h1, .slide h2 { margin-bottom: 1rem; color: #222; }
.slide ul, .slide ol { margin-left: 2rem; margin-bottom: 1rem; }
.slide p { margin-bottom: 1.5rem; font-size: 1.2rem; }
`;

export const DOC_CSS = `
body { background: #fff; color: #111; }
.document-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 4rem 2rem;
    }
h1 { font-size: 2.5rem; margin-bottom: 1.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #eee; }
h2 { font-size: 1.8rem; margin-top: 2rem; margin-bottom: 1rem; }
p { margin-bottom: 1rem; font-size: 1.1rem; }
li { margin-bottom: 0.5rem; }
`;
