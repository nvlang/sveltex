# `@nvl/sveltex-language-server`

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
- **`core/markdown.ts`** — native Markdown features (document symbols, folding
  ranges, selection ranges) computed directly from the mdast. These need no
  position mapping because the mdast carries source offsets.
- **`core/diagnostics.ts` / `core/remap.ts`** — translate every
  position-bearing message. Requests are mapped source → generated before being
  forwarded; responses (and diagnostics) are mapped generated → source, and
  anything that lands in a non-delegated region is dropped.
- **`core/server.ts`** — `createServer(connection)`, the orchestrator.

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
- **Zed** (future, not built here): the Zed extension only needs to launch
  `bin/server.js` and talk LSP over **stdio**. Because `createServer()` is
  transport-agnostic and `bin/server.js` already exists, _no change to this
  package is required_ — the Zed extension is purely a thin launcher on the Zed
  side.

Any future host (Neovim, Emacs `lsp-mode`, Sublime LSP, ...) plugs in the same
way: run `bin/server.js`, speak LSP.

## v1 feature coverage

**Proxied to `svelte-language-server`, fully position-mapped**, and suppressed
inside non-delegated regions:

- Diagnostics (merged with native ones)
- Hover
- Completion (+ completion-item resolve)
- Go-to-definition / declaration
- Find references
- Document highlight
- Code actions
- Rename (+ prepare-rename)
- Signature help
- Document links

**Native** (computed from the mdast, no proxy, no mapping needed):

- Document symbols (heading outline)
- Folding ranges
- Selection ranges

**Document sync:** `didOpen` / `didChange` / `didClose` of the source file are
translated into sync of the virtual `.svelte` document. Changes trigger a
debounced full re-parse (v1 uses full-document sync).

**Configuration:** `sveltex.config.{js,cjs,mjs}` is loaded on `initialize` to
pick up verbatim-environment names, math delimiters, and directive settings.

## Known limitations / stubbed for later

- **LaTeX / math language features** are stubbed. Math and verbatim regions are
  recognized and excluded from Svelte analysis, but no diagnostics, hover or
  completion are produced _for_ them yet. (`TODO`s mark the seams.)
- **Markdown → HTML expansion.** Delegated Markdown is currently passed to the
  Svelte server as-is. A future phase will expand it to the HTML the Svelte
  compiler actually sees; the `Mapping` model already supports the non-identity
  (length-changing) mappings this needs.
- **Incremental virtual-file updates.** Each edit rebuilds the whole virtual
  document. Fine for v1; a future phase can patch incrementally.
- **`.ts` config files** are detected but not executed (running them needs a
  TypeScript loader). `.js` / `.cjs` / `.mjs` configs are fully loaded.
- **Formatting** is not yet proxied.
- The region detectors are imported via a deep path
  (`@nvl/sveltex/dist/utils/escape.js`) because `@nvl/sveltex` does not yet
  expose a public `getRegions()`. A `TODO` tracks upstreaming one.

## Development

```sh
pnpm --filter @nvl/sveltex-language-server build   # type-check + emit dist/
pnpm --filter @nvl/sveltex-language-server test    # run unit tests
pnpm --filter @nvl/sveltex-language-server lint    # eslint + tsc --noEmit
```

The bidirectional mapper — the most error-prone component — is covered by
`tests/unit/mapper.test.ts`.
