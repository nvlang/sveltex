# SvelTeX

[![NPM Version](https://img.shields.io/npm/v/@nvl/sveltex?style=flat-square&logo=npm&logoColor=white&label=&labelColor=BD453B&color=BD453B&logoSize=auto)](https://npmjs.com/@nvl/sveltex)
[![JSR Version](https://img.shields.io/jsr/v/@nvl/sveltex?style=flat-square&labelColor=1A3644&color=1A3644&logo=jsr&label=&logoSize=auto)](https://jsr.io/@nvl/sveltex)
[![GitHub Tag](https://img.shields.io/github/v/tag/nvlang/sveltex?style=flat-square&logo=GitHub&logoColor=aaa&label=&labelColor=333&color=333)](https://github.com/nvlang/sveltex)
[![Codecov](https://img.shields.io/codecov/c/github/nvlang/sveltex?style=flat-square&logo=codecov&label=&logoColor=aaa&labelColor=333&color=333)](https://codecov.io/gh/nvlang/sveltex)

## Installation

```sh
pnpm add -D @nvl/sveltex # If using PNPM
bun  add -D @nvl/sveltex # If using Bun
npm  add -D @nvl/sveltex # If using NPM
yarn add -D @nvl/sveltex # If using Yarn
```

## Documentation

### Quickstart

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

For further documentation, please visit the [project site](https://sveltex.dev).

## Roadmap

In alphabetical order:

-   VSCode extension for proper LSP language support via request forwarding.
    Currently, only [basic syntax
    highlighting](https://marketplace.visualstudio.com/items?itemName=sveltex-preprocessor.sveltex)
    is provided.

## Acknowledgments

See [acknowledgments](https://sveltex.dev/docs/acknowledgments) on the project site.

The TSDoc comments for many of this project's interfaces, particularly those
describing options to be passed to external libraries, may be copies,
paraphrasings, or adaptations of the official documentations of the respective
libraries. Some notable examples are MathJax and TikZ.


## Some lessons learned

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

-   `fast-check`, for fuzzy testing.
-   Shiki, for code highlighting.
-   `twoslash`, for IntelliSense in markdown code blocks.
-   VitePress.
