#!/usr/bin/env node
/**
 * Grammar parity bench: tree-sitter vs the VS Code TextMate grammar.
 *
 * For each `.sveltex` fixture under `parity-fixtures/`, runs both grammars
 * over the same input and compares which byte ranges each one classifies
 * into a small set of common "feature kinds" (frontmatter, math, verbatim
 * body, mustache expression, block-tag delimiter). Writes a Markdown report
 * to `parity-report.md` and prints a one-line summary per fixture.
 *
 * What this checks:
 *   - Whether each grammar identifies the SAME constructs at the SAME byte
 *     ranges. Helps spot drift where one grammar gains a feature the other
 *     hasn't picked up yet (e.g. the new `svelte_expression` /
 *     `svelte_block_*` node families are tree-sitter-only today).
 *
 * What this does NOT check:
 *   - LSP behaviour (hovers, completions, diagnostics) — both extensions
 *     ride on the same LSP, so any divergence there isn't a grammar issue.
 *   - Theme rendering / colour scheme — that's editor-side.
 *   - Markdown / Svelte / JS injection contents — both grammars hand those
 *     off to the host editor's grammar chain, which produces different
 *     output by design.
 *
 * Run:    pnpm parity
 * Output: parity-report.md (in the package root)
 */

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import jsYaml from 'js-yaml';
import vsctm from 'vscode-textmate';
import oniguruma from 'vscode-oniguruma';

import Parser from 'tree-sitter';
import Sveltex from '../bindings/node/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..');
const FIXTURES_DIR = join(PACKAGE_ROOT, 'parity-fixtures');
const REPORT_PATH = join(PACKAGE_ROOT, 'parity-report.md');

// ── Feature kinds we compare across the two grammars ───────────────────────
//
// Each kind is what a reader would label a span as ("this is a frontmatter
// block", "this is a math span"), without committing to a particular scope
// name. The two classifier functions below project each grammar's output
// onto this shared vocabulary.

const KINDS = /** @type {const} */ ([
    'frontmatter',
    'math',
    'verbatim-tex-body',
    'verbatim-plain-body',
    'mustache-body', // body of a `{ … }` expression (excluding the braces)
    'block-tag', // `{#if`, `{:else}`, `{/each}`, `{@const`, …
]);

// ── Tree-sitter side ───────────────────────────────────────────────────────

/**
 * Classify a tree-sitter node type into a parity kind, or `null` if the node
 * is not one of the constructs we care about for parity.
 *
 * @param {string} type
 * @returns {(typeof KINDS)[number] | null}
 */
function classifyTsNode(type) {
    if (type === 'frontmatter_content') return 'frontmatter';
    if (type.startsWith('math_content_')) return 'math';
    if (type === 'tex_verbatim_body') return 'verbatim-tex-body';
    if (type === 'plain_verbatim_body') return 'verbatim-plain-body';
    if (type === 'svelte_expression_body') return 'mustache-body';
    if (type === 'svelte_block_tag') return 'block-tag';
    return null;
}

/**
 * Run the tree-sitter parser and pull out every node whose type maps to a
 * parity kind. Returns an array of `{kind, start, end}`, sorted by start.
 *
 * @param {string} source
 * @returns {Region[]}
 */
function tsRegions(source) {
    const parser = new Parser();
    parser.setLanguage(Sveltex);
    const tree = parser.parse(source);
    /** @type {Region[]} */
    const out = [];
    const walk = (/** @type {any} */ node) => {
        const kind = classifyTsNode(node.type);
        if (kind) {
            out.push({
                kind,
                start: node.startIndex,
                end: node.endIndex,
                origin: node.type,
            });
        }
        for (let i = 0; i < node.namedChildCount; i++) {
            walk(node.namedChild(i));
        }
    };
    walk(tree.rootNode);
    out.sort((a, b) => a.start - b.start || a.end - b.end);
    return out;
}

// ── TextMate side ──────────────────────────────────────────────────────────

/**
 * Classify a TextMate scope chain into a parity kind, or `null` if none of
 * the scopes match. We look at the *whole* chain rather than just the
 * innermost scope: the SvelTeX TM grammar uses `meta.embedded.block.latex`
 * for both math content and verbatim-`<tex>` content, so the only way to
 * tell them apart is whether `meta.math.*` is anywhere above in the
 * containment chain.
 *
 * @param {string[]} scopes
 * @returns {(typeof KINDS)[number] | null}
 */
function classifyTmScopes(scopes) {
    const has = (/** @type {RegExp} */ re) => scopes.some((s) => re.test(s));

    // Frontmatter: `meta.embedded.block.frontmatter.{yaml,toml,json}`.
    if (has(/\bmeta\.embedded\.(block\.)?(yaml|toml|json|frontmatter)/)) {
        return 'frontmatter';
    }
    // Math: `meta.math.*` always wins, even if the body is
    // `meta.embedded.block.latex` (which math regions also use).
    if (has(/\bmeta\.math\b/)) {
        return 'math';
    }
    // Verbatim TeX body: `meta.embedded.block.latex` with no math scope
    // above it — that means we're inside `<tex>…</tex>`, not `$…$`.
    if (has(/\bmeta\.embedded\.block\.latex\b/)) {
        return 'verbatim-tex-body';
    }
    // Verbatim plain body: scope name varies by grammar; match liberally.
    if (has(/\bmeta\.verbatim\.body\.plain|verbatim-plain/)) {
        return 'verbatim-plain-body';
    }
    // Svelte mustache expressions: the current TextMate grammar does NOT
    // emit a first-class scope for these. They'd surface only if the
    // markup got handed to `source.svelte`, which the SvelTeX TM grammar
    // doesn't currently arrange. Surfacing this gap is the point of the
    // parity bench.
    if (has(/\bmeta\.embedded\.expression\.svelte/)) {
        return 'mustache-body';
    }
    if (has(/\b(punctuation\.definition\.block|keyword)\..*\bsvelte\b/)) {
        return 'block-tag';
    }
    return null;
}

/**
 * Tokenize a source file with the TextMate grammar and pull out every
 * maximal run of consecutive tokens that share the same parity kind.
 *
 * @param {vsctm.Registry} registry
 * @param {string} source
 * @returns {Promise<Region[]>}
 */
async function tmRegions(registry, source) {
    const grammar = await registry.loadGrammar('source.sveltex');
    if (!grammar) throw new Error('Failed to load source.sveltex grammar');

    /** @type {Region[]} */
    const out = [];
    let ruleStack = vsctm.INITIAL;
    let offset = 0;
    let current = null;

    for (const line of source.split(/(?<=\n)/)) {
        const { tokens, ruleStack: next } = grammar.tokenizeLine(
            line,
            ruleStack,
        );
        ruleStack = next;
        for (const token of tokens) {
            const start = offset + token.startIndex;
            const end = offset + token.endIndex;
            const kind = classifyTmScopes(token.scopes);
            if (current && current.kind === kind && current.end === start) {
                current.end = end; // extend run
            } else {
                if (current && current.kind) out.push(current);
                current = { kind, start, end, origin: token.scopes };
            }
        }
        offset += line.length;
    }
    if (current && current.kind) out.push(current);
    return out;
}

/**
 * Load + compile the SvelTeX TextMate grammar (and the markdown grammar it
 * extends) so they can tokenize fixtures.
 *
 * @returns {Promise<vsctm.Registry>}
 */
async function loadRegistry() {
    const wasmBinPath = resolve(
        PACKAGE_ROOT,
        'node_modules/vscode-oniguruma/release/onig.wasm',
    );
    const wasmBin = readFileSync(wasmBinPath).buffer;
    await oniguruma.loadWASM(wasmBin);

    // The published markdown grammar has `scopeName: text.markdown`, not
    // `text.html.markdown` — see `packages/vscode-sveltex/package.json`'s
    // `contributes.grammars`.
    const grammarFiles = {
        'source.sveltex': join(
            REPO_ROOT,
            'packages/vscode-sveltex/syntaxes/sveltex.tmLanguage.yaml',
        ),
        'text.markdown': join(
            REPO_ROOT,
            'packages/vscode-sveltex/syntaxes/markdown.tmLanguage.yaml',
        ),
    };

    // The SvelTeX TextMate grammar's frontmatter / verbatim / fenced-code
    // patterns include external grammars (`source.yaml`, `source.toml`,
    // `text.tex.latex`, `source.svelte`, etc.). If `loadGrammar` returns
    // `null` for any of these, vscode-textmate silently fails the entire
    // enclosing rule — its begin/end never fires and the outer
    // `meta.embedded.block.*` scope is never emitted. In VS Code those
    // grammars are typically available (ships with the language extensions);
    // here we stand in a zero-pattern grammar for each one so the
    // *outer* begin/end fires and the parity bench can compare on the
    // structural scopes we care about. The inner language tokenization is
    // out of scope for parity.
    const externalScopes = [
        'source.yaml',
        'source.toml',
        'source.json',
        'source.svelte',
        'source.js',
        'source.ts',
        'source.css',
        'source.css.scss',
        'source.sass',
        'source.css.postcss',
        'source.stylus',
        'text.tex.latex',
        'text.html.basic',
        'text.html.derivative',
    ];
    /** @param {string} scope */
    const stubGrammar = (scope) =>
        vsctm.parseRawGrammar(
            JSON.stringify({ scopeName: scope, patterns: [] }),
            `${scope}.stub.json`,
        );

    return new vsctm.Registry({
        onigLib: Promise.resolve({
            createOnigScanner: (sources) =>
                new oniguruma.OnigScanner(sources),
            createOnigString: (str) => new oniguruma.OnigString(str),
        }),
        loadGrammar: async (scopeName) => {
            const path = grammarFiles[scopeName];
            if (path) {
                const yaml = readFileSync(path, 'utf-8');
                const raw = jsYaml.load(yaml);
                return vsctm.parseRawGrammar(
                    JSON.stringify(raw),
                    path + '.json',
                );
            }
            if (externalScopes.includes(scopeName)) {
                return stubGrammar(scopeName);
            }
            return null;
        },
    });
}

// ── Comparison ─────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   kind: (typeof KINDS)[number] | null,
 *   start: number,
 *   end: number,
 *   origin: any,
 * }} Region
 */

/**
 * @typedef {{
 *   tsOnly: Region[],
 *   tmOnly: Region[],
 *   matched: { ts: Region, tm: Region }[],
 * }} Comparison
 */

/**
 * Pair up regions whose ranges overlap and whose kind agrees. The boundary
 * of "is this region a math span?" rarely lines up byte-for-byte across the
 * two grammars (TM scopes typically include the delimiters; tree-sitter
 * excludes them), so exact-match pairing produces all-divergence noise. An
 * overlap-based pairing keeps the report focused on real gaps —
 * constructs one grammar identifies and the other doesn't at all.
 *
 * @param {Region[]} ts
 * @param {Region[]} tm
 * @returns {Comparison}
 */
function compare(ts, tm) {
    /** @type {Comparison} */
    const out = { tsOnly: [], tmOnly: [], matched: [] };
    const overlaps = (/** @type {Region} */ a, /** @type {Region} */ b) =>
        a.kind === b.kind && a.start < b.end && b.start < a.end;
    const consumedTm = new Set();
    for (const r of ts) {
        // First TM region of the same kind whose range overlaps this TS
        // region. One-to-one is good enough for the report; we don't try to
        // accumulate multiple matches per TS region (TM tokens are
        // character-granular, so multiple TM regions of the same kind
        // typically map to a single TS region).
        const idx = tm.findIndex(
            (b, i) => !consumedTm.has(i) && overlaps(r, b),
        );
        if (idx >= 0) {
            out.matched.push({ ts: r, tm: tm[idx] });
            consumedTm.add(idx);
        } else {
            out.tsOnly.push(r);
        }
    }
    tm.forEach((r, i) => {
        if (!consumedTm.has(i)) out.tmOnly.push(r);
    });
    return out;
}

// ── Main ───────────────────────────────────────────────────────────────────

function summariseRegion(r) {
    const origin =
        typeof r.origin === 'string' ? r.origin : r.origin.join(' › ');
    return `\`${r.kind}\` [${r.start}–${r.end}] _${origin}_`;
}

async function main() {
    let fixtures;
    try {
        fixtures = readdirSync(FIXTURES_DIR)
            .filter((f) => f.endsWith('.sveltex'))
            .sort();
    } catch (e) {
        console.error(`No fixtures directory at ${FIXTURES_DIR}`);
        process.exit(1);
    }

    const registry = await loadRegistry();
    const lines = [
        '# Grammar parity report',
        '',
        `Generated by \`scripts/parity.mjs\` on ${new Date().toISOString()}.`,
        '',
        'For each fixture: byte ranges each grammar tags into one of',
        Array.from(KINDS, (k) => `\`${k}\``).join(', ') + '.',
        '',
        '- `matched` — same range, same kind from both grammars.',
        '- `ts-only` — tree-sitter found the region; TextMate did not.',
        '- `tm-only` — TextMate found the region; tree-sitter did not.',
        '',
    ];

    let totalMatched = 0;
    let totalTsOnly = 0;
    let totalTmOnly = 0;

    for (const fixture of fixtures) {
        const path = join(FIXTURES_DIR, fixture);
        const source = readFileSync(path, 'utf-8');
        const ts = tsRegions(source);
        const tm = await tmRegions(registry, source);
        const cmp = compare(ts, tm);
        totalMatched += cmp.matched.length;
        totalTsOnly += cmp.tsOnly.length;
        totalTmOnly += cmp.tmOnly.length;

        const summary =
            cmp.tsOnly.length === 0 && cmp.tmOnly.length === 0
                ? '✓ parity'
                : `Δ ${cmp.matched.length} matched, ${cmp.tsOnly.length} ts-only, ${cmp.tmOnly.length} tm-only`;
        console.log(`${fixture.padEnd(40)} ${summary}`);

        lines.push(`## \`${fixture}\``);
        lines.push('');
        lines.push('```' + (fixture.endsWith('.sveltex') ? '' : ''));
        lines.push(source.replace(/\n+$/, ''));
        lines.push('```');
        lines.push('');
        lines.push(
            `**Matched** (${cmp.matched.length}), **ts-only** (${cmp.tsOnly.length}), **tm-only** (${cmp.tmOnly.length}).`,
        );
        lines.push('');
        if (cmp.matched.length) {
            lines.push('<details><summary>matched</summary>');
            lines.push('');
            for (const m of cmp.matched) {
                lines.push(`- ${summariseRegion(m.ts)}`);
            }
            lines.push('');
            lines.push('</details>');
            lines.push('');
        }
        if (cmp.tsOnly.length) {
            lines.push('**ts-only**:');
            for (const r of cmp.tsOnly) lines.push(`- ${summariseRegion(r)}`);
            lines.push('');
        }
        if (cmp.tmOnly.length) {
            lines.push('**tm-only**:');
            for (const r of cmp.tmOnly) lines.push(`- ${summariseRegion(r)}`);
            lines.push('');
        }
    }

    lines.push('---');
    lines.push('');
    lines.push(
        `**Totals:** ${totalMatched} matched, ${totalTsOnly} ts-only, ${totalTmOnly} tm-only across ${fixtures.length} fixtures.`,
    );
    writeFileSync(REPORT_PATH, lines.join('\n'));
    console.log(`\nReport written to ${relative(process.cwd(), REPORT_PATH)}`);
    console.log(
        `Totals: ${totalMatched} matched, ${totalTsOnly} ts-only, ${totalTmOnly} tm-only.`,
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
