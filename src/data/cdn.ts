// Types
import type { SupportedCdn } from '$types/handlers/misc.js';

export const cdnPrefixes: Record<SupportedCdn, `https://${string}/`> = {
    jsdelivr: 'https://cdn.jsdelivr.net/npm/',
    'esm.sh': 'https://esm.sh/',
    unpkg: 'https://unpkg.com/',
} as const;
