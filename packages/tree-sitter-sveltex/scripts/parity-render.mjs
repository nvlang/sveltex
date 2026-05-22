#!/usr/bin/env node
/**
 * Renders every `parity-fixtures/*.sveltex` document twice — once with
 * tree-sitter highlighting, once with TextMate highlighting — into a
 * static HTML report, so feature parity (or gaps) can be inspected
 * visually.
 *
 * Output: `parity-fixtures.html` in the package root. Each fixture gets
 * a three-column section: source text, tree-sitter colouring, TextMate
 * colouring, plus a short explanation of every `ts-only` / `tm-only`
 * region the parity bench reported. Same colour in both columns = the
 * grammars agree on the kind. Different colour (or grey = unclassified)
 * = a divergence the bench flagged.
 *
 * Run:    pnpm parity:render
 * Output: parity-fixtures.html  (open in any browser)
 *
 * This script intentionally reuses `parity.mjs`'s classifiers so the
 * coloured output and the numeric report can never disagree on what
 * counts as "math" vs "verbatim-tex-body" vs "mustache-body" etc.
 */

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
const OUT_PATH = join(PACKAGE_ROOT, 'parity-fixtures.html');

// Same parity vocabulary as `parity.mjs`, in a fixed order so the legend
// reads naturally. The colour palette is consistent across both grammars
// — same kind = same colour everywhere — so a region looking different
// between the two columns is exactly the bench's "divergence".
const PALETTE = {
    frontmatter: { bg: '#fff7d6', fg: '#5b4500', label: 'frontmatter' },
    math: { bg: '#dcefff', fg: '#0a4d8c', label: 'math' },
    'verbatim-tex-body': { bg: '#d6f5e3', fg: '#0d5b32', label: 'verbatim-tex' },
    'verbatim-plain-body': { bg: '#eaeaea', fg: '#444', label: 'verbatim-plain' },
    'mustache-body': { bg: '#f4dffb', fg: '#5d1d6b', label: 'mustache' },
    'block-tag': { bg: '#ffe3d6', fg: '#7a2c00', label: 'block-tag' },
};

// ── Classifiers (copy of parity.mjs) ──────────────────────────────────────

function classifyTsNode(type) {
    if (type === 'frontmatter_content') return 'frontmatter';
    if (type.startsWith('math_content_')) return 'math';
    if (type === 'math_delimiter') return 'math';
    if (type === 'tex_verbatim_body') return 'verbatim-tex-body';
    if (type === 'plain_verbatim_body') return 'verbatim-plain-body';
    if (type === 'svelte_expression_body') return 'mustache-body';
    if (type === 'svelte_each_iterable') return 'mustache-body';
    if (type === 'svelte_each_binding') return 'mustache-body';
    if (type === 'svelte_each_index') return 'mustache-body';
    if (type === 'svelte_each_key') return 'mustache-body';
    if (type === 'svelte_snippet_params') return 'mustache-body';
    if (type === 'svelte_await_promise') return 'mustache-body';
    if (type === 'svelte_await_binding') return 'mustache-body';
    if (type === 'svelte_block_tag') return 'block-tag';
    if (type === 'svelte_each_as') return 'block-tag';
    if (type === 'svelte_await_keyword') return 'block-tag';
    return null;
}

function classifyTmScopes(scopes) {
    const has = (re) => scopes.some((s) => re.test(s));
    if (has(/\bmeta\.embedded\.(block\.)?(yaml|toml|json|frontmatter)/)) return 'frontmatter';
    if (has(/\bmeta\.math\b/)) return 'math';
    if (has(/\bmeta\.embedded\.block\.latex\b/)) return 'verbatim-tex-body';
    if (has(/\bmeta\.verbatim\.body\.plain|verbatim-plain/)) return 'verbatim-plain-body';
    if (has(/\bmeta\.embedded\.expression\.svelte\b/)) return 'mustache-body';
    // Block-tag delimiters / keywords — only count `punctuation.section.
    // embedded.*` as block-tag when the scope chain is inside a
    // `meta.special.*.svelte` container; otherwise it's just a plain
    // mustache `{` / `}`.
    if (has(/\bmeta\.special\.\w+\.svelte\b/)) {
        if (has(/\b(keyword|storage\.type)\..*\bsvelte\b/)) return 'block-tag';
        if (has(/\bpunctuation\.(definition\.keyword|section\.embedded\.(begin|end))\..*\bsvelte\b/)) return 'block-tag';
    }
    return null;
}

// ── Tokenization ──────────────────────────────────────────────────────────

/**
 * Returns a per-byte classification array (length = source.length). Each
 * entry is the kind string for that byte, or null if the byte is
 * unclassified.
 */
function bytewiseTs(source) {
    const parser = new Parser();
    parser.setLanguage(Sveltex);
    const tree = parser.parse(source);
    const out = new Array(source.length).fill(null);
    const walk = (node) => {
        const kind = classifyTsNode(node.type);
        if (kind) {
            for (let i = node.startIndex; i < node.endIndex; i++) {
                // First (outer) classification wins, then inner nodes
                // overwrite — so a more-specific inner node like
                // `svelte_expression_body` shows through `svelte_block_tag`.
                // Outer-first ensures the parent doesn't blanket-erase the
                // inner classification.
                out[i] = kind;
            }
        }
        for (let i = 0; i < node.namedChildCount; i++) {
            walk(node.namedChild(i));
        }
    };
    walk(tree.rootNode);
    return out;
}

async function bytewiseTm(registry, source) {
    const grammar = await registry.loadGrammar('source.sveltex');
    if (!grammar) throw new Error('Failed to load source.sveltex grammar');
    const out = new Array(source.length).fill(null);
    let ruleStack = vsctm.INITIAL;
    let offset = 0;
    for (const line of source.split(/(?<=\n)/)) {
        // Strip the trailing newline before tokenizing — feeding the `\n`
        // breaks vscode-textmate's `$`/`while` anchoring (lists never
        // terminate). `line.length` (with the `\n`) still drives the offset.
        const lineText = line.replace(/\r?\n$/, '');
        const { tokens, ruleStack: next } = grammar.tokenizeLine(lineText, ruleStack);
        ruleStack = next;
        for (const token of tokens) {
            const kind = classifyTmScopes(token.scopes);
            if (kind) {
                const stop = Math.min(token.endIndex, lineText.length);
                for (let i = token.startIndex; i < stop; i++) {
                    out[offset + i] = kind;
                }
            }
        }
        offset += line.length;
    }
    return out;
}

// ── Registry (with external grammar stubs, same as parity.mjs) ────────────

async function loadRegistry() {
    const wasm = readFileSync(
        resolve(PACKAGE_ROOT, 'node_modules/vscode-oniguruma/release/onig.wasm'),
    ).buffer;
    await oniguruma.loadWASM(wasm);

    // `source.svelte` comes from `docs/misc/svelte.tmLanguage.json`,
    // vendored from upstream and refreshed weekly by the
    // `vendor-update` workflow — so block tags / mustache / interpolation
    // tokenise through the real Svelte grammar rather than a stub.
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
    const externalScopes = [
        'source.yaml', 'source.toml', 'source.json',
        'source.js', 'source.ts', 'source.css', 'source.css.scss',
        'source.sass', 'source.css.postcss', 'source.stylus',
        'text.tex.latex', 'text.html.basic', 'text.html.derivative',
    ];
    const stub = (scope) =>
        vsctm.parseRawGrammar(
            JSON.stringify({ scopeName: scope, patterns: [] }),
            `${scope}.stub.json`,
        );

    return new vsctm.Registry({
        onigLib: Promise.resolve({
            createOnigScanner: (s) => new oniguruma.OnigScanner(s),
            createOnigString: (s) => new oniguruma.OnigString(s),
        }),
        loadGrammar: async (scope) => {
            const path = grammarFiles[scope];
            if (path) {
                const text = readFileSync(path, 'utf-8');
                const raw = path.endsWith('.json')
                    ? JSON.parse(text)
                    : jsYaml.load(text);
                // Always end filename in `.json` so vscode-textmate
                // parses JSON, not PLIST.
                return vsctm.parseRawGrammar(
                    JSON.stringify(raw),
                    path.endsWith('.json') ? path : `${path}.json`,
                );
            }
            if (externalScopes.includes(scope)) return stub(scope);
            return null;
        },
    });
}

// ── HTML rendering ────────────────────────────────────────────────────────

/** Wraps the source text in `<span class="kind-X">` runs from a per-byte
 *  kind array. Adjacent same-kind bytes are merged into one span. */
function renderColoured(source, kinds) {
    const parts = [];
    let current = { kind: kinds[0], chars: [] };
    const flush = () => {
        if (!current.chars.length) return;
        const text = escapeHtml(current.chars.join(''));
        if (current.kind) {
            const palette = PALETTE[current.kind];
            parts.push(
                `<span class="kind ${cssClass(current.kind)}" data-kind="${current.kind}" style="background:${palette.bg};color:${palette.fg}">${text}</span>`,
            );
        } else {
            parts.push(text);
        }
    };
    for (let i = 0; i < source.length; i++) {
        const k = kinds[i];
        if (k !== current.kind) {
            flush();
            current = { kind: k, chars: [] };
        }
        current.chars.push(source[i]);
    }
    flush();
    return parts.join('');
}

function cssClass(kind) {
    return 'k-' + kind.replace(/[^a-z0-9]/gi, '-');
}

function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function divergenceList(tsKinds, tmKinds, source) {
    /** @type {{start: number, end: number, ts: string|null, tm: string|null}[]} */
    const out = [];
    let i = 0;
    while (i < source.length) {
        if (tsKinds[i] === tmKinds[i]) {
            i++;
            continue;
        }
        const start = i;
        while (
            i < source.length &&
            tsKinds[i] !== tmKinds[i] &&
            tsKinds[i] === tsKinds[start] &&
            tmKinds[i] === tmKinds[start]
        ) {
            i++;
        }
        out.push({ start, end: i, ts: tsKinds[start], tm: tmKinds[start] });
    }
    return out;
}

function divergenceWhy(d) {
    // Heuristic plain-English explanation per divergence pair.
    if (d.ts && !d.tm) {
        const reasons = {
            frontmatter: 'TextMate frontmatter pattern requires `source.yaml`/`toml`/`json` to resolve — in a bench without those, the body shows unclassified.',
            math: 'Per-byte boundary mismatch inside a math span (e.g. tree-sitter splits delimiter from content; TM uses one continuous `meta.math.*` scope).',
            'verbatim-tex-body': 'TextMate normally tags `<tex>` bodies as `meta.embedded.block.latex`. Likely a per-character gap in the TM tokeniser.',
            'verbatim-plain-body': 'The TextMate grammar has no dedicated scope for `<verbatim>` bodies; left as plain text.',
            'mustache-body': 'TM via `source.svelte` did not inject here — usually because a Markdown construct (e.g. a list-item paragraph) absorbed the line first. Tree-sitter parses these top-level.',
            'block-tag': 'TM via `source.svelte` did not inject here — typically a Markdown list / paragraph swallowed the line before `source.svelte#special-tags` could fire. Tree-sitter parses these top-level so it picks them up regardless.',
        };
        return reasons[d.ts] ?? '';
    }
    if (d.tm && !d.ts) {
        const reasons = {
            math: 'TextMate carries the `meta.math.*` scope across a leading/trailing newline that tree-sitter excludes from `math_content_*`; both grammars colour the delimiters as math.',
            'verbatim-tex-body': 'TextMate scopes the `<tex>` / `</tex>` tags inside the latex meta scope; tree-sitter scopes only the body.',
            frontmatter: 'Boundary mismatch: tree-sitter excludes the `\\n` between fence and body from `frontmatter_content`, TextMate includes it (or vice-versa). The `---` fences are *not* scoped under frontmatter by either grammar.',
        };
        return reasons[d.tm] ?? '';
    }
    if (d.ts && d.tm) {
        return `Both grammars classify these bytes but disagree on the kind — likely a classifier-mapping bug in the bench.`;
    }
    return '';
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
    const fixtures = readdirSync(FIXTURES_DIR)
        .filter((f) => f.endsWith('.sveltex'))
        .sort();
    const registry = await loadRegistry();

    /** @type {string[]} */
    const sections = [];
    let totalMatched = 0, totalDivergent = 0;

    for (const fixture of fixtures) {
        const source = readFileSync(join(FIXTURES_DIR, fixture), 'utf-8');
        const ts = bytewiseTs(source);
        const tm = await bytewiseTm(registry, source);
        const divergences = divergenceList(ts, tm, source);
        const matchedBytes = source.length - divergences.reduce((a, d) => a + (d.end - d.start), 0);
        totalMatched += matchedBytes;
        totalDivergent += source.length - matchedBytes;

        const tsHtml = renderColoured(source, ts);
        const tmHtml = renderColoured(source, tm);

        const divRows = divergences.map((d) => {
            const slice = escapeHtml(source.slice(d.start, d.end).replace(/\n/g, '↵'));
            const ts = d.ts ? `<span class="kind ${cssClass(d.ts)}" style="background:${PALETTE[d.ts].bg};color:${PALETTE[d.ts].fg}">${d.ts}</span>` : '<em>—</em>';
            const tm = d.tm ? `<span class="kind ${cssClass(d.tm)}" style="background:${PALETTE[d.tm].bg};color:${PALETTE[d.tm].fg}">${d.tm}</span>` : '<em>—</em>';
            return `<tr><td><code>${d.start}–${d.end}</code></td><td><code>${slice}</code></td><td>${ts}</td><td>${tm}</td><td>${divergenceWhy(d)}</td></tr>`;
        }).join('');

        sections.push(`
<section>
  <h2>${escapeHtml(fixture)}</h2>
  <p class="summary">${matchedBytes}/${source.length} bytes agree (${(100 * matchedBytes / source.length).toFixed(1)}%); ${divergences.length} divergent regions.</p>
  <div class="grid">
    <div><h3>source</h3><pre>${escapeHtml(source)}</pre></div>
    <div><h3>tree-sitter</h3><pre>${tsHtml}</pre></div>
    <div><h3>TextMate</h3><pre>${tmHtml}</pre></div>
  </div>
  ${divergences.length ? `<details><summary>Divergences (${divergences.length})</summary>
    <table>
      <thead><tr><th>bytes</th><th>text</th><th>tree-sitter</th><th>TextMate</th><th>why</th></tr></thead>
      <tbody>${divRows}</tbody>
    </table>
  </details>` : ''}
</section>`);
    }

    const legend = Object.entries(PALETTE).map(
        ([k, p]) => `<span class="kind" style="background:${p.bg};color:${p.fg}">${p.label}</span>`,
    ).join(' ');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SvelTeX grammar parity</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 1400px; margin: 2em auto; padding: 0 1em; color: #222; }
  h1 { margin-bottom: 0; }
  .legend { margin: 1em 0 2em; }
  .kind { padding: 1px 4px; border-radius: 3px; font-size: 0.95em; }
  section { border-top: 1px solid #ddd; padding-top: 1.5em; margin-top: 2em; }
  .summary { color: #666; font-style: italic; margin: 0 0 1em; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1em; }
  .grid h3 { margin: 0 0 0.4em; font-size: 0.95em; color: #666; font-weight: 600; }
  pre { background: #fafafa; padding: 0.8em; border: 1px solid #eee; border-radius: 4px; font-size: 13px; line-height: 1.5; overflow-x: auto; margin: 0; white-space: pre-wrap; }
  details { margin-top: 1em; }
  summary { cursor: pointer; font-weight: 600; padding: 0.4em 0; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 0.5em; }
  th, td { border: 1px solid #eee; padding: 0.4em 0.6em; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; font-weight: 600; }
  code { background: #f0f0f0; padding: 1px 3px; border-radius: 2px; font-size: 12px; }
  .totals { background: #f4f4f4; padding: 0.8em 1em; border-radius: 4px; margin-top: 2em; }
</style>
</head>
<body>
<h1>SvelTeX grammar parity</h1>
<p>Generated by <code>scripts/parity-render.mjs</code> on ${new Date().toISOString()}.</p>
<p>For each fixture, the source is rendered three times: plain, with tree-sitter's classification, and with the SvelTeX TextMate grammar's classification. <strong>Same colour in both columns = the grammars agree.</strong> Different colour (or grey vs coloured) = a divergence.</p>
<div class="legend"><strong>Legend:</strong> ${legend}</div>
${sections.join('\n')}
<div class="totals"><strong>Totals:</strong> ${totalMatched.toLocaleString()} bytes agree, ${totalDivergent.toLocaleString()} bytes diverge across ${fixtures.length} fixtures.</div>
</body>
</html>`;

    writeFileSync(OUT_PATH, html);
    console.log(`Wrote ${relative(process.cwd(), OUT_PATH)} (${fixtures.length} fixtures, ${totalMatched} matched bytes, ${totalDivergent} divergent bytes).`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
