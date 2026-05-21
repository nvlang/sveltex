// File description: Hover and completion for a `.sveltex` frontmatter block.
//
// A `.sveltex` document may open with a YAML / TOML / JSON frontmatter block.
// SvelTeX reads it and renders the recognised keys into the document's
// `<svelte:head>` — `title` becomes `<title>`, `meta` becomes `<meta>` tags,
// and so on. This module documents that mapping, surfacing it as hover text
// and as completion suggestions.
//
// Both are *context-aware*: which keys are valid depends on the block the
// caret sits in — the top level, or inside `meta` / `base` / `link` — so e.g.
// `title` is documented and suggested at the top level but not inside `meta`,
// where SvelTeX would not render it as a title.
//
// Frontmatter is a non-delegated region: the embedded Svelte language server
// never sees it. Hover and completion here are therefore computed natively.
// They need no position mapping — a frontmatter region is verbatim `.sveltex`
// source, so a token's line/character already are its source coordinates —
// and no real YAML/TOML/JSON parse: the line a key sits on, and which block
// encloses it, are recognised by small line-shaped patterns that cover all
// three syntaxes.

import {
    CompletionItemKind,
    MarkupKind,
    type CompletionItem,
    type CompletionList,
    type Hover,
    type Position,
} from 'vscode-languageserver-protocol';
import {
    keysForContext,
    metaHeadEffect,
    metaRenderedHtml,
    META_HTTP_EQUIV,
    META_NAMES,
    type FrontmatterEntryDoc,
} from './frontmatter-data.js';

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
 * Finds which block a caret line sits inside — `meta`, `base` or `link` — by
 * walking up to the nearest enclosing key: a less-indented YAML/JSON key, or
 * a TOML `[table]` header. `undefined` means the frontmatter top level.
 *
 * @param lines - The `.sveltex` document split into lines.
 * @param lineIndex - The caret's line index.
 */
function frontmatterContext(
    lines: readonly string[],
    lineIndex: number,
): string | undefined {
    const indentOf = (s: string): number => (/^\s*/u.exec(s)?.[0] ?? '').length;
    let minIndent = indentOf(lines[lineIndex] ?? '');
    for (let i = lineIndex - 1; i >= 0; i -= 1) {
        const raw = lines[i] ?? '';
        const trimmed = raw.trim();
        if (trimmed === '' || trimmed.startsWith('#')) continue;
        // The frontmatter fence — the top of the block has been reached.
        if (/^[-+]{3,}$/u.test(trimmed)) break;
        // A TOML `[table]` / `[[table]]` header is the enclosing table.
        const toml = /^\[+\s*([A-Za-z_][\w-]*)/u.exec(trimmed);
        if (toml) {
            const name = toml[1];
            return name === 'meta' || name === 'base' || name === 'link'
                ? name
                : undefined;
        }
        // YAML / JSON: an ancestor is any line indented less than the caret.
        const indent = indentOf(raw);
        if (indent < minIndent) {
            minIndent = indent;
            const keyName = parseFrontmatterLine(raw).key?.name;
            if (
                keyName === 'meta' ||
                keyName === 'base' ||
                keyName === 'link'
            ) {
                return keyName;
            }
        }
    }
    return undefined;
}

/** Top-level keys whose value SvelTeX expects to be an object or array. */
const STRUCTURED_VALUE_KEYS: ReadonlySet<string> = new Set([
    'base',
    'meta',
    'link',
    'imports',
]);

/**
 * The shape of a JavaScript identifier — used to decide whether a key
 * needs quoting when written as an object-literal key in the rendered
 * `metadata` example.
 */
const identifierRegExp = /^[A-Za-z_$][\w$]*$/u;

/**
 * Build the per-effect sections appended to the hover of a top-level
 * frontmatter key — one per frontmatter-processing step the key takes
 * part in. Each section names the step's `frontmatter: { … }` toggle so
 * the reader learns how to switch it off.
 *
 * @param key - The bare key text — used to format the `metadata` object
 * key in the rendered example.
 * @param doc - The key's entry doc; `headEffect` / `element` decide the
 * head section's sentence.
 */
function effectSections(
    key: string,
    doc: FrontmatterEntryDoc,
): readonly string[] {
    const sections: string[] = [];
    const placeholder = STRUCTURED_VALUE_KEYS.has(key)
        ? '〈value〉'
        : '"〈value〉"';
    const disableHint = (toggle: 'head' | 'metadata' | 'imports'): string =>
        `To turn this off, set \`frontmatter: { ${toggle}: false }\` in ` +
        'your SvelTeX configuration.';

    // <svelte:head> — structural keys supply `headEffect` explicitly,
    // `<meta>` / `<meta http-equiv>` / `<meta charset>` keys derive it.
    const head =
        doc.headEffect ??
        (doc.element !== undefined ? metaHeadEffect(doc.element) : undefined);
    if (head !== undefined) {
        sections.push('---', '', head, '', disableHint('head'), '');
    }

    // `import` statements — only for the special `imports` key.
    if (key === 'imports') {
        sections.push(
            '---',
            '',
            "Adds an `import` statement to the page's `<script>` for " +
                'each entry — each key is the module path, each value ' +
                'the binding(s) to import.',
            '',
            disableHint('imports'),
            '',
        );
    }

    // `export const metadata` module-script export — the original key is
    // preserved, quoted when it isn't a valid identifier.
    const metaKey = identifierRegExp.test(key) ? key : JSON.stringify(key);
    sections.push(
        '---',
        '',
        `Adds \`${metaKey}: ${placeholder}\` to the page's \`metadata\` ` +
            'export.',
        '',
        disableHint('metadata'),
        '',
    );

    return sections;
}

/**
 * Builds the Markdown body shown when hovering a frontmatter key or value.
 *
 * @param name - The bare token text.
 * @param doc - The token's {@link FrontmatterEntryDoc}.
 * @param topLevelKey - The bare key text when the hover is over a top-level
 * frontmatter key (not a nested-block key, not a value). When supplied,
 * per-effect sections are appended describing what the key inserts into
 * the page's `<svelte:head>` / `<script>` / `metadata` export, each with
 * the `frontmatter: { … }` toggle that switches that step off.
 */
function entryHoverMarkdown(
    name: string,
    doc: FrontmatterEntryDoc,
    topLevelKey?: string,
): string {
    const rendered =
        doc.rendersAs ??
        (doc.element !== undefined ? metaRenderedHtml(doc.element) : undefined);
    const heading = rendered
        ? `**\`${name}\`** — renders \`${rendered}\``
        : `**\`${name}\`**`;
    const linkLabel = doc.element
        ? `\`${doc.element}\` on MDN`
        : 'SvelTeX documentation';
    const parts: string[] = [
        heading,
        '',
        doc.summary,
        '',
        `[${linkLabel}](${doc.docUrl})`,
        '',
    ];
    if (topLevelKey !== undefined) {
        parts.push(...effectSections(topLevelKey, doc));
    }
    parts.push('_SvelTeX frontmatter_');
    return parts.join('\n');
}

/**
 * Wraps an entry doc and its token into an LSP {@link Hover}.
 *
 * @param topLevelKey - Forwarded to {@link entryHoverMarkdown}; supplied
 * for hovers over a top-level frontmatter key so the markdown body is
 * followed by per-effect sections.
 */
function entryHover(
    token: Token,
    doc: FrontmatterEntryDoc,
    line: number,
    topLevelKey?: string,
): Hover {
    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: entryHoverMarkdown(token.name, doc, topLevelKey),
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
 * when the caret is not on a token recognised in that block.
 */
export function computeFrontmatterHover(
    source: string,
    position: Position,
): Hover | null {
    const lines = source.split(/\r\n?|\n/u);
    const line = lines[position.line];
    if (line === undefined) return null;

    const { key, value } = parseFrontmatterLine(line);
    const caret = position.character;

    // Caret on the key — describe it, but only if the key is valid in the
    // block the caret sits in. `title` inside `meta`, say, is left
    // undocumented because SvelTeX would not render it as the page title
    // there. For top-level keys the body is followed by per-effect
    // sections naming each frontmatter-processing step the key takes part
    // in and the `frontmatter: { … }` toggle that switches it off.
    if (key && caretOn(caret, key)) {
        const context = frontmatterContext(lines, position.line);
        const doc = keysForContext(context)[key.name];
        if (doc === undefined) return null;
        const topLevelKey = context === undefined ? key.name : undefined;
        return entryHover(key, doc, position.line, topLevelKey);
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
 * region: the keys valid in the enclosing block when a key is being typed, or
 * the standard `<meta>` `name` / `http-equiv` values when the caret is on the
 * value of such an entry.
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
    const lines = source.split(/\r\n?|\n/u);
    const line = lines[position.line];
    if (line === undefined) return empty;

    const context = completionContext(line, position.character);
    let entries: Readonly<Record<string, FrontmatterEntryDoc>>;
    let kind: CompletionItemKind;
    if (context.kind === 'key') {
        // Offer only the keys valid in the block the caret sits in — so e.g.
        // `title` is not suggested inside a `meta` block.
        entries = keysForContext(frontmatterContext(lines, position.line));
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

    const items = Object.entries(entries).map(([name, doc]): CompletionItem => {
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
    });
    return { isIncomplete: false, items };
}
