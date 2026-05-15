---
title: Math
description: Use MathJax or KaTeX with SvelTeX.
---

<script lang="ts" setup>
import { PhFileCss, PhPalette, PhGear, PhArrowFatLineRight, PhEar } from '@phosphor-icons/vue';
</script>

# Math

<p class="text-lg py-2">
Render math expressions that don't require a full TeX distribution at build-time
with MathJax or KaTeX.
</p>

<div class="features-list mt-8">

-   <PhFileCss color="var(--hig-orange)" class="opacity-90" :size="28" weight="duotone"/>

    **Automatic CSS:** MathJax and KaTeX need CSS to work properly. SvelTeX
    will by default automatically take care of this for you.

-   <PhPalette color="var(--hig-orange)" class="opacity-90" :size="28" weight="duotone"/>

    **Adaptive theming:** MathJax and KaTeX both use `currentColor` for their
    output by default. KaTeX also natively supports **CSS color variables**, and
    for MathJax this behavior is emulated by SvelTeX.

-   <PhEar color="var(--hig-orange)" class="opacity-90" :size="28" weight="duotone"/>

    **Accessible by default:** Both backends emit assistive
    [MathML](https://developer.mozilla.org/en-US/docs/Web/MathML) alongside
    their visual output by default, so screen readers can announce your math.

-   <PhGear color="var(--hig-orange)" class="opacity-90" :size="28" weight="duotone"/>

    **Custom transformers:** Inject custom transformers to pre- and post-process
    the in- and output of the math renderer, respectively.

</div>


## Backends

The following backends are supported for math rendering:

-   **MathJax** [[web](https://www.mathjax.org/) /
    [github](https://github.com/mathjax/MathJax-src/) /
    [npm](https://www.npmjs.com/package/@mathjax/src)]: An
    [extensible](https://docs.mathjax.org/en/latest/input/tex/extensions/index.html)
    math renderer that supports
    [many](https://docs.mathjax.org/en/latest/input/tex/macros/index.html) TeX
    and LaTeX commands and places a lot of focus on accessibility. It supports
    SVG and CHTML output. It's somewhat bulkier and slower than KaTeX, but this
    matters primarily for client-side rendering, which is non-existent with
    SvelTeX — instead, in this context the only effect that the difference in
    performance might have is potentially yielding marginally slower build
    times.

    Using the `mathjax` backend requires the [`@mathjax/src`] package
    (version 4 or later), as well as the font package matching your
    [`math.font`](#fonts) setting. See [Installation](#installation) below.

-   **KaTeX** [[web](https://katex.org/) / [github](https://github.com/KaTeX/KaTeX) / [npm](https://www.npmjs.com/package/katex)]: A fast math renderer that supports [many](https://katex.org/docs/supported.html) TeX and LaTeX commands and produces CHTML output. It supports fewer commands than MathJax, and only a few [extensions](https://katex.org/docs/libs.html).


## Installation

The math backend's renderer isn't bundled with SvelTeX — you install whichever
one you've chosen as a peer dependency.

For **KaTeX**, install [`katex`]:

::: code-group
```sh [pnpm]
pnpm add -D katex
```
```sh [bun]
bun add -D katex
```
```sh [npm]
npm add -D katex
```
```sh [yarn]
yarn add -D katex
```
:::

For **MathJax**, install [`@mathjax/src`] (version 4 or later). MathJax v4 also
ships each math font as a separate npm package, so you additionally need the
`@mathjax/mathjax-<font>-font` package that matches your
[`math.font`](#fonts) setting. With the default font (`newcm`), that's
[`@mathjax/mathjax-newcm-font`]:

::: code-group
```sh [pnpm]
pnpm add -D @mathjax/src @mathjax/mathjax-newcm-font
```
```sh [bun]
bun add -D @mathjax/src @mathjax/mathjax-newcm-font
```
```sh [npm]
npm add -D @mathjax/src @mathjax/mathjax-newcm-font
```
```sh [yarn]
yarn add -D @mathjax/src @mathjax/mathjax-newcm-font
```
:::

::: info

SvelTeX used [`mathjax-full`] (MathJax v3) before v0.5.0. As of v0.5.0, the
`mathjax` backend targets the [`@mathjax/src`] package at version 4 or later
instead. If you're upgrading, replace `mathjax-full` with `@mathjax/src` and add
the font package for your chosen [`math.font`](#fonts).

:::


## Configuration

**Hint:** Hover over the different properties in the code block to show some
IntelliSense.

::: code-group

```js twoslash [MathJax]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex'

export default await sveltex({
    mathBackend: 'mathjax',
}, {
    math: {
        css: {
            type: 'hybrid',
            cdn: 'jsdelivr'
        },
        mathjax: {
            // Options passed to MathJax; note that some of the
            // options may be ineffective, since SvelTeX takes
            // care of some of the functionality that MathJax
            // usually provides (e.g., finding math within a
            // source file).
        },
        // 'svg' or 'chtml' (default). See "Output format" below.
        outputFormat: 'svg',
        transformers: {
            pre: [],
            post: [],
        },
    }
})
```

```ts [KaTeX]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex'

export default await sveltex({
    mathBackend: 'katex',
}, {
    math: {
        css: {
            type: 'cdn',
            cdn: 'jsdelivr'
        },
        katex: {
            // Options passed to KaTeX
        },
        transformers: {
            pre: [],
            post: [],
        },
    }
})
```

:::


## Output format <Badge type="tip" text="mathjax" />

The `mathjax` backend can render math either as **CHTML** (CommonHTML, the
default) or as **SVG**. Pick one with the `math.outputFormat` setting:

```js
// sveltex.config.js
import { sveltex } from '@nvl/sveltex'

export default await sveltex({
    mathBackend: 'mathjax',
}, {
    math: {
        outputFormat: 'svg', // or 'chtml' (default)
    }
})
```

MathJax v4 initializes a single, process-global document, so each build uses one
output format throughout — you can't mix `svg` and `chtml` within the same
build. This is fine for any SvelteKit build, since a project picks one format
for all of its pages anyway.

::: warning

You'll have to delete the previously generated MathJax CSS file if you change
the output format, otherwise the change won't take effect.

:::


## Fonts <Badge type="tip" text="mathjax" />

MathJax v4 ships each of its math fonts as a separate npm package. SvelTeX
defaults to **New Computer Modern** ([`@mathjax/mathjax-newcm-font`]); set
`math.font` to use a different one. Whichever font you pick, remember to install
the matching `@mathjax/mathjax-<font>-font` package (see
[Installation](#installation)).

```js
// sveltex.config.js
import { sveltex } from '@nvl/sveltex'

export default await sveltex({
    mathBackend: 'mathjax',
}, {
    math: {
        font: 'newcm', // the default
    }
})
```

The supported fonts are `newcm`, `asana`, `bonum`, `dejavu`, `fira`, `modern`,
`pagella`, `schola`, `stix2`, `termes`, and `tex`; each corresponds to a
`@mathjax/mathjax-<font>-font` package.

::: warning

You'll have to delete the previously generated MathJax CSS file if you change
the font, otherwise the change won't take effect.

:::


## Accessibility

SvelTeX renders accessible math out of the box.

-   **KaTeX** emits [MathML](https://developer.mozilla.org/en-US/docs/Web/MathML)
    alongside its visual HTML output by default (i.e., SvelTeX sets KaTeX's
    `output` option to `'htmlAndMathml'`). Screen readers use the MathML; sighted
    users see the HTML.

-   **MathJax** emits assistive MathML by default, and leaves MathJax's own
    speech-string generation off. Emitting both an assistive-MathML tree and
    speech strings can cause some screen readers to announce an expression
    twice, so SvelTeX enables just the MathML by default.

### MathJax accessibility options <Badge type="tip" text="mathjax" />

For the `mathjax` backend, the relevant accessibility settings live under
`math.mathjax.options`. SvelTeX treats the following `enable*` options as
meta-options: each one decides whether SvelTeX loads the corresponding MathJax
accessibility component, so turning a feature on or off behaves as documented.

| Option | Default | Effect |
|---|:---:|---|
| `enableAssistiveMml` | `true` | Insert an assistive MathML tree next to each expression. |
| `enableEnrichment` | `true` | Apply semantic enrichment to the internal MathML. |
| `enableSpeech` | `false` | Generate and attach speech strings. |
| `enableBraille` | `false` | Generate and attach Braille labels. |
| `enableComplexity` | `false` | Run the complexity extension's build-time computations. |

```js
// sveltex.config.js
import { sveltex } from '@nvl/sveltex'

export default await sveltex({
    mathBackend: 'mathjax',
}, {
    math: {
        mathjax: {
            options: {
                enableAssistiveMml: true,
                enableSpeech: false,
            },
        },
    }
})
```

::: info

SvelTeX is purely a build-time preprocessor, so MathJax accessibility features
that require running MathJax in the browser — the contextual menu, the
`explorer` extension, and the collapsing behavior of the `complexity` extension
— are not supported. This is why SvelTeX turns assistive MathML on by default:
in MathJax v4 it's off by default, on the assumption that the in-browser menu
and explorer are available.

:::

[`katex`]: https://www.npmjs.com/package/katex
[`@mathjax/src`]: https://www.npmjs.com/package/@mathjax/src
[`@mathjax/mathjax-newcm-font`]: https://www.npmjs.com/package/@mathjax/mathjax-newcm-font
[`mathjax-full`]: https://www.npmjs.com/package/mathjax-full
