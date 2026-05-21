# @nvl/sveltex-language-server

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
