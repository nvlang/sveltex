
# Getting Started

## Creating a new project

SvelTeX is distributed as a community add-on for the official Svelte CLI
([`sv`](https://github.com/sveltejs/cli)). To start from scratch, first
scaffold a SvelteKit project:

::: code-group
```sh [pnpm]
pnpm dlx sv create
```
```sh [bun]
bunx sv create
```
```sh [npm]
npx sv create
```
```sh [yarn]
yarn dlx sv create
```
:::

...then add SvelTeX to it, as described in the next section.

::: info `create-sveltex` is deprecated

Earlier versions of SvelTeX shipped a `create-sveltex` scaffolding package. It
has been superseded by the `sv` add-on below; the `create-sveltex` binary now
only prints a notice pointing here.

:::


## Adding to an existing project

### Using the `sv` add-on

The quickest way to add SvelTeX to an existing SvelteKit project is the `sv`
add-on. It installs SvelTeX and the peer dependencies for the backends you
pick, creates a `sveltex.config.js`, and wires the preprocessor into your
`svelte.config.js`:

::: code-group
```sh [pnpm]
pnpm dlx sv add @nvl/sv-sveltex
```
```sh [bun]
bunx sv add @nvl/sv-sveltex
```
```sh [npm]
npx sv add @nvl/sv-sveltex
```
```sh [yarn]
yarn dlx sv add @nvl/sv-sveltex
```
:::

...and follow the prompts.

Prefer to set things up by hand? The rest of this page walks through the
manual installation and configuration.

### Installation

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

SvelTeX doesn't bundle the markdown, code, or math backends — you install the
ones you've chosen as peer dependencies. For example, the `unified` markdown
backend needs the `unified`, `remark-parse`, `remark-rehype`, and
`rehype-stringify` packages, the `shiki` code backend needs `shiki`, and so on.
SvelTeX will tell you exactly which packages are missing the first time you run
a build.

::: info MathJax backend

If you pick `mathjax` as your math backend, you need the
[`@mathjax/src`](https://www.npmjs.com/package/@mathjax/src) package at version
4 or later:

```sh
pnpm add -D @mathjax/src
```

MathJax v4 ships each math font as a separate npm package, but `@mathjax/src`
already declares
[`@mathjax/mathjax-newcm-font`](https://www.npmjs.com/package/@mathjax/mathjax-newcm-font)
as a dependency — so the default font is pulled in automatically. If you
override [`math.font`](math#fonts), also install the matching
`@mathjax/mathjax-<font>-font` package — e.g. for `fira`:

```sh
pnpm add -D @mathjax/mathjax-fira-font
```

`devDependencies` is the right scope for both: the CHTML output's font files
are served from a CDN at runtime by default (via MathJax's `fontURL`), and the
SVG output bakes glyph paths into the rendered HTML at build time. Either way,
the npm packages themselves only need to be present while SvelTeX runs.

See the [Math](math#installation) page for details.

:::

### Setup

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
    -   [`verbatim`]: Map of verbatim environments to their respective
        configuration options.
    -   [`frontmatter`]: Which of SvelTeX's frontmatter-processing steps
        (head injection, `metadata` export, `import` statements) to
        perform. Pass `false` to disable frontmatter handling entirely,
        or an object to toggle individual steps.

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
[`verbatim`]: verbatim
[`frontmatter`]: markdown#disabling-frontmatter-processing

### Inspecting defaults programmatically

If you're building tooling around SvelTeX — a config wizard, a custom
preprocessor that extends SvelTeX, or anything that needs to know what
the implicit defaults actually are — you can ask for them directly:

```ts twoslash
import {
    getDefaultSveltexConfig,
    getDefaultCodeConfig,
    getDefaultMarkdownConfig,
    getDefaultMathConfig,
    getDefaultTexConfig,
    getDefaultVerbEnvConfig,
    getTexPresetDefaults,
    getDefaultCacheDirectory,
} from '@nvl/sveltex';

// The full default config for a `unified` / `shiki` / `katex` combo.
const defaults = getDefaultSveltexConfig('unified', 'shiki', 'katex');

// Just the math slice, with the `'hybrid'` CSS approach.
const mathDefaults = getDefaultMathConfig('mathjax', 'hybrid');

// The bundled `tikz` preset's defaults.
const tikz = getTexPresetDefaults('tikz');
```

Each helper returns a freshly-cloned object — mutating it has no effect
on subsequent calls.

