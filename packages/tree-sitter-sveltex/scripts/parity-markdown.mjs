#!/usr/bin/env node
/**
 * Markdown-level grammar parity bench: the VS Code TextMate grammar vs the
 * tree-sitter markdown stack, run over large markdown corpora.
 *
 * Sibling to `parity.mjs` (which compares SvelTeX-specific constructs — math,
 * verbatim, mustaches). This script instead compares how the two systems
 * tokenize *markdown* itself, across the CommonMark spec, the GFM spec, a
 * seeded fuzzer, and a few real-world READMEs.
 *
 * ── Why two tree-sitter grammars? ──────────────────────────────────────────
 * In Zed, a `.sveltex` file is parsed in two levels: the `sveltex` grammar
 * carves the document into opaque `markdown_chunk` ranges, and each chunk is
 * re-parsed by the markdown grammars (block + inline) via injection. We
 * replicate that here. For pure-markdown corpora the sveltex grammar emits a
 * single chunk spanning the whole input, so we run the markdown grammars on
 * the whole input.
 *
 * ── Before / after ─────────────────────────────────────────────────────────
 * The tree-sitter markdown grammar is swappable between:
 *   - FORK     — the vendored `@nvl/tree-sitter-markdown-sveltex`
 *                (`markdown_sveltex` / `markdown_inline_sveltex`): indented
 *                code disabled; underscore-emphasis-ending-in-digit fixed.
 *   - UPSTREAM — a clean `tree-sitter-grammars/tree-sitter-markdown` at rev
 *                9a23c1a, cloned + built into `.parity-cache/upstream/`.
 * Reporting divergences-vs-TM for BOTH quantifies what the fork fixes.
 *
 * Run:    node scripts/parity-markdown.mjs [--corpus=commonmark,gfm,fuzzer,real]
 *                                          [--limit=N] [--upstream-only] [--no-upstream]
 * Output: parity-markdown-report.md (in the package root)
 */

import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import jsYaml from 'js-yaml';
import vsctm from 'vscode-textmate';
import oniguruma from 'vscode-oniguruma';

import { loadCommonMark } from './corpora/commonmark.mjs';
import { loadGfm } from './corpora/gfm.mjs';
import { loadFuzzer } from './corpora/fuzzer.mjs';
import { loadRealWorld } from './corpora/real-world.mjs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..');
const REPORT_PATH = join(PACKAGE_ROOT, 'parity-markdown-report.md');
const CACHE_DIR = join(PACKAGE_ROOT, '.parity-cache');
const MD_FORK_PKG = join(REPO_ROOT, 'packages', 'tree-sitter-markdown-sveltex');
const UPSTREAM_DIR = join(CACHE_DIR, 'upstream');
const UPSTREAM_REV = '9a23c1a';
const UPSTREAM_URL =
    'https://github.com/tree-sitter-grammars/tree-sitter-markdown.git';
const UPSTREAM_FETCH_BRANCH = 'split_parser';

// ── Markdown kind taxonomy ─────────────────────────────────────────────────
//
// A semantic, system-agnostic vocabulary a reader would use to label a span.
// Both the TextMate classifier and the tree-sitter classifier project their
// native output onto this set, so the two can be compared range-by-range.
//
//   emphasis        *italic* / _italic_
//   strong          **bold** / __bold__
//   code-inline     `code`
//   code-fenced     ``` … ``` / ~~~ … ~~~
//   code-indented   4-space / tab indented code block
//   heading         # ATX … and Setext underlines
//   list-marker     the bullet / number marker of a list item
//   blockquote      > quoted block
//   link            [text](url) and reference links + autolinks
//   image           ![alt](url)
//   html-tag        inline HTML tag (<span>, <br/>, …)
//   html-block      block-level HTML (<div>…</div> on its own lines)
//   thematic-break  --- / *** / ___
//   strikethrough   ~~struck~~  (GFM)
//
// Notes on deliberate exclusions:
//   - link/image/code *content* and delimiters are folded into the one kind so
//     boundary differences (TM scopes the brackets; tree-sitter has child
//     nodes) don't show up as divergences.
//   - tables and task-list markers are left out: the SvelTeX TM grammar's table
//     support and tree-sitter's pipe_table decompose very differently and would
//     swamp the signal; out of scope for this bench.

export const KINDS = /** @type {const} */ ([
    'emphasis',
    'strong',
    'code-inline',
    'code-fenced',
    'code-indented',
    'heading',
    'list-marker',
    'blockquote',
    'link',
    'image',
    'html-tag',
    'html-block',
    'thematic-break',
    'strikethrough',
]);

// ════════════════════════════════════════════════════════════════════════════
// tree-sitter side
// ════════════════════════════════════════════════════════════════════════════

// The markdown grammars are built against tree-sitter language ABI 15 (fork)
// and 14 (upstream); both need the `tree-sitter@0.25` runtime (ABI 13–15). The
// fork pins `tree-sitter@^0.21` in its peerDeps, which only speaks ABI ≤14 and
// segfaults on the ABI-15 fork parser — so we resolve the 0.25 runtime that the
// `sveltex` grammar already depends on, and feed every language to it.
export function loadParserClass() {
    const TreeSitter = require(
        require.resolve('tree-sitter', { paths: [PACKAGE_ROOT] }),
    );
    return TreeSitter;
}

/**
 * Load the FORK markdown grammar's native binding. Returns `{ block, inline }`
 * language handles ready for `parser.setLanguage`. Resolved via the declared
 * `@nvl/tree-sitter-markdown-sveltex` workspace devDependency (whose own
 * `bindings/node` entry exports the block language directly and the inline
 * language as `.inline`).
 */
export function loadForkGrammars() {
    let binding;
    try {
        binding = require('@nvl/tree-sitter-markdown-sveltex');
    } catch {
        // Fallback to the in-tree build path if the package isn't linked.
        binding = require(
            join(MD_FORK_PKG, 'build', 'Release', 'tree_sitter_markdown_binding.node'),
        );
    }
    return { block: binding, inline: binding.inline };
}

/**
 * Ensure the clean UPSTREAM `tree-sitter-markdown@9a23c1a` is cloned + built,
 * then load its native binding. Idempotent: clones on first run only.
 *
 * @returns {{ block: any, inline: any } | null}
 */
export function loadUpstreamGrammars() {
    const builtNode = join(
        UPSTREAM_DIR,
        'build',
        'Release',
        'tree_sitter_markdown_binding.node',
    );
    if (!existsSync(builtNode)) {
        try {
            buildUpstream();
        } catch (e) {
            console.warn(`  (upstream build failed: ${e.message})`);
            return null;
        }
    }
    try {
        const binding = require(builtNode);
        return { block: binding, inline: binding.inline };
    } catch (e) {
        console.warn(`  (upstream load failed: ${e.message})`);
        return null;
    }
}

function buildUpstream() {
    mkdirSync(UPSTREAM_DIR, { recursive: true });
    const git = (...args) =>
        execFileSync('git', args, { cwd: UPSTREAM_DIR, stdio: 'ignore' });
    if (!existsSync(join(UPSTREAM_DIR, '.git'))) {
        console.log(`  cloning upstream tree-sitter-markdown@${UPSTREAM_REV} …`);
        git('init', '-q', '.');
        git('remote', 'add', 'origin', UPSTREAM_URL);
    }
    // Shallow-fetch the branch that contains the pinned rev, then check it out.
    try {
        git('cat-file', '-t', UPSTREAM_REV);
    } catch {
        execFileSync(
            'git',
            ['fetch', '-q', '--depth', '200', 'origin', UPSTREAM_FETCH_BRANCH],
            { cwd: UPSTREAM_DIR, stdio: 'inherit' },
        );
    }
    git('checkout', '-q', UPSTREAM_REV);
    // The upstream binding.gyp needs `node-addon-api`; expose the workspace's
    // copy via a local node_modules symlink so node-gyp resolves it.
    const nmDir = join(UPSTREAM_DIR, 'node_modules');
    mkdirSync(nmDir, { recursive: true });
    const addonLink = join(nmDir, 'node-addon-api');
    if (!existsSync(addonLink)) {
        const addonReal = dirname(
            require.resolve('node-addon-api/package.json', {
                paths: [PACKAGE_ROOT],
            }),
        );
        symlinkSync(addonReal, addonLink, 'dir');
    }
    console.log('  building upstream native binding …');
    execFileSync('npx', ['--no-install', 'node-gyp', 'configure', 'build'], {
        cwd: UPSTREAM_DIR,
        stdio: 'inherit',
    });
}

/**
 * Classify a BLOCK-grammar node type into a parity kind, or `null`.
 * @param {string} type
 * @returns {(typeof KINDS)[number] | null}
 */
function classifyTsBlockNode(type) {
    if (type === 'atx_heading' || type === 'setext_heading') return 'heading';
    if (type === 'fenced_code_block') return 'code-fenced';
    if (type === 'indented_code_block') return 'code-indented';
    if (type === 'block_quote') return 'blockquote';
    if (type === 'html_block') return 'html-block';
    if (type === 'thematic_break') return 'thematic-break';
    if (type.startsWith('list_marker_')) return 'list-marker';
    return null;
}

/**
 * Classify an INLINE-grammar node type into a parity kind, or `null`.
 * @param {string} type
 * @returns {(typeof KINDS)[number] | null}
 */
function classifyTsInlineNode(type) {
    if (type === 'emphasis') return 'emphasis';
    if (type === 'strong_emphasis') return 'strong';
    if (type === 'strikethrough') return 'strikethrough';
    if (type === 'code_span') return 'code-inline';
    if (type === 'html_tag') return 'html-tag';
    if (type === 'image') return 'image';
    if (
        type === 'inline_link' ||
        type === 'full_reference_link' ||
        type === 'collapsed_reference_link' ||
        type === 'shortcut_link' ||
        type === 'uri_autolink' ||
        type === 'email_autolink'
    ) {
        return 'link';
    }
    return null;
}

/**
 * Run the two-level markdown parse over `source` and collect parity regions.
 *
 * Block grammar gives block kinds plus the `(inline)` leaf nodes; each inline
 * node's text is re-parsed by the inline grammar, with ranges offset back to
 * document coordinates.
 *
 * @param {any} TreeSitter
 * @param {{ block: any, inline: any }} grammars
 * @param {string} source
 * @returns {Region[]}
 */
export function tsMarkdownRegions(TreeSitter, grammars, source) {
    /** @type {Region[]} */
    const out = [];

    const blockParser = new TreeSitter();
    blockParser.setLanguage(grammars.block);
    const blockTree = blockParser.parse(source);

    const inlineParser = new TreeSitter();
    inlineParser.setLanguage(grammars.inline);

    /** @param {any} node */
    const walkBlock = (node) => {
        const kind = classifyTsBlockNode(node.type);
        if (kind) {
            out.push({
                kind,
                start: node.startIndex,
                end: node.endIndex,
                origin: node.type,
            });
        }
        if (node.type === 'inline') {
            const text = source.slice(node.startIndex, node.endIndex);
            const base = node.startIndex;
            const inlineTree = inlineParser.parse(text);
            walkInline(inlineTree.rootNode, base);
            // Don't descend into inline's children on the block tree — the
            // block grammar leaves inline content unparsed.
            return;
        }
        for (let i = 0; i < node.namedChildCount; i++) {
            walkBlock(node.namedChild(i));
        }
    };

    /** @param {any} node @param {number} base */
    const walkInline = (node, base) => {
        const kind = classifyTsInlineNode(node.type);
        if (kind) {
            out.push({
                kind,
                start: base + node.startIndex,
                end: base + node.endIndex,
                origin: node.type,
            });
        }
        for (let i = 0; i < node.namedChildCount; i++) {
            walkInline(node.namedChild(i), base);
        }
    };

    walkBlock(blockTree.rootNode);
    out.sort((a, b) => a.start - b.start || a.end - b.end);
    return out;
}

// ════════════════════════════════════════════════════════════════════════════
// TextMate side
// ════════════════════════════════════════════════════════════════════════════

/**
 * Classify a TextMate scope chain into a markdown parity kind, or `null`.
 *
 * Scope strings were verified empirically against the customized markdown TM
 * grammar (`packages/vscode-sveltex/syntaxes/markdown.tmLanguage.yaml`) via
 * `scripts/tm-dump.mjs`. Ordering matters: image is checked before link
 * (`meta.image.*` would otherwise be missed), strong/strikethrough before the
 * generic emphasis check.
 *
 * @param {string[]} scopes
 * @returns {(typeof KINDS)[number] | null}
 */
function classifyTmMarkdownScopes(scopes) {
    const has = (/** @type {RegExp} */ re) => scopes.some((s) => re.test(s));

    // Frontmatter wins outright — a leading `---` in a SvelTeX doc is YAML
    // frontmatter, not a thematic break, and its body must not be mistaken for
    // markdown. (Mirrors the sveltex grammar.)
    if (has(/\bmeta\.embedded\.(block\.)?(frontmatter|yaml|toml|json)\b/)) {
        return null;
    }

    // Headings: ATX + setext both carry `markup.heading`.
    if (has(/\bmarkup\.heading\b/)) return 'heading';

    // Fenced code: `markup.fenced_code.block.markdown` (incl. its language /
    // embedded body). Indented code: `markup.raw.block.markdown` — note the
    // SvelTeX grammar does NOT include `#raw_block`, so this practically never
    // fires through `source.sveltex`; kept for completeness.
    if (has(/\bmarkup\.fenced_code\.block\b/)) return 'code-fenced';
    if (has(/\bmarkup\.raw\.block\.markdown\b/)) return 'code-indented';

    // Inline code: `markup.inline.raw.string.markdown`.
    if (has(/\bmarkup\.inline\.raw\b/)) return 'code-inline';

    // Blockquote.
    if (has(/\bmarkup\.quote\b/)) return 'blockquote';

    // List marker: ONLY the marker punctuation (`-`, `*`, `1.`), tagged
    // `punctuation.definition.list.begin.markdown`. We deliberately do NOT map
    // the bare `markup.list.{unnumbered,numbered}.markdown` content scope —
    // that wraps the entire list item (and, due to this grammar's greedy
    // `while`-based continuation, often trailing blocks too), whereas
    // tree-sitter has a dedicated `list_marker_*` node for just the marker.
    // Matching only the marker keeps the kinds comparable.
    if (has(/\bpunctuation\.definition\.list\.begin\b/)) return 'list-marker';

    // Thematic break.
    if (has(/\bmeta\.separator\.markdown\b/)) return 'thematic-break';

    // Image before link (image scopes are a superset shape).
    if (has(/\bmeta\.image\.(inline|reference)\b/)) return 'image';
    if (has(/\bmarkup\.underline\.link\.image\b/)) return 'image';
    if (
        has(/\bmeta\.link\.(inline|reference|inet|email)\b/) ||
        has(/\bmarkup\.underline\.link\b/) ||
        has(/\bconstant\.other\.reference\.link\b/)
    ) {
        return 'link';
    }

    // Strikethrough (GFM) before emphasis.
    if (has(/\bmarkup\.strikethrough\b/)) return 'strikethrough';
    // Strong before italic (the bold scope is distinct).
    //
    // KNOWN ARTIFACT (`***x***` / `___x___`): TextMate applies BOTH
    // `markup.bold` and `markup.italic` to a triple-delimiter run, but this
    // classifier collapses each scope set to a single kind and checks bold
    // first, so it reports only `strong`. tree-sitter instead nests a
    // `strong_emphasis` with a child `emphasis`, so that inner `emphasis`
    // surfaces as a spurious `tsOnly` divergence in the report. It is unbiased
    // between the fork and clean upstream (both nest identically), so it never
    // skews the fork-vs-upstream delta — it only inflates the absolute
    // `emphasis` counts.
    if (has(/\bmarkup\.bold\b/)) return 'strong';
    if (has(/\bmarkup\.italic\b/)) return 'emphasis';

    // Inline HTML: the markdown grammar delegates to text.html.basic, which we
    // stub — but the SvelTeX grammar tags Svelte/HTML tags via source.svelte.
    // Match the html tag scopes that survive.
    if (has(/\bentity\.name\.tag\b/) || has(/\bmeta\.tag\b/)) return 'html-tag';

    return null;
}

/**
 * Tokenize `source` with the SvelTeX TM grammar and collapse consecutive
 * same-kind tokens into maximal regions.
 *
 * @param {vsctm.Registry} registry
 * @param {string} source
 * @returns {Promise<Region[]>}
 */
export async function tmMarkdownRegions(registry, source) {
    const grammar = await registry.loadGrammar('source.sveltex');
    if (!grammar) throw new Error('Failed to load source.sveltex grammar');

    /** @type {Region[]} */
    const out = [];
    let ruleStack = vsctm.INITIAL;
    let offset = 0;
    let current = null;

    for (const line of source.split(/(?<=\n)/)) {
        // Feed vscode-textmate the line WITHOUT its trailing newline. With the
        // `\n` present, `$`/`while` anchoring misfires — a list's `while` never
        // terminates and swallows the rest of the document, so TextMate appears
        // to massively under-tokenize real-world docs. That is a harness bug,
        // not a grammar limitation: VS Code tokenizes newline-stripped lines.
        // `line.length` (with the `\n`) still drives the running offset.
        const lineText = line.replace(/\r?\n$/, '');
        const { tokens, ruleStack: next } = grammar.tokenizeLine(
            lineText,
            ruleStack,
        );
        ruleStack = next;
        for (const token of tokens) {
            // Clamp to the stripped line length: vscode-textmate still reports a
            // virtual EOL token one past the end, which would otherwise push a
            // line-final region past the next line's first token.
            const start = offset + Math.min(token.startIndex, lineText.length);
            const end = offset + Math.min(token.endIndex, lineText.length);
            if (end <= start) continue;
            const kind = classifyTmMarkdownScopes(token.scopes);
            if (current && current.kind === kind && current.end === start) {
                current.end = end;
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
 * Load + compile the SvelTeX TextMate grammar (and the markdown + Svelte
 * grammars it extends) so it can tokenize markdown samples. Same plumbing as
 * `parity.mjs`: external host languages get zero-pattern stubs.
 *
 * @returns {Promise<vsctm.Registry>}
 */
export async function loadRegistry() {
    const wasmBin = readFileSync(
        resolve(PACKAGE_ROOT, 'node_modules/vscode-oniguruma/release/onig.wasm'),
    ).buffer;
    await oniguruma.loadWASM(wasmBin);

    const grammarFiles = {
        'source.sveltex': join(
            REPO_ROOT,
            'packages/vscode-sveltex/syntaxes/sveltex.tmLanguage.yaml',
        ),
        'text.markdown': join(
            REPO_ROOT,
            'packages/vscode-sveltex/syntaxes/markdown.tmLanguage.yaml',
        ),
        'source.svelte': join(REPO_ROOT, 'docs/misc/svelte.tmLanguage.json'),
    };
    const externalScopes = [
        'source.yaml', 'source.toml', 'source.json', 'source.js', 'source.ts',
        'source.css', 'source.css.scss', 'source.sass', 'source.css.postcss',
        'source.stylus', 'text.tex.latex', 'text.html.basic',
        'text.html.derivative',
    ];
    const stubGrammar = (/** @type {string} */ scope) =>
        vsctm.parseRawGrammar(
            JSON.stringify({ scopeName: scope, patterns: [] }),
            `${scope}.stub.json`,
        );

    return new vsctm.Registry({
        onigLib: Promise.resolve({
            createOnigScanner: (s) => new oniguruma.OnigScanner(s),
            createOnigString: (s) => new oniguruma.OnigString(s),
        }),
        loadGrammar: async (scopeName) => {
            const path = grammarFiles[scopeName];
            if (path) {
                const text = readFileSync(path, 'utf-8');
                const raw = path.endsWith('.json')
                    ? JSON.parse(text)
                    : jsYaml.load(text);
                return vsctm.parseRawGrammar(
                    JSON.stringify(raw),
                    path.endsWith('.json') ? path : `${path}.json`,
                );
            }
            if (externalScopes.includes(scopeName)) return stubGrammar(scopeName);
            return null;
        },
    });
}

// ════════════════════════════════════════════════════════════════════════════
// Comparison
// ════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {{
 *   kind: (typeof KINDS)[number] | null,
 *   start: number,
 *   end: number,
 *   origin: any,
 * }} Region
 */

/**
 * Pair regions by kind + range overlap (same approach as `parity.mjs`):
 * exact byte-for-byte agreement is rare across the two systems, so overlap
 * pairing keeps the focus on real gaps — a construct one side sees and the
 * other misses entirely.
 *
 * @param {Region[]} ts
 * @param {Region[]} tm
 */
export function compare(ts, tm) {
    const out = { tsOnly: /** @type {Region[]} */ ([]), tmOnly: /** @type {Region[]} */ ([]), matched: /** @type {{ts:Region,tm:Region}[]} */ ([]) };
    const overlaps = (/** @type {Region} */ a, /** @type {Region} */ b) =>
        a.kind === b.kind && a.start < b.end && b.start < a.end;
    const consumedTm = new Set();
    for (const r of ts) {
        const idx = tm.findIndex((b, i) => !consumedTm.has(i) && overlaps(r, b));
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

// ════════════════════════════════════════════════════════════════════════════
// Report
// ════════════════════════════════════════════════════════════════════════════

/** @param {Region} r */
function summariseRegion(r) {
    const origin = typeof r.origin === 'string' ? r.origin : r.origin.join(' › ');
    return `\`${r.kind}\` [${r.start}–${r.end}] _${origin}_`;
}

/** Empty per-kind tally. */
function zeroByKind() {
    /** @type {Record<string, {tsOnly:number, tmOnly:number, matched:number}>} */
    const o = {};
    for (const k of KINDS) o[k] = { tsOnly: 0, tmOnly: 0, matched: 0 };
    return o;
}

/**
 * Run one variant (fork or upstream) over a corpus and accumulate stats.
 *
 * @param {string} variantLabel
 * @param {any} TreeSitter
 * @param {{block:any,inline:any}} grammars
 * @param {vsctm.Registry} registry
 * @param {{name:string, samples:{id:string,text:string,section:string}[]}} corpus
 * @param {{collectExamples?: number}} [opts]
 */
async function runVariant(variantLabel, TreeSitter, grammars, registry, corpus, opts = {}) {
    const byKind = zeroByKind();
    let fullParity = 0;
    let totalMatched = 0;
    let totalTsOnly = 0;
    let totalTmOnly = 0;
    /** @type {{id:string, section:string, text:string, tsOnly:Region[], tmOnly:Region[]}[]} */
    const divergent = [];
    const collectN = opts.collectExamples ?? 12;

    for (const sample of corpus.samples) {
        let ts, tm;
        try {
            ts = tsMarkdownRegions(TreeSitter, grammars, sample.text);
            tm = await tmMarkdownRegions(registry, sample.text);
        } catch (e) {
            console.warn(`  [${variantLabel}] ${sample.id} errored: ${e.message}`);
            continue;
        }
        const cmp = compare(ts, tm);
        totalMatched += cmp.matched.length;
        totalTsOnly += cmp.tsOnly.length;
        totalTmOnly += cmp.tmOnly.length;
        for (const m of cmp.matched) byKind[m.ts.kind].matched++;
        for (const r of cmp.tsOnly) byKind[r.kind].tsOnly++;
        for (const r of cmp.tmOnly) byKind[r.kind].tmOnly++;
        if (cmp.tsOnly.length === 0 && cmp.tmOnly.length === 0) {
            fullParity++;
        } else if (divergent.length < collectN) {
            divergent.push({
                id: sample.id,
                section: sample.section,
                text: sample.text,
                tsOnly: cmp.tsOnly,
                tmOnly: cmp.tmOnly,
            });
        }
    }

    return {
        variantLabel,
        total: corpus.samples.length,
        fullParity,
        totalMatched,
        totalTsOnly,
        totalTmOnly,
        byKind,
        divergent,
    };
}

/** @param {ReturnType<typeof zeroByKind>} byKind */
function rankedDivergenceRows(byKind) {
    return Object.entries(byKind)
        .map(([kind, v]) => ({ kind, ...v, div: v.tsOnly + v.tmOnly }))
        .filter((r) => r.div > 0 || r.matched > 0)
        .sort((a, b) => b.div - a.div);
}

// ════════════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════════════

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (name, dflt) => {
        const a = args.find((x) => x.startsWith(`--${name}=`));
        return a ? a.split('=')[1] : dflt;
    };
    const has = (name) => args.includes(`--${name}`);
    return {
        corpora: (get('corpus', 'commonmark') || '').split(',').map((s) => s.trim()).filter(Boolean),
        limit: get('limit', null) ? Number(get('limit')) : null,
        upstreamOnly: has('upstream-only'),
        noUpstream: has('no-upstream'),
        collect: get('collect', null) ? Number(get('collect')) : 12,
    };
}

export const CORPUS_LOADERS = {
    commonmark: loadCommonMark,
    gfm: loadGfm,
    fuzzer: () => loadFuzzer({ count: 300 }),
    real: loadRealWorld,
};

async function main() {
    const opts = parseArgs();
    console.log('Markdown grammar parity bench (TextMate vs tree-sitter)\n');

    const TreeSitter = loadParserClass();
    const registry = await loadRegistry();

    const forkGrammars = loadForkGrammars();
    const upstreamGrammars = opts.noUpstream ? null : loadUpstreamGrammars();

    const variants = [];
    if (!opts.upstreamOnly) variants.push(['FORK', forkGrammars]);
    if (upstreamGrammars) variants.push(['UPSTREAM', upstreamGrammars]);
    if (variants.length === 0) {
        console.error('No grammar variants available to run.');
        process.exit(1);
    }

    const reportLines = [
        '# Markdown grammar parity report',
        '',
        `Generated by \`scripts/parity-markdown.mjs\` on ${new Date().toISOString()}.`,
        '',
        'Compares how the SvelTeX **TextMate** grammar and the **tree-sitter**',
        'markdown stack tokenize markdown, over large corpora. Kinds compared:',
        '',
        Array.from(KINDS, (k) => `\`${k}\``).join(', ') + '.',
        '',
        '- `matched` — both systems tag an overlapping range with the same kind.',
        '- `ts-only` — tree-sitter found the construct; TextMate did not.',
        '- `tm-only` — TextMate found the construct; tree-sitter did not.',
        '',
        '**FORK** = `@nvl/tree-sitter-markdown-sveltex` (indented code disabled;',
        `digit-emphasis fixed). **UPSTREAM** = clean \`tree-sitter-markdown@${UPSTREAM_REV}\`.`,
        '',
        '<!-- OVERVIEW -->',
        '',
    ];

    /** @type {string[]} Cross-corpus headline rows, spliced in at <!-- OVERVIEW -->. */
    const overviewRows = [];

    for (const corpusKey of opts.corpora) {
        const loader = CORPUS_LOADERS[corpusKey];
        if (!loader) {
            console.warn(`Unknown corpus "${corpusKey}", skipping.`);
            continue;
        }
        console.log(`\n━━ Corpus: ${corpusKey} ━━`);
        let corpus = loader();
        if (opts.limit) {
            corpus = { ...corpus, samples: corpus.samples.slice(0, opts.limit) };
        }
        console.log(`  ${corpus.name}: ${corpus.samples.length} samples`);

        reportLines.push(`## Corpus: ${corpus.name}`);
        reportLines.push('');
        reportLines.push(`${corpus.samples.length} samples.`);
        reportLines.push('');

        /** @type {Record<string, Awaited<ReturnType<typeof runVariant>>>} */
        const results = {};
        for (const [label, grammars] of variants) {
            const res = await runVariant(label, TreeSitter, grammars, registry, corpus, { collectExamples: opts.collect });
            results[label] = res;
            const pct = ((res.fullParity / res.total) * 100).toFixed(1);
            console.log(
                `  ${label.padEnd(9)} full-parity ${res.fullParity}/${res.total} (${pct}%)  ` +
                `matched=${res.totalMatched} ts-only=${res.totalTsOnly} tm-only=${res.totalTmOnly}`,
            );
        }

        // Cross-corpus overview rows (one per variant per corpus).
        for (const [label] of variants) {
            const r = results[label];
            const pct = ((r.fullParity / r.total) * 100).toFixed(1);
            overviewRows.push(
                `| ${corpus.name} | ${label} | ${r.fullParity}/${r.total} (${pct}%) | ${r.totalMatched} | ${r.totalTsOnly} | ${r.totalTmOnly} |`,
            );
        }

        // Summary table across variants.
        reportLines.push('### Parity summary');
        reportLines.push('');
        reportLines.push('| Variant | Full parity | matched | ts-only | tm-only |');
        reportLines.push('| --- | --- | --- | --- | --- |');
        for (const [label] of variants) {
            const r = results[label];
            const pct = ((r.fullParity / r.total) * 100).toFixed(1);
            reportLines.push(
                `| ${label} | ${r.fullParity}/${r.total} (${pct}%) | ${r.totalMatched} | ${r.totalTsOnly} | ${r.totalTmOnly} |`,
            );
        }
        reportLines.push('');

        // Per-kind divergence breakdown for each variant.
        for (const [label] of variants) {
            const r = results[label];
            reportLines.push(`### ${label}: divergences by kind`);
            reportLines.push('');
            reportLines.push('| Kind | matched | ts-only | tm-only |');
            reportLines.push('| --- | --- | --- | --- |');
            for (const row of rankedDivergenceRows(r.byKind)) {
                reportLines.push(
                    `| \`${row.kind}\` | ${row.matched} | ${row.tsOnly} | ${row.tmOnly} |`,
                );
            }
            reportLines.push('');
        }

        // Drill-down: top divergent examples for the *fork* (or first variant).
        const drillLabel = results['FORK'] ? 'FORK' : variants[0][0];
        const drill = results[drillLabel];
        reportLines.push(`### ${drillLabel}: top divergent examples`);
        reportLines.push('');
        if (drill.divergent.length === 0) {
            reportLines.push('_None — full parity on every sample._');
            reportLines.push('');
        }
        for (const ex of drill.divergent) {
            reportLines.push(`<details><summary><code>${ex.id}</code> (${ex.section}) — ${ex.tsOnly.length} ts-only, ${ex.tmOnly.length} tm-only</summary>`);
            reportLines.push('');
            // Cap the embedded source: real-world samples are whole READMEs, and
            // the raw markdown would both bloat the report and (via its own `#`
            // headings / ``` fences) corrupt the document outline. Use a `~~~`
            // fence so embedded triple-backticks don't break out.
            const MAX_CHARS = 1200;
            let body = ex.text.replace(/\n+$/, '');
            if (body.length > MAX_CHARS) {
                body = body.slice(0, MAX_CHARS) + `\n… [truncated, ${ex.text.length} chars total]`;
            }
            reportLines.push('~~~markdown');
            reportLines.push(body);
            reportLines.push('~~~');
            reportLines.push('');
            // Cap the per-example region listing too (a single README can
            // diverge in hundreds of spots).
            const MAX_REGIONS = 40;
            if (ex.tsOnly.length) {
                reportLines.push(`**ts-only** (${ex.tsOnly.length}):`);
                for (const x of ex.tsOnly.slice(0, MAX_REGIONS)) reportLines.push(`- ${summariseRegion(x)}`);
                if (ex.tsOnly.length > MAX_REGIONS) reportLines.push(`- … and ${ex.tsOnly.length - MAX_REGIONS} more`);
                reportLines.push('');
            }
            if (ex.tmOnly.length) {
                reportLines.push(`**tm-only** (${ex.tmOnly.length}):`);
                for (const x of ex.tmOnly.slice(0, MAX_REGIONS)) reportLines.push(`- ${summariseRegion(x)}`);
                if (ex.tmOnly.length > MAX_REGIONS) reportLines.push(`- … and ${ex.tmOnly.length - MAX_REGIONS} more`);
                reportLines.push('');
            }
            reportLines.push('</details>');
            reportLines.push('');
        }
    }

    // Splice the cross-corpus overview table into the header placeholder.
    const overview = [
        '## Overview',
        '',
        '| Corpus | Variant | Full parity | matched | ts-only | tm-only |',
        '| --- | --- | --- | --- | --- | --- |',
        ...overviewRows,
    ];
    const out = reportLines
        .join('\n')
        .replace('<!-- OVERVIEW -->', overview.join('\n'));
    writeFileSync(REPORT_PATH, out);
    console.log(`\nReport written to ${relative(process.cwd(), REPORT_PATH)}`);
}

// Only run the full bench when executed directly (`node parity-markdown.mjs`),
// not when imported for its tokenizer/classifier exports (e.g. by
// `parity-markdown-html.mjs`, which reuses the shared pieces above so the
// coloured HTML report and the numeric report can never disagree on kinds).
if (
    process.argv[1] &&
    fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
