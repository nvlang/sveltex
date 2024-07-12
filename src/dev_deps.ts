// File description: Exports _some_ dev dependencies used by SvelTeX. Inspired
// by [Deno](https://docs.deno.com/runtime/tutorials/manage_dependencies).
// _(Notable exception: `vitest` isn't exported here, because importing it from
// `dev_deps.ts` in the test files would cause problems with Vitest's mocking
// mechanisms.)_

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
export { default as retextIndefiniteArticle } from 'retext-indefinite-article';
export {
    transformerNotationDiff as shikiTransformerNotationDiff,
    transformerMetaHighlight as shikiTransformerMetaHighlight,
} from '@shikijs/transformers';
export {
    gfm as micromarkGfm,
    gfmHtml as micromarkGfmHtml,
} from 'micromark-extension-gfm';

export { visit as unistVisit } from 'unist-util-visit';
export { h as hastscriptH } from 'hastscript';

export { glob } from 'glob';
