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
 *   - YAML / TOML / LaTeX body tokenisation inside embedded blocks — the
 *     bench loads zero-pattern stubs for those host grammars (they ship
 *     with VS Code language extensions, not vendored here). Only
 *     `source.svelte` is loaded for real, from the vendored
 *     `docs/misc/svelte.tmLanguage.json`.
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
    // The TM convention nests `punctuation.definition.string.{begin,end}.tex`
    // *inside* `meta.math.{block,inline}.tex`, so a delimiter's full scope
    // chain includes `meta.math` — TM's `classifyTmScopes` reports it as
    // `math`. Mirror that here: count the tree-sitter `math_delimiter`
    // alias as `math` too, otherwise the parity report shows the delimiters
    // as TM-only every time.
    if (type === 'math_delimiter') return 'math';
    if (type === 'tex_verbatim_body') return 'verbatim-tex-body';
    if (type === 'plain_verbatim_body') return 'verbatim-plain-body';
    // Mustache / block-head JS payloads. The Svelte TM grammar tags all of
    // these with `meta.embedded.expression.svelte` — collapse them to one
    // parity kind so the bench doesn't over-report divergences for the
    // structural decomposition (`iterable` vs `binding` vs `key` etc.)
    // tree-sitter does on top.
    if (type === 'svelte_expression_body') return 'mustache-body';
    if (type === 'svelte_each_iterable') return 'mustache-body';
    if (type === 'svelte_each_binding') return 'mustache-body';
    if (type === 'svelte_each_index') return 'mustache-body';
    if (type === 'svelte_each_key') return 'mustache-body';
    if (type === 'svelte_snippet_params') return 'mustache-body';
    if (type === 'svelte_await_promise') return 'mustache-body';
    if (type === 'svelte_await_binding') return 'mustache-body';
    // Block-tag delimiters + the keyword tokens TM puts between them.
    if (type === 'svelte_block_tag') return 'block-tag';
    if (type === 'svelte_each_as') return 'block-tag';
    if (type === 'svelte_await_keyword') return 'block-tag';
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
    // Svelte mustache / block-head JS payloads: scoped as
    // `meta.embedded.expression.svelte` (with an inner `source.ts` /
    // `source.js`) by the upstream Svelte grammar. The same scope wraps
    // both plain `{name}` interpolation bodies and the JS-bearing parts
    // of block heads (`items` and `(item.id)` inside `{#each items as
    // item (item.id)}`).
    if (has(/\bmeta\.embedded\.expression\.svelte\b/)) {
        return 'mustache-body';
    }
    // Block-tag delimiters / keywords. The Svelte TM grammar wraps every
    // block tag in a `meta.special.{if,each,await,key,snippet,…}.svelte`
    // scope, and *inside* that scope it tags individual pieces with:
    //   - `punctuation.section.embedded.{begin,end}.svelte` for `{` / `}`
    //   - `punctuation.definition.keyword.svelte` for the `#` / `:` /
    //     `/` / `@` sigil
    //   - `keyword.control.{conditional,flow,as,…}.svelte`,
    //     `keyword.other.svelte`, `storage.type.svelte` for the keyword
    //     identifier (`if`, `each`, `await`, `then`, `catch`, `as`,
    //     `const`, `html`, `render`, `debug`, `attach`, …)
    // Gating on `meta.special.*.svelte` keeps plain `{name}` interpolation
    // braces — which share `punctuation.section.embedded.*.svelte` but
    // are NOT block tags — out of this bucket.
    if (has(/\bmeta\.special\.\w+\.svelte\b/)) {
        if (has(/\b(keyword|storage\.type)\..*\bsvelte\b/)) return 'block-tag';
        if (has(/\bpunctuation\.(definition\.keyword|section\.embedded\.(begin|end))\..*\bsvelte\b/)) return 'block-tag';
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
        // Feed vscode-textmate the line WITHOUT its trailing newline. With the
        // `\n` present, `$`/`while` anchoring misfires (e.g. a list's `while`
        // never terminates and swallows the rest of the document) — which is
        // NOT how VS Code, which tokenizes newline-stripped lines, behaves.
        // `line.length` (with the `\n`) still drives the running offset.
        const lineText = line.replace(/\r?\n$/, '');
        const { tokens, ruleStack: next } = grammar.tokenizeLine(
            lineText,
            ruleStack,
        );
        ruleStack = next;
        for (const token of tokens) {
            const start = offset + Math.min(token.startIndex, lineText.length);
            const end = offset + Math.min(token.endIndex, lineText.length);
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
    // `contributes.grammars`. The Svelte grammar is loaded from
    // `docs/misc/svelte.tmLanguage.json`, vendored from upstream
    // (`sveltejs/language-tools`) and kept fresh by the weekly
    // `vendor-update` workflow — so the bench tokenises Svelte
    // mustaches / block tags / interpolation through the *real* grammar
    // the SvelTeX TM grammar would resolve to at runtime in VS Code.
    const grammarFiles = {
        'source.sveltex': join(
            REPO_ROOT,
            'packages/vscode-sveltex/syntaxes/sveltex.tmLanguage.yaml',
        ),
        'text.markdown': join(
            REPO_ROOT,
            'packages/vscode-sveltex/syntaxes/markdown.tmLanguage.yaml',
        ),
        'source.svelte': join(
            REPO_ROOT,
            'docs/misc/svelte.tmLanguage.json',
        ),
    };

    // The SvelTeX TextMate grammar's frontmatter / verbatim / fenced-code
    // patterns include external grammars (`source.yaml`, `source.toml`,
    // `text.tex.latex`, etc.) that ship with VS Code's bundled language
    // extensions — we don't vendor them here. If `loadGrammar` returns
    // `null` for any of them, vscode-textmate silently fails the entire
    // enclosing rule — its begin/end never fires and the outer
    // `meta.embedded.block.*` scope is never emitted. So we stand in a
    // zero-pattern grammar for each one: the outer begin/end fires and
    // the parity bench compares on the structural scopes we care about.
    // The inner-language tokenisation (the YAML body of frontmatter,
    // the LaTeX body of `<tex>`) is out of scope for this bench.
    const externalScopes = [
        'source.yaml',
        'source.toml',
        'source.json',
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
                const text = readFileSync(path, 'utf-8');
                const raw = path.endsWith('.json')
                    ? JSON.parse(text)
                    : jsYaml.load(text);
                // Always end the filename in `.json` — vscode-textmate
                // picks PLIST vs JSON parsing off the extension, and
                // we've already serialised `raw` to JSON above.
                return vsctm.parseRawGrammar(
                    JSON.stringify(raw),
                    path.endsWith('.json') ? path : `${path}.json`,
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
