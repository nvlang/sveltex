import { Extends, htmlTagNames, typeAssert } from '$deps.js';
import { isString } from '$typeGuards/utils.js';
import type { ComponentInfo } from '$types/handlers/Markdown.js';

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
// `MarkdownHtmlTagType6`.
typeAssert<Extends<TagThatCanContainParagraph, MarkdownHtmlTagType6>>();

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

export function canContainParagraph(
    tag: unknown,
    components?: ComponentInfo[],
): tag is TagThatCanContainParagraph {
    if (!isString(tag)) return false;
    if (
        components?.some(
            (c) => c.name === tag && !componentCanContainParagraph(c),
        )
    ) {
        return false;
    }
    if (
        htmlTagNames.includes(tag) &&
        !tagsThatCanContainParagraphs.includes(
            tag as TagThatCanContainParagraph,
        )
    ) {
        return false;
    }
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

export function componentCanBeInParagraph(c: ComponentInfo): boolean {
    return c.type === 'phrasing' || c.type === 'all' || c.type === undefined;
}

export function componentCanContainParagraph(c: ComponentInfo): boolean {
    return c.type === 'sectioning' || c.type === 'all' || c.type === undefined;
}
