// File description:

// Types
import type { SourceMap } from '../deps.js';

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
