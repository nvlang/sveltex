export { default as mockFs } from 'mock-fs';

/**
 * Fuzzy testing.
 */
export { test as fuzzyTest, fc } from '@fast-check/vitest';

/**
 * Markdown plugins for testing.
 */
export { default as markdownItMultimdTablePlugin } from 'markdown-it-multimd-table';

export { default as rehypeSlug } from 'rehype-slug';
export { default as remarkDirective } from 'remark-directive';
export { visit as unistVisit } from 'unist-util-visit';
export { h as hastscriptH } from 'hastscript';

export {
    transformerNotationDiff as shikiTransformerNotationDiff,
    transformerMetaHighlight as shikiTransformerMetaHighlight,
} from '@shikijs/transformers';
export {
    gfm as micromarkGfm,
    gfmHtml as micromarkGfmHtml,
} from 'micromark-extension-gfm';
