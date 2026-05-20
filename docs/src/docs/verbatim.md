# Verbatim environments

<p class="text-lg py-2">
Carve out custom tags whose content SvelTeX preprocesses specially before
the Svelte compiler ever sees it.
</p>

A **verbatim environment** is a Svelte-style element whose contents
SvelTeX recognises by name and hands off to a dedicated handler. Inside
the tag, neither the markdown processor nor (typically) the Svelte
compiler parses the body — the verbatim handler decides what to do with
it.

The canonical use is `tex`-type environments that compile a LaTeX
snippet to an SVG at build time (e.g. for [TikZ](tex) diagrams), but
verbatim covers four processing modes in total.

## The four processing types

| `type` | Behaviour | Typical tag names |
| --- | --- | --- |
| `'tex'` | Compile the contents as a LaTeX document, convert the output to SVG, and import the SVG as a Svelte component. See the [TeX page](tex) for the full pipeline. | `<Tex>`, `<tex>`, `<tikz>` |
| `'code'` | Run the contents through the configured [code](code) backend (Shiki, starry-night, highlight.js, or escape-only) and wrap the result. | `<Code>`, `<Highlight>` |
| `'escape'` | HTML- and brace-escape the contents (so curly braces don't get interpreted as Svelte mustache tags) and emit them verbatim. | `<Verbatim>` |
| `'noop'` | Don't process the body at all — pass it through unchanged. Useful for tags whose body Svelte should see as-is. | `<Raw>` |

## Configuration

Verbatim environments are registered under the top-level
[`verbatim`](getting-started) key of your SvelTeX configuration. Each
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
-   `respectSelfClosing` — when `true` (default), `<Tag />` is treated as
    self-closing; when `false`, SvelTeX expects an opening + closing
    pair.
-   `selfCloseOutputWith` — `'auto'` | `'slash'` | `''`: controls
    whether the rendered output uses `<tag />` or `<tag>` for empty
    instances.
-   `component` — `'this'` | `'none'` | `string`: pick the Svelte
    component the rendered output is mounted as. `'this'` keeps the
    original tag; `'none'` strips the wrapper entirely; a string names a
    specific component to swap in.
-   `transformers` — a `pre` and `post` array of regex/string-replace
    pairs or callback functions, run before and after the handler.

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
&lt;script&gt; tags, { braces }, and <em>html</em> all kept literal here.
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

The `Raw` tag is recognised and excluded from markdown processing, but
its body is passed through unchanged to the Svelte compiler — useful
for hand-written Svelte fragments that share a tag name you want to
treat as verbatim everywhere else (so the markdown processor leaves them
alone).

## Hover for the IntelliSense

When the [SvelTeX language server](language-server) is set up, hovering
the configuration keys in your `sveltex.config.js` shows the same
information as this page, with per-option descriptions. The verbatim
section of the config has the densest TSDoc of any SvelTeX surface;
prefer the in-editor hover for option-level reference, and use this
page for the conceptual overview.
