/**
 * Parser for the CommonMark / GFM spec example format.
 *
 * Each example is delimited by a run of 30+ backticks followed by ` example`
 * (optionally with a space-separated section name, e.g. ``…``` example`), then
 * the source markdown, a line containing only `.`, the expected HTML, and a
 * closing run of backticks:
 *
 * ```````````````````````````````` example
 * *foo*
 * .
 * <p><em>foo</em></p>
 * ````````````````````````````````
 *
 * The spec renders a literal tab as `→` (U+2192) and—in some specs—a
 * significant space as `␣`/`·`; we restore those on the markdown side so the
 * grammars see real whitespace.
 */

const FENCE_RE = /^(`{30,}|~{30,})\s*example/;

/**
 * @typedef {{
 *   index: number,      // 1-based example number within the spec
 *   markdown: string,   // the source markdown (whitespace restored)
 *   html: string,       // the expected HTML (informational only)
 *   section: string,    // nearest preceding ATX heading in the spec prose
 * }} SpecExample
 */

/**
 * @param {string} spec  full spec.txt contents
 * @returns {SpecExample[]}
 */
export function parseSpecExamples(spec) {
    const lines = spec.split('\n');
    /** @type {SpecExample[]} */
    const out = [];
    let section = '';
    let i = 0;
    let index = 0;
    while (i < lines.length) {
        const line = lines[i];
        // Track the current section from spec prose headings (`# …`, `## …`).
        const h = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
        if (h) section = h[1];
        const m = FENCE_RE.exec(line);
        if (!m) {
            i++;
            continue;
        }
        const close = m[1]; // the same run of backticks closes the block
        i++;
        const md = [];
        while (i < lines.length && lines[i] !== '.') md.push(lines[i++]);
        i++; // skip the `.`
        const html = [];
        while (i < lines.length && lines[i] !== close) html.push(lines[i++]);
        i++; // skip the closing fence
        index++;
        out.push({
            index,
            section,
            markdown: restoreWhitespace(md.join('\n') + (md.length ? '\n' : '')),
            html: html.join('\n'),
        });
    }
    return out;
}

/**
 * Restore the spec's printable whitespace placeholders to real characters.
 * `→` (U+2192) is a tab; `␣` (U+2423) and `·` (U+00B7) are spaces when used.
 *
 * @param {string} s
 * @returns {string}
 */
function restoreWhitespace(s) {
    return s
        .replace(/→/g, '\t')
        .replace(/␣/g, ' ')
        .replace(/·/g, ' ');
}
