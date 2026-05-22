/**
 * P1 corpus: the CommonMark spec examples (v0.31.2).
 *
 * Downloads `spec.txt`, extracts the ~650 `… example … . … ` blocks, and
 * returns each one's source markdown as a parity sample.
 */
import { fetchCached } from './_cache.mjs';
import { parseSpecExamples } from './_spec.mjs';

const SPEC_URL = 'https://spec.commonmark.org/0.31.2/spec.txt';
const SPEC_FILE = 'commonmark-0.31.2.spec.txt';

/**
 * @returns {{ name: string, samples: { id: string, text: string, section: string }[] }}
 */
export function loadCommonMark() {
    const spec = fetchCached(SPEC_URL, SPEC_FILE);
    const examples = parseSpecExamples(spec);
    return {
        name: 'CommonMark 0.31.2',
        samples: examples.map((e) => ({
            id: `cm-${String(e.index).padStart(3, '0')}`,
            text: e.markdown,
            section: e.section,
        })),
    };
}
