---
title: Math
description: Use MathJax or KaTeX with SvelTeX.
---

<script lang="ts" setup>
import { PhFileCss, PhPalette, PhGear, PhArrowFatLineRight } from '@phosphor-icons/vue';
</script>

# Math

Render math expressions that don't require a full TeX distribution at build-time
with MathJax or KaTeX.



<div class="features-list mt-8">

-   <PhFileCss :size="28" weight="duotone"/>

    **Automatic CSS**: MathJax and KaTeX need CSS to work properly. SvelTeX
    will by default automatically take care of this for you.

-   <PhPalette :size="28" weight="duotone"/>

    **Adaptive theming**: MathJax and KaTeX both use `currentColor` for their
    output by default. KaTeX also natively supports **CSS color variables**, and
    for MathJax this behavior is emulated by SvelTeX.

-   <PhGear :size="28" weight="duotone"/>

    **Custom transformers**: Inject custom transformers to pre- and post-process
    the in- and output of the math renderer, respectively.

<!-- -   <PhArrowFatLineRight :size="28" weight="duotone"/> -->

</div>


## Backends

The following backends are supported for math rendering:

-   **MathJax** [[web](https://www.mathjax.org/) /
    [github](https://github.com/mathjax/MathJax-src/) /
    [npm](https://www.npmjs.com/package/mathjax-full)]: An
    [extensible](https://docs.mathjax.org/en/latest/input/tex/extensions/index.html)
    math renderer that supports
    [many](https://docs.mathjax.org/en/latest/input/tex/macros/index.html) TeX
    and LaTeX commands and places a lot of focus on accessibility. It supports
    SVG and CHTML output. It's somewhat bulkier and slower than KaTeX, but this
    matters primarily for client-side rendering, which is non-existent with
    SvelTeX — instead, in this context the only effect that the difference in
    performance might have is potentially yielding marginally slower build
    times.
-   **KaTeX** [[web](https://katex.org/) / [github](https://github.com/KaTeX/KaTeX) / [npm](https://www.npmjs.com/package/katex)]: A fast math renderer that supports [many](https://katex.org/docs/supported.html) TeX and LaTeX commands and produces CHTML output. It supports fewer commands than MathJax, and only a few [extensions](https://katex.org/docs/libs.html).


::: code-group

```js twoslash [MathJax]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex'

export default await sveltex({
    texBackend: 'mathjax',
}, {
    math: {
        css: {
            type: 'hybrid',
            cdn: 'jsdelivr'
        }
    }
})
```

```ts [KaTeX]
fdsfds
```

```ts twoslash
console.log('hello')
```

:::



```ts twoslash
console.log('hello')
```