/**
 * A flexible Svelte preprocessor with extensive LaTeX support.
 * @packageDocumentation
 */

export { sveltex, Sveltex } from '$processor';

export type {
    AdvancedTexBackend,
    AdvancedTexConfiguration,
    CodeBackend,
    CodeConfiguration,
    MarkdownBackend,
    MarkdownConfiguration,
    TexBackend,
    TexConfiguration,
} from '$types';

export {
    AdvancedTexHandler,
    CodeHandler,
    MarkdownHandler,
    TexHandler,
    VerbatimHandler,
} from '$handlers';

export { TexComponent } from '$utils';
