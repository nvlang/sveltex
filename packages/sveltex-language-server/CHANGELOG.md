# @nvl/sveltex-language-server

## 0.3.0

### Minor Changes

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`c9b5a85`](https://github.com/nvlang/sveltex/commit/c9b5a8525960baa76fa734bc291ebc9f8121fc3a)
  Thanks [@nvlang](https://github.com/nvlang)! - Two related fixes for custom
  verbatim envs:

    **`noop`-typed envs are now visible to `svelte-language-server`.** Per the
    SvelTeX docs, `type: 'noop'` "passes the body to Svelte unchanged", so the
    body should travel into the virtual `.svelte` document the LSP hands to
    `svelte-language-server`. Previously the LSP classified all verbatim regions
    as kind `'verbatim'`, which is blanked from the virtual document — Svelte
    never saw `<MyNoop>` bodies. Now the body is delegated (kind `'svelte'`)
    while the wrapper tags stay blanked, so the proxy sees the body without
    tripping over the SvelTeX wrapper tags (which are rewritten at build time
    and aren't real Svelte components).

    **Custom `escape`- and `code`-typed envs get flat semantic-token coloring in
    non-VS-Code clients.** A scoped `textDocument/ semanticTokens/full` provider
    emits one `string` token per body line of a custom escape- or code-typed
    verbatim region (e.g. `<MyEscape>`, `<MyCode>`). Tex- and noop-typed envs
    and the standard hardcoded `tex|latex|tikz|verb|verbatim` are skipped —
    those are handled by the editor grammars directly (TM regen in VS Code,
    native tree-sitter captures in Zed). The provider is advertised only when
    the client's `initializationOptions.client` is anything other than
    `'vscode'`; VS Code stays on the TM-only path so its grammar regeneration
    isn't overridden by semantic tokens.

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`22b6dce`](https://github.com/nvlang/sveltex/commit/22b6dce8754179638b0b85b866882f35ee022133)
  Thanks [@nvlang](https://github.com/nvlang)! - The VS Code extension's
  TextMate grammar is now driven entirely by the user's `sveltex.config.js` /
  `svelte.config.js` — the `sveltex.latexTags` / `sveltex.escapeTags` extension
  settings are gone. The language server reports the live verbatim tag list to
  the client via a new `sveltex/resolvedTags` notification (sent on
  `initialized` and after every config reload), keyed by type:
    - `latexTags` (`type: 'tex'`) — body highlighted as LaTeX via
      `text.tex.latex`.
    - `escapeTags` (`type: 'escape'`) — body highlighted as plain literal text
      via `markup.fenced_code.block.markdown`.
    - `codeTags` (`type: 'code'`) — body highlighted the same as `escape` (both
      look like literal text in the editor; the build-time backend decides what
      to actually do with it).
    - `noopTags` (`type: 'noop'`) — body handed to `source.svelte` (noop bodies
      pass through unchanged to the Svelte compiler, so they should look like
      ordinary Svelte markup in the editor).

    A user who adds `MyTex: { type: 'tex' }` / `MyEscape: { type: 'escape' }` /
    `MyCode: { type: 'code' }` / `MyNoop: { type: 'noop' }` to their config now
    gets the appropriate editor highlighting for each — no other configuration
    step needed. A window reload may be required once after first declaring a
    new tag for VS Code to pick up the regenerated grammar.

    Bug fix in passing: the existing single-line `<verb>…</verb>` /
    `<verbatim>…</verbatim>` TextMate match incorrectly used the LaTeX tag-name
    alternation; same-line plain verbatim envs weren't highlighted as fenced
    code. Fixed.

### Patch Changes

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`8637310`](https://github.com/nvlang/sveltex/commit/86373104bb1da7e98879701fcdcd78c68aa2661d)
  Thanks [@nvlang](https://github.com/nvlang)! - Region-detection and reload
  improvements:
    - **Recognise verbatim `aliases`.** The resolved verbatim-tag set now
      includes each environment's `aliases`, not just the record keys — so an
      aliased env (e.g. `<tikz>` for a `tex`-typed `Tex`) is correctly detected
      as a verbatim region (its body blanked, and `tex` types forwarded to
      TexLab) instead of being mis-delegated to `svelte-language-server` as
      markup.
    - **Watch the config's dependency graph.** A live config reload now also
      fires when a file the `svelte.config.*` statically imports changes (a
      separate `sveltex.config.js`, a shared helper module), via a server-side
      watcher — which also brings live reload to clients (Zed, standalone) that
      register no file watcher of their own.
    - **Don't resurrect closed documents during reload.** The config-reload
      resync now re-checks each document's liveness around its async proxy
      close/open, so a document the editor closes mid-reload is no longer
      re-opened in the Svelte proxy as a phantom virtual document with stale
      diagnostics.

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`24d8ff7`](https://github.com/nvlang/sveltex/commit/24d8ff73a75f70a1f8b87c66e269bbcfcfce8da8)
  Thanks [@nvlang](https://github.com/nvlang)! - Two robustness fixes surfaced
  while bringing the server to full coverage:
    - **Go-to-definition no longer returns a stale origin range.** When a
      `LocationLink`'s `originSelectionRange` could not be mapped back to the
      source, it leaked through in virtual-document coordinates; it is now
      dropped.
    - **`LspProxy.start()` no longer hangs when the child dies mid-handshake.**
      A child language server that crashes or exits during `initialize` now
      rejects startup (and tears the proxy down to a clean not-running state)
      instead of hanging on a response that will never arrive.

- Updated dependencies
  [[`9a2095d`](https://github.com/nvlang/sveltex/commit/9a2095d6d0a53f0883d80ae84ec02d475d0dc6ea),
  [`15ef830`](https://github.com/nvlang/sveltex/commit/15ef830fb6b832c28fd6b6dbcf2c892899b72994)]:
    - @nvl/sveltex@0.5.1
    - @nvl/sveltex-math-language-server@0.2.1

## 0.2.0

### Minor Changes

- [`b6617c0`](https://github.com/nvlang/sveltex/commit/b6617c0ae23c873e6866e86434198e197d9256ae)
  Thanks [@nvlang](https://github.com/nvlang)! - Enrich the frontmatter hover
  for top-level keys in `.sveltex` files: the hover body now appends one section
  per frontmatter-processing step the key takes part in — what it inserts into
  `<svelte:head>` (for `<title>`, `<meta>`, `<link>`, `<base>`, `<noscript>`
  keys) and its entry in the `metadata` export — each with the
  `frontmatter: { … }` toggle that switches that step off.

    The `imports` key gets a dedicated section describing the `import`
    statements it generates. Nested-block keys (inside `meta` / `base` / `link`)
    and value hovers continue to show the plain entry summary.

    The hover heading now shows what SvelTeX actually renders for the key, with
    `〈value〉` / `〈href〉` / `〈target〉` placeholders standing in for the
    parts that come from the user's frontmatter — e.g. for `color-scheme`:

    ```
    **`color-scheme`** — renders `<meta name="color-scheme" content="〈value〉">`
    ```

    rather than the previously misleading `renders <meta name="color-scheme">`
    (which omitted the `content` attribute) or `renders <base>` (which suggested
    an empty element). The summaries for `base`, `meta`, `link` and `imports`
    also now spell out the required sub-fields each one expects.

- [`ad1a3fa`](https://github.com/nvlang/sveltex/commit/ad1a3fa5503a211e3f04710cbdfe04a945bc1a64)
  Thanks [@nvlang](https://github.com/nvlang)! - The language server now
  resolves and live-reloads the user's SvelTeX configuration:
    - locates `svelte.config.{js,mjs,cjs,ts,mts,cts}` from the workspace root,
    - runs it in a short-lived child process to extract the SvelTeX
      preprocessor's configuration (so the host editor's Node process is never
      blocked or polluted),
    - watches the resolved config file and its transitively-imported files,
      debouncing reloads on change,
    - surfaces load outcomes (success, transient failure, missing config) in the
      LSP output channel.

    Also fixes a `completionItem/resolve -32603` error that surfaced when the
    forwarded child language server returned `null` from `resolve`.

- [`47b6bc1`](https://github.com/nvlang/sveltex/commit/47b6bc1a27125114887fcec89b0211714024f85e)
  Thanks [@nvlang](https://github.com/nvlang)! - Initial release of
  `@nvl/sveltex-language-server`. The VS Code extension now starts a full
  language server (the new `@nvl/sveltex-language-server` package). For the
  delegated regions of a `.sveltex` file it proxies the Svelte language server —
  diagnostics, hover, completion, go-to-definition, references, rename and more
  — while suppressing it inside verbatim, code, math and frontmatter regions. It
  also adds native features computed directly from the source: a Markdown
  heading outline, folding ranges, selection ranges, and — in the YAML / TOML /
  JSON frontmatter block — context-aware hover and completion for the
  frontmatter keys (`title`, `meta`, `base`, `link`, …) and standard `<meta>`
  names, each documented with a link to MDN. The server core is
  transport-agnostic, so the same core backs both the VS Code extension and a
  Zed extension.

- [`aa69190`](https://github.com/nvlang/sveltex/commit/aa691900e9279da6fd643994c3d1a838fe4f001b)
  Thanks [@nvlang](https://github.com/nvlang)! - Initial release of
  `@nvl/sveltex-math-language-server`, plus the wiring in
  `@nvl/sveltex-language-server` that forwards math and LaTeX regions to it.

    The SvelTeX language server now offers TeX-math and LaTeX assistance. The
    new `@nvl/sveltex-math-language-server` package provides command/macro
    completion (triggered on `\`) and hover for the math inside `$…$` / `$$…$$`
    regions, accurately scoped to the project's math backend (KaTeX or MathJax —
    their command sets differ, and the lists are extracted from each engine's
    own package source). The hover shows a command's signature, the Unicode
    symbol it renders (e.g. `∮ (contour integral)`), a one-line description and
    the providing package. The language server forwards math regions to it, and
    forwards LaTeX verbatim regions (`<tex>` / `<latex>` / `<tikz>`) to
    [TexLab](https://github.com/latex-lsp/texlab) when a `texlab` binary is on
    `PATH`. Both are skipped gracefully when unavailable.

### Patch Changes

- Updated dependencies
  [[`33b8d16`](https://github.com/nvlang/sveltex/commit/33b8d167966e6148df72e55b4b761e7587ae9149),
  [`33b8d16`](https://github.com/nvlang/sveltex/commit/33b8d167966e6148df72e55b4b761e7587ae9149),
  [`33b8d16`](https://github.com/nvlang/sveltex/commit/33b8d167966e6148df72e55b4b761e7587ae9149),
  [`aa69190`](https://github.com/nvlang/sveltex/commit/aa691900e9279da6fd643994c3d1a838fe4f001b),
  [`6895bc6`](https://github.com/nvlang/sveltex/commit/6895bc6556a72baac5a739ad747454dbc1d0b8f2),
  [`4381c80`](https://github.com/nvlang/sveltex/commit/4381c808c8ffe0e6c78549a331d267b7a6f24a70),
  [`badb34e`](https://github.com/nvlang/sveltex/commit/badb34ecbcf50b0e588ebe61cd33a9305d0173a7),
  [`ad1a3fa`](https://github.com/nvlang/sveltex/commit/ad1a3fa5503a211e3f04710cbdfe04a945bc1a64)]:
    - @nvl/sveltex@0.5.0
    - @nvl/sveltex-math-language-server@0.2.0
