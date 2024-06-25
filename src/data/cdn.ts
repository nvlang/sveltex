// File description: Supported CDN URL prefixes.

/**
 * @remarks
 * cdnjs does not serve `starry-night`; if a situation arises where cdnjs
 * would be queried for `starry-night`, jsDelivr will be used instead.
 */
export type SupportedCdn = keyof typeof cdnPrefixes;

export const cdnPrefixes = {
    jsdelivr: 'https://cdn.jsdelivr.net/npm/',
    'esm.sh': 'https://esm.sh/',
    unpkg: 'https://unpkg.com/',
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/',
} as const;
