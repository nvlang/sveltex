// File description: Hover and completion for a `.sveltex` frontmatter block.
//
// A `.sveltex` document may open with a YAML / TOML / JSON frontmatter block.
// SvelTeX reads it and renders the recognised keys into the document's
// `<svelte:head>` — `title` becomes `<title>`, `meta` becomes `<meta>` tags,
// and so on. This module documents that mapping: each known frontmatter key,
// and each standard `<meta>` `name` / `http-equiv` value, is backed by a
// one-line description and a documentation link (MDN for the keys and values
// that map to an HTML head construct). It surfaces that knowledge two ways —
// as hover text, and as completion suggestions.
//
// Frontmatter is a non-delegated region: the embedded Svelte language server
// never sees it. Hover and completion here are therefore computed natively.
// They need no position mapping — a frontmatter region is verbatim `.sveltex`
// source, so a token's line/character already are its source coordinates —
// and no real YAML/TOML/JSON parse: a key/value pair is recognised by a small
// line-shaped pattern that covers all three syntaxes.

import {
    CompletionItemKind,
    MarkupKind,
    type CompletionItem,
    type CompletionList,
    type Hover,
    type Position,
} from 'vscode-languageserver-protocol';

/** Documentation for one recognised frontmatter key or `<meta>` value. */
interface FrontmatterEntryDoc {
    /** A one-line description of what the key or value does. */
    readonly summary: string;
    /** The HTML head element/attribute it renders to, if any. */
    readonly element?: string;
    /** A documentation URL — MDN for HTML entries, the SvelTeX site else. */
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
const FRONTMATTER_SCHEMA: Readonly<Record<string, FrontmatterEntryDoc>> = {
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

/**
 * Standard `<meta name="…">` values — what a user writes as the value of a
 * `name:` entry inside `meta`. Mirrors `@nvl/sveltex`'s `MetaName` type.
 */
const META_NAMES: Readonly<Record<string, FrontmatterEntryDoc>> = {
    charset: {
        summary:
            "Declares the document's character encoding, emitted as " +
            '`<meta charset>`. In practice this is always `utf-8`.',
        element: '<meta charset>',
        docUrl: `${MDN}/meta`,
    },
    author: {
        summary: "The name of the document's author.",
        element: '<meta name="author">',
        docUrl: `${MDN}/meta/name`,
    },
    'application-name': {
        summary:
            'The name of the web application the page represents; used by ' +
            'browsers when the site is pinned or installed.',
        element: '<meta name="application-name">',
        docUrl: `${MDN}/meta/name`,
    },
    description: {
        summary:
            "A short, accurate summary of the page's content. Search " +
            'engines often show it beneath the title in results.',
        element: '<meta name="description">',
        docUrl: `${MDN}/meta/name`,
    },
    generator: {
        summary: 'The identifier of the software that generated the page.',
        element: '<meta name="generator">',
        docUrl: `${MDN}/meta/name`,
    },
    keywords: {
        summary:
            'A comma-separated list of keywords relevant to the page — ' +
            'largely ignored by modern search engines.',
        element: '<meta name="keywords">',
        docUrl: `${MDN}/meta/name`,
    },
    viewport: {
        summary:
            'Hints to the browser on how to size and scale the viewport — ' +
            'essential for a page to render well on mobile devices.',
        element: '<meta name="viewport">',
        docUrl: `${MDN}/meta/name`,
    },
    referrer: {
        summary:
            'Controls the `Referer` header sent for requests the page ' +
            'initiates.',
        element: '<meta name="referrer">',
        docUrl: `${MDN}/meta/name`,
    },
    'theme-color': {
        summary:
            'Suggests a colour for browsers to tint surrounding UI with, ' +
            'such as the address bar or the task switcher.',
        element: '<meta name="theme-color">',
        docUrl: `${MDN}/meta/name`,
    },
    'color-scheme': {
        summary:
            'Declares which colour schemes (e.g. `light`, `dark`) the ' +
            'document is comfortable being rendered in.',
        element: '<meta name="color-scheme">',
        docUrl: `${MDN}/meta/name`,
    },
};

/**
 * Standard `<meta http-equiv="…">` values — what a user writes as the value
 * of an `http-equiv:` entry. Mirrors `@nvl/sveltex`'s `MetaHttpEquiv` type.
 */
const META_HTTP_EQUIV: Readonly<Record<string, FrontmatterEntryDoc>> = {
    'content-security-policy': {
        summary:
            'Defines a Content Security Policy for the document, ' +
            'restricting which resources it may load and execute.',
        element: '<meta http-equiv="content-security-policy">',
        docUrl: `${MDN}/meta`,
    },
    'default-style': {
        summary: 'Sets the name of the preferred (default) stylesheet.',
        element: '<meta http-equiv="default-style">',
        docUrl: `${MDN}/meta`,
    },
};

/**
 * Every name a user may write as a frontmatter *key*.
 *
 * Besides the structural keys, this includes the `<meta>` `name` /
 * `http-equiv` values: SvelTeX's `interpretFrontmatter` accepts a metadata
 * name written directly as a key — at the top level (`description: …`) or in
 * the `meta: { description: … }` mapping form — not only as the value of a
 * `name:` entry in the `meta: [{ name: … }]` array form. The three name
 * spaces are disjoint, so the merge is unambiguous.
 */
const ALL_FRONTMATTER_KEYS: Readonly<Record<string, FrontmatterEntryDoc>> = {
    ...FRONTMATTER_SCHEMA,
    ...META_NAMES,
    ...META_HTTP_EQUIV,
};

/** A key or value token located on a frontmatter line. */
interface Token {
    /** The bare token text. */
    readonly name: string;
    /** Character offset of the first character of the token on its line. */
    readonly start: number;
    /** Character offset one past the last character of the token. */
    readonly end: number;
}

/** The key and (when present) first value token of a frontmatter line. */
interface LineTokens {
    readonly key?: Token;
    readonly value?: Token;
}

/**
 * Splits a single frontmatter line into its key and first value token.
 *
 * Recognises all three frontmatter syntaxes with one shape: `key: value`
 * (YAML / JSON), `key = value` (TOML), optionally quoted tokens, an optional
 * leading YAML list-item dash, and a TOML `[table]` / `[[array]]` header
 * (which has a key but no value).
 *
 * @param line - A single line of frontmatter text.
 * @returns The key and value tokens found on the line (either may be absent).
 */
function parseFrontmatterLine(line: string): LineTokens {
    // `key: value` / `key = value` / `"key": "value"`, with an optional `- `
    // list-item prefix. The value is the first token after the separator.
    const keyValue =
        /^(\s*(?:-\s+)?)(['"]?)([A-Za-z_][\w-]*)\2(\s*[:=]\s*)(['"]?)([\w-][\w./-]*)?/u.exec(
            line,
        );
    if (keyValue) {
        const [, indent = '', kq = '', key = '', sep = '', vq = '', value] =
            keyValue;
        const keyStart = indent.length + kq.length;
        const key_: Token = {
            name: key,
            start: keyStart,
            end: keyStart + key.length,
        };
        if (value === undefined || value.length === 0) return { key: key_ };
        // The closing key quote is `\2`, i.e. another `kq`.
        const valueStart =
            indent.length + kq.length * 2 + key.length + sep.length + vq.length;
        return {
            key: key_,
            value: {
                name: value,
                start: valueStart,
                end: valueStart + value.length,
            },
        };
    }
    // TOML table header: `[base]`, `[[meta]]` — a key with no value.
    const table = /^(\s*\[+\s*)([A-Za-z_][\w-]*)/u.exec(line);
    if (table) {
        const [, prefix = '', name = ''] = table;
        return {
            key: {
                name,
                start: prefix.length,
                end: prefix.length + name.length,
            },
        };
    }
    return {};
}

/** Whether the caret column falls on (or just past the end of) `token`. */
function caretOn(caret: number, token: Token): boolean {
    return caret >= token.start && caret <= token.end;
}

/**
 * Builds the Markdown body shown when hovering a frontmatter key or value.
 *
 * @param name - The bare token text.
 * @param doc - The token's {@link FrontmatterEntryDoc}.
 */
function entryHoverMarkdown(name: string, doc: FrontmatterEntryDoc): string {
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

/** Wraps an entry doc and its token into an LSP {@link Hover}. */
function entryHover(
    token: Token,
    doc: FrontmatterEntryDoc,
    line: number,
): Hover {
    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: entryHoverMarkdown(token.name, doc),
        },
        range: {
            start: { line, character: token.start },
            end: { line, character: token.end },
        },
    };
}

/**
 * Computes the hover for a caret inside a `.sveltex` frontmatter region.
 *
 * @param source - Full text of the `.sveltex` document.
 * @param position - The caret position, in `.sveltex` coordinates. The caller
 * guarantees it falls inside a `frontmatter` region.
 * @returns A {@link Hover} describing the frontmatter key — or, on a `name:` /
 * `http-equiv:` line, the standard `<meta>` value — under the caret, or `null`
 * when the caret is not on a recognised token.
 */
export function computeFrontmatterHover(
    source: string,
    position: Position,
): Hover | null {
    const line = source.split(/\r\n?|\n/u)[position.line];
    if (line === undefined) return null;

    const { key, value } = parseFrontmatterLine(line);
    const caret = position.character;

    // Caret on the key — describe the frontmatter key itself. A key may be a
    // structural key or a metadata name written directly (see
    // `ALL_FRONTMATTER_KEYS`).
    if (key && caretOn(caret, key)) {
        const doc = ALL_FRONTMATTER_KEYS[key.name];
        return doc ? entryHover(key, doc, position.line) : null;
    }

    // Caret on the value of a `name:` / `http-equiv:` entry — describe the
    // standard metadata name or pragma directive it selects.
    if (key && value && caretOn(caret, value)) {
        const schema =
            key.name === 'name'
                ? META_NAMES
                : key.name === 'http-equiv'
                  ? META_HTTP_EQUIV
                  : undefined;
        const doc = schema?.[value.name];
        if (doc) return entryHover(value, doc, position.line);
    }

    return null;
}

/** Whether the caret on a frontmatter line is completing a key or a value. */
type CompletionContext =
    | { readonly kind: 'key' }
    | { readonly kind: 'value'; readonly ofKey: string };

/**
 * Classifies a caret on a frontmatter line as completing a key or a value.
 *
 * The caret is in value position once it is past the `:` / `=` separator of a
 * `key:` / `key =` pair; everywhere else a key is being typed.
 *
 * @param line - The frontmatter line the caret is on.
 * @param caret - The caret's character offset within the line.
 */
function completionContext(line: string, caret: number): CompletionContext {
    const pair = /^(\s*(?:-\s+)?)(['"]?)([A-Za-z_][\w-]*)\2(\s*)([:=])/u.exec(
        line,
    );
    if (pair) {
        const [match = '', , , key = ''] = pair;
        if (caret > match.length - 1) return { kind: 'value', ofKey: key };
    }
    return { kind: 'key' };
}

/**
 * Computes the completion list for a caret inside a `.sveltex` frontmatter
 * region: the frontmatter keys when a key is being typed, or the standard
 * `<meta>` `name` / `http-equiv` values when the caret is on the value of
 * such an entry.
 *
 * @param source - Full text of the `.sveltex` document.
 * @param position - The caret position, in `.sveltex` coordinates. The caller
 * guarantees it falls inside a `frontmatter` region.
 * @returns A {@link CompletionList} — empty (but never `null`) when nothing
 * sensible can be suggested.
 */
export function computeFrontmatterCompletion(
    source: string,
    position: Position,
): CompletionList {
    const empty: CompletionList = { isIncomplete: false, items: [] };
    const line = source.split(/\r\n?|\n/u)[position.line];
    if (line === undefined) return empty;

    const context = completionContext(line, position.character);
    let entries: Readonly<Record<string, FrontmatterEntryDoc>>;
    let kind: CompletionItemKind;
    if (context.kind === 'key') {
        entries = ALL_FRONTMATTER_KEYS;
        kind = CompletionItemKind.Property;
    } else if (context.ofKey === 'name') {
        entries = META_NAMES;
        kind = CompletionItemKind.EnumMember;
    } else if (context.ofKey === 'http-equiv') {
        entries = META_HTTP_EQUIV;
        kind = CompletionItemKind.EnumMember;
    } else {
        // The value of any other key is free-form — nothing to suggest.
        return empty;
    }

    // The inserted text replaces the partial identifier already typed.
    const typed = /[A-Za-z0-9_-]*$/u.exec(line.slice(0, position.character));
    const range = {
        start: {
            line: position.line,
            character: position.character - (typed?.[0] ?? '').length,
        },
        end: { line: position.line, character: position.character },
    };

    const items = Object.entries(entries).map(
        ([name, doc]): CompletionItem => {
            const item: CompletionItem = {
                label: name,
                kind,
                documentation: {
                    kind: MarkupKind.Markdown,
                    value: doc.summary,
                },
                textEdit: { range, newText: name },
            };
            if (doc.element) item.detail = doc.element;
            return item;
        },
    );
    return { isIncomplete: false, items };
}
