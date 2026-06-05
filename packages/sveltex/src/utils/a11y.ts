// File description: helpers that give **block** code listings an accessible,
// keyboard-scrollable treatment. See `CommonCodeConfiguration.a11y` for the
// user-facing option and the rationale.

import type {
    CodeBlockA11yConfiguration,
    CodeBlockA11yLabel,
    CodeBlockA11yRole,
} from '../types/handlers/Code.js';
import { escapeHtml, isCodeTag, tagToCodeLang } from '../deps.js';

/**
 * Language tags that denote "no language" / plain text. A block tagged with one
 * of these (or with no tag at all) gets a generic label rather than a
 * language-specific one — `tagToCodeLang('text')` is `'Text'`, which would
 * otherwise yield the misleading `"Text code block"`.
 */
const plaintextTags = new Set(['text', 'plain', 'plaintext', 'txt']);

/**
 * Comment that suppresses Svelte's `a11y_no_noninteractive_tabindex` warning for
 * the single element immediately following it. The warning is a false positive
 * on a scrollable region deliberately made keyboard-focusable; emitting the
 * comment per generated `<pre>` keeps the rule active for the user's own markup.
 */
const svelteIgnoreTabindex =
    '<!-- svelte-ignore a11y_no_noninteractive_tabindex -->';

/**
 * Default accessible-name builder: `"<Language> code block"`, or `"Code block"`
 * for a plain (languageless) block.
 */
const defaultLabel: CodeBlockA11yLabel = ({ name }) =>
    name ? `${name} code block` : 'Code block';

/**
 * Resolve the user-facing {@link CodeBlockA11yConfiguration | `a11y`} option
 * (`boolean | object`) into a concrete `{ role, label }`, or `null` when the
 * treatment is switched off.
 *
 * @param value - The merged `code.a11y` value.
 */
export function resolveCodeBlockA11y(
    value: boolean | CodeBlockA11yConfiguration | undefined,
): {
    role: CodeBlockA11yRole | false;
    label: CodeBlockA11yLabel | false;
} | null {
    if (value === false) return null;
    if (value === true || value === undefined) {
        return { role: 'figure', label: defaultLabel };
    }
    return {
        role: value.role ?? 'figure',
        label: value.label ?? defaultLabel,
    };
}

/**
 * Given a language tag already resolved through `langAlias`, return the
 * human-readable language name (via `@nvl/tag-to-code-lang`) and the tag to pass
 * to a label builder. A plain or unknown language yields `name: undefined`.
 *
 * @param tag - The resolved language tag, or `undefined`.
 */
export function codeBlockLabelInfo(tag: string | undefined): {
    name: string | undefined;
    tag: string | undefined;
} {
    if (!tag || plaintextTags.has(tag.toLowerCase())) {
        return { name: undefined, tag: undefined };
    }
    return { name: isCodeTag(tag) ? tagToCodeLang(tag) : undefined, tag };
}

/**
 * Add the accessible, keyboard-scrollable treatment to a **block** code
 * listing's HTML: `tabindex="0"` (plus `role` and `aria-label` as configured) on
 * the outer `<pre>`, preceded by a scoped `svelte-ignore` comment. A no-op when
 * `html` has no `<pre>` (inline code, or the `none` backend, which emits no
 * wrapper) or when every attribute is already present.
 *
 * @param html - The block's rendered HTML (starting at, or containing, `<pre>`).
 * @param role - ARIA role to add, or `false` to add none.
 * @param ariaLabel - Accessible name to add, or `undefined` to add none.
 */
export function addBlockCodeA11y(
    html: string,
    role: CodeBlockA11yRole | false,
    ariaLabel: string | undefined,
): string {
    const openTag = /<pre\b[^>]*>/iu.exec(html)?.[0];
    if (openTag === undefined) return html;
    let attrs = '';
    if (!/\stabindex\s*=/iu.test(openTag)) attrs += ' tabindex="0"';
    if (role && !/\srole\s*=/iu.test(openTag)) attrs += ` role="${role}"`;
    if (ariaLabel && !/\saria-label\s*=/iu.test(openTag)) {
        attrs += ` aria-label="${escapeHtml(ariaLabel)}"`;
    }
    // Insert the attributes before the tag's closing `>`, and prepend the
    // scoped svelte-ignore. Built with slices (not `String#replace`) so a `$`
    // in the label can't be read as a replacement pattern.
    const newOpenTag = `${openTag.slice(0, -1)}${attrs}>`;
    const index = html.indexOf(openTag);
    return (
        html.slice(0, index) +
        `${svelteIgnoreTabindex}\n${newOpenTag}` +
        html.slice(index + openTag.length)
    );
}

/**
 * Convenience wrapper used by the code backends: resolve the `a11y` option and,
 * if enabled, add the block treatment to `html` for the (already
 * `langAlias`-resolved) language `tag`. Returns `html` unchanged when `a11y` is
 * off, or when there is no `<pre>` to treat (e.g. inline code).
 *
 * @param html - The block's rendered HTML.
 * @param a11y - The handler's `a11y` configuration value.
 * @param tag - The resolved language tag, or `undefined`.
 */
export function applyCodeBlockA11y(
    html: string,
    a11y: boolean | CodeBlockA11yConfiguration | undefined,
    tag: string | undefined,
): string {
    const resolved = resolveCodeBlockA11y(a11y);
    if (!resolved) return html;
    const info = codeBlockLabelInfo(tag);
    const ariaLabel =
        resolved.label === false ? undefined : resolved.label(info);
    return addBlockCodeA11y(html, resolved.role, ariaLabel);
}
