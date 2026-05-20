// File description:  Parse frontmatter from a Sveltex file.

// Types
import type {
    Frontmatter,
    Meta,
    MetaHttpEquiv,
    MetaName,
} from '../types/utils/Frontmatter.js';
import type { FullFrontmatterConfiguration } from '../types/SveltexConfiguration.js';

// Internal dependencies
import { log, prettifyError } from './debug.js';

// External dependencies
import { parseYaml, parseToml } from '../deps.js';
import type { ProcessableSnippet } from '../types/utils/Escape.js';
import {
    isArray,
    isNonNullObject,
    isPresentAndDefined,
    isRecord,
    isString,
} from '../typeGuards/utils.js';
import { isMetaHttpEquiv, isMetaName } from '../typeGuards/frontmatter.js';

export function parseFrontmatter(
    snippet: ProcessableSnippet<'frontmatter'>,
): object | undefined {
    const lang = snippet.optionsForProcessor.type;
    try {
        let result: unknown = undefined;
        if (lang === 'yaml') result = parseYaml(snippet.innerContent);
        else if (lang === 'toml') result = parseToml(snippet.innerContent);
        else result = JSON.parse(snippet.innerContent);
        return isNonNullObject(result) ? result : undefined;
    } catch (error) {
        log('error', `Error parsing frontmatter: ${prettifyError(error)}`);
        return undefined;
    }
}

/**
 * Interpret a raw parsed frontmatter object into:
 *
 *   - a `frontmatter` object that mirrors the user's input verbatim,
 *     with `base` / `link` / `meta` normalized into the structural
 *     shapes the consumer is best served by (string `base` → `{href}`,
 *     invalid `link` items dropped, `meta:` block deduplicated). The
 *     `metadata` export SvelTeX emits is built from this object — so it
 *     reflects what the user wrote, no more.
 *   - a separate `meta` array of `<meta>` entries to render in
 *     `<svelte:head>`. This combines the synthesized entries derived
 *     from top-level metadata-name keys (`color-scheme: dark` →
 *     `<meta name="color-scheme" content="dark">`) with the user's
 *     `meta:` block; the synthesized entries do _not_ leak into
 *     `frontmatter.meta`.
 */
export function interpretFrontmatter(
    obj: object | undefined,
): { frontmatter: Frontmatter; meta: Meta[] } | undefined {
    if (obj === undefined) return undefined;
    const { title, noscript, base, link, meta: rawMeta, ...rest } = obj as {
        title: unknown;
        noscript: unknown;
        base: unknown;
        link: unknown;
        meta: unknown;
    };

    const frontmatter: Frontmatter = { ...rest };
    const interpretedLink: Frontmatter['link'] = [];

    // Title
    if (title && isString(title)) frontmatter.title = title;

    // NoScript
    if (noscript && isString(noscript)) frontmatter.noscript = noscript;

    // Synthesized `<meta>` list from top-level metadata-name keys.
    // Kept SEPARATE from `frontmatter` so the `metadata` export reflects
    // only what the user wrote.
    const synthesizedMeta: Meta[] = [];
    Object.entries(rest).forEach(([k, v]) => {
        if (isString(k) && isString(v)) {
            if (k === 'charset') {
                // `charset` is special: HTML wants `<meta charset="…">`,
                // not `<meta name="charset" content="…">`. Push the
                // dedicated `CharsetMeta` shape so the `<meta>`-rendering
                // loop in `handleFrontmatter` emits the right tag.
                synthesizedMeta.push({ charset: v });
            } else if (isMetaName(k)) {
                synthesizedMeta.push({ name: k, content: v });
            } else if (isMetaHttpEquiv(k)) {
                synthesizedMeta.push({ 'http-equiv': k, content: v });
            }
        }
    });

    // Base URL
    if (base) {
        if (isString(base)) {
            frontmatter.base = { href: base };
        } else if (isNonNullObject(base)) {
            const href =
                isPresentAndDefined(base, 'href') && isString(base.href)
                    ? base.href
                    : undefined;
            const target =
                isPresentAndDefined(base, 'target') && isString(base.target)
                    ? base.target
                    : undefined;
            if (href && target) {
                frontmatter.base = { href, target };
            } else if (href) {
                frontmatter.base = { href };
            } else if (target) {
                frontmatter.base = { target };
            }
        }
    }

    // Link
    if (link) {
        frontmatter.link = [];
        if (isArray(link)) {
            link.forEach((item) => {
                if (
                    isNonNullObject(item) &&
                    isPresentAndDefined(item, 'rel') &&
                    isString(item.rel)
                ) {
                    interpretedLink.push(
                        item as { rel: string; [key: string]: unknown },
                    );
                }
            });
        }
    }
    if (interpretedLink.length > 0) frontmatter.link = interpretedLink;

    // Process the user's `meta:` block twice:
    //   - silently into an empty list — that's `frontmatter.meta`, used
    //     for the `metadata` export, so it reflects only what the user
    //     wrote;
    //   - loudly into a copy of the synthesized list — that's the
    //     `<meta>` list rendered into `<svelte:head>`.
    // Both passes deduplicate; the `silent` flag stops the user-only
    // pass from logging duplicate-name warnings the rendered pass will
    // log too.
    const userMeta = applyMetaBlock([], rawMeta, true);
    const renderedMeta = applyMetaBlock([...synthesizedMeta], rawMeta, false);

    if (userMeta.length > 0) frontmatter.meta = userMeta;

    return { frontmatter, meta: renderedMeta };
}

// The three `addX` helpers below accept a `silent` flag because
// `interpretFrontmatter` calls them twice: once silently to build the
// user-only `frontmatter.meta`, and once loudly to build the rendered
// `<meta>` list (synthesized + user). Without the flag, dedup warnings
// inside the user's `meta:` block would fire twice.

function addMetaName(
    interpretedMeta: Meta[],
    rawItem: {
        name: MetaName;
        content:
            | (string | number | boolean | null)
            | (string | number | boolean | null)[];
    },
    silent: boolean = false,
) {
    const item = {
        ...rawItem,
        content: isArray(rawItem.content)
            ? rawItem.content.join(', ')
            : rawItem.content,
    };
    const others = interpretedMeta.filter(
        (m) =>
            (isPresentAndDefined(m, 'name') && m.name !== item.name) ||
            isPresentAndDefined(m, 'http-equiv') ||
            isPresentAndDefined(m, 'charset'),
    );
    if (others.length !== interpretedMeta.length) {
        if (!silent) {
            log(
                'warn',
                `Duplicate meta name "${item.name}" found in frontmatter.`,
            );
        }
        return [...others, item];
    } else {
        interpretedMeta.push(item);
        return interpretedMeta;
    }
}

function addMetaHttpEquiv(
    interpretedMeta: Meta[],
    rawItem: {
        'http-equiv': MetaHttpEquiv;
        content:
            | (string | number | boolean | null)
            | (string | number | boolean | null)[];
    },
    silent: boolean = false,
): Meta[] {
    const item = {
        ...rawItem,
        content: isArray(rawItem.content)
            ? rawItem.content.join(', ')
            : rawItem.content,
    };
    const others = interpretedMeta.filter(
        (m) =>
            (isPresentAndDefined(m, 'http-equiv') &&
                m['http-equiv'] !== item['http-equiv']) ||
            isPresentAndDefined(m, 'name') ||
            isPresentAndDefined(m, 'charset'),
    );
    if (others.length !== interpretedMeta.length) {
        if (!silent) {
            log(
                'warn',
                `Duplicate meta http-equiv "${item['http-equiv']}" found in frontmatter.`,
            );
        }
        return [...others, item];
    } else {
        interpretedMeta.push(item);
        return interpretedMeta;
    }
}

/**
 * Add or replace the `<meta charset>` entry in `interpretedMeta`. There
 * can be at most one — a second `charset` overrides the first and logs a
 * warning; other meta names and pragma directives are preserved.
 *
 * @param content - The raw value of the `charset` key; an array is joined
 * with `, ` for symmetry with {@link addMetaName} / {@link addMetaHttpEquiv},
 * even though a multi-valued `<meta charset>` is meaningless.
 * @param silent - When `true`, dedup warnings are suppressed. See the note
 * on the {@link addMetaName} helper above.
 */
function addCharset(
    interpretedMeta: Meta[],
    content:
        | (string | number | boolean | null)
        | (string | number | boolean | null)[],
    silent: boolean = false,
): Meta[] {
    const item: Meta = {
        charset: isArray(content) ? content.join(', ') : content,
    };
    const others = interpretedMeta.filter(
        (m) =>
            isPresentAndDefined(m, 'name') ||
            isPresentAndDefined(m, 'http-equiv'),
    );
    if (others.length !== interpretedMeta.length) {
        if (!silent) {
            log('warn', `Duplicate meta charset found in frontmatter.`);
        }
        return [...others, item];
    } else {
        interpretedMeta.push(item);
        return interpretedMeta;
    }
}

/**
 * Apply the entries of a user-written `meta:` frontmatter block on top of
 * an initial `<meta>` list, deduplicating with the existing helpers. Used
 * for both the user-only `frontmatter.meta` (initial = `[]`) and the
 * rendered `<meta>` list (initial = the synthesized top-level entries).
 *
 * @param silent - Forwarded to the dedup helpers; see their note.
 */
function applyMetaBlock(
    initial: Meta[],
    rawMeta: unknown,
    silent: boolean,
): Meta[] {
    let result = initial;
    if (isArray(rawMeta)) {
        rawMeta.filter(isNonNullObject).forEach((item) => {
            const name =
                isPresentAndDefined(item, 'name') &&
                isString(item.name) &&
                isMetaName(item.name)
                    ? item.name
                    : undefined;
            const httpEquiv =
                isPresentAndDefined(item, 'http-equiv') &&
                isString(item['http-equiv']) &&
                isMetaHttpEquiv(item['http-equiv'])
                    ? item['http-equiv']
                    : undefined;
            const content = isPresentAndDefined(item, 'content')
                ? (item.content as
                      | (string | number | boolean | null)
                      | (string | number | boolean | null)[])
                : undefined;
            if (content) {
                if (name === 'charset') {
                    result = addCharset(result, content, silent);
                } else if (name) {
                    result = addMetaName(
                        result,
                        { name, content },
                        silent,
                    );
                } else if (httpEquiv) {
                    result = addMetaHttpEquiv(
                        result,
                        { 'http-equiv': httpEquiv, content },
                        silent,
                    );
                }
            }
        });
    } else if (isNonNullObject(rawMeta)) {
        Object.entries(rawMeta).forEach(([name, content]) => {
            // Unreachable falsy branch: keys returned by `Object.entries`
            // are always strings, so `isString(name)` is always `true`.
            /* v8 ignore start */
            if (isString(name)) {
                /* v8 ignore stop */
                if (name === 'charset') {
                    result = addCharset(
                        result,
                        content as
                            | (string | number | boolean | null)
                            | (string | number | boolean | null)[],
                        silent,
                    );
                } else if (isMetaName(name)) {
                    result = addMetaName(
                        result,
                        {
                            name,
                            content: content as
                                | (string | number | boolean | null)
                                | (string | number | boolean | null)[],
                        },
                        silent,
                    );
                } else if (isMetaHttpEquiv(name)) {
                    result = addMetaHttpEquiv(
                        result,
                        {
                            'http-equiv': name,
                            content: content as
                                | (string | number | boolean | null)
                                | (string | number | boolean | null)[],
                        },
                        silent,
                    );
                }
            }
        });
    }
    return result;
}

/**
 * Expand the user-facing `frontmatter` configuration option — which may be a
 * boolean shorthand — into a full object with every frontmatter-processing
 * step explicitly enabled or disabled.
 *
 * @param frontmatter - The `frontmatter` option after it has been merged with
 * the defaults, so any object form is already complete.
 * @returns A {@link FullFrontmatterConfiguration | `FullFrontmatterConfiguration`}.
 */
export function normalizeFrontmatterConfiguration(
    frontmatter: boolean | FullFrontmatterConfiguration,
): FullFrontmatterConfiguration {
    if (typeof frontmatter === 'boolean') {
        return {
            head: frontmatter,
            metadata: frontmatter,
            imports: frontmatter,
        };
    }
    return frontmatter;
}

/**
 * The shape of a JavaScript identifier — a leading letter / `_` / `$`,
 * followed by letters, digits, `_`, or `$`. Used to decide whether a
 * key needs quoting when written as an object-literal key in the
 * generated `metadata` export.
 */
const identifierRegExp = /^[A-Za-z_$][\w$]*$/u;

/**
 * Turn a parsed frontmatter snippet into the code SvelTeX injects into the
 * Svelte file.
 *
 * @param snippet - The frontmatter snippet to process.
 * @param config - Which frontmatter-processing steps to perform. The
 * frontmatter is always parsed (and returned), so disabling a step only
 * suppresses its generated code.
 * @returns
 * - `headLines` — `<svelte:head>` content (gated by `config.head`);
 * - `scriptLines` — instance-`<script>` content: `import` statements
 *   derived from the special `imports` key (gated by `config.imports`);
 * - `scriptModuleLines` — the `export const metadata` module-script
 *   statement (gated by `config.metadata`);
 * - `frontmatter` — the parsed frontmatter itself, regardless of `config`.
 */
export function handleFrontmatter(
    snippet: ProcessableSnippet<'frontmatter'>,
    config: FullFrontmatterConfiguration,
): {
    headLines: string[];
    scriptLines: string[];
    scriptModuleLines: string[];
    frontmatter: Frontmatter | undefined;
} {
    const interpreted = interpretFrontmatter(parseFrontmatter(snippet));
    const headLines: string[] = [];
    const scriptLines: string[] = [];
    const scriptModuleLines: string[] = [];
    if (interpreted === undefined) {
        return {
            headLines,
            scriptLines,
            scriptModuleLines,
            frontmatter: undefined,
        };
    }
    const { frontmatter, meta: renderedMeta } = interpreted;
    const { title, base, noscript, link, imports } = frontmatter;

    // The `metadata` module-script export collects every top-level
    // frontmatter key. Frontmatter keys are unconstrained YAML / TOML /
    // JSON strings — e.g. the W3C metadata names `color-scheme` and
    // `theme-color`, which contain hyphens — so object-literal keys are
    // quoted whenever they aren't a valid JavaScript identifier, keeping
    // the emitted object syntactically valid.
    if (config.metadata) {
        Object.entries(frontmatter).forEach(([key, value]) => {
            const objectKey = identifierRegExp.test(key)
                ? key
                : JSON.stringify(key);
            scriptModuleLines.push(
                `${objectKey}: ${JSON.stringify(value)},`,
            );
        });

        if (scriptModuleLines.length > 0) {
            scriptModuleLines.unshift('export const metadata = {');
            scriptModuleLines.push('};');
        }
    }

    // Imports
    if (
        config.imports &&
        imports &&
        isRecord(
            imports,
            ([k, v]) => (isString(k) && isString(v)) || isArray(v, isString),
        )
    ) {
        Object.entries(imports).forEach(([path, value]) => {
            if (isString(value)) {
                scriptLines.push(`import ${value} from '${path}';`);
                // Unreachable falsy branch: the `isRecord` guard above already
                // guarantees every `value` is a string or a string array, so
                // a non-string `value` is necessarily an array here.
                /* v8 ignore start */
            } else if (isArray(value)) {
                /* v8 ignore stop */
                scriptLines.push(
                    `import { ${value.join(', ')} } from '${path}';`,
                );
            }
        });
    }

    // `<svelte:head>` content — title, noscript, base, links, and meta tags.
    // Switched off as a group via `config.head`.
    if (config.head) {
        // Title
        if (title && isString(title)) {
            headLines.push(`<title>${title}</title>`);
        }

        // NoScript
        if (noscript && isString(noscript)) {
            headLines.push(`<noscript>${noscript}</noscript>`);
        }

        // Base
        if (base) {
            const entries = Object.entries(base);
            // Unreachable falsy branch: `base` here comes from
            // `interpretFrontmatter`, which only ever yields a non-empty
            // object whose keys are `href` and/or `target` (or drops `base`
            // entirely).
            /* v8 ignore start */
            if (
                0 < entries.length &&
                entries.every(
                    ([k, v]) =>
                        (k === 'href' || k === 'target') && isString(v),
                )
            ) {
                /* v8 ignore stop */
                let baseString = '<base';
                entries.forEach(([key, value]) => {
                    baseString += ` ${key}="${String(value)}"`;
                });
                baseString += '>';
                headLines.push(baseString);
            }
        }

        // Links
        if (link) {
            link.forEach((l) => {
                let linkString = '<link';
                Object.entries(l).forEach(([key, value]) => {
                    linkString += ` ${key}="${String(value)}"`;
                });
                linkString += '>';
                headLines.push(linkString);
            });
        }

        // Meta — use the rendered list (synthesized top-level entries
        // combined with the user's `meta:` block), NOT `frontmatter.meta`
        // (which carries only the user's input).
        renderedMeta.forEach((metaEntry) => {
            let metaString = '<meta';
            Object.entries(metaEntry).forEach(([key, value]) => {
                metaString += ` ${key}="${String(value)}"`;
            });
            metaString += '>';
            headLines.push(metaString);
        });
    }

    return { headLines, scriptLines, scriptModuleLines, frontmatter };
}
