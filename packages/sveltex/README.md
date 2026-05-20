<br>
<div align="center">
<picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nvlang/sveltex/main/res/dark/logotype.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/nvlang/sveltex/main/res/light/logotype.svg">
    <img alt="Logotype" src="https://raw.githubusercontent.com/nvlang/sveltex/main/res/light/logotype.svg" width="40%">
</picture>
<br>
<br>
<div>

[<picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/github/v/tag/nvlang/sveltex?style=flat-square&logo=GitHub&logoColor=a3acb7&label=&labelColor=21262d&color=21262d&filter=@nvl/sveltex@*"><source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/github/v/tag/nvlang/sveltex?style=flat-square&logo=GitHub&logoColor=24292f&label=&labelColor=eaeef2&color=eaeef2&filter=@nvl/sveltex@*"><img alt="GitHub version tag" src="https://img.shields.io/github/v/tag/nvlang/sveltex?style=flat-square&logo=GitHub&logoColor=24292f&label=&labelColor=eaeef2&color=eaeef2&filter=@nvl/sveltex@*"></picture>](https://github.com/nvlang/sveltex)
[<picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&logo=npm&logoColor=a3acb7&labelColor=21262d&color=21262d&logoSize=auto)"><source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&logo=npm&logoColor=24292f&labelColor=eaeef2&color=eaeef2&logoSize=auto)"><img alt="NPM package name" src="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&logo=npm&logoColor=24292f&labelColor=eaeef2&color=eaeef2&logoSize=auto)"></picture>](https://npmjs.com/@nvl/sveltex)
[<picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&labelColor=21262d&color=21262d&logo=jsr&logoColor=a3acb7&logoSize=auto"><source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&labelColor=eaeef2&color=eaeef2&logo=jsr&logoColor=24292f&logoSize=auto"><img alt="JSR package name" src="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&labelColor=eaeef2&color=eaeef2&logo=jsr&logoColor=24292f&logoSize=auto"></picture>](https://jsr.io/@nvl/sveltex)
[<picture><source media="(prefers-color-scheme: dark)" srcset="https://jsr.io/badges/@nvl/sveltex/score?style=flat-square&labelColor=21262d&color=21262d&logoColor=a3acb7"><source media="(prefers-color-scheme: light)" srcset="https://jsr.io/badges/@nvl/sveltex/score?style=flat-square&labelColor=eaeef2&color=eaeef2&logoColor=24292f"><img alt="JSR score" src="https://jsr.io/badges/@nvl/sveltex/score?style=flat-square&labelColor=eaeef2&color=eaeef2&logoColor=24292f"></picture>](https://jsr.io/@nvl/sveltex)
[<picture><source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/codecov/c/github/nvlang/sveltex?flag=sveltex&style=flat-square&logo=codecov&label=&logoColor=a3acb7&labelColor=21262d&color=21262d"><source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/codecov/c/github/nvlang/sveltex?flag=sveltex&style=flat-square&logo=codecov&label=&logoColor=24292f&labelColor=eaeef2&color=eaeef2"><img alt="CodeCov coverage" src="https://img.shields.io/codecov/c/github/nvlang/sveltex?flag=sveltex&style=flat-square&logo=codecov&label=&logoColor=24292f&labelColor=eaeef2&color=eaeef2"></picture>](https://codecov.io/gh/nvlang/sveltex)

</div>
</div>


## Getting Started

**Note:** See the [docs] for more information.<br>
**Note**: This package is [ESM-only].

### Adding SvelTeX to a project

The quickest way is the [`@nvl/sveltex-sv`] community add-on for the [Svelte CLI]
(`sv`). In a SvelteKit project, run:

```sh
npx sv add @nvl/sveltex-sv
```

…and follow the prompts. It installs `@nvl/sveltex` and the peer dependencies
for the backends you pick, creates a `sveltex.config.{js,ts}`, and wires the
SvelTeX preprocessor and the `.sveltex` extension into your
`svelte.config.{js,ts}`. Starting from scratch? Run `npx sv create` first,
then `npx sv add @nvl/sveltex-sv` inside the new project.

> [!NOTE]
> Svelte's community-add-on support is still experimental, and [`@nvl/sveltex-sv`]
> itself is in alpha; community add-ons are not vetted by the Svelte
> maintainers.

### Manual setup

If you're not on SvelteKit, or would rather wire things up by hand:

```sh
pnpm add -D @nvl/sveltex     # If using pnpm
bun  add -D @nvl/sveltex     # If using Bun
npm  add -D @nvl/sveltex     # If using npm
yarn add -D @nvl/sveltex     # If using Yarn
deno add -D jsr:@nvl/sveltex # If using Deno
```

```js
// svelte.config.js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltex } from '@nvl/sveltex';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: [
        vitePreprocess(), // (optional)
        await sveltex({
            markdownBackend: 'unified',
            codeBackend: 'shiki',
            mathBackend: 'mathjax',
        }, {
            // Options
        }),
    ],
    extensions: ['.svelte', '.sveltex'],
};

export default config;
```

Then install the backends you chose — IntelliSense, or the error SvelTeX
throws without them, will tell you which — create a `+page.sveltex` file under
`src/routes`, and start writing Markdown, math, code blocks and TeX
components. See the [docs] for more.

<div align="center">
<picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nvlang/sveltex/main/res/dark/screenshot.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/nvlang/sveltex/main/res/light/screenshot.png">
    <img alt="Logotype" src="https://raw.githubusercontent.com/nvlang/sveltex/main/res/light/screenshot.png" width="100%">
</picture>
</div>

## Editor integration

SvelTeX has first-class editor support: syntax highlighting **and** a language
server ([`@nvl/sveltex-language-server`]) that proxies the real Svelte tooling
for the Svelte parts of a `.sveltex` file and adds native Markdown, math and
frontmatter features.

- **VS Code** — install the [SvelTeX extension] (VS Code Marketplace; also on
  [Open VSX] for VSCodium, Cursor, Windsurf, …). It bundles the language
  server, so diagnostics, hover, completion, go-to-definition, rename and more
  work out of the box.
- **Zed** — the [SvelTeX Zed extension] provides tree-sitter highlighting and
  launches the same language server.
- **Other LSP-capable editors** (Neovim, Emacs, Sublime Text, …) — run
  [`@nvl/sveltex-language-server`] directly; it speaks LSP over stdio
  (`node …/bin/server.js --stdio`).
- **Syntax highlighting only** — [`@nvl/tree-sitter-sveltex`] is a standalone
  tree-sitter grammar; the VS Code extension also ships a [TextMate grammar].

Inside a `.sveltex` file the language server additionally forwards math
regions to a bundled math language server (TeX command completion and rich
hover) and LaTeX `<tex>` / `<tikz>` regions to [TexLab], when a `texlab`
binary is on `PATH`.

> [!NOTE]
> The language-server, Zed-extension and tree-sitter packages are new and
> currently in **alpha** — expect rough edges and breaking changes before
> `1.0.0`.

## Acknowledgments

See [acknowledgments] on the project site.

**Note:** The TSDoc comments for many of this project's interfaces, particularly
those describing options to be passed to external libraries, may be copies,
paraphrasings, or adaptations of the official documentations of the respective
libraries. Some notable examples are MathJax and TikZ.


[docs]: https://sveltex.dev/docs
[ESM-only]: https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c
[Svelte CLI]: https://svelte.dev/docs/cli/overview
[`@nvl/sveltex-sv`]: https://www.npmjs.com/package/@nvl/sveltex-sv
[`@nvl/sveltex-language-server`]: https://www.npmjs.com/package/@nvl/sveltex-language-server
[`@nvl/tree-sitter-sveltex`]: https://www.npmjs.com/package/@nvl/tree-sitter-sveltex
[SvelTeX extension]: https://marketplace.visualstudio.com/items?itemName=sveltex-preprocessor.sveltex
[Open VSX]: https://open-vsx.org/extension/sveltex-preprocessor/sveltex
[SvelTeX Zed extension]: https://github.com/nvlang/sveltex/tree/main/editors/zed
[TextMate grammar]: https://github.com/nvlang/sveltex/tree/main/packages/vscode-sveltex/syntaxes
[acknowledgments]: https://sveltex.dev/docs/acknowledgments
