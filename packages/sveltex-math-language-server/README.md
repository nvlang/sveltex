# `@nvl/sveltex-math-language-server`

A small, standalone Language Server Protocol (LSP) implementation that provides
editor assistance for **TeX math** — the math written inside the `$…$` /
`$$…$$` / `\(…\)` / `\[…\]` regions of a [SvelTeX](https://sveltex.dev)
document.

It is spawned by [`@nvl/sveltex-language-server`](../sveltex-language-server),
which feeds it each math region of a `.sveltex` file as its own tiny virtual
TeX document, but it is an ordinary LSP server and can be launched directly by
any editor over stdio.

## Features

- **Command completion** — triggered on `\`. As you type `\fra…` the server
  offers `\frac`, `\frak`, … Inside `\begin{…}` / `\end{…}` it offers
  environment names instead.
- **Hover** — hovering a command shows a short description, its category
  (function / symbol / macro / environment) and which backend supports it.

## Two backends, two command sets

The server runs in one of two modes, chosen by the LSP `initialize` request's
`initializationOptions`:

```jsonc
{ "backend": "mathjax" } // or "katex"
```

This matters because **KaTeX and MathJax support different sets of commands**.
A command list that mixed them would suggest commands that silently fail to
render. So the server ships one accurate list per backend and offers only the
commands the selected backend actually understands.

If `initializationOptions.backend` is absent or unrecognised the server falls
back to `mathjax` (SvelTeX's default math backend).

## How the command lists are sourced

The lists are **not** transcribed from prose documentation — that drifts. They
are extracted directly from each backend's own package source by
[`scripts/generate-commands.ts`](./scripts/generate-commands.ts), which writes
[`src/data/commands.generated.ts`](./src/data/commands.generated.ts):

- **KaTeX** declares its commands in four side-effect-populated tables —
  `functions`, `symbols`, `macros` and `environments` (the default exports of
  the matching files under `katex/src/`). KaTeX supports a finite, enumerable
  set; those four tables _are_ that set.
- **MathJax** registers its TeX macros/symbols/environments through a global
  `MapHandler`. The generator patches `MapHandler.register`, imports the
  packages the default `input/tex` configuration loads — plus the ones its
  `autoload` extension pulls in on demand (`mhchem`, `cancel`, `braket`, …) —
  and reads the registered token keys back out. Packages that need an explicit
  `\require{}` (`physics`, `mathtools`, …) are intentionally excluded: they are
  not available out of the box, so offering them would be a false promise.

`katex` and `@mathjax/src` are **devDependencies only** — the published package
ships the generated static data and has no runtime dependency on either. Run

```sh
pnpm --filter @nvl/sveltex-math-language-server generate
```

to regenerate the lists after a `katex` / `@mathjax/src` version bump.

## Architecture

```
src/data/commands.generated.ts   ← generated, per-backend command tables
src/core/commands.ts             ← CommandTable: indexed prefix/exact lookup
src/core/context.ts              ← TeX caret-context lexing (\cmd, \begin{…})
src/core/describe.ts             ← human-readable command descriptions
src/core/features.ts             ← pure completion + hover (LSP payloads)
src/core/server.ts               ← createServer(connection): the orchestrator
src/index.ts                     ← startServer() (stdio convenience wrapper)
bin/server.js                    ← #!/usr/bin/env node → startServer()
```

`createServer(connection)` is **transport-agnostic** — it never imports
`vscode` and never touches `process.stdin`. The same core therefore backs the
stdio `bin/server.js` and any in-process host, exactly like
`@nvl/sveltex-language-server`.

## Development

```sh
pnpm --filter @nvl/sveltex-math-language-server generate   # refresh command data
pnpm --filter @nvl/sveltex-math-language-server build      # type-check + emit dist/
pnpm --filter @nvl/sveltex-math-language-server test       # run unit/integration tests
pnpm --filter @nvl/sveltex-math-language-server lint       # eslint + tsc --noEmit
```

The test suite covers the per-backend command tables, the caret-context lexer,
completion filtering and hover, and an end-to-end check that spawns
`bin/server.js` and drives it over stdio.
