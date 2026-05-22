/**
 * P2 corpus: the GitHub Flavored Markdown spec examples.
 *
 * Same example format as CommonMark (GFM is a strict superset). Sourced from
 * `github/cmark-gfm`'s test spec. Exercises the GFM-only constructs the fork
 * inherits from `tree-sitter-markdown`: strikethrough (`~~…~~`), pipe tables,
 * task list markers, and autolinks.
 */
import { fetchCached } from './_cache.mjs';
import { parseSpecExamples } from './_spec.mjs';

const SPEC_URL =
    'https://raw.githubusercontent.com/github/cmark-gfm/0.29.0.gfm.13/test/spec.txt';
const SPEC_FILE = 'gfm-0.29.0.gfm.13.spec.txt';

/**
 * @returns {{ name: string, samples: { id: string, text: string, section: string }[] }}
 */
export function loadGfm() {
    const spec = fetchCached(SPEC_URL, SPEC_FILE);
    const examples = parseSpecExamples(spec);
    return {
        name: 'GFM 0.29.0.gfm.13',
        samples: examples.map((e) => ({
            id: `gfm-${String(e.index).padStart(3, '0')}`,
            text: e.markdown,
            section: e.section,
        })),
    };
}
