<script lang="ts" setup>
import { PhCursorText, PhEye, PhListMagnifyingGlass, PhPuzzlePiece, PhTreeStructure, PhGear, PhBookmarksSimple } from '@phosphor-icons/vue';
</script>

# Editor integration

<p class="text-lg py-2">
Editor features for <code>.sveltex</code> files — hover, completion,
diagnostics, outline — across every editor that speaks LSP.
</p>

`.sveltex` files are not a single language: they intermix Svelte
(markup, `<script>`, `<style>`, mustache tags, logic blocks) with
Markdown, and are punctuated by **verbatim** regions — fenced code,
math (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`), and LaTeX environments — that
must _not_ be interpreted as Svelte. The
[`@nvl/sveltex-language-server`](https://www.npmjs.com/package/@nvl/sveltex-language-server)
package gives each region the treatment it deserves.

<div class="features-list mt-8">

-   <PhPuzzlePiece color="var(--vp-c-brand-1)" :size="28" weight="duotone"/>

    **Full Svelte tooling, proxied:** Diagnostics, hover, completion,
    go-to-definition, find references, document highlight, code
    actions, rename, signature help, and document links — all
    forwarded to the upstream
    [`svelte-language-server`](https://www.npmjs.com/package/svelte-language-server),
    fully position-mapped to the source `.sveltex` file. Most
    verbatim regions are suppressed so you don't see spurious
    "unexpected `$`" diagnostics inside a math block — the exception
    is `noop`-typed environments, whose bodies pass straight through
    to Svelte at build time and so are forwarded to
    `svelte-language-server` for full Svelte tooling.

-   <PhCursorText color="var(--vp-c-brand-1)" :size="28" weight="duotone"/>

    **TeX command completion in math:** Type `\al` inside `$…$` and
    get `\alpha` and friends, with rich hover showing each command's
    signature, the Unicode symbol it renders, and a description. The
    offered commands match the project's `mathBackend` (KaTeX vs
    MathJax), via the bundled
    [`@nvl/sveltex-math-language-server`](https://www.npmjs.com/package/@nvl/sveltex-math-language-server).

-   <PhEye color="var(--vp-c-brand-1)" :size="28" weight="duotone"/>

    **Frontmatter hover & completion:** Every recognised frontmatter
    key (`title`, `meta`, `base`, `link`, `imports`, …) and every
    standard [`<meta>`](markdown#meta) name documents itself on
    hover, with a link to MDN. Completion offers the right keys for
    the block the caret sits in.

-   <PhListMagnifyingGlass color="var(--vp-c-brand-1)" :size="28" weight="duotone"/>

    **Heading outline & folding:** The Markdown headings of a
    `.sveltex` file populate the editor's outline view; folding
    ranges and structured selection ranges match the source's
    heading and block structure.

-   <PhTreeStructure color="var(--vp-c-brand-1)" :size="28" weight="duotone"/>

    **LaTeX features in `tex` verbatim** _(optional)_: When
    [TexLab](https://github.com/latex-lsp/texlab) is on `PATH`,
    hover and completion inside `<tex>` / `<latex>` / `<tikz>`
    environments are forwarded to it. If TexLab isn't installed,
    these regions are skipped silently.

-   <PhGear color="var(--vp-c-brand-1)" :size="28" weight="duotone"/>

    **Auto-configured:** Reads `svelte.config.{js,mjs,cjs,ts,mts,cts}`
    from the workspace root to discover your SvelTeX configuration
    (verbatim environment names, math delimiters, math backend, …)
    and live-reloads when the config or one of its imports changes.

</div>

::: info Highlighting custom verbatim envs in non-VS-Code editors

For LSP clients other than VS Code (Zed, Neovim, …), the server also emits
**semantic tokens** that flat-colour the bodies of your custom `escape`- and
`code`-typed verbatim environments. VS Code achieves the same through its
generated TextMate grammar instead, so the server skips semantic tokens there.
See [Verbatim › Editor syntax highlighting](/docs/verbatim#editor-syntax-highlighting).

:::

## Setup

Pick your editor. The official extension bundles the language server, so
there's nothing extra to install — it activates on any `.sveltex` file.

<EditorTabs>
<template #vscode>

Install from the **VS Code Marketplace** — search **"SvelTeX"** in the
Extensions view, or from a terminal:

```sh
code --install-extension sveltex-preprocessor.sveltex
```

The first activation spawns the language server in the background; its output
goes to the **SvelTeX Language Server** output channel if you need to debug.

</template>
<template #cursor>

Cursor is a VS Code fork, so the same extension works. Search **"SvelTeX"** in
the Extensions view, or:

```sh
cursor --install-extension sveltex-preprocessor.sveltex
```

The extension is published to both the VS Code Marketplace and **Open VSX**, so
it resolves from whichever registry Cursor is pointed at.

</template>
<template #vscodium>

VSCodium installs from **Open VSX**, where the extension is published alongside
the Marketplace. Search **"SvelTeX"** in the Extensions view, or:

```sh
codium --install-extension sveltex-preprocessor.sveltex
```

</template>
<template #theia>

Theia installs extensions from **Open VSX**. Open the Extensions view, search
**"SvelTeX"**, and install — the bundled language server starts automatically
for `.sveltex` files.

</template>
<template #zed>

A native Zed extension is published to the Zed extension registry. Open the
extensions panel (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>), search
**"SvelTeX"**, and install. It launches the same
`@nvl/sveltex-language-server` over stdio. (Source:
[`editors/zed`](https://github.com/nvlang/sveltex/tree/main/editors/zed).)

::: tip Enable the heading outline in Zed

<span class="icon-tryout"><PhBookmarksSimple weight="duotone" :size="30" /> duotone&ensp;·&ensp;<PhBookmarksSimple weight="fill" :size="30" /> fill</span>

Zed's outline panel and breadcrumbs default to its tree-sitter queries, which
can't see the Markdown headings (they're delegated to an injected grammar). To
get the heading outline (as VS Code shows it), tell Zed to use the language
server's symbols for the `SvelTeX` language in your `settings.json`:

```json
{
  "languages": {
    "SvelTeX": { "document_symbols": "on" }
  }
}
```

:::

</template>
</EditorTabs>

## Any other editor

The language server is editor-agnostic. Any LSP-aware editor (Neovim, Emacs
`lsp-mode`, Sublime LSP, Helix, …) can launch it as a child process that speaks
LSP over stdio:

1.  Install the server:

    ```sh
    npm install -g @nvl/sveltex-language-server
    ```

2.  Configure your editor's LSP client to spawn `sveltex-language-server` (or,
    if `npm` didn't add it to your `PATH`, the `bin/server.js` it ships) for
    files matching `**/*.sveltex`.

For a worked example of how a third-party editor launches the server, see the
[Zed extension's manifest](https://github.com/nvlang/sveltex/blob/main/editors/zed/extension.toml)
and `editors/zed/src/lib.rs` — both spawn `bin/server.js` over stdio.

## Configuration

The language server has no configuration of its own — it reads your
project's SvelTeX configuration directly from
`svelte.config.{js,mjs,cjs,ts,mts,cts}` on the first request and
re-reads whenever the file (or anything it imports) changes.

What the server picks up from there:

-   the **verbatim environment names and aliases** (so hover and
    completion know which tags carve out non-delegated regions);
-   the **math delimiters and `mathBackend`** (which spawns the
    correct math language server — KaTeX or MathJax — for command
    completion);
-   the **markdown directives** settings (for the region detector).

Anything else (TeX compilation settings, output paths, caching) is
runtime-only and never needed by the language server.

::: tip

If the language server can't find a `svelte.config.*`, it falls back to
SvelTeX's implicit defaults and logs a notice to the output channel —
the server still works, but verbatim tags you've configured won't be
recognised. Add a `svelte.config.js` at the workspace root that
imports your SvelTeX configuration.

:::

## Companion: `@nvl/sveltex-math-language-server`

Math-only LSP that does TeX command completion and hover inside math
regions. Bundled with `@nvl/sveltex-language-server` — there's nothing
to install separately; the parent server spawns it on demand based on
your project's `mathBackend`. Useful as a standalone server too (for
editors that want math features in plain `.tex` / `.md` files).

## Troubleshooting

-   **The server doesn't start.** Check the editor's LSP / output
    channel for an error. The extension keeps syntax highlighting
    working even if the server fails, so the absence of hover /
    completion is the only outward symptom.

-   **TeX command completion is missing inside `$…$`.** The math
    backend is `'none'` or `'custom'` — neither has a corresponding
    math server. Set
    [`mathBackend`](math#installation) to `'katex'` or `'mathjax'`.

-   **No completion inside `<tex>` / `<latex>` / `<tikz>`.** The
    server forwards LaTeX-verbatim regions to TexLab; if `texlab`
    isn't on `PATH`, these regions are silently skipped. Install
    [TexLab](https://github.com/latex-lsp/texlab/releases) and
    restart your editor.

-   **Diagnostics for math / LaTeX are missing.** Not implemented
    yet — math and LaTeX verbatim regions get completion and hover
    but no diagnostics. The full Svelte / TypeScript / CSS
    diagnostic stream still works in delegated regions.

For implementation details — region detection, the virtual-document
strategy, position mapping — see the
[`@nvl/sveltex-language-server` README](https://github.com/nvlang/sveltex/blob/main/packages/sveltex-language-server/README.md).
