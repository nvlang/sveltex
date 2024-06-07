// Node.js
export { default as nodeAssert } from 'node:assert';
export { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process';
export { createHash, type BinaryToTextEncoding } from 'node:crypto';
export { existsSync, readFileSync } from 'node:fs';
export { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
export { homedir } from 'node:os';
export {
    dirname,
    basename,
    join,
    normalize,
    relative,
    resolve,
    sep as pathSep,
} from 'node:path';
export { inspect } from 'node:util';
export { isRegExp } from 'node:util/types';

export { default as CleanCSS, Output } from 'clean-css';
export { deepmergeCustom } from 'deepmerge-ts';
export { default as findCacheDirectory } from 'find-cache-dir';
export { Glob } from 'glob';
export { escape as escapeHtml } from 'html-escaper';
export { htmlTagNames } from 'html-tag-names';
export { default as MagicString, type SourceMap } from 'magic-string';

/**
 * MDAST types for better type-safety.
 */
export type {
    Code as MdastCodeNode,
    InlineCode as MdastInlineCodeNode,
    Literal as MdastLiteral,
    Root as MdastRoot,
    Yaml as MdastYaml,
} from 'mdast';

/**
 * MDAST utility that turns markdown into a syntax tree.
 *
 * - `fromMarkdown`: Turn markdown into a syntax tree.
 *
 * Types:
 *
 * - `Extension`: An Extension object can change how markdown tokens from
 *   micromark are turned into MDAST.
 * - `Options`: Options for `fromMarkdown`.
 */
export {
    fromMarkdown as mdastFromMarkdown,
    type Extension as MdastExtension,
    type Options as MdastFromMarkdownOptions,
} from 'mdast-util-from-markdown';

/**
 * MDAST extensions to parse and serialize math (e.g. $x^2$).
 *
 * - `mathFromMarkdown`: Create an extension for `mdast-util-from-markdown` that
 *   will help parse math.
 *
 * Types:
 *
 * - `InlineMath`: An inline math node within an MDAST.
 * - `Math`: A display math node within an MDAST.
 */
export {
    mathFromMarkdown as mdastMathFromMarkdown,
    type InlineMath as MdastInlineMathNode,
    type Math as MdastMathNode,
} from 'mdast-util-math';

/**
 *
 */
export {
    frontmatterFromMarkdown as mdastFrontmatterFromMarkdown,
    frontmatterToMarkdown as mdastFrontmatterToMarkdown,
} from 'mdast-util-frontmatter';
export {
    mdxExpressionFromMarkdown as mdastMdxExpressionFromMarkdown,
    type MdxFlowExpression as MdastMdxFlowExpressionNode,
    type MdxTextExpression as MdastMdxTextExpressionNode,
} from 'mdast-util-mdx-expression';
export { mdxJsxFromMarkdown as mdastMdxJsxFromMarkdown } from 'mdast-util-mdx-jsx';
export { frontmatter as micromarkFrontmatter } from 'micromark-extension-frontmatter';
export {
    math as micromarkMath,
    type Options as MicromarkMathOptions,
} from 'micromark-extension-math';
export { mdx as micromarkMdx } from 'micromark-extension-mdx';
export {
    mdxExpression as micromarkMdxExpression,
    type Options as MicromarkMdxExpressionOptions,
} from 'micromark-extension-mdx-expression';
export {
    mdxJsx as micromarkMdxJsx,
    type Options as MicromarkMdxJsxOptions,
} from 'micromark-extension-mdx-jsx';
export {
    mdxMd as micromarkMdxMd,
    type Extension as MicromarkExtension,
} from 'micromark-extension-mdx-md';
export type {
    Value as MdastFromMarkdownValue,
    Options,
} from 'micromark-util-types';
export { AbortError, default as nodeFetch } from 'node-fetch';
export { default as ora, type Ora } from 'ora';
export { default as pc } from 'picocolors';
export type { Colors } from 'picocolors/types.js';
export { default as prettyBytes } from 'pretty-bytes';
export {
    crush as flattenObject,
    get as getProperty,
    set as setProperty,
} from 'radash';
export { default as rfdc } from 'rfdc'; // "Really Fast Deep Clone"
export { rimraf } from 'rimraf';
export type {
    MarkupPreprocessor,
    Preprocessor,
    PreprocessorGroup,
} from 'svelte/compiler';
export type { HTMLAttributes } from 'svelte/elements';
export { optimize as svgoOptimize, type Config as SvgoOptions } from 'svgo';
export { is, assert as typeAssert, type Equals, type Extends } from 'tsafe';
export type {
    Node as UnistNode,
    Position as UnistPosition,
    Point as UnistPoint,
} from 'unist';
export { v4 as uuid } from 'uuid';
export { default as XRegExp } from 'xregexp';

export { Poppler } from 'node-poppler';

// Parsers for frontmatter
export { load as parseYaml } from 'js-yaml';
export { parse as parseToml } from 'smol-toml';
