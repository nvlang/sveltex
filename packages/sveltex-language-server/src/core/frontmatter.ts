// File description: Hover documentation for keys in a `.sveltex` frontmatter
// block.
//
// A `.sveltex` document may open with a YAML / TOML / JSON frontmatter block.
// SvelTeX reads it and renders the recognised keys into the document's
// `<svelte:head>` — `title` becomes `<title>`, `meta` becomes `<meta>` tags,
// and so on. That mapping is not obvious from the frontmatter alone, so this
// module backs each known key with a one-line description and a documentation
// link (MDN for the keys that map to an HTML head element).
//
// Frontmatter is a non-delegated region: the embedded Svelte language server
// never sees it. The hover here is therefore computed natively. It needs no
// position mapping — a frontmatter region is verbatim `.sveltex` source, so a
// key's line/character already are its source coordinates — and no real
// YAML/TOML/JSON parse: a key is recognised by a small line-shaped pattern that
// covers all three syntaxes.

import {
    MarkupKind,
    type Hover,
    type Position,
} from 'vscode-languageserver-protocol';

/** Documentation for one recognised frontmatter key. */
interface FrontmatterKeyDoc {
    /** A one-line description of what the key does. */
    readonly summary: string;
    /** The HTML head element/attribute the key renders to, if any. */
    readonly element?: string;
    /** A documentation URL — MDN for HTML keys, the SvelTeX site otherwise. */
    readonly docUrl: string;
}

/** Base URL of the MDN HTML element reference. */
const MDN = 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element';

/**
 * The recognised SvelTeX frontmatter keys, keyed by bare name.
 *
 * The set mirrors the `Frontmatter` interface of `@nvl/sveltex`: the top-level
 * keys `title`, `noscript`, `base`, `meta`, `link` and `imports`, plus the
 * nested keys a user writes inside `base`, `meta` and `link` entries. Each maps
 * to an HTML `<head>` construct (except `imports`, which is SvelTeX's own).
 */
const FRONTMATTER_SCHEMA: Readonly<Record<string, FrontmatterKeyDoc>> = {
    title: {
        summary:
            "Sets the document's title — rendered as the page's `<title>` " +
            'element, shown in the browser tab and used by search engines ' +
            'and bookmarks.',
        element: '<title>',
        docUrl: `${MDN}/title`,
    },
    noscript: {
        summary:
            'Fallback content rendered inside a `<noscript>` element, shown ' +
            'only to browsers that have scripting disabled.',
        element: '<noscript>',
        docUrl: `${MDN}/noscript`,
    },
    base: {
        summary:
            "Configures the document's `<base>` element: the base URL and " +
            'default browsing context against which relative URLs on the ' +
            'page are resolved.',
        element: '<base>',
        docUrl: `${MDN}/base`,
    },
    target: {
        summary:
            'The default browsing context for links and forms ' +
            '(`<base target>`) — e.g. `_blank`, `_self`, `_parent`, `_top`.',
        element: '<base target>',
        docUrl: `${MDN}/base#target`,
    },
    meta: {
        summary:
            'A list of `<meta>` elements — document-level metadata such as ' +
            'the description, viewport, character set and social/Open Graph ' +
            'tags.',
        element: '<meta>',
        docUrl: `${MDN}/meta`,
    },
    name: {
        summary:
            'The kind of metadata a `<meta>` element carries ' +
            '(`<meta name>`) — e.g. `description`, `viewport`, `keywords`, ' +
            '`author`, `theme-color`.',
        element: '<meta name>',
        docUrl: `${MDN}/meta#name`,
    },
    'http-equiv': {
        summary:
            'A pragma directive — a `<meta http-equiv>` element that acts ' +
            'like the equivalent HTTP response header.',
        element: '<meta http-equiv>',
        docUrl: `${MDN}/meta#http-equiv`,
    },
    content: {
        summary:
            'The value of a `<meta>` element, paired with its `name` or ' +
            '`http-equiv`.',
        element: '<meta content>',
        docUrl: `${MDN}/meta#content`,
    },
    link: {
        summary:
            'A list of `<link>` elements — relationships to external ' +
            'resources such as stylesheets, icons and preloaded assets.',
        element: '<link>',
        docUrl: `${MDN}/link`,
    },
    rel: {
        summary:
            'The relationship between the document and a linked resource ' +
            '(`<link rel>`) — e.g. `stylesheet`, `icon`, `preload`, ' +
            '`canonical`.',
        element: '<link rel>',
        docUrl: `${MDN}/link#rel`,
    },
    imports: {
        summary:
            'Svelte components and modules to import into the document — a ' +
            'SvelTeX convenience equivalent to writing the imports in a ' +
            '`<script>` block.',
        docUrl: 'https://sveltex.dev',
    },
};

/** A key token located on a frontmatter line. */
interface KeyMatch {
    /** The bare key name. */
    readonly name: string;
    /** Character offset of the first character of the key on its line. */
    readonly start: number;
    /** Character offset one past the last character of the key. */
    readonly end: number;
}

/**
 * Locates the key token on a single frontmatter line, if the line declares
 * one.
 *
 * Recognises all three frontmatter syntaxes with one shape: `key:` (YAML /
 * JSON), `key =` (TOML), an optionally quoted key, an optional leading YAML
 * list-item dash, and a TOML `[table]` / `[[array]]` header.
 *
 * @param line - A single line of frontmatter text.
 * @returns The key and its character range, or `undefined` if the line holds
 * no key.
 */
function findFrontmatterKey(line: string): KeyMatch | undefined {
    // `key:` / `key =` / `"key":`, with an optional `- ` list-item prefix.
    const keyValue = /^(\s*(?:-\s+)?)(['"]?)([A-Za-z_][\w-]*)\2\s*[:=]/u.exec(
        line,
    );
    if (keyValue) {
        const [, indent = '', quote = '', name = ''] = keyValue;
        const start = indent.length + quote.length;
        return { name, start, end: start + name.length };
    }
    // TOML table header: `[base]`, `[[meta]]`.
    const table = /^(\s*\[+\s*)([A-Za-z_][\w-]*)/u.exec(line);
    if (table) {
        const [, prefix = '', name = ''] = table;
        return { name, start: prefix.length, end: prefix.length + name.length };
    }
    return undefined;
}

/**
 * Builds the Markdown body shown when hovering a frontmatter key.
 *
 * @param name - The bare key name.
 * @param doc - The key's {@link FrontmatterKeyDoc}.
 */
function frontmatterHoverMarkdown(
    name: string,
    doc: FrontmatterKeyDoc,
): string {
    const heading = doc.element
        ? `**\`${name}\`** — renders \`${doc.element}\``
        : `**\`${name}\`**`;
    const linkLabel = doc.element
        ? `\`${doc.element}\` on MDN`
        : 'SvelTeX documentation';
    return [
        heading,
        '',
        doc.summary,
        '',
        `[${linkLabel}](${doc.docUrl})`,
        '',
        '_SvelTeX frontmatter_',
    ].join('\n');
}

/**
 * Computes the hover for a caret inside a `.sveltex` frontmatter region.
 *
 * @param source - Full text of the `.sveltex` document.
 * @param position - The caret position, in `.sveltex` coordinates. The caller
 * guarantees it falls inside a `frontmatter` region.
 * @returns A {@link Hover} describing the frontmatter key under the caret, or
 * `null` when the caret is not on a recognised key.
 */
export function computeFrontmatterHover(
    source: string,
    position: Position,
): Hover | null {
    const line = source.split(/\r\n?|\n/u)[position.line];
    if (line === undefined) return null;

    const key = findFrontmatterKey(line);
    if (!key) return null;
    // The caret must land on the key token itself, not on its value.
    if (position.character < key.start || position.character > key.end) {
        return null;
    }

    const doc = FRONTMATTER_SCHEMA[key.name];
    if (!doc) return null;

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: frontmatterHoverMarkdown(key.name, doc),
        },
        range: {
            start: { line: position.line, character: key.start },
            end: { line: position.line, character: key.end },
        },
    };
}
