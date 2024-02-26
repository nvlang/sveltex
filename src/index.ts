import { Processed } from 'svelte/compiler';
import { marked } from 'marked';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Initialize DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Custom preprocessor for `.sveltex` files
const markdownPreprocessor = {
    markup: async ({
        content,
        filename,
    }: {
        content: string;
        filename?: string;
    }): Promise<Processed> => {
        if (!filename || !filename.endsWith('.sveltex')) {
            return { code: content };
        }

        // Convert Markdown to HTML
        let html = await marked(content);

        // Sanitize HTML
        html = DOMPurify.sanitize(html);

        return { code: `<div class="sveltex-output">${html}</div>` };
    },
};

export default function preprocessSveltex() {
    return markdownPreprocessor;
}
