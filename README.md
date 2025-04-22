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

[
<picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/github/v/tag/nvlang/sveltex?style=flat-square&logo=GitHub&logoColor=a3acb7&label=&labelColor=21262d&color=21262d&filter=@nvl/sveltex@*">
    <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/github/v/tag/nvlang/sveltex?style=flat-square&logo=GitHub&logoColor=24292f&label=&labelColor=eaeef2&color=eaeef2&filter=@nvl/sveltex@*">
    <img alt="GitHub version tag" src="https://img.shields.io/github/v/tag/nvlang/sveltex?style=flat-square&logo=GitHub&logoColor=24292f&label=&labelColor=eaeef2&color=eaeef2&filter=@nvl/sveltex@*">
</picture>
](https://github.com/nvlang/sveltex)
[
<picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&logo=npm&logoColor=a3acb7&labelColor=21262d&color=21262d&logoSize=auto)">
    <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&logo=npm&logoColor=24292f&labelColor=eaeef2&color=eaeef2&logoSize=auto)">
    <img alt="NPM package name" src="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&logo=npm&logoColor=24292f&labelColor=eaeef2&color=eaeef2&logoSize=auto)">
</picture>
](https://npmjs.com/@nvl/sveltex)
[
<picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&labelColor=21262d&color=21262d&logo=jsr&logoColor=a3acb7&logoSize=auto">
    <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&labelColor=eaeef2&color=eaeef2&logo=jsr&logoColor=24292f&logoSize=auto">
    <img alt="JSR package name" src="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&labelColor=eaeef2&color=eaeef2&logo=jsr&logoColor=24292f&logoSize=auto">
</picture>
](https://jsr.io/@nvl/sveltex)
[
<picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://jsr.io/badges/@nvl/sveltex/score?style=flat-square&labelColor=21262d&color=21262d&logoColor=a3acb7">
    <source media="(prefers-color-scheme: light)" srcset="https://jsr.io/badges/@nvl/sveltex/score?style=flat-square&labelColor=eaeef2&color=eaeef2&logoColor=24292f">
    <img alt="JSR score" src="https://jsr.io/badges/@nvl/sveltex/score?style=flat-square&labelColor=eaeef2&color=eaeef2&logoColor=24292f">
</picture>
](https://jsr.io/@nvl/sveltex)
[
<picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/codecov/c/github/nvlang/sveltex?flag=sveltex&style=flat-square&logo=codecov&label=&logoColor=a3acb7&labelColor=21262d&color=21262d">
    <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/codecov/c/github/nvlang/sveltex?flag=sveltex&style=flat-square&logo=codecov&label=&logoColor=24292f&labelColor=eaeef2&color=eaeef2">
    <img alt="CodeCov coverage" src="https://img.shields.io/codecov/c/github/nvlang/sveltex?flag=sveltex&style=flat-square&logo=codecov&label=&logoColor=24292f&labelColor=eaeef2&color=eaeef2">
</picture>
](https://codecov.io/gh/nvlang/sveltex)

</div>
</div>


## Getting Started

**Note:** See the [docs] for more information.<br>
**Note**: This package is [ESM-only].

<details>
<summary><b>Creating a new project</b></summary>

You can use the [`create-sveltex`] package to create a new project using SvelTeX:

```sh
pnpm dlx create-sveltex # If using PNPM
bunx     create-sveltex # If using Bun
npx      create-sveltex # If using NPM
yarn dlx create-sveltex # If using Yarn
```

...and follow the prompts.

</details>

<details>
<summary><b>Adding to an existing project</b></summary>

#### Installation

```sh
pnpm add -D @nvl/sveltex     # If using PNPM
bun  add -D @nvl/sveltex     # If using Bun
npm  add -D @nvl/sveltex     # If using NPM
yarn add -D @nvl/sveltex     # If using Yarn
deno add -D jsr:@nvl/sveltex # If using Deno
```

#### Basic steup

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

Now, install the backends (see IntelliSense or the error message you'd get if
you tried to run the above code without installing the backends), and you should
be good to go. Create a `+page.sveltex` file in your `src/routes` directory, and
start adding markdown, math, code blocks, and even TeX components.

See the [docs] for more information on how to use SvelTeX.

</details>

<div align="center">
<picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nvlang/sveltex/main/res/dark/screenshot.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/nvlang/sveltex/main/res/light/screenshot.png">
    <img alt="Logotype" src="https://raw.githubusercontent.com/nvlang/sveltex/main/res/light/screenshot.png" width="100%">
</picture>
</div>

## Editor integration

For VS Code, you can install the official [SvelTeX extension] from the
marketplace. This will provide syntax highlighting for `.sveltex` files.

For other editors, you'd need to configure syntax highlighting yourself using
the SvelTeX [TextMate grammar] provided within the VS Code extension.

Proper LSP-style language support is not currently implemented. Doing so via
e.g. [request forwarding] could be an immense enrichment to the developer
experience, but it's not something I can currently commit to. Contributions for
this would be extremely welcome.

## Acknowledgments

See [acknowledgments] on the project site.

**Note:** The TSDoc comments for many of this project's interfaces, particularly
those describing options to be passed to external libraries, may be copies,
paraphrasings, or adaptations of the official documentations of the respective
libraries. Some notable examples are MathJax and TikZ.


[docs]: https://sveltex.dev/docs
[ESM-only]: https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c
[`create-sveltex`]: https://www.npmjs.com/package/create-sveltex
[SvelTeX extension]: https://marketplace.visualstudio.com/items?itemName=sveltex-preprocessor.sveltex
[TextMate grammar]: ./packages/vscode-sveltex/syntaxes
[request forwarding]: https://code.visualstudio.com/api/language-extensions/embedded-languages#request-forwarding
[acknowledgments]: https://sveltex.dev/docs/acknowledgments
