---
title: Math
description: Use MathJax or KaTeX with SvelTeX.
---

# Math

Render math expressions that don't require a full TeX distribution at build-time
with MathJax or KaTeX.


## MathJax



## KaTeX

::: code-group

```js twoslash [MathJax]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex'

export default await sveltex({
    texBackend: 'mathjax',
}, {
    tex: {
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
