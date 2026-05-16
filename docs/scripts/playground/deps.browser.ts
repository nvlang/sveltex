// File description: Browser-safe replacement for `packages/sveltex/src/deps.ts`.
//
// SvelTeX's `deps.ts` is a barrel module that statically re-exports Node
// builtins and Node-only npm packages (node-poppler, svgo, glob, rimraf, ...).
// The playground only ever calls `Sveltex.trace` (pure text transformation)
// with the `marked` + `escape` + `katex` backends, so the Node-only code paths
// are never reached. This module mirrors *every* named/type export of the real
// `deps.ts`, but replaces the Node-only pieces with browser-safe shims/stubs:
//
//   - Node builtins  -> pure-JS or no-op shims.
//   - Node-only npm  -> stubs that are safe to construct and only throw if a
//                       real operation is attempted (never reached here).
//   - everything else (deepmerge-ts, micromark-*, mdast-*, hast-*, magic-string,
//                       radash, tsafe, uuid, xregexp, regex, js-yaml, ...) is
//                       re-exported verbatim; those bundle fine for the browser.
//
// `scripts/build-playground.mjs` aliases `../deps.js` / `../deps.ts` to this
// file when bundling SvelTeX with esbuild.

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Node.js builtins -> browser-safe shims
// ---------------------------------------------------------------------------

/** `node:assert` shim. */
export function nodeAssert(value: unknown, message?: string): asserts value {
    if (!value) {
        throw new Error(message ?? 'Assertion failed');
    }
}

/** `node:child_process` type-only export. */
export type SpawnOptionsWithoutStdio = Record<string, unknown>;

/** `node:child_process` `spawn` shim. Never reached on the playground path. */
export function spawn(): never {
    throw new Error('`spawn` is not available in the browser.');
}

/** `node:crypto` type-only export. */
export type BinaryToTextEncoding = 'hex' | 'base64' | 'base64url' | 'binary';

/**
 * Tiny pure-JS stand-in for `node:crypto`'s `createHash`. SvelTeX only uses
 * hashing to derive cache keys/filenames; a non-cryptographic hash is fine
 * here, and these code paths are not exercised by `trace` anyway.
 */
export function createHash(_algorithm: string): {
    update: (data: string) => any;
    digest: (encoding?: BinaryToTextEncoding) => string;
} {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    const api = {
        update(data: string) {
            for (let i = 0; i < data.length; i++) {
                const ch = data.charCodeAt(i);
                h1 = Math.imul(h1 ^ ch, 2654435761);
                h2 = Math.imul(h2 ^ ch, 1597334677);
            }
            return api;
        },
        digest(_encoding?: BinaryToTextEncoding) {
            h1 =
                Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
                Math.imul(h2 ^ (h2 >>> 13), 3266489909);
            h2 =
                Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
                Math.imul(h1 ^ (h1 >>> 13), 3266489909);
            const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
            return n.toString(16).padStart(16, '0');
        },
    };
    return api;
}

// SvelTeX reads `<pkg>/package.json` only to discover a dependency's version
// for CDN URLs (e.g. KaTeX's CSS link). There is no filesystem in the browser,
// so we answer those reads with a minimal stub; SvelTeX falls back to `latest`
// in the resulting CDN URL, which is exactly what we want for the playground.
function fakeFileContents(path: unknown): string | undefined {
    if (typeof path === 'string' && path.endsWith('package.json')) {
        return '{"version":"latest"}';
    }
    return undefined;
}

// `node:fs` (sync) -> in-memory / no-op.
export function existsSync(_path: unknown): boolean {
    return false;
}
export function readFileSync(path: unknown, _options?: unknown): string {
    const fake = fakeFileContents(path);
    if (fake !== undefined) return fake;
    throw new Error('`readFileSync` is not available in the browser.');
}
export function writeFileSync(..._args: unknown[]): void {
    /* no-op */
}
export function mkdirSync(..._args: unknown[]): undefined {
    return undefined;
}

// `node:fs/promises` -> in-memory / no-op.
export async function mkdir(..._args: unknown[]): Promise<undefined> {
    return undefined;
}
export async function readFile(
    path: unknown,
    _options?: unknown,
): Promise<string> {
    const fake = fakeFileContents(path);
    if (fake !== undefined) return fake;
    throw new Error('`readFile` is not available in the browser.');
}
export async function rename(..._args: unknown[]): Promise<void> {
    /* no-op */
}
export async function stat(_path: unknown): Promise<never> {
    throw new Error('`stat` is not available in the browser.');
}
export async function writeFile(..._args: unknown[]): Promise<void> {
    /* no-op */
}

/** `node:os` `homedir` shim. */
export function homedir(): string {
    return '/';
}

// ---------------------------------------------------------------------------
// `node:path` (posix) -> pure reimplementation.
// ---------------------------------------------------------------------------

export const pathSep = '/';

function normalizeArray(parts: string[], allowAboveRoot: boolean): string[] {
    const res: string[] = [];
    for (const p of parts) {
        if (!p || p === '.') continue;
        if (p === '..') {
            if (res.length && res[res.length - 1] !== '..') {
                res.pop();
            } else if (allowAboveRoot) {
                res.push('..');
            }
        } else {
            res.push(p);
        }
    }
    return res;
}

export function normalize(path: string): string {
    const isAbsolute = path.startsWith('/');
    const trailingSlash = path.endsWith('/');
    let normalized = normalizeArray(path.split('/'), !isAbsolute).join('/');
    if (!normalized && !isAbsolute) normalized = '.';
    if (normalized && trailingSlash) normalized += '/';
    return (isAbsolute ? '/' : '') + normalized;
}

export function join(...parts: string[]): string {
    const joined = parts.filter((p) => p && p.length > 0).join('/');
    return joined ? normalize(joined) : '.';
}

export function resolve(...parts: string[]): string {
    let resolved = '';
    let isAbsolute = false;
    for (let i = parts.length - 1; i >= -1 && !isAbsolute; i--) {
        const part = i >= 0 ? parts[i] : '/';
        if (!part) continue;
        resolved = part + '/' + resolved;
        isAbsolute = part.startsWith('/');
    }
    resolved = normalizeArray(resolved.split('/'), !isAbsolute).join('/');
    if (isAbsolute) return '/' + resolved;
    return resolved || '.';
}

export function dirname(path: string): string {
    if (path.length === 0) return '.';
    const hasRoot = path.startsWith('/');
    let end = -1;
    let matchedSlash = true;
    for (let i = path.length - 1; i >= 1; i--) {
        if (path[i] === '/') {
            if (!matchedSlash) {
                end = i;
                break;
            }
        } else {
            matchedSlash = false;
        }
    }
    if (end === -1) return hasRoot ? '/' : '.';
    if (hasRoot && end === 1) return '//';
    return path.slice(0, end);
}

export function basename(path: string, ext?: string): string {
    let start = 0;
    let end = -1;
    let matchedSlash = true;
    for (let i = path.length - 1; i >= 0; i--) {
        if (path[i] === '/') {
            if (!matchedSlash) {
                start = i + 1;
                break;
            }
        } else if (end === -1) {
            matchedSlash = false;
            end = i + 1;
        }
    }
    let name = end === -1 ? '' : path.slice(start, end);
    if (ext && name.endsWith(ext) && name !== ext) {
        name = name.slice(0, name.length - ext.length);
    }
    return name;
}

export function relative(from: string, to: string): string {
    const fromParts = normalizeArray(resolve(from).split('/'), false);
    const toParts = normalizeArray(resolve(to).split('/'), false);
    let i = 0;
    while (
        i < fromParts.length &&
        i < toParts.length &&
        fromParts[i] === toParts[i]
    ) {
        i++;
    }
    const up = fromParts.slice(i).map(() => '..');
    return [...up, ...toParts.slice(i)].join('/');
}

// ---------------------------------------------------------------------------
// `node:process` -> minimal browser-safe object.
// ---------------------------------------------------------------------------

const browserProcess = {
    cwd: () => '/',
    env: {} as Record<string, string | undefined>,
    platform: 'browser',
    argv: [] as string[],
    version: '',
    versions: {} as Record<string, string>,
    nextTick: (cb: (...args: unknown[]) => void, ...args: unknown[]) => {
        Promise.resolve().then(() => {
            cb(...args);
        });
    },
    hrtime: ((time?: [number, number]) => {
        const now = (globalThis.performance?.now?.() ?? Date.now()) * 1e6;
        const sec = Math.floor(now / 1e9);
        const nano = Math.floor(now % 1e9);
        if (time) return [sec - time[0], nano - time[1]];
        return [sec, nano];
    }) as unknown as NodeJS.Process['hrtime'],
    stdout: { write: () => true },
    stderr: { write: () => true },
    on: () => browserProcess,
    exit: () => undefined,
};

export const process = browserProcess as unknown as NodeJS.Process;

// ---------------------------------------------------------------------------
// `node:util` -> browser-safe shims.
// ---------------------------------------------------------------------------

/** Minimal `node:util` `inspect` shim. */
export function inspect(value: unknown): string {
    try {
        return typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/** `node:util/types` `isRegExp`. */
export function isRegExp(value: unknown): value is RegExp {
    return (
        value instanceof RegExp ||
        Object.prototype.toString.call(value) === '[object RegExp]'
    );
}

// ---------------------------------------------------------------------------
// Node-only npm packages -> stubs (safe to construct, never reached here).
// ---------------------------------------------------------------------------

/** `find-cache-directory` stub. */
export function findCacheDirectory(): string | undefined {
    return undefined;
}

/** `glob` `Glob` stub. */
export class Glob {
    constructor(..._args: unknown[]) {
        /* no-op */
    }
    [Symbol.iterator]() {
        return [][Symbol.iterator]();
    }
    [Symbol.asyncIterator]() {
        return (async function* () {
            /* yields nothing */
        })();
    }
    walkSync(): string[] {
        return [];
    }
    async walk(): Promise<string[]> {
        return [];
    }
}

/** `node-fetch` `AbortError` stub. */
export class AbortError extends Error {
    type = 'aborted';
    constructor(message = 'The operation was aborted.') {
        super(message);
        this.name = 'AbortError';
    }
}

/** `node-fetch` default export -> browser `fetch`. */
export const nodeFetch: typeof fetch = (...args: Parameters<typeof fetch>) =>
    globalThis.fetch(...args);

/** `ora` type-only export. */
export type Ora = ReturnType<typeof ora>;

/** `ora` default export -> no-op spinner. */
export function ora(_options?: unknown): {
    start: (text?: string) => any;
    stop: () => any;
    succeed: (text?: string) => any;
    fail: (text?: string) => any;
    warn: (text?: string) => any;
    info: (text?: string) => any;
    clear: () => any;
    render: () => any;
    stopAndPersist: () => any;
    text: string;
    isSpinning: boolean;
} {
    const spinner: any = {
        text: '',
        isSpinning: false,
        start: () => spinner,
        stop: () => spinner,
        succeed: () => spinner,
        fail: () => spinner,
        warn: () => spinner,
        info: () => spinner,
        clear: () => spinner,
        render: () => spinner,
        stopAndPersist: () => spinner,
    };
    return spinner;
}

/** `rimraf` stub. Never reached on the playground path. */
export async function rimraf(..._args: unknown[]): Promise<boolean> {
    return true;
}

/** `node-poppler` `Poppler` stub. Native bindings; never reached here. */
export class Poppler {
    constructor(..._args: unknown[]) {
        /* no-op: construction is safe, operations are not reached */
    }
    pdfToCairo(): never {
        throw new Error('`node-poppler` is not available in the browser.');
    }
}

/** `svgo` type-only export. */
export type SvgoOptions = Record<string, unknown>;

/** `svgo` `optimize` stub. SVG optimization is not reached by `trace`. */
export function svgoOptimize(input: string): { data: string } {
    return { data: input };
}

// ---------------------------------------------------------------------------
// Everything else: re-exported verbatim from `deps.ts`. These packages all
// resolve and bundle for the browser without issue.
// ---------------------------------------------------------------------------

export { deepmergeCustom } from 'deepmerge-ts';
export { escape as escapeHtml } from 'html-escaper';
export { htmlTagNames } from 'html-tag-names';
export { default as MagicString, type SourceMap } from 'magic-string';

export type {
    Code as MicromarkCode,
    Construct as MicromarkConstruct,
    Effects as MicromarkEffects,
    State as MicromarkState,
    TokenizeContext as MicromarkTokenizeContext,
} from 'micromark-util-types';

export {
    markdownLineEnding as micromarkMarkdownLineEnding,
    markdownLineEndingOrSpace as micromarkMarkdownLineEndingOrSpace,
} from 'micromark-util-character';
export { htmlRawNames } from 'micromark-util-html-tag-name';
export { codes as asciiCodes } from 'micromark-util-symbol';

export { fromHtml as hastFromHtml } from 'hast-util-from-html';
export { toHtml as hastToHtml } from 'hast-util-to-html';

export type { Element as HastElement } from 'hast';

export { default as sanitizeHtml } from 'sanitize-html';

export type {
    Code as MdastCodeNode,
    InlineCode as MdastInlineCodeNode,
    Literal as MdastLiteral,
    Root as MdastRoot,
    Yaml as MdastYaml,
} from 'mdast';

export {
    fromMarkdown as mdastFromMarkdown,
    type Extension as MdastExtension,
    type Options as MdastFromMarkdownOptions,
} from 'mdast-util-from-markdown';

export { mdxJsxFromMarkdown as mdastMdxJsxFromMarkdown } from 'mdast-util-mdx-jsx';

export { mdxJsx as micromarkMdxJsx } from 'micromark-extension-mdx-jsx';

export {
    mathFromMarkdown as mdastMathFromMarkdown,
    type InlineMath as MdastInlineMathNode,
    type Math as MdastMathNode,
} from 'mdast-util-math';

export { directiveFromMarkdown } from 'mdast-util-directive';
export {
    frontmatterFromMarkdown as mdastFrontmatterFromMarkdown,
    frontmatterToMarkdown as mdastFrontmatterToMarkdown,
} from 'mdast-util-frontmatter';
export {
    mdxExpressionFromMarkdown as mdastMdxExpressionFromMarkdown,
    type MdxFlowExpression as MdastMdxFlowExpressionNode,
    type MdxTextExpression as MdastMdxTextExpressionNode,
} from 'mdast-util-mdx-expression';
export { directive as micromarkDirective } from 'micromark-extension-directive';
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
    mdxMd as micromarkMdxMd,
    type Extension as MicromarkExtension,
} from 'micromark-extension-mdx-md';
export type { TokenTypeMap as MicromarkTokenTypeMap } from 'micromark-util-types';
export { default as pc } from 'picocolors';
export type { Colors } from 'picocolors/types.js';
export { default as prettyBytes } from 'pretty-bytes';
export {
    crush as flattenObject,
    get as getProperty,
    set as setProperty,
} from 'radash';
export { default as rfdc } from 'rfdc'; // "Really Fast Deep Clone"
export type {
    MarkupPreprocessor,
    Preprocessor,
    PreprocessorGroup,
} from 'svelte/compiler';
export type { HTMLAttributes } from 'svelte/elements';
export { is, assert as typeAssert, type Equals, type Extends } from 'tsafe';
export type {
    Node as UnistNode,
    Point as UnistPoint,
    Position as UnistPosition,
} from 'unist';
export { v4 as uuid } from 'uuid';
import { default as XRegExpOrig } from 'xregexp';
XRegExpOrig.install({ namespacing: true });
export const XRegExp = XRegExpOrig;

export { regex, pattern } from 'regex';

// Parsers for frontmatter
export { load as parseYaml } from 'js-yaml';
export { parse as parseToml } from 'smol-toml';
