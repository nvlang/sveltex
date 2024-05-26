import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig({
    plugins: [sveltekit()],
    preview: {
        port: 3004,
    },
    server: {
        fs: { allow: [searchForWorkspaceRoot(process.cwd()), './static'] },
    },
    // build: {},
    // css: {},
    // ssr: {},
});
