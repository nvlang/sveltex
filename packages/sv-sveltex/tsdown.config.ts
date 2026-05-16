import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts'],
    format: 'esm',
    outExtensions: () => ({ js: '.mjs' }),
    clean: true,
    deps: {
        // `sv` is a peer dependency provided by the Svelte CLI at runtime; it
        // must not be bundled. Everything else (notably `@sveltejs/sv-utils`)
        // is bundled so that the published package can keep an empty
        // `dependencies` field, as required for community `sv` add-ons.
        neverBundle: ['sv'],
    },
});
