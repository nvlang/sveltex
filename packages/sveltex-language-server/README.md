# `@nvl/sveltex-language-server`

> [!WARNING]
> **This package is in alpha.** It is brand new and under active development.
> Its API, behaviour, and configuration may change at any time, and breaking
> changes should be expected before version `1.0.0`.

A Language Server Protocol (LSP) implementation for
[SvelTeX](https://sveltex.dev) — the Svelte preprocessor that lets a `.sveltex`
file mix Markdown, Svelte, and embedded LaTeX / math / code.

A `.sveltex` file is not a single language. The bulk of it is Svelte (markup,
`<script>`, `<style>`, mustache tags, logic blocks) interleaved with Markdown,
and punctuated by **verbatim** regions — fenced/inline code, KaTeX/MathJax math,
LaTeX environments — that must _not_ be interpreted as Svelte. This server gives
each region the treatment it deserves.

## Architecture

### The problem

The real Svelte tooling lives in
[`svelte-language-server`](https://www.npmjs.com/package/svelte-language-server).
It is excellent, but two facts shape everything here:

1. **It is not an embeddable library.** Its npm `exports` expose only `.` and
   `./bin/server.js`. The official Svelte VS Code extension spawns
   `svelte-language-server/bin/server.js` as a child process and proxies it over
   JSON-RPC. It is **not** built on [Volar](https://volarjs.dev/).
2. **It cannot be hosted inside Volar.** Volar is the dominant framework for
   embedded-language servers (MDX, Astro, and Vue use it), but Volar drives
   TypeScript semantics _itself_. Adopting Volar would mean reimplementing
   Svelte support instead of reusing `svelte-language-server`.

SvelTeX's own preprocessor is no help for position mapping either: its `markup`
step replaces escaped snippets with opaque UUIDs and lets the Markdown processor
reflow HTML, which destroys source offsets. There is no usable source map to
piggyback on.

### The approach: a hand-rolled, region-based proxy

```
        .sveltex file
              │
              ▼
   ┌──────────────────────┐
   │  core/regions.ts     │  parse into Region[]  (reuses SvelTeX's own
   │                      │   exported detectors: parseToMdast, getMdastES,
   │                      │   getSvelteES, getMathInSpecialDelimsES, ...)
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ core/virtual-svelte  │  build ONE virtual `.svelte` document:
   │                      │   • delegated regions copied byte-for-byte
   │                      │   • everything else blanked to same-length
   │                      │     whitespace (newlines preserved)
   │                      │   → emits Mapping[]  (offset-triple model)
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐         ┌─────────────────────────────┐
   │ core/svelte-proxy.ts │ ──JSON──▶│  svelte-language-server      │
   │  (spawns child)      │◀─ RPC ──│  (real Svelte tooling, child  │
   └──────────┬───────────┘         │   process)                   │
              │                     └─────────────────────────────┘
              ▼
   ┌──────────────────────┐
   │ core/mapper.ts       │  SourceMap: bidirectional offset/position/range
   │                      │  translation between source and virtual docs
   └──────────────────────┘
```

- **`core/regions.ts`** — splits the `.sveltex` document into a gap-free
  `Region[]`. It does **not** re-implement SvelTeX's parser; it calls the
  region-detection functions SvelTeX already exports (`parseToMdast`,
  `getMdastES`, `getSvelteES`, `getMathInSpecialDelimsES`, `getColonES`,
  `outermostRanges`), each of which reports precise offsets on the original
  source. Every region is classified as **delegated** (plain Markdown/HTML,
  Svelte markup, mustache tags) or **non-delegated** (verbatim, code, math,
  frontmatter).
- **`core/virtual-svelte.ts`** — builds a single virtual `.svelte` document.
  Delegated regions are copied verbatim; non-delegated regions are replaced by
  an equal-length run of whitespace (line breaks kept, so line numbers never
  shift). The result is the same length as the source, which keeps mapping
  geometry trivial.
- **`core/mapping.ts` / `core/mapper.ts`** — the position mapper. The data
  model is a trimmed-down adaptation of Volar's `CodeMapping` offset-triple
  representation (`sourceOffset` / `generatedOffset` / `length` + per-region
  feature flags). `SourceMap` does binary-searched, bidirectional translation of
  offsets, `Position`s and `Range`s. _Volar itself is **not** a dependency_ —
  only its proven data shape is borrowed.
- **`core/svelte-proxy.ts`** — resolves `svelte-language-server/bin/server.js`
  from `node_modules`, forks it, and speaks LSP with it over a stdio JSON-RPC
  connection.
- **`core/lsp-proxy.ts`** — a _generic_ child-language-server proxy (the same
  spawn/JSON-RPC pattern as `svelte-proxy.ts`, but server-agnostic). Supports
  both a forked Node module (the bundled math language server) and a spawned
  native executable (the TexLab binary).
- **`core/region-virtual.ts`** — builds a small, standalone virtual document
  for a single non-delegated region: bare TeX for a math region (delimiters
  stripped), bare LaTeX for a verbatim region (tags stripped), each with a
  `SourceMap` back to the `.sveltex` source.
- **`core/texlab.ts`** — robust, cross-platform detection of a `texlab` binary
  on `PATH`.
- **`core/region-forwarding.ts`** — forwards hover/completion that land in a
  math region (to the math language server) or a LaTeX verbatim region (to
  TexLab), spawning those children lazily and mapping results back.
- **`core/markdown.ts`** — native Markdown features (document symbols, folding
  ranges, selection ranges) computed directly from the mdast. These need no
  position mapping because the mdast carries source offsets.
- **`core/frontmatter.ts`** — native hover and completion for a frontmatter
  block: the frontmatter keys (`title`, `meta`, `base`, `link`, …) and the
  standard `<meta>` names, resolved against the block the caret sits in.
- **`core/diagnostics.ts` / `core/remap.ts`** — translate every
  position-bearing message. Requests are mapped source → generated before being
  forwarded; responses (and diagnostics) are mapped generated → source, and
  anything that lands in a non-delegated region is dropped.
- **`core/server.ts`** — `createServer(connection)`, the orchestrator. It
  routes each request: a delegated region goes to the Svelte proxy, a math or
  LaTeX-verbatim region to `RegionForwarder`, and a frontmatter region to the
  native `core/frontmatter.ts` handler.

### Why one virtual document and not many

A `.sveltex` file _is_ essentially a Svelte file with holes. Producing a single
virtual `.svelte` document (rather than one per embedded language) means the
embedded `svelte-language-server` sees a coherent Svelte file and its
TypeScript/HTML/CSS analysis works exactly as it would for a hand-written
`.svelte` file. The holes (verbatim/code/math) are simply blank to it.

## The core / wrapper split

The most important structural rule of this package:

> **`createServer(connection)` is transport-agnostic. It never imports
> `vscode`, never touches `process.stdin`, and never assumes how it is being
> run.**

```
src/core/server.ts   →  createServer(connection: Connection)   ← pure core
src/index.ts         →  startServer()  (stdio convenience wrapper)
bin/server.js        →  #!/usr/bin/env node  →  startServer()
```

This is what makes the same core reusable across editors:

- **VS Code** (`packages/vscode-sveltex`, wired up now): a
  `vscode-languageclient` `LanguageClient` launches `bin/server.js` as a child
  process over Node IPC. `startServer()` creates the LSP connection;
  `createServer()` does the work.
- **Zed** (`editors/zed`): a thin Zed extension that launches `bin/server.js`
  and talks LSP over **stdio**. Because `createServer()` is transport-agnostic
  and `bin/server.js` already exists, the Zed extension needs no change to this
  package — it is purely a thin launcher on the Zed side.

Any future host (Neovim, Emacs `lsp-mode`, Sublime LSP, ...) plugs in the same
way: run `bin/server.js`, speak LSP.

## Feature coverage

**Proxied to `svelte-language-server`, fully position-mapped**, and suppressed
inside non-delegated regions:

- Diagnostics (merged with native ones)
- Hover
- Completion (+ completion-item resolve)
- Go-to-definition
- Find references
- Document highlight
- Code actions
- Rename (+ prepare-rename)
- Signature help
- Document links

**Native** (computed directly from the `.sveltex` source, no proxy, no mapping
needed):

- Document symbols (heading outline)
- Folding ranges
- Selection ranges
- Frontmatter hover and completion — the frontmatter keys and standard
  `<meta>` names, each documented with a link to MDN

**Forwarded to dedicated child servers** (each non-delegated region becomes its
own small virtual document; positions and results are mapped back):

- **Math regions** (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`) → the bundled
  [`@nvl/sveltex-math-language-server`](../sveltex-math-language-server),
  spawned with `initializationOptions.backend` set from the SvelTeX config's
  `mathBackend`. TeX command completion (on `\`) and rich hover — the
  command's signature, the Unicode symbol it renders, and a description. When
  `mathBackend` is `custom` or `none` — backends with no math server — math
  regions are skipped.
- **LaTeX verbatim regions** (a `verbatim` environment whose tag is one of the
  configured `latexTags` — `tex` / `latex` / `tikz` by default) → a spawned
  [TexLab](https://github.com/latex-lsp/texlab) process, _if_ a `texlab` binary
  is found on `PATH`. Hover, completion, and TexLab's other LaTeX features. If
  `texlab` is not installed, these regions are skipped silently — no error.

**Document sync:** `didOpen` / `didChange` / `didClose` of the source file are
translated into sync of the virtual `.svelte` document. Each change triggers a
synchronous full re-parse (full-document sync).

**Configuration:** `svelte.config.{js,mjs,cjs,ts,mts,cts}` is loaded on
`initialize` and live-reloaded on save to pick up verbatim-environment names,
math delimiters, the math backend, and directive settings. (The user's
`sveltex.config.*` is loaded indirectly when the Svelte config imports it.)
The config is evaluated in a child Node process via `--input-type=module
--eval`, so `.ts` / `.mts` / `.cts` configs run natively on Node 22.6+.

## Known limitations / stubbed for later

- **LaTeX / math diagnostics** are not yet produced. Math and LaTeX verbatim
  regions get completion and hover (forwarded, see above), but no _diagnostics_
  are surfaced for them.
- **Markdown → HTML expansion.** Delegated Markdown is currently passed to the
  Svelte server as-is. A future phase will expand it to the HTML the Svelte
  compiler actually sees; the `Mapping` model already supports the non-identity
  (length-changing) mappings this needs.
- **Incremental virtual-file updates.** Each edit rebuilds the whole virtual
  document. A future phase can patch incrementally.
- **Formatting** is not yet proxied.
- The region detectors are imported via a deep path
  (`@nvl/sveltex/dist/utils/escape.js`) because `@nvl/sveltex` does not yet
  expose a public `getRegions()`. A `TODO` tracks upstreaming one.

## Development

```sh
pnpm --filter @nvl/sveltex-language-server build   # type-check + emit dist/
pnpm --filter @nvl/sveltex-language-server test    # run unit/integration tests
pnpm --filter @nvl/sveltex-language-server lint    # eslint + tsc --noEmit
```

The `tests/unit/` suite covers the bidirectional mapper (the most error-prone
component), region computation, virtual-document building, the per-region
virtual documents, the config snapshot, TexLab detection, math/verbatim
forwarding, and an end-to-end check that spawns `bin/server.js` and drives it
over stdio. The TexLab path is tested with TexLab made absent, so the suite
does not require the `texlab` binary.

## How to try the extension

The [`vscode-sveltex`](../vscode-sveltex) extension launches this server. To
exercise the whole stack inside VS Code:

1. **Build everything** from the monorepo root:

   ```sh
   pnpm install
   pnpm --filter @nvl/sveltex build
   pnpm --filter @nvl/sveltex-math-language-server build
   pnpm --filter @nvl/sveltex-language-server build
   pnpm --filter sveltex build      # the VS Code extension
   ```

2. **Launch the Extension Development Host.** Open `packages/vscode-sveltex/`
   in VS Code and press <kbd>F5</kbd> (Run → Start Debugging). A second VS Code
   window opens with the SvelTeX extension loaded.

3. **Open a project** that has a `.sveltex` file (and, ideally, a
   `sveltex.config.{js,mjs,cjs}` so the math backend is detected — otherwise
   the server defaults to MathJax). The sample showcase project under
   `packages/sveltex/tests/e2e/showcase/` is a good candidate.

4. **Confirm end-to-end behaviour** in a `.sveltex` file:

   - Inside a `<script lang="ts">` block, write a type error
     (`const n: number = 'x';`) — a Svelte/TypeScript diagnostic appears,
     proving the embedded `svelte-language-server` is being proxied.
   - Inside inline math (`$ … $`), type a backslash and a few letters
     (`\alp`) — TeX command completion offers `\alpha`. Hover a command such as
     `\frac` for a description. The offered commands match the project's
     `mathBackend` (KaTeX vs MathJax).
   - Inside a LaTeX verbatim environment (`<tex> … </tex>`), completion and
     hover work _if_ a `texlab` binary is on `PATH`; if not, the editor simply
     offers nothing there (no error).
   - In the frontmatter block, hover a key such as `title` or `description`,
     and press <kbd>Ctrl</kbd>+<kbd>Space</kbd> while typing a key — both are
     answered natively.
   - A heading outline appears in the Outline view (native Markdown symbols).

If the language server fails to start, the extension logs an error but keeps
syntax highlighting working; check the "SvelTeX Language Server" output channel
in the Extension Development Host for details.

For an automated smoke test, this package's
`tests/unit/server.test.ts` already spawns `bin/server.js` and drives the same
requests over stdio — the transport the VS Code client uses.
