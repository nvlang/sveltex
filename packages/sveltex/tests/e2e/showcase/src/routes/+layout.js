/**
 * Prerender the whole showcase to static HTML.
 *
 * The site has no dynamic routes, so every page can be emitted at build time.
 * This makes the E2E screenshots deterministic — the SvelTeX-processed markup
 * is baked into the HTML files rather than rendered client-side.
 */
export const prerender = true;
