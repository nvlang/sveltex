/**
 * P2 corpus: a seeded, reproducible structured-random markdown generator.
 *
 * Not a CommonMark-conformance fuzzer — it deliberately oversamples the
 * constructs where the TM grammar and tree-sitter are most likely to disagree:
 * adjacent / nested emphasis, underscores adjacent to digits (the digit-
 * emphasis bug the fork fixes), 4-space-indented blocks (indented code, which
 * the fork disables), inline + block HTML, fenced code, and lists. Each sample
 * is a small document assembled from a few weighted block "snippets".
 *
 * Deterministic: a mulberry32 PRNG seeded from a fixed constant, so the corpus
 * is identical run-to-run (and across machines).
 */

/** Tiny deterministic PRNG (mulberry32). @param {number} seed */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'foo', 'bar', 'baz'];

/** @param {() => number} rng @param {any[]} arr */
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
/** @param {() => number} rng @param {number} n */
const words = (rng, n) =>
    Array.from({ length: n }, () => pick(rng, WORDS)).join(' ');

// Each generator returns a single block of markdown text (no trailing blank
// line; the assembler joins blocks with "\n\n"). Weights bias toward the
// divergence-prone constructs.
const GENERATORS = [
    // Adjacent / nested emphasis.
    [3, (rng) => {
        const inner = words(rng, 2);
        const forms = [
            `*${inner}* and **${words(rng, 2)}**`,
            `**${inner}*${words(rng, 1)}***`,
            `_${inner}_ then __${words(rng, 1)}__`,
            `***${inner}*** ~~${words(rng, 1)}~~`,
            `a*${inner}*b`,
        ];
        return pick(rng, forms);
    }],
    // Underscores next to digits (the digit-emphasis bug).
    [3, (rng) => {
        const w = pick(rng, WORDS);
        const n = Math.floor(rng() * 90 + 1);
        const forms = [
            `_${w}${n}_`,
            `_${w} ${n}_`,
            `__${w}${n}__`,
            `${n}_${n + 1}_${n + 2}`,
            `_${n}${w}_`,
        ];
        return pick(rng, forms);
    }],
    // 4-space-indented block (indented code upstream; disabled in fork).
    [2, (rng) => {
        const n = 1 + Math.floor(rng() * 3);
        return Array.from({ length: n }, () => '    ' + words(rng, 3)).join('\n');
    }],
    // Inline + block HTML.
    [2, (rng) => {
        const forms = [
            `<div class="x">\n${words(rng, 3)}\n</div>`,
            `text with <span>${words(rng, 1)}</span> inline`,
            `<!-- ${words(rng, 2)} -->`,
            `<br/> ${words(rng, 2)}`,
        ];
        return pick(rng, forms);
    }],
    // Fenced code.
    [2, (rng) => {
        const lang = pick(rng, ['js', 'ts', 'python', '', 'rust']);
        const fence = rng() < 0.5 ? '```' : '~~~';
        return `${fence}${lang}\n${words(rng, 4)}\n${fence}`;
    }],
    // Lists (ordered / unordered, occasionally nested).
    [2, (rng) => {
        const marker = pick(rng, ['-', '*', '+', '1.', '2)']);
        const n = 2 + Math.floor(rng() * 2);
        const lines = Array.from({ length: n }, (_, i) => {
            const m = /\d/.test(marker) ? `${i + 1}.` : marker;
            const nested = rng() < 0.3 ? `\n    - ${words(rng, 2)}` : '';
            return `${m} ${words(rng, 2)}${nested}`;
        });
        return lines.join('\n');
    }],
    // Headings (ATX + setext).
    [1, (rng) => {
        if (rng() < 0.5) {
            const lvl = 1 + Math.floor(rng() * 6);
            return `${'#'.repeat(lvl)} ${words(rng, 3)}`;
        }
        const u = rng() < 0.5 ? '=' : '-';
        return `${words(rng, 3)}\n${u.repeat(5)}`;
    }],
    // Blockquotes + thematic breaks.
    [1, (rng) => {
        if (rng() < 0.5) return `> ${words(rng, 4)}\n> ${words(rng, 3)}`;
        return pick(rng, ['---', '***', '___']);
    }],
    // Links / images.
    [1, (rng) => {
        const t = words(rng, 2);
        const forms = [
            `[${t}](https://example.com/${pick(rng, WORDS)})`,
            `![${t}](https://example.com/i.png)`,
            `[${t}][ref]`,
            `<https://example.com>`,
        ];
        return pick(rng, forms);
    }],
    // Inline code.
    [1, (rng) => `text \`${words(rng, 2)}\` and \`\`${pick(rng, WORDS)}\`\``],
];

const TOTAL_WEIGHT = GENERATORS.reduce((s, [w]) => s + w, 0);

/** @param {() => number} rng */
function pickGenerator(rng) {
    let r = rng() * TOTAL_WEIGHT;
    for (const [w, gen] of GENERATORS) {
        if (r < w) return gen;
        r -= w;
    }
    return GENERATORS[0][1];
}

/**
 * @param {{ count?: number, seed?: number }} [opts]
 * @returns {{ name: string, samples: { id: string, text: string, section: string }[] }}
 */
export function loadFuzzer({ count = 300, seed = 0xc0ffee } = {}) {
    const rng = mulberry32(seed);
    const samples = [];
    for (let i = 0; i < count; i++) {
        const blocks = 1 + Math.floor(rng() * 4);
        const doc = Array.from({ length: blocks }, () =>
            pickGenerator(rng)(rng),
        ).join('\n\n');
        samples.push({
            id: `fuzz-${String(i).padStart(4, '0')}`,
            text: doc + '\n',
            section: 'fuzzer',
        });
    }
    return { name: `fuzzer (seed 0x${seed.toString(16)}, n=${count})`, samples };
}
