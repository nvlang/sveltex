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

export function interpretFrontmatter(
    obj: object | undefined,
): Frontmatter | undefined {
    if (obj === undefined) return undefined;
    const { title, noscript, base, link, meta, ...rest } = obj as {
        title: unknown;
        noscript: unknown;
        base: unknown;
        link: unknown;
        meta: unknown;
    };

    const frontmatter: Frontmatter = { ...rest };

    let interpretedMeta: Meta[] = [];
    const interpretedLink: Frontmatter['link'] = [];

    // Title
    if (title && isString(title)) frontmatter.title = title;

    // NoScript
    if (noscript && isString(noscript)) frontmatter.noscript = noscript;

    Object.entries(rest).forEach(([k, v]) => {
        if (isString(k) && isString(v)) {
            if (k === 'charset') {
                // `charset` is special: HTML wants `<meta charset="…">`,
                // not `<meta name="charset" content="…">`. Push the
                // dedicated `CharsetMeta` shape so the `<meta>`-rendering
                // loop in `handleFrontmatter` emits the right tag.
                interpretedMeta.push({ charset: v });
            } else if (isMetaName(k)) {
                interpretedMeta.push({ name: k, content: v });
            } else if (isMetaHttpEquiv(k)) {
                interpretedMeta.push({ 'http-equiv': k, content: v });
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

    // Meta
    if (meta) {
        if (isArray(meta)) {
            meta.filter(isNonNullObject).forEach((item) => {
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
                        // See the top-level `charset` branch above.
                        interpretedMeta = addCharset(
                            interpretedMeta,
                            content,
                        );
                    } else if (name) {
                        interpretedMeta = addMetaName(interpretedMeta, {
                            name,
                            content,
                        });
                    } else if (httpEquiv) {
                        interpretedMeta = addMetaHttpEquiv(interpretedMeta, {
                            'http-equiv': httpEquiv,
                            content,
                        });
                    }
                }
            });
        } else if (isNonNullObject(meta)) {
            Object.entries(meta).forEach(([name, content]) => {
                // Unreachable falsy branch: keys returned by `Object.entries`
                // are always strings, so `isString(name)` is always `true`.
                /* v8 ignore start */
                if (isString(name)) {
                    /* v8 ignore stop */
                    if (name === 'charset') {
                        // See the top-level `charset` branch above.
                        interpretedMeta = addCharset(
                            interpretedMeta,
                            content as
                                | (string | number | boolean | null)
                                | (string | number | boolean | null)[],
                        );
                    } else if (isMetaName(name)) {
                        interpretedMeta = addMetaName(interpretedMeta, {
                            name,
                            content: content as
                                | (string | number | boolean | null)
                                | (string | number | boolean | null)[],
                        });
                    } else if (isMetaHttpEquiv(name)) {
                        interpretedMeta = addMetaHttpEquiv(interpretedMeta, {
                            'http-equiv': name,
                            content: content as
                                | (string | number | boolean | null)
                                | (string | number | boolean | null)[],
                        });
                    }
                }
            });
        }
    }
    if (interpretedMeta.length > 0) frontmatter.meta = interpretedMeta;
    if (interpretedLink.length > 0) frontmatter.link = interpretedLink;
    return frontmatter;
}

function addMetaName(
    interpretedMeta: Meta[],
    rawItem: {
        name: MetaName;
        content:
            | (string | number | boolean | null)
            | (string | number | boolean | null)[];
    },
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
        log('warn', `Duplicate meta name "${item.name}" found in frontmatter.`);
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
        log(
            'warn',
            `Duplicate meta http-equiv "${item['http-equiv']}" found in frontmatter.`,
        );
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
 */
function addCharset(
    interpretedMeta: Meta[],
    content:
        | (string | number | boolean | null)
        | (string | number | boolean | null)[],
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
        log('warn', `Duplicate meta charset found in frontmatter.`);
        return [...others, item];
    } else {
        interpretedMeta.push(item);
        return interpretedMeta;
    }
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
            variables: frontmatter,
            imports: frontmatter,
        };
    }
    return frontmatter;
}

/**
 * The shape of a JavaScript identifier — a leading letter / `_` / `$`,
 * followed by letters, digits, `_`, or `$`. The check is purely
 * syntactic; reserved words like `class` or `default` also pass it and
 * are filtered separately (see {@link reservedWords}).
 */
const identifierRegExp = /^[A-Za-z_$][\w$]*$/u;

/**
 * Strict-mode ECMAScript reserved words and the two identifiers
 * (`arguments`, `eval`) that can't be used as binding names in strict
 * mode. SvelTeX emits its `<script>` blocks into Svelte components, which
 * are modules and therefore strict-mode, so every entry here would cause
 * a parse error if used as a `const` binding name.
 */
const reservedWords: ReadonlySet<string> = new Set([
    'arguments',
    'await',
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'enum',
    'eval',
    'export',
    'extends',
    'false',
    'finally',
    'for',
    'function',
    'if',
    'implements',
    'import',
    'in',
    'instanceof',
    'interface',
    'let',
    'new',
    'null',
    'package',
    'private',
    'protected',
    'public',
    'return',
    'static',
    'super',
    'switch',
    'this',
    'throw',
    'true',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'yield',
]);

/**
 * Derive a JavaScript identifier from a frontmatter key, for use as a
 * `const` variable name in the page's instance `<script>`. Keys that are
 * already valid identifiers are kept verbatim; others are converted to
 * camelCase by splitting on runs of non-identifier characters (e.g.
 * `color-scheme` → `colorScheme`, `my key` → `myKey`). Returns `undefined`
 * when no valid identifier can be formed — for instance when the key
 * starts with a digit (`123abc`), its non-identifier characters leave
 * nothing behind (`---`), or the resulting name is a reserved word
 * (`class`, `default`, …); those keys remain accessible through the
 * `metadata` export under their original name.
 *
 * @example
 * ```ts
 * keyToIdentifier('color-scheme'); // → 'colorScheme'
 * keyToIdentifier('foo');          // → 'foo'
 * keyToIdentifier('123abc');       // → undefined
 * keyToIdentifier('class');        // → undefined  (reserved word)
 * ```
 */
export function keyToIdentifier(key: string): string | undefined {
    if (identifierRegExp.test(key)) {
        return reservedWords.has(key) ? undefined : key;
    }
    // Split on runs of non-identifier characters and discard the empty
    // pieces a leading/trailing/repeated separator leaves behind, then
    // camelCase: keep the first word as-is and title-case the rest.
    const [first, ...rest] = key
        .split(/[^A-Za-z0-9_$]+/u)
        .filter((w) => w.length > 0);
    if (first === undefined) return undefined;
    const candidate =
        first +
        rest
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join('');
    if (!identifierRegExp.test(candidate)) return undefined;
    return reservedWords.has(candidate) ? undefined : candidate;
}

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
 * - `scriptLines` — instance-`<script>` content: per-key `const`s (gated by
 *   `config.variables`) followed by `import` statements (gated by
 *   `config.imports`);
 * - `scriptModuleLines` — the `export const metadata` module-script statement
 *   (gated by `config.metadata`);
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
    const frontmatter = interpretFrontmatter(parseFrontmatter(snippet));
    const headLines: string[] = [];
    const scriptLines: string[] = [];
    const scriptModuleLines: string[] = [];
    if (frontmatter === undefined)
        return { headLines, scriptLines, scriptModuleLines, frontmatter };
    const { title, base, noscript, link, meta, imports } = frontmatter;

    // The `metadata` module-script export and the per-key instance-script
    // `const`s are both derived from every top-level frontmatter key; either
    // can be switched off independently via the `frontmatter` configuration.
    //
    // Frontmatter keys are unconstrained YAML / TOML / JSON strings, so they
    // can perfectly well not be valid JavaScript identifiers (e.g. the W3C
    // metadata names `color-scheme` and `theme-color`, or any user-chosen
    // key with hyphens or spaces). For each step we handle that differently:
    //
    //   - object-literal keys are quoted when not valid identifiers, so the
    //     emitted `metadata` object is always syntactically valid;
    //   - `const` binding names must be valid identifiers, so the key is
    //     run through `keyToIdentifier` to derive a camelCase name. When no
    //     identifier can be formed, the variable is silently dropped — the
    //     key remains accessible through the `metadata` export.
    Object.entries(frontmatter).forEach(([key, value]) => {
        const serializedValue = JSON.stringify(value);
        if (config.metadata) {
            const objectKey = identifierRegExp.test(key)
                ? key
                : JSON.stringify(key);
            scriptModuleLines.push(`${objectKey}: ${serializedValue},`);
        }
        if (config.variables) {
            const id = keyToIdentifier(key);
            if (id !== undefined) {
                scriptLines.push(`const ${id} = ${serializedValue};`);
            }
        }
    });

    if (scriptModuleLines.length > 0) {
        scriptModuleLines.unshift('export const metadata = {');
        scriptModuleLines.push('};');
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

        // Meta
        if (meta && isArray(meta)) {
            meta.forEach((metaEntry) => {
                let metaString = '<meta';
                Object.entries(metaEntry).forEach(([key, value]) => {
                    metaString += ` ${key}="${String(value)}"`;
                });
                metaString += '>';
                headLines.push(metaString);
            });
        }
    }

    return { headLines, scriptLines, scriptModuleLines, frontmatter };
}
