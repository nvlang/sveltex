// File description: the shape Svelte expects a preprocessor function to
// return. Re-declared here (rather than imported from `svelte/compiler`)
// so SvelTeX's public type surface doesn't couple to the `svelte` version
// the host is on.

// Types
import type { SourceMap } from '../deps.js';

/**
 * The shape Svelte expects every preprocessor function (`markup`,
 * `script`, `style`) to return: the transformed source plus optional
 * metadata. Mirrors the same-named type in `svelte/compiler` — SvelTeX
 * re-declares it locally to avoid a `svelte`-version-coupled type
 * import.
 */
export interface Processed {
    /**
     * The new code
     */
    code: string;
    /**
     * A source map mapping back to the original code
     */
    map?: Omit<SourceMap, 'toString' | 'toUrl'>;
    /**
     * A list of additional files to watch for changes
     */
    dependencies?: string[];
    /**
     * Only for script/style preprocessors: The updated attributes to set on the tag. If undefined, attributes stay unchanged.
     */
    attributes?: Record<string, string | boolean>;
    toString?: () => string;
}
