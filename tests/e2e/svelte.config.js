import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { preprocessors } from './sveltex.config.js';

const ps = await preprocessors();

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://kit.svelte.dev/docs/integrations#preprocessors
    // for more information about preprocessors
    preprocess: [vitePreprocess(), ...ps],

    extensions: ['.svelte', ...ps.flatMap((p) => p.configuration.extensions)],

    onwarn: (warning, defaultHandler) => {
        if (warning.code === 'a11y-no-noninteractive-tabindex') return;
        defaultHandler(warning);
    },

    kit: {
        // adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
        // If your environment is not supported or you settled on a specific environment, switch out the adapter.
        // See https://kit.svelte.dev/docs/adapters for more information about adapters.
        adapter: adapter(),
    },
};

export default config;
