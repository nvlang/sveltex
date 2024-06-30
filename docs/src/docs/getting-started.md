
# Getting Started

## Installation

To install SvelTeX, run the following command in your project's root directory
(wherever your `package.json` is located):

::: code-group
```sh [pnpm]
pnpm add -D @nvl/sveltex
```
```sh [bun]
bun add -D @nvl/sveltex
```
```sh [npm]
npm add -D @nvl/sveltex
```
```sh [yarn]
yarn add -D @nvl/sveltex
```
:::

## Setup

SvelTeX has one main export, `sveltex`. This is an asynchronous function that
takes two arguments:

1.  **Backend specification:** An object with the following (optional)
    properties:

    -   [`markdownBackend`]: The markdown processor to use.
    -   [`codeBackend`]: The syntax highlighter to use.
    -   [`mathBackend`]: The math renderer to use. This is different from the
        full-fledged TeX to SVG pipeline, and intended for simpler math
        expressions (i.e., expressions that can be rendered with MathJax or
        KaTeX).

2.  **Configuration object:** An object with the following (optional) properties:

    -   `extensions`: An array of file extensions to process. Defaults to
        `['.sveltex']`.
    -   [`code`]: Configuration options for the code backend.
    -   [`markdown`]: Configuration options for the markdown backend.
    -   [`math`]: Configuration options for the math backend.
    -   [`tex`]: Configuration options for the TeX to SVG pipeline.
    -   `verbatim`: Map of verbatim environments to their respective
        configuration options.

In turn, it returns a promise which resolves to a Svelte preprocessor.

For example:

```js twoslash
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({
    markdownBackend: 'unified',
    codeBackend: 'shiki',
    mathBackend: 'mathjax'
}, {
    code: { shiki: { theme: 'github-dark' } },
    verbatim: { Tex: { type: 'tex', aliases: ['TeX'] } }
})
```

You can then use this export in your `svelte.config.js`:

```js twoslash
// svelte.config.js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import sveltexPreprocessor from './sveltex.config.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // ...
    preprocess: [
        vitePreprocess(), // (optional)
        sveltexPreprocessor,
        // ...
    ],
    extensions: ['.svelte', '.sveltex'],
    // ...
};

export default config;
```

If you prefer, you can also just use the `sveltex` function directly in your
`svelte.config.js`. Just remember to `await` it.


[`markdownBackend`]: markdown
[`codeBackend`]: code
[`mathBackend`]: math
[`code`]: code
[`markdown`]: markdown
[`math`]: math
[`tex`]: tex

