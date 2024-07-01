
<div align="center">
<picture style="display: flex; width: 50%;">
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nvlang/sveltex/main/res/dark/logotype.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/nvlang/sveltex/main/res/light/logotype.svg">
    <img alt="Logotype" src="https://raw.githubusercontent.com/nvlang/sveltex/main/res/light/logotype.svg">
</picture>
<br>
<div>
<span>
<a href="https://npmjs.com/@nvl/sveltex">
<img alt="NPM Version" src="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&logo=npm&logoColor=white&labelColor=8e433b&color=8e433b&logoSize=auto">
</a>
<a href="https://jsr.io/@nvl/sveltex">
<img alt="JSR Version" src="https://img.shields.io/badge/@nvl/sveltex-_?style=flat-square&labelColor=1A3644&color=1A3644&logo=jsr&logoSize=auto">
</a>
</span>
<span>
<a href="https://github.com/nvlang/sveltex"><img alt="GitHub Tag" src="https://img.shields.io/github/v/tag/nvlang/sveltex?style=flat-square&logo=GitHub&logoColor=8D96A0&label=&labelColor=21262d&color=21262d">
</a>
<a href="https://codecov.io/gh/nvlang/sveltex">
<img alt="Codecov Coverage" src="https://img.shields.io/codecov/c/github/nvlang/sveltex?style=flat-square&logo=codecov&label=&logoColor=8D96A0&labelColor=21262d&color=21262d">
</a>
</span>
</div>
</div>


## Getting Started

**Note:** See the [docs](https://sveltex.dev/docs) for more information.


### Installation

```sh
pnpm add -D @nvl/sveltex # If using PNPM
bun  add -D @nvl/sveltex # If using Bun
npm  add -D @nvl/sveltex # If using NPM
yarn add -D @nvl/sveltex # If using Yarn
```


### Basic steup

```js
// svelte.config.js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltex } from '@nvl/sveltex';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // ...
    preprocess: [
        vitePreprocess(), // (optional)
        await sveltex({
            markdownBackend: 'unified',
            codeBackend: 'shiki',
            mathBackend: 'mathjax',
        }, {
            // Options
        }),
        // ...
    ],
    extensions: ['.svelte', '.sveltex'],
    // ...
};

export default config;
```

Now, install the backends (cf. IntelliSense or the error message you'd get if
you tried to run the above code without installing the backends), and you should
be good to go. Create a `+page.sveltex` file in your `src/routes` directory, and
start adding markdown, math, code blocks, and even TeX components.


## Editor integration

For VS Code, you can install the official [SvelTeX extension] from the
marketplace. This will provide syntax highlighting for `.sveltex` files.

For other editors, you'd need to configure syntax highlighting yourself using
the SvelTeX [TextMate grammar] provided within the VS Code extension.

Proper LSP-style language support is not currently implemented. Doing so via
e.g. [request forwarding] could be an immense enrichment to the developer
experience, but it's not something I can currently commit to. Contributions for
this would be extremely welcome.

[SvelTeX extension]: https://marketplace.visualstudio.com/items?itemName=sveltex-preprocessor.sveltex
[TextMate grammar]: https://github.com/nvlang/sveltex/tree/main/extras/vscode-extension/syntaxes
[request forwarding]: https://code.visualstudio.com/api/language-extensions/embedded-languages#request-forwarding


## Acknowledgments

See [acknowledgments] on the project site.

**Note:** The TSDoc comments for many of this project's interfaces, particularly
those describing options to be passed to external libraries, may be copies,
paraphrasings, or adaptations of the official documentations of the respective
libraries. Some notable examples are MathJax and TikZ.

[acknowledgments]: https://sveltex.dev/docs/acknowledgments


## Addendum: Some lessons learned

### Tips

-   Always run your linter before you run your tests. In particular, note that
    VSCode's ESLint extension only runs on files that are currently open, so
    even if the problems pane is clear, you might still have linting errors in
    files that are not currently open.
-   Generally speaking, don't combine `.ts` and `.d.ts` files. In short, it's
    either `.ts` or it's `.js` + (optionally) `.d.ts`. This is almost certainly
    an egregious oversimplification, but it's the feeling I got after spending a
    bunch of time trying to debug issues caused by me mixing `.ts` and `.d.ts`
    files.
-   In YAML files for GitHub actions, `'text'`, `"text"`, and `text` may not be
    the same. In particular, I had `workflow_run` events not triggering because
    the needed workflow's name wasn't in quotes, but the `workflow_run` element
    was.

### Cool software I didn't know before

-   [`fast-check`], for fuzzy testing.
-   [Shiki], for code highlighting.
-   [`twoslash`], for IntelliSense in markdown code blocks.
-   [VitePress], a great [SSG] for docs.
-   [`node-poppler`], a Node.js wrapper for Poppler, which can used to convert
    PDFs to SVGs.

[`fast-check`]: https://fast-check.dev
[Shiki]: https://shiki.style
[`twoslash`]: https://twoslash.netlify.app
[VitePress]: https://vitepress.dev
[SSG]: https://en.wikipedia.org/wiki/Static_site_generator
[`node-poppler`]: https://github.com/Fdawgs/node-poppler
