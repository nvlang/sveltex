---
pageClass: docs-verbatim
---

<script lang="ts" setup>
import { PhHammer, PhFunnelX, PhShuffle } from '@phosphor-icons/vue';
</script>

# Verbatim environments

<p class="text-lg py-2">
Carve out custom tags whose content SvelTeX preprocesses specially before
the Svelte compiler ever sees it.
</p>

<div class="features-list mt-8">

-   <PhHammer color="var(--hig-brown)" class="opacity-90" :size="28" weight="duotone"/>

    **Four processing modes:** `'tex'` compiles a LaTeX snippet to SVG,
    `'code'` runs the body through the [code](code) backend, `'escape'`
    HTML- and brace-escapes the body so Svelte leaves it alone, `'noop'`
    skips SvelTeX entirely and passes the body straight to Svelte.

-   <PhFunnelX color="var(--hig-brown)" class="opacity-90" :size="28" weight="duotone"/>

    **Attribute forwarding:** Allowlist or blocklist which attributes flow
    from the source tag through to the rendered component, so build-time
    options (`preamble`, `caption`, …) can sit alongside runtime props
    without leaking.

-   <PhShuffle color="var(--hig-brown)" class="opacity-90" :size="28" weight="duotone"/>

    **Aliases:** Several tag names can resolve to the same environment —
    handy for keeping `<tex>` / `<latex>` / `<tikz>` interchangeable in
    your source.

</div>

A **verbatim environment** is a Svelte-style element whose contents
SvelTeX recognises by name and hands off to a dedicated handler.

The canonical use is `tex`-type environments that compile a LaTeX
snippet to an SVG at build time (e.g. for [TikZ](tex) diagrams), but
verbatim covers four processing modes in total.

## The four processing types

| `type` | Behaviour |
| --- | --- |
| `'tex'` | Compile the contents as a LaTeX document, convert the output to SVG, and import the SVG as a Svelte component. See the [TeX page](tex) for the full pipeline. |
| `'code'` | Run the contents through the configured [code](code) backend (Shiki, starry-night, highlight.js, or escape-only) and wrap the result. |
| `'escape'` | HTML- and brace-escape the contents (so curly braces don't get interpreted as Svelte mustache tags) and emit them verbatim. |
| `'noop'` | Don't process the body at all — no Markdown, math, code, or TeX handling. SvelTeX is effectively switched off for the region; the body passes through to Svelte unchanged. |

## Configuration

Verbatim environments are registered under the top-level
[`verbatim`](getting-started#setup) key of your SvelTeX configuration. Each
entry's key is the tag name SvelTeX will recognise; the value is the
environment's configuration, with `type` selecting the processing mode.

```ts twoslash
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({}, {
    verbatim: {
        Tex: {
            type: 'tex',
            aliases: ['tex', 'tikz'],
            documentClass: { name: 'standalone', options: [] },
            preamble: '\\usepackage{tikz, microtype}',
            preset: [{ name: 'tikz', libraries: { babel: true, calc: true } }],
        },
        Code: {
            type: 'code',
        },
        Verbatim: {
            type: 'escape',
            escape: { braces: true, html: true },
        },
        Raw: {
            type: 'noop',
        },
    },
});
```

In your `.sveltex` files, every registered tag and alias is then valid
markup:

```sveltex
<Tex ref="dependency-graph">
\begin{tikzpicture}
    \node (a) {A};
    \node[right=of a] (b) {B};
    \draw[->] (a) -- (b);
\end{tikzpicture}
</Tex>

<Code lang="ts">
const x: number = 42;
</Code>

<Verbatim>
Curly braces { won't } be parsed by Svelte here.
</Verbatim>
```

::: warning A `tex` body is the document body only
The content between a `tex` environment's tags is the LaTeX **document body** —
exactly what you would write between `\begin{document}` and `\end{document}`.
SvelTeX supplies the `\documentclass`, the preamble, and the `document`
environment itself; configure those with the `documentClass` and `preamble`
options shown above. Putting a `\documentclass` or `\begin{document}` in the
body would nest one document inside another, so SvelTeX rejects it with a clear
error rather than emitting invalid LaTeX.
:::

### Common options

These apply to every verbatim type:

-   `aliases` — extra tag names that resolve to this environment. The
    primary tag (the object key) and every alias are interchangeable in
    markup.
-   `defaultAttributes` — attributes merged into every instance of the
    tag before the handler runs.
-   `attributeForwardingAllowlist` / `attributeForwardingBlocklist` —
    decide which of the tag's attributes flow through to the rendered
    output. The allowlist defaults to `'all'`; the blocklist applies on
    top of it.
-   `respectSelfClosing` — when `true` (the default for `code`, `escape`
    and `noop` types), `<Tag />` is treated as self-closing; when `false`
    (the default for `tex`, since a TeX snippet always needs a body),
    SvelTeX expects an opening + closing pair.
-   `selfCloseOutputWith` — `'auto'` | `' />'` | `'/>'`: controls
    whether the rendered output emits a self-closing tag (` />` or
    `/>`) or omits the slash; `'auto'` mirrors whatever the source
    used.
-   `component` — `'this'` | `'none'` | `string`: pick the Svelte
    component the rendered output is mounted as. `'this'` keeps the
    original tag; `'none'` strips the wrapper entirely; a string names a
    specific component to swap in.
-   `transformers` — a `pre` and `post` array of regex/string-replace
    pairs or callback functions, run before and after the handler.

## Editor syntax highlighting

SvelTeX processes verbatim environments **at build time** — the body is
turned into HTML and handed to Svelte's compiler regardless of editor
support. The SvelTeX editor extensions additionally try to colour the
body of a verbatim block _as you type_, and how well they manage depends
on the editor.

### VS Code

The VS Code extension **regenerates its TextMate grammar from your
`sveltex.config.js`**, so each configured environment's body is highlighted
according to its `type`:

-   `'tex'` → highlighted as **LaTeX**;
-   `'escape'` / `'code'` → highlighted as a **plain fenced-code block**;
-   `'noop'` → treated as **Svelte** markup.

Because the grammar is rebuilt from your config, custom tag names work — a
`<Diagram>` of `type: 'tex'` gets LaTeX highlighting just like `<tex>`.

::: warning Reload after changing your verbatim config

The grammar is regenerated when the extension loads — **not** live as you edit
the config. After you add, remove, or rename a verbatim environment in
`sveltex.config.js`, run **Developer: Reload Window** (or restart VS Code) so
the regenerated grammar takes effect; until then the editor keeps highlighting
the previous set of tags.

:::

### Zed

Zed compiles the tree-sitter grammar from a pinned commit and **cannot read
your config**, so only a fixed set of hard-coded tag names is recognised:

-   **LaTeX** body highlighting applies to environments named `tex`, `latex`
    or `tikz`, plus their proper-form (`TeX`, `LaTeX`, `TikZ`) and
    title-case (`Tex`, `Latex`, `Tikz`) variants. Matching is
    **case-sensitive** — any other casing (`TEX`, `LATEX`, …) is _not_
    recognised.
-   `verb` / `verbatim` (and `Verb` / `Verbatim`) bodies are rendered as plain
    text.

### Semantic highlighting

In **Zed**, semantic highlighting is what lets the language server colour
`escape`- and `code`-type verbatim bodies — the static grammar can't, since it
can't read your config. Zed has it **off by default**, so turn it on: set
`semantic_tokens` to `"combined"` (LSP tokens layered on tree-sitter), either
globally or under `"languages": { "SvelTeX": { … } }`. In **VS Code** the
regenerated TextMate grammar already covers those bodies and the extension
emits no SvelTeX semantic tokens, so the editor's
`editor.semanticHighlighting.enabled` (default `configuredByTheme`) doesn't
change `.sveltex` highlighting either way.

::: warning Highlighting mirrors SvelTeX's parsing, not CommonMark

The editor highlighting (in both extensions) intentionally diverges from
CommonMark/GFM in the same ways SvelTeX's own Markdown parsing does — see
[Markdown implementation](implementation/markdown). For SvelTeX this is a
feature: what you see highlighted reflects how SvelTeX will actually parse the
source. If you're used to **mdsvex** or a stock CommonMark/GFM renderer,
though, the highlighting may _not_ match how those parse the same input — don't
read it as a preview of their output.

:::

::: tip Prefer fenced backticks for code

For code blocks specifically, **fenced backticks** — ` ```ts … ``` ` —
give you language-aware editor highlighting as you type, on top of the
same build-time syntax highlighting a `<Code>…</Code>` environment would
produce. If you want every code block wrapped in a custom Svelte
component, do it after the fact with
[`code.transformers.post`](code#configuration) — the post-transformer
can replace the rendered `<pre>` with `<MyCode>` (or whatever) without
forcing you off the standard fenced syntax.

:::

## Examples

### A TikZ environment

```ts twoslash
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({}, {
    verbatim: {
        Tex: {
            type: 'tex',
            aliases: ['tex', 'tikz'],
            documentClass: 'standalone',
            preamble: '\\usepackage{tikz, microtype}',
            preset: [{
                name: 'tikz',
                libraries: { babel: true, calc: true, arrows: { meta: true } },
            }],
        },
    },
});
```

```sveltex
<tikz ref="hello" caption="A first TikZ diagram.">
\begin{tikzpicture}
    \draw[thick, ->] (0, 0) -- (2, 1) node[right] {hi};
\end{tikzpicture}
</tikz>
```

See the [TeX page](tex) for the full set of TeX-specific options
(`compilation`, `conversion`, `optimization`, `overrides`,
`handleAttributes`, `postprocess`, …).

### A code environment

```ts twoslash
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({ codeBackend: 'shiki' }, {
    verbatim: {
        Code: {
            type: 'code',
            defaultAttributes: { lang: 'ts' },
            attributeForwardingBlocklist: ['lang', 'inline', 'metaString'],
        },
    },
});
```

```sveltex
<Code>
const greet = (name: string): string => `Hello, ${name}!`;
</Code>

<Code lang="diff">
- a
+ b
</Code>
```

### An escape-only environment

```ts twoslash
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({}, {
    verbatim: {
        Verbatim: {
            type: 'escape',
            escape: { braces: true, html: true },
        },
    },
});
```

```sveltex
<Verbatim>
<script> tags, { braces }, and <em>html</em> all kept literal here.
</Verbatim>
```

### A pass-through environment

```ts twoslash
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({}, {
    verbatim: {
        Raw: {
            type: 'noop',
        },
    },
});
```

The point of `noop` is to **switch SvelTeX off for the region**: the `Raw`
tag is recognised so the region is carved out, but then *no* processing runs
on its body — no Markdown, no math, no code or TeX handling. The body is
passed through to the Svelte compiler exactly as written.
