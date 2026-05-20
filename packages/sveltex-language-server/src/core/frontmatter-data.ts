// File description: Static documentation tables for the SvelTeX frontmatter
// hover / completion implementation in `frontmatter.ts`.
//
// Each table maps a recognised frontmatter key (or `<meta>` name / pragma
// directive) to a {@link FrontmatterEntryDoc}: a one-line summary, an MDN
// URL, and -- for keys that render into `<svelte:head>` -- the HTML template
// SvelTeX inserts. Together these power the hover heading
// ("renders `<title>〈value〉</title>`") and the completion-item details.
//
// The tables are split out from `frontmatter.ts` because that file would
// otherwise be dominated by data: the actual hover/completion logic is only
// a few hundred lines, but the prose summaries push the combined file past
// 800 lines, which is hard to skim when looking for the algorithm rather
// than for what one specific key does.

/** Documentation for one recognised frontmatter key or `<meta>` value. */
export interface FrontmatterEntryDoc {
    /** A one-line description of what the key or value does. */
    readonly summary: string;
    /**
     * The bare HTML element this key relates to, used only for the
     * "[`<X>`] on MDN" link label. Set to the element type (e.g.
     * `<title>`, `<base>`) or an attribute reference (e.g. `<base href>`).
     */
    readonly element?: string;
    /** A documentation URL — MDN for HTML entries, the SvelTeX site else. */
    readonly docUrl: string;
    /**
     * The sentence shown in a top-level key's hover describing what SvelTeX
     * inserts into `<svelte:head>` for this key. Omitted for keys that
     * produce no `<svelte:head>` output (e.g. `imports`). For `<meta>` /
     * `<meta http-equiv>` entries the sentence is derived from `element`
     * (see {@link metaHeadEffect}); for structural keys it is given here
     * explicitly because the head insertion is structure-, not value-,
     * shaped.
     */
    readonly headEffect?: string;
    /**
     * The HTML SvelTeX renders for this key, with `〈value〉` /
     * `〈href〉` / `…` placeholders for the parts that come from the
     * user's frontmatter. Shown in the hover heading
     * ("renders `<title>〈value〉</title>`"). For `<meta name>` /
     * `<meta http-equiv>` / `<meta charset>` keys the value is derived
     * from `element` when omitted (see {@link metaRenderedHtml}). When
     * no `rendersAs` resolves — e.g. for structural list keys
     * (`meta` / `link`), or for `imports` — the heading is the bare
     * key name with no "renders" suffix.
     */
    readonly rendersAs?: string;
}

/** Base URL of the MDN HTML element reference. */
const MDN = 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element';

/** The structural keys valid at the frontmatter top level. */
const TOP_LEVEL_STRUCTURAL: Readonly<Record<string, FrontmatterEntryDoc>> = {
    title: {
        summary:
            "Sets the document's title — rendered as the page's `<title>` " +
            'element, shown in the browser tab and used by search engines ' +
            'and bookmarks.',
        element: '<title>',
        rendersAs: '<title>〈value〉</title>',
        docUrl: `${MDN}/title`,
        headEffect:
            "Inserts `<title>〈value〉</title>` into the page's " +
            '`<svelte:head>`, where `〈value〉` is the value you set this ' +
            'property to.',
    },
    noscript: {
        summary:
            'Fallback content rendered inside a `<noscript>` element, shown ' +
            'only to browsers that have scripting disabled.',
        element: '<noscript>',
        rendersAs: '<noscript>〈value〉</noscript>',
        docUrl: `${MDN}/noscript`,
        headEffect:
            "Inserts `<noscript>〈value〉</noscript>` into the page's " +
            '`<svelte:head>`, where `〈value〉` is the value you set this ' +
            'property to.',
    },
    base: {
        summary:
            "Configures the document's `<base>` element: the base URL and " +
            'default browsing context against which relative URLs on the ' +
            'page are resolved. Set this to the URL as a shorthand for ' +
            '`{ href: <url> }`, or to an object with `href` and/or ' +
            '`target`; at least one of the two must be present.',
        element: '<base>',
        rendersAs: '<base href="〈href〉" target="〈target〉">',
        docUrl: `${MDN}/base`,
        headEffect:
            "Inserts a `<base>` element into the page's `<svelte:head>`, " +
            'with `href` and (optionally) `target` attributes taken from ' +
            'this object.',
    },
    meta: {
        summary:
            'A list of `<meta>` elements — document-level metadata such as ' +
            'the description, viewport, character set and social/Open Graph ' +
            'tags. Use the mapping form (`description: …`) where each key ' +
            'is a metadata name, or the array form (`- name: …` / ' +
            '`- http-equiv: …`) where each item must include `content` ' +
            'plus either `name` or `http-equiv` (items without that pair ' +
            'are dropped).',
        element: '<meta>',
        docUrl: `${MDN}/meta`,
        headEffect:
            "Inserts a `<meta>` element into the page's `<svelte:head>` " +
            'for each entry — both the array form (`- name: …`) and the ' +
            'mapping form (`description: …`) are supported.',
    },
    link: {
        summary:
            'A list of `<link>` elements — relationships to external ' +
            'resources such as stylesheets, icons and preloaded assets. ' +
            'Each item must include a `rel` attribute (items without ' +
            'one are dropped).',
        element: '<link>',
        docUrl: `${MDN}/link`,
        headEffect:
            "Inserts a `<link>` element into the page's `<svelte:head>` " +
            'for each entry in the array.',
    },
    imports: {
        summary:
            'Svelte components and modules to import into the document — a ' +
            'SvelTeX convenience equivalent to writing the imports in a ' +
            "`<script>` block. Each entry's key is the module path; its " +
            'value is either the binding name (default import) or an array ' +
            'of binding names (named imports).',
        docUrl: 'https://sveltex.dev',
    },
};

/**
 * Standard `<meta name="…">` values. Mirrors `@nvl/sveltex`'s `MetaName`
 * type. SvelTeX accepts a metadata name as a `name:` value (array form), a
 * `meta` mapping key, or a top-level key, so these are valid both as values
 * and as keys.
 */
export const META_NAMES: Readonly<Record<string, FrontmatterEntryDoc>> = {
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
 * Standard `<meta http-equiv="…">` values. Mirrors `@nvl/sveltex`'s
 * `MetaHttpEquiv` type. Valid as an `http-equiv:` value or written as a key.
 */
export const META_HTTP_EQUIV: Readonly<Record<string, FrontmatterEntryDoc>> = {
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

/** The object keys of a `meta: [{ … }]` array item. */
const META_ITEM_KEYS: Readonly<Record<string, FrontmatterEntryDoc>> = {
    name: {
        summary:
            'The kind of metadata a `<meta>` element carries ' +
            '(`<meta name>`) — e.g. `description`, `viewport`, `keywords`, ' +
            '`author`, `theme-color`. Must be paired with a `content`.',
        element: '<meta name>',
        rendersAs: '<meta name="〈value〉" content="…">',
        docUrl: `${MDN}/meta#name`,
    },
    'http-equiv': {
        summary:
            'A pragma directive — a `<meta http-equiv>` element that acts ' +
            'like the equivalent HTTP response header. Must be paired ' +
            'with a `content`.',
        element: '<meta http-equiv>',
        rendersAs: '<meta http-equiv="〈value〉" content="…">',
        docUrl: `${MDN}/meta#http-equiv`,
    },
    content: {
        summary:
            'The value of a `<meta>` element, paired with its `name` or ' +
            '`http-equiv`.',
        element: '<meta content>',
        rendersAs: '<meta name="…" content="〈value〉">',
        docUrl: `${MDN}/meta#content`,
    },
};

/** Keys valid inside a `base` block. */
const BASE_KEYS: Readonly<Record<string, FrontmatterEntryDoc>> = {
    href: {
        summary:
            'The base URL for the document (`<base href>`). Every relative ' +
            'URL on the page is resolved against it.',
        element: '<base href>',
        rendersAs: '<base href="〈value〉">',
        docUrl: `${MDN}/base#href`,
    },
    target: {
        summary:
            'The default browsing context for links and forms ' +
            '(`<base target>`) — e.g. `_blank`, `_self`, `_parent`, `_top`.',
        element: '<base target>',
        rendersAs: '<base target="〈value〉">',
        docUrl: `${MDN}/base#target`,
    },
};

/** Keys valid inside a `link` item. */
const LINK_KEYS: Readonly<Record<string, FrontmatterEntryDoc>> = {
    rel: {
        summary:
            'The relationship between the document and a linked resource ' +
            '(`<link rel>`) — e.g. `stylesheet`, `icon`, `preload`, ' +
            '`canonical`. Required — items without it are dropped.',
        element: '<link rel>',
        rendersAs: '<link rel="〈value〉">',
        docUrl: `${MDN}/link#rel`,
    },
    href: {
        summary:
            'The URL of the linked resource (`<link href>`) — the ' +
            'stylesheet, icon or asset the `<link>` points to.',
        element: '<link href>',
        rendersAs: '<link href="〈value〉">',
        docUrl: `${MDN}/link#href`,
    },
    as: {
        summary:
            'For `rel="preload"` / `rel="modulepreload"`, the kind of ' +
            'content being fetched (`<link as>`) — e.g. `script`, `style`, ' +
            '`font`, `image`.',
        element: '<link as>',
        rendersAs: '<link as="〈value〉">',
        docUrl: `${MDN}/link#as`,
    },
    type: {
        summary:
            'The MIME type of the linked resource (`<link type>`) — e.g. ' +
            '`text/css` for a stylesheet.',
        element: '<link type>',
        rendersAs: '<link type="〈value〉">',
        docUrl: `${MDN}/link#type`,
    },
    crossorigin: {
        summary:
            'The CORS policy used when fetching the linked resource ' +
            '(`<link crossorigin>`) — `anonymous` or `use-credentials`.',
        element: '<link crossorigin>',
        rendersAs: '<link crossorigin="〈value〉">',
        docUrl: `${MDN}/link#crossorigin`,
    },
};

/**
 * Every key valid at the frontmatter top level: the structural keys, plus the
 * metadata names — which SvelTeX also accepts written directly as top-level
 * keys (`description: …`), not only inside `meta`.
 */
const TOP_LEVEL_KEYS: Readonly<Record<string, FrontmatterEntryDoc>> = {
    ...TOP_LEVEL_STRUCTURAL,
    ...META_NAMES,
    ...META_HTTP_EQUIV,
};

/**
 * Every key valid inside a `meta` block: the metadata names and pragma
 * directives (the `meta: { description: … }` mapping form) plus the object
 * keys of the `meta: [{ name: … }]` array form.
 */
const META_KEYS: Readonly<Record<string, FrontmatterEntryDoc>> = {
    ...META_NAMES,
    ...META_HTTP_EQUIV,
    ...META_ITEM_KEYS,
};

/**
 * Returns the keys valid in a frontmatter block.
 *
 * @param where - The enclosing block from {@link frontmatterContext} —
 * `meta` / `base` / `link`, or `undefined` for the top level.
 */
export function keysForContext(
    where: string | undefined,
): Readonly<Record<string, FrontmatterEntryDoc>> {
    switch (where) {
        case 'meta':
            return META_KEYS;
        case 'base':
            return BASE_KEYS;
        case 'link':
            return LINK_KEYS;
        default:
            return TOP_LEVEL_KEYS;
    }
}

/**
 * Derive the HTML SvelTeX renders for a `<meta>` entry from its `element`
 * string — the metadata-name and pragma-directive keys all follow one of
 * two templates:
 *
 *   - `<meta name="…">` / `<meta http-equiv="…">` — slot a
 *     `content="〈value〉"` attribute in before the closing `>`;
 *   - `<meta charset>` — the value sits in the `charset` attribute itself.
 *
 * @returns The rendered HTML, or `undefined` when `element` doesn't fit
 * either template — structural keys (`<title>`, `<base>`, …) supply their
 * own `rendersAs`.
 */
export function metaRenderedHtml(element: string): string | undefined {
    if (/^<meta (?:name|http-equiv)="[^"]+">$/u.test(element)) {
        return element.replace(/>$/u, ' content="〈value〉">');
    }
    if (element === '<meta charset>') {
        return '<meta charset="〈value〉">';
    }
    return undefined;
}

/**
 * Build the head-section sentence for a `<meta>` entry; wraps
 * {@link metaRenderedHtml} in a "Inserts `…` into `<svelte:head>`"
 * sentence used in the per-effect sections of a top-level key's hover.
 */
export function metaHeadEffect(element: string): string | undefined {
    const rendered = metaRenderedHtml(element);
    if (rendered === undefined) return undefined;
    return (
        `Inserts \`${rendered}\` into the page's \`<svelte:head>\`, ` +
        'where `〈value〉` is the value you set this property to.'
    );
}
