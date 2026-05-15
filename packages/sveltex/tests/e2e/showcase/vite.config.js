import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [sveltekit()],
    preview: { port: 3200, strictPort: true },
    server: { port: 3300, strictPort: false },
});
