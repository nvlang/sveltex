# Change Log

## 2.1.0

### Minor Changes

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
  [`049ca07`](https://github.com/nvlang/sveltex/commit/049ca07d96ffb1502e00ce58704d6eaa9919594d)
  Thanks [@nvlang](https://github.com/nvlang)! - Disable indented (4-space) code
  blocks in the VS Code extension's Markdown TextMate grammar, matching the
  forked tree-sitter grammar and SvelTeX's own Markdown parsing:
  4-space-indented prose stays a paragraph (with its inline markup still
  highlighted) instead of being coloured as a code block.

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`7c98d41`](https://github.com/nvlang/sveltex/commit/7c98d4108029998a39081f1e098fdeba0d66df5e)
  Thanks [@nvlang](https://github.com/nvlang)! - Harden the runtime
  TextMate-grammar regeneration:
    - **Regex-escape verbatim tag names** before splicing them into the
      generated grammar, and **anchor** the tag validator (`^…$`). Previously a
      tag containing a regex metacharacter (e.g. `a.b`) matched too broadly, and
      the unanchored validator let a malformed or hostile config inject regex
      syntax into the grammar.
    - **Guard grammar regeneration** so a filesystem error (a read-only install,
      a missing template) can no longer throw out of `activate()` and take the
      language server and syntax highlighting down with it.

    Also refreshes the Marketplace README, which still documented the removed
    `sveltex.latexTags` / `sveltex.escapeTags` settings.

- [#34](https://github.com/nvlang/sveltex/pull/34)
  [`3dcaa9d`](https://github.com/nvlang/sveltex/commit/3dcaa9d915ac6f896f12ac45e1fb313bb0b9249d)
  Thanks [@nvlang](https://github.com/nvlang)! - Fix multi-line `<tex>` /
  `<latex>` / `<tikz>` and `<verbatim>` blocks never closing in the VS Code
  TextMate grammar. The nested `begin: ^ / while:` sub-rule was consuming
  content line-by-line and shadowing the outer `end:`, so the closing `</tex>`
  (etc.) never popped the `meta.embedded.block.latex` scope — everything after
  the first opening tag stayed highlighted as embedded LaTeX. Replaced with the
  standard `begin / end` pair plus an `include: text.tex.latex` for the body.
- Updated dependencies
  [[`9a2095d`](https://github.com/nvlang/sveltex/commit/9a2095d6d0a53f0883d80ae84ec02d475d0dc6ea),
  [`8637310`](https://github.com/nvlang/sveltex/commit/86373104bb1da7e98879701fcdcd78c68aa2661d),
  [`c9b5a85`](https://github.com/nvlang/sveltex/commit/c9b5a8525960baa76fa734bc291ebc9f8121fc3a),
  [`24d8ff7`](https://github.com/nvlang/sveltex/commit/24d8ff73a75f70a1f8b87c66e269bbcfcfce8da8),
  [`22b6dce`](https://github.com/nvlang/sveltex/commit/22b6dce8754179638b0b85b866882f35ee022133)]:
    - @nvl/sveltex-math-language-server@0.2.1
    - @nvl/sveltex-language-server@0.3.0

## 2.0.0

### Major Changes

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

### Minor Changes

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
  [[`b6617c0`](https://github.com/nvlang/sveltex/commit/b6617c0ae23c873e6866e86434198e197d9256ae),
  [`ad1a3fa`](https://github.com/nvlang/sveltex/commit/ad1a3fa5503a211e3f04710cbdfe04a945bc1a64),
  [`47b6bc1`](https://github.com/nvlang/sveltex/commit/47b6bc1a27125114887fcec89b0211714024f85e),
  [`aa69190`](https://github.com/nvlang/sveltex/commit/aa691900e9279da6fd643994c3d1a838fe4f001b)]:
    - @nvl/sveltex-language-server@0.2.0
    - @nvl/sveltex-math-language-server@0.2.0

## [1.0.3] - 2025-04-29

### Documentation

- Fixed link to screenshot in `README.md`.

### Build

- Reduce extension size by not bundling unnecessary files.

## [1.0.2] - 2024-07-09

### Fixes

- Increased specificity of scopes of some pattern injections to avoid conflicts
  with e.g. the comment or string scopes within script blocks.

### Dev Dependencies

- Updated `@types/node`: `^20.14.9` → `^20.14.10`.

## [1.0.1] - 2024-06-30

### Documentation

- Improved `README.md` for rendering on the VS Code Marketplace.

## [1.0.0] - 2024-06-30

### Features

- Added basic support for SvelTeX syntax highlighting.
