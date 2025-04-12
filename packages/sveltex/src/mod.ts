// File description: Entry point of the module.

/**
 * @packageDocumentation
 * A flexible Svelte preprocessor with extensive LaTeX support.
 */

export type { TexBackend, TexConfiguration } from '$types/handlers/Tex.js';
export type { CodeBackend, CodeConfiguration } from '$types/handlers/Code.js';
export type {
    MarkdownBackend,
    MarkdownConfiguration,
} from '$types/handlers/Markdown.js';
export type { MathBackend, MathConfiguration } from '$types/handlers/Math.js';
export type { SveltexConfiguration } from '$types/SveltexConfiguration.js';

export { sveltex } from '$base/Sveltex.js';

export type { Sveltex } from '$base/Sveltex.js';

export {
    getDefaultCodeConfig,
    getDefaultMarkdownConfig,
    getDefaultMathConfig,
    getDefaultSveltexConfig,
    getDefaultTexConfig,
    getDefaultVerbEnvConfig,
    getTexPresetDefaults,
    getDefaultCacheDirectory,
} from '$base/defaults.js';
