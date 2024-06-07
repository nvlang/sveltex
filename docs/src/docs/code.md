


## Backends

The following backends are supported for syntax highlighting in code blocks:

- **Shiki** _(recommended)_ [[web](https://shiki.style/) /
  [github](https://github.com/shikijs/shiki) /
  [npm](https://npmjs.com/package/shiki)]: Powerful and extensible, making use
  of transformers to add all sorts of decorations to a code block (see e.g.
  [`@shikijs/transformers`](https://shiki.style/packages/transformers) or
  [`twoslash`](https://shiki.style/packages/twoslash)). Same fine-grained
  grammars as VS Code, and compatible with its huge array of themes. Used by
  VitePress, Astro, etc. Can bundle with support for up to 280+ languages.
- **`starry-night`** [[github](https://github.com/wooorm/starry-night) /
  [npm](https://npmjs.com/package/@wooorm/starry-night)]: Designed to emulate
  GitHub's closed-source PrettyLights syntax highlighter. Shares many
  dependencies with Shiki, and they use many of the same grammars. Can bundle
  with support for up to 600+ languages.
- **highlight.js** [[web](https://highlightjs.org/) /
  [github](https://github.com/highlightjs/highlight.js) /
  [npm](https://npmjs.com/package/highlight.js)]: Simple, fast, widespread.
  Limited functionality. Coarser grammars. Can bundle with support for up to
  180+ languages.

### Setup

::: warning

You should _not_ install plugins for your chosen markdown backend to handle the
syntax highlighting, since SvelTeX will take care of this for you.

If there's a syntax highlighter you'd like to use that isn't listed here and
isn't Prism.js, please open an issue on the [GitHub repository](https://github.com/nvlang/sveltex).

:::



::: code-group
```ts twoslash [Shiki]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({ codeBackend: 'shiki' }, {
    code: {
        addLanguageClass: 'language-',
        appendNewline: true,
        inlineMeta: undefined,

        transformers: {
            pre: [],
            post: [],
        }
    }
})
```
```js twoslash [starry-night]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({ codeBackend: 'starry-night' }, {
    code: {
        addLanguageClass: 'language-',
        appendNewline: true,
        // inlineMeta,
        transformers: {
            pre: [],
            post: [],
        }
    }
})
```
```js twoslash [highlight.js]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({ codeBackend: 'higlight.js' }, {
    code: {
        addLanguageClass: 'language-',
        appendNewline: true,
        // inlineMeta,
        transformers: {
            pre: [],
            post: [],
        }
    }
})
```
```js twoslash [escapeOnly]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({ codeBackend: 'escapeOnly' }, {
    code: {
        addLanguageClass: 'language-',
        appendNewline: true,
        // inlineMeta,
        transformers: {
            pre: [],
            post: [],
        }
    }
})
```
```js twoslash [none]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({ codeBackend: 'none' }, {
    code: {
        addLanguageClass: 'language-',
        appendNewline: true,
        // inlineMeta,
        transformers: {
            pre: [],
            post: [],
        }
    }
})
```
:::



### Note on Prism.js

Prism.js is not supported as a backend for syntax highlighting in code blocks. This isn't for lack of trying. Prism.js v1 is

