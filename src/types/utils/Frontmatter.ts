// File description: Types related to SvelTeX's handling of frontmatter.

import { MdastLiteral } from '$deps.js';

export type MetaName =
    | 'charset'
    | 'author'
    | 'application-name'
    | 'description'
    | 'generator'
    | 'keywords'
    | 'viewport'
    | 'referrer'
    | 'theme-color'
    | 'color-scheme';
export type MetaHttpEquiv = 'content-security-policy' | 'default-style';
// export type Meta =
//     | { name: MetaName; content: string }
//     | { 'http-equiv': MetaHttpEquiv; content: string };

export interface Meta<T extends 'http-equiv' | 'name' = 'http-equiv' | 'name'> {
    name?: T extends 'name' ? MetaName : never;
    'http-equiv'?: T extends 'http-equiv' ? MetaHttpEquiv : never;
    content: string | number | boolean | null;
}

// export type LinkAs =
//     | 'audio'
//     | 'document'
//     | 'embed'
//     | 'fetch'
//     | 'font'
//     | 'image'
//     | 'object'
//     | 'script'
//     | 'style'
//     | 'track'
//     | 'video'
//     | 'worker';

// export type LinkRel =
//     | 'alternate'
//     | 'author'
//     | 'canonical'
//     | 'dns-prefetch'
//     | 'help'
//     | 'icon'
//     | 'license'
//     | 'me'
//     | 'modulepreload'
//     | 'next'
//     | 'pingback'
//     | 'preconnect'
//     | 'prefetch'
//     | 'preload'
//     | 'prev'
//     | 'privacy-policy'
//     | 'stylesheet'
//     | 'search'
//     | 'terms-of-service';

// export interface Link<
//     Rel extends LinkRel | 'alternate stylesheet' = LinkRel,
//     As extends Rel extends 'preload' | 'modulepreload'
//         ? LinkAs | undefined
//         : undefined = undefined,
// > {
//     as?: As;
//     crossorigin?: 'anonymous' | 'use-credentials' | undefined;
//     disabled?: Rel extends 'stylesheet' | 'alternate stylesheet'
//         ? boolean
//         : false;
//     fetchpriority?: 'high' | 'low' | 'auto' | undefined;
//     href?: string | undefined;
//     hreflang?: string | undefined;
//     imagesizes?: Rel extends 'preload'
//         ? As extends 'image'
//             ? string
//             : never
//         : never;
//     imagesrcset?: Rel extends 'preload'
//         ? As extends 'image'
//             ? string
//             : never
//         : never;
//     integrity?: Rel extends
//         | 'stylesheet'
//         | 'alternate stylesheet'
//         | 'preload'
//         | 'modulepreload'
//         ? string
//         : never;
//     media?: string | undefined;
//     referrerpolicy?:
//         | 'no-referrer'
//         | 'no-referrer-when-downgrade'
//         | 'origin'
//         | 'origin-when-cross-origin'
//         | 'unsafe-url'
//         | undefined;
//     rel: Rel;
//     sizes?: string | undefined;
//     title?: string | undefined;
//     type?: Rel extends 'stylesheet' | 'alternate stylesheet'
//         ? never
//         : string | undefined;
// }

export interface Frontmatter extends Record<string, unknown> {
    title?: string | undefined;
    noscript?: string | undefined;
    base?:
        | {
              href?: string | undefined;
              target?: string | undefined;
          }
        | undefined;
    meta?: Meta[];
    link?: {
        rel: string;
        [key: string]: unknown;
    }[];
    imports?: Record<ImportPath, string | string[]>;
}

type ImportPath = string;

export interface MdastToml extends MdastLiteral {
    type: 'toml';
}

export interface MdastJson extends MdastLiteral {
    type: 'json';
}

declare module 'mdast' {
    interface FrontmatterContentMap {
        toml: MdastToml;
        json: MdastJson;
    }
}
