#!/usr/bin/env node
/**
 * Browser-readable HTML companion to `parity-markdown.mjs`.
 *
 * Where `parity-markdown.mjs` emits a numeric Markdown report, this script
 * renders every divergent corpus example as **three side-by-side panels —
 * TextMate │ Fork │ Upstream** — each showing the example's source as
 * syntax-highlighted code, coloured by the shared parity *kind* taxonomy
 * (emphasis, strong, code-*, heading, link, html-*, …). The palette is shared:
 * the same kind is the same colour in all three panels, so if TextMate colours
 * a span `emphasis` but tree-sitter leaves it plain, the columns visibly differ
 * at a glance.
 *
 * It deliberately REUSES `parity-markdown.mjs`'s tokenizers and classifiers
 * (imported, not re-derived) so the coloured HTML and the numeric `.md` report
 * can never disagree on what counts as which kind.
 *
 * ── Two phases (so HTML iteration is cheap) ────────────────────────────────
 * Tokenizing all corpora takes a while. To make tweaking the HTML free, the
 * run is split:
 *   1. DUMP   — tokenize every example with all three grammars and write the
 *               per-example data (source + each grammar's regions) to a JSON
 *               cache at `.parity-cache/markdown-html-data.json`.
 *   2. RENDER — read that JSON and build the HTML. No tokenization.
 * By default both run. `--render-only` skips the dump and reuses the cache (the
 * fast path while iterating on layout/CSS). `--dump` / `--refresh` forces a
 * re-tokenize.
 *
 * ── Readability ────────────────────────────────────────────────────────────
 * The report does NOT dump all ~1600 examples flat. It DEFAULTS to showing only
 * examples where TextMate and the Fork disagree, grouped into collapsible
 * per-corpus sections, with an overview stats table and a top nav. A small
 * inline-JS toggle reveals the full-parity examples on demand. Single
 * self-contained file (inline CSS + JS, no external resources): a reader can
 * jump between corpora and the overview, and the toggle works globally.
 *
 * Run:    node scripts/parity-markdown-html.mjs
 *             [--corpus=commonmark,gfm,fuzzer,real]
 *             [--limit=N] [--render-only] [--dump] [--no-upstream]
 *             [--all]   (also embed full-parity examples; default omits them)
 * Output: parity-markdown-report.html (in the package root)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    CORPUS_LOADERS,
    KINDS,
    compare,
    loadForkGrammars,
    loadParserClass,
    loadRegistry,
    loadUpstreamGrammars,
    tmMarkdownRegions,
    tsMarkdownRegions,
} from './parity-markdown.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, '..');
const REPORT_PATH = join(PACKAGE_ROOT, 'parity-markdown-report.html');
const CACHE_DIR = join(PACKAGE_ROOT, '.parity-cache');
const DATA_PATH = join(CACHE_DIR, 'markdown-html-data.json');

// ── Shared palette ─────────────────────────────────────────────────────────
//
// One readable colour/style per parity kind. The SAME kind renders identically
// in all three panels, so a span TextMate colours but tree-sitter doesn't (or
// vice-versa) jumps out as a column-to-column colour difference. `fg`/`bg` are
// the run colours; `style` is extra CSS for the run (italic, bold, …).

/** @type {Record<string, { fg: string, bg: string, style?: string, label: string }>} */
const PALETTE = {
    emphasis: { fg: '#1a7f37', bg: '#dafbe1', style: 'font-style:italic', label: 'emphasis' },
    strong: { fg: '#bc4c00', bg: '#fff1e5', style: 'font-weight:700', label: 'strong' },
    'code-inline': { fg: '#a0111f', bg: '#fff0f0', style: 'font-family:ui-monospace,monospace', label: 'code-inline' },
    'code-fenced': { fg: '#7d2200', bg: '#fbece1', style: 'font-family:ui-monospace,monospace', label: 'code-fenced' },
    'code-indented': { fg: '#6a4a00', bg: '#fbf3da', style: 'font-family:ui-monospace,monospace', label: 'code-indented' },
    heading: { fg: '#0550ae', bg: '#ddf4ff', style: 'font-weight:700', label: 'heading' },
    'list-marker': { fg: '#6639ba', bg: '#f3eefb', style: 'font-weight:700', label: 'list-marker' },
    blockquote: { fg: '#57606a', bg: '#eef1f4', style: 'font-style:italic', label: 'blockquote' },
    link: { fg: '#0969da', bg: '#ddf4ff', style: 'text-decoration:underline', label: 'link' },
    image: { fg: '#0a7ea3', bg: '#d7f3fb', style: 'text-decoration:underline dotted', label: 'image' },
    'html-tag': { fg: '#8250df', bg: '#f3eefb', label: 'html-tag' },
    'html-block': { fg: '#5a2a9e', bg: '#ece2fb', label: 'html-block' },
    'thematic-break': { fg: '#82071e', bg: '#ffe2e0', label: 'thematic-break' },
    strikethrough: { fg: '#6e7781', bg: '#f0f1f3', style: 'text-decoration:line-through', label: 'strikethrough' },
};

const PANELS = /** @type {const} */ ([
    { key: 'tm', label: 'TextMate' },
    { key: 'fork', label: 'Fork (tree-sitter)' },
    { key: 'upstream', label: 'Upstream (tree-sitter)' },
]);

// ════════════════════════════════════════════════════════════════════════════
// Phase 1 — dump per-example regions to JSON
// ════════════════════════════════════════════════════════════════════════════

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (/** @type {string} */ name, /** @type {any} */ dflt) => {
        const a = args.find((x) => x.startsWith(`--${name}=`));
        return a ? a.split('=')[1] : dflt;
    };
    const has = (/** @type {string} */ name) => args.includes(`--${name}`);
    return {
        corpora: (get('corpus', 'commonmark,gfm,fuzzer,real') || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        limit: get('limit', null) ? Number(get('limit')) : null,
        renderOnly: has('render-only'),
        forceDump: has('dump') || has('refresh'),
        noUpstream: has('no-upstream'),
        all: has('all'),
    };
}

/**
 * Tokenize every example in every requested corpus with all available grammars
 * and return a plain-JSON-serialisable structure.
 *
 * @param {ReturnType<typeof parseArgs>} opts
 */
async function dumpData(opts) {
    console.log('Tokenizing corpora (TextMate + tree-sitter fork/upstream) …');
    const TreeSitter = loadParserClass();
    const registry = await loadRegistry();
    const forkGrammars = loadForkGrammars();
    const upstreamGrammars = opts.noUpstream ? null : loadUpstreamGrammars();
    if (!upstreamGrammars) {
        console.warn('  (upstream grammar unavailable — its column will be empty)');
    }

    /** @type {any} */
    const data = {
        generatedAt: new Date().toISOString(),
        kinds: KINDS,
        hasUpstream: Boolean(upstreamGrammars),
        corpora: [],
    };

    for (const corpusKey of opts.corpora) {
        const loader = CORPUS_LOADERS[corpusKey];
        if (!loader) {
            console.warn(`  unknown corpus "${corpusKey}", skipping.`);
            continue;
        }
        let corpus = loader();
        if (opts.limit) {
            corpus = { ...corpus, samples: corpus.samples.slice(0, opts.limit) };
        }
        console.log(`  ${corpusKey}: ${corpus.samples.length} samples …`);

        const examples = [];
        for (const sample of corpus.samples) {
            /** @type {any} */
            let tm, fork, upstream;
            try {
                tm = await tmMarkdownRegions(registry, sample.text);
                fork = tsMarkdownRegions(TreeSitter, forkGrammars, sample.text);
                upstream = upstreamGrammars
                    ? tsMarkdownRegions(TreeSitter, upstreamGrammars, sample.text)
                    : [];
            } catch (e) {
                console.warn(`    ${sample.id} errored: ${e.message}`);
                continue;
            }
            // Pairwise compare TM vs fork (the headline question: what does the
            // SvelTeX TM grammar disagree with the shipped fork on?).
            const cmpFork = compare(fork, tm);
            const divergent =
                cmpFork.tsOnly.length > 0 || cmpFork.tmOnly.length > 0;
            examples.push({
                id: sample.id,
                section: sample.section,
                text: sample.text,
                regions: {
                    // Store origin as a compact string: TM origins are scope
                    // arrays (keep the last 2 — the most specific), tree-sitter
                    // origins are a single node-type string.
                    tm: tm.map(packRegion),
                    fork: fork.map(packRegion),
                    upstream: upstream.map(packRegion),
                },
                divergent,
            });
        }

        data.corpora.push({
            key: corpusKey,
            name: corpus.name,
            total: corpus.samples.length,
            examples,
        });
    }

    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(DATA_PATH, JSON.stringify(data));
    console.log(
        `  cached ${data.corpora.reduce((a, c) => a + c.examples.length, 0)} ` +
            `examples to ${relative(process.cwd(), DATA_PATH)}`,
    );
    return data;
}

/** @param {{kind: string|null, start: number, end: number, origin: any}} r */
function packRegion(r) {
    let origin;
    if (Array.isArray(r.origin)) {
        // TM scope chain: keep the two most-specific scopes for the tooltip.
        origin = r.origin.slice(-2).join(' › ');
    } else {
        origin = String(r.origin ?? '');
    }
    return { k: r.kind, s: r.start, e: r.end, o: origin };
}

// ════════════════════════════════════════════════════════════════════════════
// Phase 2 — render HTML from the JSON cache
// ════════════════════════════════════════════════════════════════════════════

/** @param {string} s */
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** @param {string} kind */
function cssClass(kind) {
    return 'k-' + kind.replace(/[^a-z0-9]/gi, '-');
}

/**
 * Build a per-character classification from a region list. On overlap the
 * INNERMOST (narrowest) region wins: we paint widest-first so narrower regions
 * overwrite. Returns two parallel arrays of length `len`: the kind per char and
 * the origin (underlying node/scope) per char.
 *
 * @param {{k: string|null, s: number, e: number, o: string}[]} regions
 * @param {number} len
 */
function perCharKinds(regions, len) {
    const kinds = /** @type {(string|null)[]} */ (new Array(len).fill(null));
    const origins = /** @type {(string|null)[]} */ (new Array(len).fill(null));
    // Paint widest spans first so the narrowest (most specific) region wins.
    const sorted = regions
        .filter((r) => r.k)
        .slice()
        .sort((a, b) => b.e - b.s - (a.e - a.s));
    for (const r of sorted) {
        for (let i = r.s; i < r.e && i < len; i++) {
            kinds[i] = r.k;
            origins[i] = r.o;
        }
    }
    return { kinds, origins };
}

/**
 * Render `source` as HTML, colouring each run by its kind. A run is also
 * flagged `divergent` when its kind differs from at least one of the
 * `otherKinds` panels at the same character — that paints a dotted underline +
 * tint so divergences are easy to spot column-to-column.
 *
 * @param {string} source
 * @param {{kinds:(string|null)[], origins:(string|null)[]}} self
 * @param {(string|null)[][]} otherKinds  per-char kind arrays for the OTHER panels
 */
function renderPanel(source, self, otherKinds) {
    const { kinds, origins } = self;
    const len = source.length;
    /** @param {number} i */
    const diverges = (i) => otherKinds.some((ok) => (ok[i] ?? null) !== (kinds[i] ?? null));

    const parts = [];
    let i = 0;
    while (i < len) {
        const kind = kinds[i];
        const origin = origins[i];
        const div = diverges(i);
        let j = i + 1;
        while (
            j < len &&
            kinds[j] === kind &&
            origins[j] === origin &&
            diverges(j) === div
        ) {
            j++;
        }
        const text = escapeHtml(source.slice(i, j));
        const classes = [];
        if (kind) classes.push('k', cssClass(kind));
        if (div) classes.push('div');
        if (classes.length) {
            const title = origin
                ? ` title="${escapeHtml(origin)}"`
                : div
                  ? ' title="divergent: differs from another panel here"'
                  : '';
            parts.push(`<span class="${classes.join(' ')}"${title}>${text}</span>`);
        } else {
            parts.push(text);
        }
        i = j;
    }
    return parts.join('');
}

/**
 * One-line per-example divergence summary, e.g. "emphasis: 1 tm-only;
 * html-tag: 1 tm-only" — computed from the TM-vs-fork pairing.
 *
 * @param {{k:string|null,s:number,e:number,o:string}[]} fork
 * @param {{k:string|null,s:number,e:number,o:string}[]} tm
 */
function divergenceSummary(fork, tm) {
    // Reuse the bench's overlap pairing (same as the numeric report).
    const ts = fork.map((r) => ({ kind: r.k, start: r.s, end: r.e, origin: r.o }));
    const tmR = tm.map((r) => ({ kind: r.k, start: r.s, end: r.e, origin: r.o }));
    const cmp = compare(ts, tmR);
    /** @type {Record<string, {tsOnly:number, tmOnly:number}>} */
    const byKind = {};
    for (const r of cmp.tsOnly) {
        (byKind[r.kind] ??= { tsOnly: 0, tmOnly: 0 }).tsOnly++;
    }
    for (const r of cmp.tmOnly) {
        (byKind[r.kind] ??= { tsOnly: 0, tmOnly: 0 }).tmOnly++;
    }
    const parts = [];
    for (const [kind, v] of Object.entries(byKind)) {
        const bits = [];
        if (v.tmOnly) bits.push(`${v.tmOnly} tm-only`);
        if (v.tsOnly) bits.push(`${v.tsOnly} ts-only`);
        parts.push(`${kind}: ${bits.join(', ')}`);
    }
    return parts.join('; ');
}

/**
 * Render the side-by-side panels + header for one example.
 *
 * @param {any} ex
 * @param {boolean} hasUpstream
 */
function renderExample(ex, hasUpstream) {
    const len = ex.text.length;
    const panelKeys = hasUpstream ? ['tm', 'fork', 'upstream'] : ['tm', 'fork'];
    /** @type {Record<string, {kinds:(string|null)[], origins:(string|null)[]}>} */
    const perChar = {};
    for (const key of panelKeys) {
        perChar[key] = perCharKinds(ex.regions[key] ?? [], len);
    }

    const panelsHtml = PANELS.filter((p) => panelKeys.includes(p.key))
        .map((p) => {
            const others = panelKeys
                .filter((k) => k !== p.key)
                .map((k) => perChar[k].kinds);
            const body = renderPanel(ex.text, perChar[p.key], others);
            return `      <div class="panel">
        <div class="panel-label">${p.label}</div>
        <pre class="code">${body || '<span class="empty">(empty)</span>'}</pre>
      </div>`;
        })
        .join('\n');

    const summary = divergenceSummary(ex.regions.fork, ex.regions.tm);
    const summaryHtml = summary
        ? `<span class="dsummary">${escapeHtml(summary)}</span>`
        : `<span class="dsummary parity">full parity (TM vs fork)</span>`;

    return `    <div class="example${ex.divergent ? '' : ' full-parity'}" data-divergent="${ex.divergent}">
      <div class="ex-head">
        <code class="ex-id">${escapeHtml(ex.id)}</code>
        <span class="ex-section">${escapeHtml(ex.section)}</span>
        ${summaryHtml}
      </div>
      <div class="panels">
${panelsHtml}
      </div>
    </div>`;
}

/**
 * Per-corpus parity stats (full-parity %, matched / ts-only / tm-only) for the
 * fork and upstream variants — the HTML equivalent of the numeric report's
 * overview, computed from the cached regions.
 *
 * @param {any} corpus
 * @param {boolean} hasUpstream
 */
function corpusStats(corpus, hasUpstream) {
    const variants = hasUpstream ? ['fork', 'upstream'] : ['fork'];
    /** @type {Record<string, {full:number, matched:number, tsOnly:number, tmOnly:number}>} */
    const stat = {};
    for (const v of variants) stat[v] = { full: 0, matched: 0, tsOnly: 0, tmOnly: 0 };
    for (const ex of corpus.examples) {
        const tm = ex.regions.tm.map((r) => ({ kind: r.k, start: r.s, end: r.e }));
        for (const v of variants) {
            const ts = ex.regions[v].map((r) => ({ kind: r.k, start: r.s, end: r.e }));
            const cmp = compare(ts, tm);
            stat[v].matched += cmp.matched.length;
            stat[v].tsOnly += cmp.tsOnly.length;
            stat[v].tmOnly += cmp.tmOnly.length;
            if (cmp.tsOnly.length === 0 && cmp.tmOnly.length === 0) stat[v].full++;
        }
    }
    return stat;
}

/** @param {any} data */
function renderHtml(data) {
    const hasUpstream = data.hasUpstream;

    // ── Overview table ──────────────────────────────────────────────────────
    const overviewRows = [];
    /** @type {Record<string, ReturnType<typeof corpusStats>>} */
    const statsByCorpus = {};
    for (const corpus of data.corpora) {
        const stat = corpusStats(corpus, hasUpstream);
        statsByCorpus[corpus.key] = stat;
        const total = corpus.examples.length;
        const variants = hasUpstream ? ['fork', 'upstream'] : ['fork'];
        for (const v of variants) {
            const s = stat[v];
            const pct = total ? ((s.full / total) * 100).toFixed(1) : '0.0';
            overviewRows.push(
                `<tr><td>${escapeHtml(corpus.name)}</td><td>${v}</td>` +
                    `<td>${s.full}/${total} (${pct}%)</td>` +
                    `<td>${s.matched}</td><td>${s.tsOnly}</td><td>${s.tmOnly}</td></tr>`,
            );
        }
    }

    // ── Per-corpus sections ─────────────────────────────────────────────────
    const sections = [];
    const nav = [];
    for (const corpus of data.corpora) {
        const divCount = corpus.examples.filter((e) => e.divergent).length;
        const anchor = `corpus-${corpus.key}`;
        nav.push(
            `<a href="#${anchor}">${escapeHtml(corpus.name)} <span class="badge">${divCount} div</span></a>`,
        );

        // Default: render only divergent examples. Full-parity examples are
        // rendered but hidden (revealed by the global toggle) — unless the
        // corpus is huge, in which case we cap the hidden set to keep the file
        // from ballooning.
        const divergent = corpus.examples.filter((e) => e.divergent);
        const fullParity = corpus.examples.filter((e) => !e.divergent);
        const FULL_PARITY_CAP = 60;
        const fullParityShown = fullParity.slice(0, FULL_PARITY_CAP);

        const exHtml = [
            ...divergent.map((e) => renderExample(e, hasUpstream)),
            ...fullParityShown.map((e) => renderExample(e, hasUpstream)),
        ].join('\n');

        const stat = statsByCorpus[corpus.key];
        const total = corpus.examples.length;
        const variants = hasUpstream ? ['fork', 'upstream'] : ['fork'];
        const statLine = variants
            .map((v) => {
                const s = stat[v];
                const pct = total ? ((s.full / total) * 100).toFixed(1) : '0.0';
                return `${v}: ${s.full}/${total} full-parity (${pct}%)`;
            })
            .join(' · ');

        const cappedNote =
            fullParity.length > FULL_PARITY_CAP
                ? ` (showing ${FULL_PARITY_CAP} of ${fullParity.length} full-parity examples)`
                : '';

        sections.push(`  <details class="corpus" id="${anchor}" open>
    <summary><span class="corpus-name">${escapeHtml(corpus.name)}</span>
      <span class="corpus-stat">${escapeHtml(statLine)} · ${divCount} divergent${escapeHtml(cappedNote)}</span>
    </summary>
${exHtml || '    <p class="none">No examples.</p>'}
  </details>`);
    }

    // ── Legend ──────────────────────────────────────────────────────────────
    const legend = Object.entries(PALETTE)
        .map(
            ([k, p]) =>
                `<span class="legend-item"><span class="swatch ${cssClass(k)}">Aa</span> ${p.label}</span>`,
        )
        .join('\n');

    // ── Per-kind CSS from the palette ───────────────────────────────────────
    const kindCss = Object.entries(PALETTE)
        .map(([k, p]) => {
            const sel = `.${cssClass(k)}`;
            return `    ${sel} { color: ${p.fg}; background: ${p.bg};${p.style ? ' ' + p.style + ';' : ''} }`;
        })
        .join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SvelTeX markdown grammar parity — side-by-side</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; color: #1f2328; background: #fff; line-height: 1.45; }
  header { padding: 1.4em 1.6em 1em; border-bottom: 1px solid #d0d7de; }
  h1 { margin: 0 0 0.2em; font-size: 1.5em; }
  .sub { color: #57606a; margin: 0.2em 0; font-size: 0.92em; }
  main { padding: 0 1.6em 4em; max-width: 1500px; margin: 0 auto; }
  a { color: #0969da; }

  /* sticky nav */
  nav { position: sticky; top: 0; z-index: 10; background: #f6f8fa; border-bottom: 1px solid #d0d7de;
        padding: 0.6em 1.6em; display: flex; flex-wrap: wrap; gap: 0.5em 1.1em; align-items: center; font-size: 0.9em; }
  nav .badge { background: #ddf4ff; color: #0550ae; border-radius: 9px; padding: 0 6px; font-size: 0.82em; }
  nav .toggle { margin-left: auto; display: flex; gap: 0.5em; align-items: center; }
  nav button { font: inherit; cursor: pointer; background: #fff; border: 1px solid #d0d7de; border-radius: 6px; padding: 3px 10px; }
  nav button:hover { background: #f3f4f6; }

  /* overview */
  .overview { margin: 1.4em 0; }
  table { border-collapse: collapse; font-size: 0.9em; }
  th, td { border: 1px solid #d0d7de; padding: 4px 10px; text-align: left; }
  th { background: #f6f8fa; }
  td:nth-child(n+3) { text-align: right; font-variant-numeric: tabular-nums; }

  /* legend */
  .legend { display: flex; flex-wrap: wrap; gap: 0.4em 1em; margin: 1em 0 1.6em; font-size: 0.88em; align-items: center; }
  .legend-item { display: inline-flex; align-items: center; gap: 0.35em; }
  .swatch { padding: 1px 6px; border-radius: 3px; font-family: ui-monospace, monospace; font-size: 0.85em; border: 1px solid rgba(0,0,0,0.08); }

  /* corpus sections */
  details.corpus { border: 1px solid #d0d7de; border-radius: 8px; margin: 1.2em 0; overflow: hidden; }
  details.corpus > summary { cursor: pointer; padding: 0.7em 1em; background: #f6f8fa; font-size: 1.05em; list-style-position: inside; }
  details.corpus > summary .corpus-name { font-weight: 700; }
  .corpus-stat { color: #57606a; font-size: 0.82em; font-weight: 400; margin-left: 0.6em; }

  /* an example */
  .example { border-top: 1px solid #eaeef2; padding: 0.9em 1em; }
  .example.full-parity { display: none; background: #fbfdff; }
  body.show-all .example.full-parity { display: block; }
  .ex-head { display: flex; flex-wrap: wrap; gap: 0.4em 0.8em; align-items: baseline; margin-bottom: 0.5em; }
  .ex-id { background: #eaeef2; border-radius: 4px; padding: 1px 6px; font-size: 0.85em; font-weight: 600; }
  .ex-section { color: #57606a; font-size: 0.82em; }
  .dsummary { font-size: 0.82em; color: #82071e; background: #ffebe9; border-radius: 4px; padding: 1px 7px; }
  .dsummary.parity { color: #1a7f37; background: #dafbe1; }

  /* the three panels */
  .panels { display: grid; grid-template-columns: repeat(var(--cols, 3), 1fr); gap: 0.7em; }
  .panel { min-width: 0; border: 1px solid #eaeef2; border-radius: 6px; overflow: hidden; }
  .panel-label { font-size: 0.78em; color: #57606a; background: #f6f8fa; padding: 3px 8px; border-bottom: 1px solid #eaeef2; font-weight: 600; }
  pre.code { margin: 0; padding: 0.6em 0.7em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px;
             line-height: 1.55; white-space: pre; overflow-x: auto; tab-size: 4; }
  pre.code .empty { color: #8c959f; font-style: italic; font-family: system-ui, sans-serif; }

  /* kind colours (shared palette) */
  .k { border-radius: 2px; }
${kindCss}

  /* divergence flag: a run whose kind differs from another panel here */
  .div { outline: 1px dotted #cf222e; outline-offset: -1px; box-shadow: inset 0 -2px 0 rgba(207,34,46,0.25); }
  body.hide-div .div { outline: none; box-shadow: none; }

  .none { color: #8c959f; padding: 0.6em 1em; }
  footer { color: #57606a; font-size: 0.85em; padding: 2em 1.6em; border-top: 1px solid #d0d7de; }
</style>
</head>
<body class="hide-flags-off">
<header>
  <h1>SvelTeX markdown grammar parity — side-by-side</h1>
  <p class="sub">Generated by <code>scripts/parity-markdown-html.mjs</code> on ${escapeHtml(data.generatedAt)}.</p>
  <p class="sub">Each example is rendered as <strong>three side-by-side panels — TextMate │ Fork │ Upstream</strong> — coloured by the shared parity-kind palette below. <strong>Same kind = same colour everywhere</strong>, so a span one panel colours but another leaves plain (or colours differently) is a <em>divergence</em>; divergent runs carry a dotted red underline. By default only TM-vs-Fork divergent examples are shown.</p>
</header>
<nav>
  ${nav.join('\n  ')}
  <span class="toggle">
    <button id="btn-toggle-full">Show full-parity examples</button>
    <button id="btn-toggle-flags">Hide divergence flags</button>
  </span>
</nav>
<main>
  <section class="overview">
    <h2>Overview</h2>
    <p class="sub">Per corpus: fork / upstream full-parity vs the SvelTeX TextMate grammar, with matched / ts-only / tm-only region counts. <code>ts-only</code> = a construct tree-sitter found but TextMate did not; <code>tm-only</code> = the reverse.</p>
    <table>
      <thead><tr><th>Corpus</th><th>Variant</th><th>Full parity</th><th>matched</th><th>ts-only</th><th>tm-only</th></tr></thead>
      <tbody>
        ${overviewRows.join('\n        ')}
      </tbody>
    </table>
  </section>

  <section class="legend-section">
    <h2>Legend</h2>
    <div class="legend">
${legend}
    </div>
  </section>

${sections.join('\n')}
</main>
<footer>
  Self-contained report (inline CSS + JS, no external resources). Layout: single
  file with a sticky nav, an overview table, and one collapsible section per
  corpus. Reuses <code>parity-markdown.mjs</code>'s tokenizers + classifiers so
  the colours and the numeric report agree on kinds.
</footer>
<script>
  (function () {
    var cols = ${hasUpstream ? 3 : 2};
    document.documentElement.style.setProperty('--cols', cols);
    document.querySelectorAll('.panels').forEach(function (el) {
      el.style.setProperty('--cols', cols);
    });
    var btnFull = document.getElementById('btn-toggle-full');
    btnFull.addEventListener('click', function () {
      var on = document.body.classList.toggle('show-all');
      btnFull.textContent = on ? 'Hide full-parity examples' : 'Show full-parity examples';
    });
    var btnFlags = document.getElementById('btn-toggle-flags');
    btnFlags.addEventListener('click', function () {
      var off = document.body.classList.toggle('hide-div');
      btnFlags.textContent = off ? 'Show divergence flags' : 'Hide divergence flags';
    });
  })();
</script>
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════════════

async function main() {
    const opts = parseArgs();
    console.log('Markdown grammar parity — HTML report\n');

    /** @type {any} */
    let data;
    if (opts.renderOnly && !opts.forceDump) {
        if (!existsSync(DATA_PATH)) {
            console.error(
                `--render-only but no cache at ${relative(process.cwd(), DATA_PATH)}; ` +
                    `run without --render-only first.`,
            );
            process.exit(1);
        }
        console.log(`Reusing cached data (${relative(process.cwd(), DATA_PATH)}).`);
        data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
    } else {
        data = await dumpData(opts);
    }

    const html = renderHtml(data);
    writeFileSync(REPORT_PATH, html);
    const totalEx = data.corpora.reduce((a, c) => a + c.examples.length, 0);
    const totalDiv = data.corpora.reduce(
        (a, c) => a + c.examples.filter((e) => e.divergent).length,
        0,
    );
    console.log(
        `\nReport written to ${relative(process.cwd(), REPORT_PATH)} ` +
            `(${totalEx} examples, ${totalDiv} TM-vs-fork divergent).`,
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
