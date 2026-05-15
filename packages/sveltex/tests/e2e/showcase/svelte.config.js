import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { preprocessor } from './sveltex.config.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: [vitePreprocess(), preprocessor],
    extensions: ['.svelte', '.sveltex'],
    onwarn: (warning, handler) => {
        // Shiki adds `tabindex="0"` to its `<pre>` blocks so they remain
        // keyboard-scrollable; Svelte's a11y pass flags that as a
        // noninteractive element with a tabindex. The markup is intentional
        // and comes from the highlighter, so this one warning is silenced.
        if (warning.code === 'a11y_no_noninteractive_tabindex') return;
        handler(warning);
    },
    kit: {
        adapter: adapter({ fallback: '404.html' }),
    },
};

export default config;
