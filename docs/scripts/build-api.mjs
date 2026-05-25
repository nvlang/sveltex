// Generates the VitePress API reference for `@nvl/sveltex` from its TSDoc.
//
// Unlike a stock TypeDoc run, this:
//   - renders the conditional config types (Markdown/Code/Math) as one page
//     each, with a tab per backend (the backends are read from each type's
//     generic constraint, then the type is instantiated per backend so the
//     resolved properties + their TSDoc can be listed);
//   - inline-expands nested option objects defined inside the package
//     (e.g. `TexConfiguration.compilation`) down to `MAX_DEPTH` levels.
//
// Everything is derived from the types + comments, so ordinary doc edits need
// no changes here — only structural changes (new public export kinds) would.

import { Project, Node, ts } from 'ts-morph';
import { createHighlighter } from 'shiki';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
// The site's tweaked github-dark theme, so inline types match code blocks.
import { githubDarkDefault } from '../.vitepress/theme/code-theme.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const PKG = `${ROOT}/packages/sveltex`;
const ENTRY = `${PKG}/src/mod.ts`;
const OUT = `${ROOT}/docs/src/api`;
const GH = 'https://github.com/nvlang/sveltex/blob/main';
const MAX_DEPTH = 3;
const MAX_TYPE = 72; // chars before a type string is truncated (full in title)

// Conditional config types whose per-backend variants get their own sections.
const TABBED = new Set([
    'MarkdownConfiguration',
    'CodeConfiguration',
    'MathConfiguration',
]);

// Shiki highlighter for inline type signatures (dual-theme via CSS vars).
const highlighter = await createHighlighter({
    themes: ['github-light-default', githubDarkDefault],
    langs: ['ts'],
});

/** Shiki-highlighted inline HTML (token spans only) for a type string. */
function highlightType(text) {
    const shown = text.length > MAX_TYPE ? `${text.slice(0, MAX_TYPE)}…` : text;
    return highlighter.codeToHtml(shown, {
        lang: 'ts',
        themes: { light: 'github-light-default', dark: 'github-dark-default' },
        // No default `color:` on spans (only CSS vars) so our light/dark rules
        // win — otherwise the inline light color shows on the dark theme.
        defaultColor: false,
        structure: 'inline',
    });
}

/**
 * Build the `type-html` (+ `type-title` when truncated) attributes for a type
 * string. The highlighted HTML is passed as an (escaped) attribute and injected
 * via `v-html`, which — unlike a markdown slot — never lets Vue parse the type's
 * `{ }`, `<>` or tags.
 */
function typeHtmlAttrs(text) {
    let attrs = ` type-html="${escapeAttr(highlightType(text))}"`;
    if (text.length > MAX_TYPE) attrs += ` type-title="${escapeAttr(text)}"`;
    return attrs;
}

/** `typeHtmlAttrs` for a ts-morph type (short name if it'll be inline-expanded). */
function typeAttrs(type, ctx, expandable) {
    return typeHtmlAttrs(
        expandable ? shortTypeName(type) : cleanType(type.getText(ctx)),
    );
}

// ───────────────────────────── helpers ──────────────────────────────

/** Strip `import("…").` prefixes and collapse whitespace in a type string. */
function cleanType(text) {
    return text
        .replace(/import\([^)]*\)\./g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const slug = (name) => name;

// Fence languages the docs' Shiki instance actually has loaded (see the
// VitePress config's shikiSetup). Anything else would throw a ShikiError and
// crash the build, so unknown languages are dropped (plain code block).
const LANG_MAP = {
    typescript: 'ts',
    javascript: 'js',
    shell: 'sh',
    bash: 'sh',
    shellscript: 'sh',
    markdown: 'md',
    tex: 'latex',
};
const SAFE_LANGS = new Set([
    'ts', 'js', 'html', 'css', 'scss', 'sass', 'postcss', 'stylus', 'sh',
    'xml', 'latex', 'svelte', 'md',
]);
const normalizeFenceLang = (lang) => {
    const l = LANG_MAP[lang.toLowerCase()] ?? lang.toLowerCase();
    return SAFE_LANGS.has(l) ? l : '';
};

/**
 * Within each fenced code block, strip leading whitespace shared by every body
 * line beyond the fence marker's own indent. Authors often indent fence bodies
 * a few spaces for source readability (e.g. shell commands inside `@remarks`);
 * that surplus would otherwise render literally inside the code block. Uses a
 * min-indent dedent, so relative indentation within real code is preserved.
 */
function dedentFences(text) {
    const lines = text.split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const open = lines[i].match(/^(\s*)(`{3,}|~{3,})(.*)$/);
        if (!open) {
            out.push(lines[i]);
            continue;
        }
        const fenceIndent = open[1].length;
        const marker = open[2][0];
        const body = [];
        let close = -1;
        for (let j = i + 1; j < lines.length; j++) {
            if (new RegExp(`^\\s*\\${marker}{${open[2].length},}\\s*$`).test(lines[j])) {
                close = j;
                break;
            }
            body.push(lines[j]);
        }
        if (close === -1) {
            out.push(lines[i]);
            continue;
        }
        let extra = Infinity;
        for (const b of body) {
            if (!b.trim()) continue;
            extra = Math.min(extra, Math.max(0, b.match(/^(\s*)/)[1].length - fenceIndent));
        }
        if (!Number.isFinite(extra)) extra = 0;
        out.push(lines[i]);
        for (const b of body) {
            if (!b.trim() || extra === 0) {
                out.push(b);
                continue;
            }
            const m = b.match(/^(\s*)(.*)$/);
            out.push(' '.repeat(Math.max(0, m[1].length - extra)) + m[2]);
        }
        out.push(lines[close]);
        i = close;
    }
    return out.join('\n');
}

/**
 * Demote ATX headings authors wrote inside comments (e.g. `#### LINKS`) to bold
 * text, and normalize fenced-code languages to ones Shiki has loaded. Both keep
 * the page structurally valid / crash-free. Fence-aware.
 */
function sanitizeComment(text) {
    if (!text) return text;
    let inFence = false;
    return dedentFences(text)
        .split('\n')
        .map((line) => {
            const f = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
            if (f) {
                const wasIn = inFence;
                inFence = !inFence;
                if (!wasIn)
                    return `${f[1]}${f[2]}${normalizeFenceLang(f[3].trim().split(/\s/)[0] ?? '')}`;
                return line;
            }
            if (!inFence) {
                // Demote only h1–h3 (those would pollute the page ToC, which is
                // [2,3]); keep h4–h6 as real, lower-level headings.
                const m = line.match(/^\s*(#{1,6})\s+(.*)$/);
                if (m && m[1].length <= 3) return `**${m[2].trim()}**`;
                if (m) return `${m[1]} ${m[2].trim()}`;
            }
            return line;
        })
        .join('\n');
}

/** Frontmatter shared by every generated API page. */
const FRONTMATTER = `---\noutline: [2, 3]\npageClass: api-doc\n---\n\n`;

/** Escape a string for use inside a double-quoted HTML/Vue attribute. */
const escapeAttr = (s) =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/** Compact source location: `{label: 'types/…/Tex.ts:75-126', href}` or null. */
function ghInfo(node) {
    if (!node) return null;
    const sf = node.getSourceFile();
    const full = sf.getFilePath();
    const relRepo = relative(ROOT, full);
    if (relRepo.startsWith('..') || relRepo.includes('node_modules')) return null;
    const start = node.getStartLineNumber();
    const end = node.getEndLineNumber();
    const label = `${relative(`${PKG}/src`, full)}:${end > start ? `${start}-${end}` : start}`;
    const href = `${GH}/${relRepo}#L${start}${end > start ? `-L${end}` : ''}`;
    return { label, href };
}

/** Is this symbol declared inside the package source (vs node_modules)? */
function inPackage(node) {
    if (!node) return false;
    const p = node.getSourceFile().getFilePath();
    return p.includes('/packages/sveltex/src/') && !p.includes('/node_modules/');
}

/**
 * Resolve inline `{@link target | display}` tags and bare URLs in comment
 * text. Links to documented symbols become page links; URLs become autolinks
 * (which also stops markdown-it's emoticon shortcut turning `://` into 😕).
 */
function processInline(text) {
    if (!text) return text;
    // ts-morph drops the newline that followed an inline {@link} in the source,
    // gluing the tag to the next word; re-insert a separating space.
    text = text.replace(/(\{@link[^}]*\})(?=[A-Za-z0-9])/g, '$1 ');
    text = text.replace(
        /\{@link\s+([^}|]+?)(?:\s*\|\s*([^}]+?))?\s*\}/g,
        (_m, target, display) => {
            target = target.trim();
            const label = (display ?? target).trim().replace(/`/g, '');
            if (/^https?:\/\//.test(target)) return `[${label}](${target})`;
            const base = target.split('.')[0].split('(')[0];
            if (documented.has(base))
                return `[\`${label}\`](${documented.get(base)})`;
            return `\`${label}\``;
        },
    );
    text = text.replace(/(?<![("<\]=])(https?:\/\/[^\s<>)\]]+)/g, '<$1>');
    return text;
}

/**
 * Wrap paragraphs that begin with a "⚠ **Warning**:" / "**Note**:" label in a
 * compact <ApiCallout> (icon column + body, with the colored label inlined at
 * the start of the body). Runs after {@link processInline} so the body keeps
 * its markdown links; blank lines inside the component let VitePress render the
 * slot as markdown. Any remaining bare ⚠ (e.g. inside a list item) becomes a
 * plain inline icon.
 */
const WARNING_LEAD = /^⚠️?[ \t]*(?:\*\*[ \t]*Warning[ \t]*:?[ \t]*\*\*[ \t]*:?)?[ \t]*/;
const NOTE_LEAD = /^(?:\*\*[ \t]*Note[ \t]*:[ \t]*\*\*|\*\*[ \t]*Note[ \t]*\*\*[ \t]*:)[ \t]*/;
const IS_LIST = /^[ \t]*(?:[-*+][ \t]|\d+[.)][ \t])/;

function calloutBlocks(text) {
    if (!text) return text;
    const wrap = (type, label, body) =>
        `<ApiCallout type="${type}">\n\n<span class="api-cl__label">${label}</span> ${body.trim()}\n\n</ApiCallout>`;
    const blocks = text.split(/\n{2,}/);
    const out = [];
    for (let i = 0; i < blocks.length; i++) {
        const para = blocks[i];
        let type, lead;
        const w = para.match(WARNING_LEAD);
        const n = para.match(NOTE_LEAD);
        if (w && /^⚠/.test(para)) [type, lead] = ['warning', para.slice(w[0].length)];
        else if (n) [type, lead] = ['note', para.slice(n[0].length)];
        if (!type) {
            out.push(para);
            continue;
        }
        // Absorb immediately-following list blocks (they belong to the callout).
        const parts = [lead];
        while (i + 1 < blocks.length && IS_LIST.test(blocks[i + 1])) parts.push(blocks[++i]);
        out.push(wrap(type, type === 'warning' ? 'Warning' : 'Note', parts.join('\n\n')));
    }
    // Leftover bare warning glyphs (not paragraph-leading) → inline icon.
    return out.join('\n\n').replace(/⚠️?/g, '<PhWarning weight="fill" class="api-warn-icon" />');
}

/**
 * Escape stray `<` in comment prose so literal tag-like text (MathML/HTML
 * examples such as `<merror>`, `<mjx-container>`) isn't parsed as Vue markup.
 * Fence- and inline-code-aware; leaves `<http…>` autolinks alone.
 */
function escapeProseAngles(text) {
    if (!text) return text;
    let inFence = false;
    return text
        .split('\n')
        .map((line) => {
            if (/^\s*```/.test(line)) {
                inFence = !inFence;
                return line;
            }
            if (inFence) return line;
            let out = '';
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '`') {
                    const end = line.indexOf('`', i + 1);
                    if (end !== -1) {
                        out += line.slice(i, end + 1);
                        i = end;
                        continue;
                    }
                }
                if (ch === '<' && !/^<https?:\/\//.test(line.slice(i)))
                    out += '&lt;';
                else out += ch;
            }
            return out;
        })
        .join('\n');
}

const isValidName = (n) => /^[A-Za-z$][\w$]*$/.test(n);

/**
 * Documentable own properties of a type: real identifiers, not underscore-
 * prefixed (internal), and declared inside the package (drops inherited
 * built-ins like `lastIndexOf` / `__@iterator` that come from the TS lib).
 */
function getProps(type) {
    return [...type.getProperties()]
        .filter((p) => {
            const n = p.getName();
            if (!isValidName(n)) return false;
            const d = p.getDeclarations()?.[0];
            return !!d && inPackage(d);
        })
        .sort((a, b) => a.getName().localeCompare(b.getName()));
}

/** A blank structured-doc object (all fields empty). */
const emptyDoc = (summary = '') => ({
    summary,
    defaultValue: '',
    remarks: [],
    examples: [],
    see: [],
    params: new Map(),
    typeParams: new Map(),
    returns: '',
    throws: [],
});

/** Read structured TSDoc off a declaration node. */
function readDoc(decl) {
    const doc = emptyDoc();
    if (!decl || !('getJsDocs' in decl)) return doc;
    for (const jd of decl.getJsDocs()) {
        const d = jd.getDescription().trim();
        if (d) doc.summary = doc.summary ? `${doc.summary}\n\n${d}` : d;
        for (const tag of jd.getTags()) {
            const name = tag.getTagName();
            const text = (tag.getCommentText() ?? '').trim();
            if (name === 'defaultValue' || name === 'default')
                doc.defaultValue = text;
            else if (name === 'remarks') doc.remarks.push(text);
            else if (name === 'example') doc.examples.push(text);
            else if (name === 'see') {
                // TS parses `@see https://x` as name=`https`, comment=`://x`;
                // stitch the name back on so URLs survive intact.
                let nm = '';
                try {
                    nm = tag.compilerNode.name?.getText() ?? '';
                } catch {
                    nm = '';
                }
                const joined = nm
                    ? /^[:/]/.test(text)
                        ? `${nm}${text}` // URL split (`https` + `://…`) — no space
                        : `${nm} ${text}`
                    : text;
                // A @see is one reference — collapse soft line wraps to spaces.
                doc.see.push(joined.replace(/\s*\n\s*/g, ' ').trim());
            }
            else if (name === 'returns' || name === 'return') doc.returns = text;
            else if (name === 'throws') doc.throws.push(text);
            else if (name === 'param') {
                const pn = tag.getName?.() ?? '';
                // TS keeps the `-` separator in the comment ("- desc"); drop it.
                if (pn) doc.params.set(pn, text.replace(/^[-–—]\s+/, ''));
            } else if (name === 'typeParam' || name === 'template') {
                // ts-morph doesn't expose a name for `@typeParam`, so split it
                // out of the comment ("NAME - desc"); `@template` may have one.
                let pn = tag.getName?.() ?? '';
                let desc = text;
                if (!pn) {
                    const m = text.match(/^(\S+)\s*[-–—:]?\s*([\s\S]*)$/);
                    if (m) [, pn, desc] = m;
                }
                if (pn) doc.typeParams.set(pn, desc.trim());
            }
        }
    }
    const clean = (t) => calloutBlocks(processInline(escapeProseAngles(t)));
    doc.summary = clean(doc.summary);
    doc.remarks = doc.remarks.map(clean);
    doc.see = doc.see.map(clean);
    doc.returns = clean(doc.returns);
    doc.throws = doc.throws.map(clean);
    for (const [k, v] of doc.params) doc.params.set(k, clean(v));
    for (const [k, v] of doc.typeParams) doc.typeParams.set(k, clean(v));
    return doc;
}

/**
 * Normalize `@defaultValue`/`@example` bodies. Strips whatever fence the
 * author used (tolerating malformed ones — e.g. a triple-backtick open with a
 * single-backtick close, which would otherwise swallow the rest of the page)
 * and re-wraps multi-line/code content in a clean balanced `ts` fence; short
 * single-line values render inline.
 */
function codeText(raw) {
    const t = raw.trim();
    // Fenced (``` / ~~~, optional language) → strip the fence lines. The close
    // is matched loosely (`+) to tolerate malformed fences (triple open, single
    // close) that would otherwise swallow the rest of the page.
    if (/^[`~]{3,}/.test(t)) {
        const code = t
            .replace(/^[`~]{3,}[ \t]*[a-zA-Z0-9-]*[ \t]*\r?\n?/, '')
            .replace(/\r?\n?[ \t]*[`~]+[ \t]*$/, '')
            .trim();
        // Short single-line values (e.g. `[]`, `{}`) read better inline.
        const inline = !code.includes('\n') && code.length <= 30 && !code.includes('`');
        return { block: !inline, code };
    }
    // Inline code span (`x` / ``x``) — no language token, so don't strip the
    // content (an unquoted value like `true` must survive verbatim).
    const m = t.match(/^(`+)([\s\S]*?)\1$/);
    const code = (m ? m[2] : t).trim();
    return { block: code.includes('\n') || code.includes('`'), code };
}

/** Render the prose block (summary + default + remarks + examples + see). */
function renderProse(doc, indent = '') {
    let out = '';
    const push = (s) => {
        out += s
            .split('\n')
            .map((l) => (l ? indent + l : l))
            .join('\n');
    };
    if (doc.summary) push(`${sanitizeComment(doc.summary)}\n\n`);
    if (doc.defaultValue) {
        const { block, code } = codeText(doc.defaultValue);
        if (code) {
            const tag = `<span class="api-tag api-tag--default">Default</span>`;
            if (block) push(`${tag}\n\n\`\`\`ts\n${code}\n\`\`\`\n\n`);
            else push(`${tag} \`${code}\`\n\n`);
        }
    }
    for (const r of doc.remarks) push(`${sanitizeComment(r)}\n\n`);
    for (const e of doc.examples) {
        const ex = e.replace(/^@?example\s*/i, '');
        if (/```|~~~/.test(ex)) {
            // Rich example (prose + its own code fences): render as markdown so
            // nested fences and their languages are handled, not re-wrapped.
            push(`#### Example\n\n${sanitizeComment(ex)}\n\n`);
        } else {
            const { block, code } = codeText(ex);
            if (block) push(`#### Example\n\n\`\`\`ts\n${code}\n\`\`\`\n\n`);
            else push(`#### Example\n\n\`${code}\`\n\n`);
        }
    }
    // One tight block: each @see keeps its "See:" label (prefixed with a
    // turn-arrow icon), joined by hard line breaks rather than separate
    // (margin-spaced) paragraphs.
    // Each @see is its own paragraph, starting with markdown so it wraps in a
    // real <p> (a leading component tag would break that). A trailing marker
    // span tags it for CSS; external targets get `.api-see-ext` (no arrow).
    if (doc.see.length) {
        const external = (s) => /<https?:\/\//.test(s) || /\]\(https?:\/\//.test(s);
        for (const s of doc.see)
            push(`**See:** ${s} <span class="api-see${external(s) ? '-ext' : ''}"></span>\n\n`);
    }
    return out;
}

/** Strip `undefined`/`null` from a union; return {core, optional}. */
function unwrapNullish(type) {
    if (!type.isUnion()) return { core: type, optional: false };
    const parts = type
        .getUnionTypes()
        .filter((t) => !t.isUndefined() && !t.isNull());
    let optional = parts.length !== type.getUnionTypes().length;
    if (parts.length === 1) return { core: parts[0], optional };
    return { core: type, optional };
}

/** Names of types that get their own page → link instead of inline-expand. */
const documented = new Map();

/** Display name of a type's symbol/alias, or ''. */
function typeName(type) {
    const sym = type.getSymbol() ?? type.getAliasSymbol();
    const n = sym?.getName();
    return n && n !== '__type' && n !== '__object' ? n : '';
}

/**
 * The documented page name to link a type to, or ''. Handles `Full<X>` resolved
 * config types (e.g. `FullSveltexConfiguration` → `SveltexConfiguration`) so the
 * resolved config on the `Sveltex` page links to its documented source instead
 * of expanding into docstring-less fields.
 */
function docTargetFor(name) {
    if (documented.has(name)) return name;
    if (name.startsWith('Full') && documented.has(name.slice(4)))
        return name.slice(4);
    return '';
}

/** The in-package object type to inline-expand, or null. */
function expandable(type) {
    const { core } = unwrapNullish(type);
    if (core.isUnion() || core.isArray()) return null;
    if (core.getCallSignatures().length > 0) return null;
    if (
        core.isString() ||
        core.isNumber() ||
        core.isBoolean() ||
        core.isStringLiteral() ||
        core.isNumberLiteral()
    )
        return null;
    if (core.getProperties().length === 0) return null;
    // Types that have their own page (incl. their `Full*` resolved form) are
    // linked, not inlined.
    if (docTargetFor(typeName(core))) return null;
    const sym = core.getSymbol() ?? core.getAliasSymbol();
    const decl = sym?.getDeclarations()?.[0];
    const path = decl?.getSourceFile().getFilePath() ?? '';
    // Expand object literals (anonymous) and in-package named types; never
    // expand external library types (KatexOptions, HLJSOptions, …), nor the
    // upstream-option re-types under `types/utils/` (e.g. MathjaxConfiguration)
    // whose docstrings are copied from the backend's own docs and shouldn't be
    // reproduced here.
    if (decl && (!inPackage(decl) || path.includes('/types/utils/'))) return null;
    return core;
}

/** Short display name for an expandable type's declaration line. */
function shortTypeName(type) {
    return typeName(unwrapNullish(type).core) || '{ … }';
}

// ──────────────────────── property rendering ─────────────────────────

const slugifyId = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/**
 * Render a field. `depth` 0 ⇒ a `###` heading (so it shows in the page ToC)
 * above a headless <ApiField>; deeper levels are nested <ApiField> components
 * carrying an `id` so their left rail is a clickable anchor. In-package object
 * types are expanded inline up to MAX_DEPTH; external library types and types
 * that have their own page are linked instead.
 */
function renderField({ name, optional, type, decl, doc, ctx, depth, seen, path }) {
    const exp = depth < MAX_DEPTH ? expandable(type) : null;
    const tAttrs = typeAttrs(type, ctx, exp);
    const gh = ghInfo(decl);
    const srcAttrs = gh
        ? ` src="${escapeAttr(gh.label)}" href="${escapeAttr(gh.href)}"`
        : '';

    let body = '';
    const docTarget = docTargetFor(typeName(unwrapNullish(type).core));
    if (!exp && docTarget)
        body += `**See** [\`${docTarget}\`](${documented.get(docTarget)}). <span class="api-see"></span>\n\n`;
    body += renderProse(doc);
    if (exp) {
        const key = exp.getSymbol()?.getFullyQualifiedName?.() ?? '';
        if (!key || !seen.has(key)) {
            const nextSeen = key ? new Set(seen).add(key) : seen;
            for (const p of getProps(exp)) {
                const d = p.getDeclarations()?.[0];
                body += renderField({
                    name: p.getName(),
                    optional: (p.getFlags() & ts.SymbolFlags.Optional) !== 0,
                    type: p.getTypeAtLocation(ctx),
                    decl: d,
                    doc: readDoc(d),
                    ctx,
                    depth: depth + 1,
                    seen: nextSeen,
                    path: `${path}-${slugifyId(p.getName())}`,
                });
            }
        }
    }

    if (depth === 0) {
        // Name is the heading (clean ToC + anchor); type + source ride on the
        // same line via a self-closing <ApiSig> (no text → ToC ignores it).
        return (
            `### [\`${name}\`](#${slugifyId(name)})${optional ? '<span class="api-field__opt">?</span>' : ''} <ApiSig${tAttrs}${srcAttrs} />\n\n` +
            body
        );
    }
    return (
        `<ApiField id="${escapeAttr(path)}" name="${escapeAttr(name)}"${optional ? ' :optional="true"' : ''}${srcAttrs}${tAttrs}>\n\n` +
        body +
        `</ApiField>\n\n`
    );
}

function renderProperty(sym, ctx, depth, seen, path) {
    const decl = sym.getDeclarations()?.[0];
    return renderField({
        name: sym.getName(),
        optional: (sym.getFlags() & ts.SymbolFlags.Optional) !== 0,
        type: sym.getTypeAtLocation(ctx),
        decl,
        doc: readDoc(decl),
        ctx,
        depth,
        seen,
        path,
    });
}

// ───────────────────────── page renderers ───────────────────────────

function definedIn(decl) {
    const gh = ghInfo(decl);
    return gh
        ? `<div class="api-defined"><a href="${escapeAttr(gh.href)}" target="_blank" rel="noreferrer noopener">${gh.label}</a></div>\n\n`
        : '';
}

function renderInterface(name, decl) {
    const doc = readDoc(decl);
    let out = `${FRONTMATTER}# ${name}\n\n`;
    out += definedIn(decl);
    out += renderProse(doc);

    const props = getProps(decl.getType());
    if (props.length) {
        out += `## Properties\n\n`;
        for (const p of props)
            out += renderProperty(p, decl, 0, new Set(), slugifyId(p.getName()));
    }
    return out;
}

function backendsOf(decl) {
    const tp = decl.getTypeParameters?.()[0];
    const constraint = tp?.getConstraint();
    if (!constraint) return [];
    const ct = constraint.getType();
    // Prefer the source order declared in the backend union's type alias.
    const aliasSym = ct.getAliasSymbol() ?? ct.getSymbol();
    const aliasDecl = aliasSym?.getDeclarations?.()?.[0];
    if (aliasDecl && Node.isTypeAliasDeclaration(aliasDecl)) {
        const tn = aliasDecl.getTypeNode();
        if (tn && Node.isUnionTypeNode(tn)) {
            const lits = tn
                .getTypeNodes()
                .map((n) => (Node.isLiteralTypeNode(n) ? n.getLiteral() : null))
                .filter((l) => l && Node.isStringLiteral(l))
                .map((l) => l.getLiteralText());
            if (lits.length) return lits;
        }
    }
    const members = ct.isUnion() ? ct.getUnionTypes() : [ct];
    return members
        .filter((m) => m.isStringLiteral())
        .map((m) => m.getLiteralValue());
}

function renderConfig(name, decl, probe) {
    const doc = readDoc(decl);
    let out = `${FRONTMATTER}# ${name}\n\n`;
    out += definedIn(decl);
    out += renderProse(doc);

    // Instantiate the type once per backend; collect each backend's resolved
    // property set (symbol + type text for the shared/specific diff).
    const perBackend = backendsOf(decl).map((backend) => {
        const aliasName = `__cfg_${name}_${backend.replace(/[^A-Za-z0-9]/g, '_')}`;
        probe.addStatements(`type ${aliasName} = ${name}<'${backend}'>;\n`);
        const alias = probe.getTypeAliasOrThrow(aliasName);
        const map = new Map();
        for (const p of getProps(alias.getType()))
            map.set(p.getName(), {
                sym: p,
                typeText: cleanType(p.getTypeAtLocation(alias).getText(alias)),
            });
        return { backend, alias, map };
    });

    // Shared = present in every backend with an identical type.
    const allNames = new Set(perBackend.flatMap((pb) => [...pb.map.keys()]));
    const shared = [...allNames]
        .filter((n) => {
            const es = perBackend.map((pb) => pb.map.get(n));
            return (
                es.every(Boolean) &&
                es.every((e) => e.typeText === es[0].typeText)
            );
        })
        .sort();
    const sharedSet = new Set(shared);

    if (shared.length) {
        out += `## Shared properties\n\nThese apply regardless of the selected backend.\n\n`;
        const ctx = perBackend[0];
        for (const n of shared)
            out += renderProperty(
                ctx.map.get(n).sym,
                ctx.alias,
                0,
                new Set(),
                slugifyId(n),
            );
    }

    // One heading section per backend (no tabs) → each variant's options stay
    // in the page ToC.
    for (const pb of perBackend) {
        const specific = [...pb.map.keys()]
            .filter((n) => !sharedSet.has(n))
            .sort();
        if (!specific.length) continue;
        out += `## \`${pb.backend}\` backend\n\nOptions available when the backend is \`${pb.backend}\`.\n\n`;
        for (const n of specific)
            out += renderProperty(
                pb.map.get(n).sym,
                pb.alias,
                0,
                new Set(),
                `${pb.backend}-${slugifyId(n)}`,
            );
    }
    return out;
}

function renderFunction(name, decl) {
    const doc = readDoc(decl);
    let out = `${FRONTMATTER}# ${name}()\n\n`;
    out += definedIn(decl);

    const tps = decl.getTypeParameters();
    const params = decl.getParameters();
    const sigTps = tps.length
        ? `<${tps.map((t) => t.getText()).join(', ')}>`
        : '';
    const sigParams = params
        .map(
            (p) =>
                `${p.getName()}${p.hasQuestionToken() ? '?' : ''}: ${cleanType(p.getType().getText(p))}`,
        )
        .join(', ');
    const ret = cleanType(decl.getReturnType().getText(decl));
    out += '```ts\n';
    out += `function ${name}${sigTps}(${sigParams}): ${ret};\n`;
    out += '```\n\n';

    out += renderProse({ ...doc, params: new Map(), returns: '', throws: [] });

    if (tps.length) {
        out += `## Type parameters\n\n`;
        for (const t of tps) {
            const d = doc.typeParams.get(t.getName());
            out += `- \`${t.getText()}\`${d ? ` — ${d}` : ''}\n`;
        }
        out += '\n';
    }
    if (params.length) {
        out += `## Parameters\n\n`;
        for (const p of params)
            out += renderField({
                name: p.getName(),
                optional: p.hasQuestionToken(),
                type: p.getType(),
                decl: p,
                doc: emptyDoc(doc.params.get(p.getName()) ?? ''),
                ctx: p,
                depth: 0,
                seen: new Set(),
                path: slugifyId(p.getName()),
            });
    }

    out += `## Returns\n\n<ApiField${typeHtmlAttrs(ret)}>\n\n`;
    if (doc.returns) out += `${doc.returns}\n\n`;
    out += `</ApiField>\n\n`;
    for (const t of doc.throws) out += `**Throws:** ${t}\n\n`;
    return out;
}

// ─────────────────────────────── main ───────────────────────────────

const project = new Project({ tsConfigFilePath: `${PKG}/tsconfig.json` });
const mod = project.getSourceFileOrThrow(ENTRY);
const probe = project.createSourceFile(
    `${PKG}/src/__api_probe__.ts`,
    `import type {\n    MarkdownConfiguration,\n    CodeConfiguration,\n    MathConfiguration,\n} from './mod.js';\n`,
    { overwrite: true },
);

const interfaces = [];
const functions = [];

for (const [name, decls] of mod.getExportedDeclarations()) {
    const decl = decls[0];
    if (Node.isFunctionDeclaration(decl)) {
        functions.push({ name, decl });
    } else if (TABBED.has(name)) {
        interfaces.push({ name, decl, kind: 'config' });
    } else if (Node.isInterfaceDeclaration(decl) || Node.isClassDeclaration(decl)) {
        interfaces.push({ name, decl, kind: 'interface' });
    }
    // Plain type aliases (the backend unions, TexBackend, …) are intentionally
    // not given their own pages.
}

interfaces.sort((a, b) => a.name.localeCompare(b.name));
functions.sort((a, b) => a.name.localeCompare(b.name));

for (const { name } of interfaces)
    documented.set(name, `/api/interfaces/${slug(name)}`);
for (const { name } of functions)
    documented.set(name, `/api/functions/${slug(name)}`);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/interfaces`, { recursive: true });
mkdirSync(`${OUT}/functions`, { recursive: true });

const write = (rel, content) => {
    const file = `${OUT}/${rel}`;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
};

const firstLine = (decl) => {
    const s = readDoc(decl).summary.split('\n\n')[0] ?? '';
    return s.replace(/\s+/g, ' ').trim();
};

for (const { name, decl, kind } of interfaces) {
    const md =
        kind === 'config'
            ? renderConfig(name, decl, probe)
            : renderInterface(name, decl);
    write(`interfaces/${slug(name)}.md`, md);
}
for (const { name, decl } of functions) {
    write(`functions/${slug(name)}.md`, renderFunction(name, decl));
}

// Index page.
let index = `${FRONTMATTER}# API reference\n\n`;
index += `${firstLine(mod) || 'A flexible Svelte preprocessor with extensive LaTeX support.'}\n\n`;
if (interfaces.length) {
    index += `## Interfaces\n\n| Interface | Description |\n| --- | --- |\n`;
    for (const { name, decl } of interfaces)
        index += `| [${name}](interfaces/${slug(name)}) | ${firstLine(decl)} |\n`;
    index += '\n';
}
if (functions.length) {
    index += `## Functions\n\n| Function | Description |\n| --- | --- |\n`;
    for (const { name, decl } of functions)
        index += `| [${name}](functions/${slug(name)}) | ${firstLine(decl)} |\n`;
    index += '\n';
}
write('index.md', index);

// Sidebar. The two key entry points stay in their own sections but are pinned
// first (and bolded via CSS); `getDefault*` helpers are faded via CSS.
const linkItem = ({ name }) => ({ text: name, link: documented.get(name) });
const pinFirst = (arr, name) => [
    ...arr.filter((x) => x.name === name),
    ...arr.filter((x) => x.name !== name),
];

const sidebar = [
    { text: 'Overview', link: '/api/' },
    {
        text: 'Interfaces',
        collapsed: false,
        items: pinFirst(interfaces, 'SveltexConfiguration').map(linkItem),
    },
    {
        text: 'Functions',
        collapsed: false,
        items: pinFirst(functions, 'sveltex').map(linkItem),
    },
];
write('api-sidebar.json', JSON.stringify(sidebar, null, 2) + '\n');

console.log(
    `[build-api] wrote ${interfaces.length} interfaces + ${functions.length} functions to docs/src/api`,
);
