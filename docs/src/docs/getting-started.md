
# Getting Started

## System prerequisites

SvelTeX runs on **Node.js 22 or later**. Beyond that, what you need depends on
which features you use:

-   **Markdown, syntax highlighting, and math (`$…$` and `$$…$$`) work out of
    the box.** Math is rendered in pure JavaScript by MathJax or KaTeX, so it
    needs **no external tools** — only the npm packages for the backends you
    pick (which SvelTeX names for you on the first build).

-   **The [`<TeX>`](tex) component needs a local TeX distribution.** It compiles
    LaTeX to SVG by shelling out to real binaries, so for it — and _only_ for it
    — the following must be installed and on your `PATH`:

    -   a **TeX distribution** — [TeX Live](https://tug.org/texlive/),
        [MiKTeX](https://miktex.org/), or [MacTeX](https://tug.org/mactex/) —
        providing a LaTeX engine (`pdflatex`, `lualatex`, or `xelatex`);
    -   a **DVI/PDF-to-SVG converter** — [dvisvgm](https://dvisvgm.de/) (shipped
        with TeX Live and MiKTeX) or [Poppler](https://poppler.freedesktop.org/)'s
        `pdftocairo`.

    If a required binary is missing, SvelTeX fails the build for that file with
    a message naming the tool and linking back here, so the problem surfaces at
    build time rather than as a broken page.

::: tip Verify your TeX setup
Only needed if you plan to use the `<TeX>` component: run `pdflatex --version`
and `dvisvgm --version`. If both print version information, you're ready to go.
:::

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

::: info pnpm users

`@nvl/sveltex` depends (transitively, via `xregexp`) on `core-js-pure`, whose
install script pnpm blocks by default — so `pnpm install` may fail with
`ERR_PNPM_IGNORED_BUILDS`. Approve it once and re-install:

```yaml [pnpm-workspace.yaml]
allowBuilds: # pnpm < 11: onlyBuiltDependencies (a list)
    core-js-pure: true
```

The `sv` add-on does this for you automatically.

:::

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

::: tip Why two arguments?

Splitting the backend choices from the configuration is what makes the config
_type-aware_. The backends you pick in the first argument set the generic types
that drive IntelliSense for the second argument, so your editor offers exactly
the options each chosen backend supports — and flags the ones it doesn't.
Merging everything into one object would throw that inference away.

:::

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
        sveltexPreprocessor,
        vitePreprocess(), // (optional)
        // ...
    ],
    extensions: ['.svelte', '.sveltex'],
    // ...
};

export default config;
```

::: warning Order matters
List `sveltexPreprocessor` **before** any other markup preprocessor (such as
`vitePreprocess`). SvelTeX turns a `.sveltex` file's Markdown and LaTeX into
valid Svelte; a preprocessor that runs first would instead see raw LaTeX
backslashes and fail. (The `sv` add-on wires this up correctly for you.)
:::

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

## Switching backends

Changing a backend later (say MathJax → KaTeX, or Shiki → highlight.js) is just
a matter of editing the backend choice in `sveltex.config.js`. A few things to
clean up afterwards, though:

-   **Dependencies.** Install the new backend's peer dependencies and uninstall
    the old ones. Because the backends are _optional_ peer dependencies,
    `npm uninstall <pkg>` (or the pnpm/Yarn equivalent) may leave the package on
    disk and in your lockfile — run `npm prune` afterwards to remove it for
    good. SvelTeX warns on the next build if a peer dependency is missing.

-   **Stale config.** Options that belong to a different backend are ignored,
    and SvelTeX warns about them at build time (e.g. a leftover
    `code: { shiki: { … } }` block while `codeBackend` is `'highlight.js'`).
    Remove them to keep the config honest.

-   **Self-hosted CSS.** A stylesheet SvelTeX self-hosted for a previous
    backend/version (e.g. `static/sveltex/mathjax@….css` after moving to KaTeX)
    keeps shipping until you remove it. SvelTeX warns about such stale files at
    build time but doesn't delete them — `static/sveltex/` is checked into your
    repo, so removing files there is left to you. Delete the flagged file (or
    the whole directory if you've stopped self-hosting).

## Troubleshooting

A few common first-run snags:

-   **The preprocessor seems to do nothing, or Svelte errors that it isn't a
    valid preprocessor.** `sveltex(...)` is **async** — it returns a _promise_
    that resolves to the preprocessor, not the preprocessor itself. `await` it
    (top-level `await` works in both `sveltex.config.js` and
    `svelte.config.js`):

    ```js
    export default await sveltex(/* … */); // ✅ awaited
    ```

-   **Backend options appear to be ignored, or TypeScript complains about the
    configuration.** `sveltex` takes **two** arguments — the backend choices
    first, then the configuration — not a single merged object:

    ```js
    // ✅ two arguments
    await sveltex(
        { markdownBackend: 'unified', codeBackend: 'shiki' },
        { code: { shiki: { theme: 'github-dark' } } },
    );

    // ❌ one object — the backend options silently won't apply
    await sveltex({
        markdownBackend: 'unified',
        code: { shiki: { theme: 'github-dark' } },
    });
    ```

    The split is deliberate — it's what makes the configuration fully typed for
    your chosen backends (see [Setup](#setup) above).

-   **A peer dependency is missing.** SvelTeX names the exact packages it needs
    for the backends you picked on the first build — install those and re-run.

-   **`.sveltex` files aren't being processed.** Check that `extensions` in
    `svelte.config.js` includes `'.sveltex'` and that the preprocessor is
    actually in the `preprocess` array.

