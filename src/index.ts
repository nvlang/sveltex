/**
 * A flexible Svelte preprocessor with extensive LaTeX support.
 * @packageDocumentation
 */

export type {
    AdvancedTexBackend,
    AdvancedTexConfiguration,
} from '$types/handlers/AdvancedTex.js';
export type { CodeBackend, CodeConfiguration } from '$types/handlers/Code.js';
export type {
    MarkdownBackend,
    MarkdownConfiguration,
} from '$types/handlers/Markdown.js';
export type { TexBackend, TexConfiguration } from '$types/handlers/Tex.js';
export type { SveltexConfiguration } from '$types/SveltexConfiguration.js';

export { sveltex } from './Sveltex.js';

export type { Sveltex } from './Sveltex.js';
