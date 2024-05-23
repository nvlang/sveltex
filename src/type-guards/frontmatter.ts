// Types
import { Equals, typeAssert } from '$deps.js';
import type { MetaHttpEquiv, MetaName } from '$types/utils/Frontmatter.js';

export function isMetaName(name: string): name is MetaName {
    return metaNames.includes(name as (typeof metaNames)[number]);
}

export function isMetaHttpEquiv(name: string): name is MetaHttpEquiv {
    return metaHttpEquivs.includes(name as (typeof metaHttpEquivs)[number]);
}

// Ensure we're not missing any meta names or http-equivs
typeAssert<Equals<(typeof metaNames)[number], MetaName>>();
typeAssert<Equals<(typeof metaHttpEquivs)[number], MetaHttpEquiv>>();

const metaNames = [
    'charset',
    'author',
    'application-name',
    'description',
    'generator',
    'keywords',
    'viewport',
] as const;

const metaHttpEquivs = ['content-security-policy', 'default-style'] as const;
