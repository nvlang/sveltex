// File description:  Parse frontmatter from a Sveltex file.

// Types
import type {
    Frontmatter,
    Meta,
    MetaHttpEquiv,
    MetaName,
} from '$types/utils/Frontmatter.js';

// Internal dependencies
import { log, prettifyError } from '$utils/debug.js';

// External dependencies
import { parseYaml, parseToml } from '$deps.js';
import { ProcessableSnippet } from '$types/utils/Escape.js';
import {
    isArray,
    isNonNullObject,
    isPresentAndDefined,
    isRecord,
    isString,
} from '$typeGuards/utils.js';
import { isMetaHttpEquiv, isMetaName } from '$typeGuards/frontmatter.js';

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
            if (isMetaName(k)) {
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
                    if (name) {
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
                if (isString(name)) {
                    if (isMetaName(name)) {
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
            isPresentAndDefined(m, 'http-equiv'),
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
) {
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
            isPresentAndDefined(m, 'name'),
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

export function handleFrontmatter(snippet: ProcessableSnippet<'frontmatter'>): {
    headLines: string[];
    scriptLines: string[];
    frontmatter: Frontmatter | undefined;
} {
    const frontmatter = interpretFrontmatter(parseFrontmatter(snippet));
    const headLines: string[] = [];
    const scriptLines: string[] = [];
    if (frontmatter === undefined)
        return { headLines, scriptLines, frontmatter };
    const { title, base, noscript, link, meta, imports } = frontmatter;

    Object.entries(frontmatter).forEach(([key, value]) => {
        scriptLines.push(`const ${key} = ${JSON.stringify(value)};`);
    });

    // Imports
    if (
        imports &&
        isRecord(
            imports,
            ([k, v]) => (isString(k) && isString(v)) || isArray(v, isString),
        )
    ) {
        Object.entries(imports).forEach(([path, value]) => {
            if (isString(value)) {
                scriptLines.push(`import ${value} from '${path}';`);
            } else if (isArray(value)) {
                scriptLines.push(
                    `import { ${value.join(', ')} } from '${path}';`,
                );
            }
        });
    }

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
        if (
            0 < entries.length &&
            entries.every(
                ([k, v]) => (k === 'href' || k === 'target') && isString(v),
            )
        ) {
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
        link.forEach((link) => {
            let linkString = '<link';
            Object.entries(link).forEach(([key, value]) => {
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

    return { headLines, scriptLines, frontmatter };
}
