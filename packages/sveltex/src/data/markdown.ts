// File description: HTML tags by whether they can be in- or contain paragraphs.
// Also, list of "type 6" HTML blocks, as per CommonMark spec.

import { type Extends, htmlTagNames, typeAssert } from '../deps.js';
import { isString } from '../typeGuards/utils.js';
import type { ComponentInfo } from '../types/handlers/Markdown.js';

/**
 * @see https://spec.commonmark.org/0.31.2/#html-blocks
 */
export type MarkdownHtmlTagType6 = (typeof specials)[number];

/**
 * Tags that can contain paragraphs.
 */
export type TagThatCanContainParagraph =
    (typeof tagsThatCanContainParagraphs)[number];

/**
 * Tags that can be in paragraphs.
 */
export type TagThatCanBeInParagraph =
    (typeof tagsThatCanBeInParagraphs)[number];

// Ensure that `TagThatCanContainParagraph` is a "subtype" of
// `MarkdownHtmlTagType6 | 'pre'`.
typeAssert<Extends<TagThatCanContainParagraph, MarkdownHtmlTagType6 | 'pre'>>();

/**
 * @see https://spec.commonmark.org/0.31.2/#html-blocks
 */
export const specials = [
    'address',
    'article',
    'aside',
    'base',
    'basefont',
    'blockquote',
    'body',
    'caption',
    'center',
    'col',
    'colgroup',
    'dd',
    'details',
    'dialog',
    'dir',
    'div',
    'dl',
    'dt',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'frame',
    'frameset',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'head',
    'header',
    'hr',
    'html',
    'iframe',
    'legend',
    'li',
    'link',
    'main',
    'menu',
    'menuitem',
    'nav',
    'noframes',
    'ol',
    'optgroup',
    'option',
    'p',
    'param',
    'search',
    'section',
    'summary',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'title',
    'tr',
    'track',
    'ul',
] as const;

/**
 * Tags that can contain paragraphs.
 */
export const tagsThatCanContainParagraphs = [
    'address',
    'article',
    'aside',
    'blockquote',
    'body',
    'caption',
    'center',
    'col',
    'colgroup',
    'dd',
    'details',
    'dialog',
    'dir',
    'div',
    'dl',
    'dt',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'header',
    'hr',
    'html',
    'iframe',
    'legend',
    'li',
    'link',
    'main',
    'menu',
    'menuitem',
    'nav',
    'ol',
    'optgroup',
    'option',
    'pre',
    'search',
    'section',
    'summary',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'ul',
] as const;

/**
 * @see
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Content_categories#phrasing_content
 */
export const tagsThatCanBeInParagraphs = [
    'a', // if it contains only phrasing content
    'abbr',
    'area', // if it is a descendant of a <map> element
    'audio',
    'b',
    'bdi',
    'bdo',
    'br',
    'button',
    'canvas',
    'cite',
    'code',
    'data',
    'datalist',
    'del', // if it contains only phrasing content
    'dfn',
    'em',
    'embed',
    'i',
    'iframe',
    'img',
    'input',
    'ins', // if it contains only phrasing content
    'kbd',
    'label',
    'link', // if the itemprop attribute is present
    'map', // if it contains only phrasing content
    'mark',
    'math',
    'meta', // if the itemprop attribute is present
    'meter',
    'noscript',
    'object',
    'output',
    'picture',
    'progress',
    'q',
    'ruby',
    's',
    'samp',
    'script',
    'select',
    'slot',
    'small',
    'span',
    'strong',
    'sub',
    'sup',
    'svg',
    'template',
    'textarea',
    'time',
    'u',
    'var',
    'video',
    'wbr',
] as const;

export const tagsThatCannotBeInParagraphs = htmlTagNames.filter(
    (tag) => !canBeInParagraph(tag),
);

export const tagsThatCannotContainParagraphs = htmlTagNames.filter(
    (tag) => !canContainParagraph(tag),
);

/**
 * @param tag - The tag to check.
 * @param components - Optional array of component infos.
 * @returns `true` if `tag` can contain a paragraph.
 */
export function canContainParagraph(
    tag: string,
    components?: ComponentInfo[],
): tag is TagThatCanContainParagraph {
    // If `tag` matches one of the components in the components array that
    // cannot contain a paragraph, it is not a tag that can contain a paragraph.
    if (
        components?.some(
            (c) => c.name === tag && !componentCanContainParagraph(c),
        )
    ) {
        return false;
    }

    // If `tag` is a standard HTML tag, but not one of the standard HTML tags
    // that can contain paragraphs, it is not a tag that can contain a
    // paragraph.
    if (
        htmlTagNames.includes(tag) &&
        !tagsThatCanContainParagraphs.includes(
            tag as TagThatCanContainParagraph,
        )
    ) {
        return false;
    }

    // We return `true` by default to be permissive.
    return true;
}

export function canBeInParagraph(
    tag: unknown,
    components?: ComponentInfo[],
): tag is TagThatCanBeInParagraph {
    return (
        isString(tag) &&
        ((tagsThatCanBeInParagraphs as unknown as string[]).includes(tag) ||
            !!components?.some(
                (c) => c.name === tag && componentCanBeInParagraph(c),
            ))
    );
}

export function canBeOnlyThingInParagraph(
    tag: unknown,
    components: ComponentInfo[],
): tag is TagThatCanBeInParagraph {
    return (
        isString(tag) &&
        ((tagsThatCanBeInParagraphs as unknown as string[]).includes(tag) ||
            !!components.some(
                (c) => c.name === tag && componentCanBeOnlyThingInParagraph(c),
            ))
    );
}

export function componentCanBeOnlyThingInParagraph(c: ComponentInfo): boolean {
    return c.type === 'phrasing' || c.type === 'all';
}

export function componentCanBeInParagraph(c: ComponentInfo): boolean {
    return (
        c.type === 'phrasing' ||
        c.type === 'all' ||
        c.type === 'default' ||
        c.type === undefined
    );
}

export function componentCanContainParagraph(c: ComponentInfo): boolean {
    return (
        c.type === 'sectioning' ||
        c.type === 'all' ||
        c.type === 'default' ||
        c.type === undefined
    );
}
