
<script lang="ts" setup>
import PipelineImage from './PipelineImage.vue';
import { PhFileCss, PhHighlighter, PhGear, PhArrowUDownRight } from '@phosphor-icons/vue';
</script>

# Code

<p class="text-lg py-2">
Highlight code blocks and inline code spans at build-time with one of three
backends.
</p>


## Features

<div class="features-list mt-8">

-   <PhFileCss color="var(--hig-purple)" class="opacity-90" :size="28" weight="duotone"/>

    **Automatic CSS:** `starry-night` and highlight.js need CSS to apply a given
    syntax theme. SvelTeX will by default automatically take care of this for
    you. Simply specify the theme you want to use in your configuration file.

-   <PhHighlighter color="var(--hig-purple)" class="opacity-90" :size="28" weight="duotone"/>

    **Inline syntax highlighting:** Highlight inline code in the same way as you
    would code blocks. You can even customize what syntax to use to specify the
    language for the code span.

-   <PhGear color="var(--hig-purple)" class="opacity-90" :size="28" weight="duotone"/>

    **Custom transformers:** Inject custom transformers to pre- and post-process
    the in- and output of the syntax highlighter, respectively.

-   <PhArrowUDownRight color="var(--hig-purple)" class="opacity-90" :size="28" weight="duotone"/>

    **Language Aliases:** Define custom aliases for languages.

</div>

## Backends

The following backends are supported for syntax highlighting in code blocks:

-   **Shiki** _(recommended)_ [[web](https://shiki.style/) /
    [github](https://github.com/shikijs/shiki) /
    [npm](https://npmjs.com/package/shiki)]: Powerful and extensible, making use
    of transformers to add all sorts of decorations to a code block (see e.g.
    [`@shikijs/transformers`](https://shiki.style/packages/transformers) or
    [`twoslash`](https://shiki.style/packages/twoslash)). Same fine-grained
    grammars as VS Code, and compatible with its huge array of themes. Used by
    VitePress, Astro, etc. Can bundle with support for up to 280+ languages.
-   **`starry-night`** [[github](https://github.com/wooorm/starry-night) /
    [npm](https://npmjs.com/package/@wooorm/starry-night)]: Designed to emulate
    GitHub's closed-source PrettyLights syntax highlighter. Shares many
    dependencies with Shiki, and they use many of the same grammars. Can bundle
    with support for up to 600+ languages.
-   **highlight.js** [[web](https://highlightjs.org/) /
    [github](https://github.com/highlightjs/highlight.js) /
    [npm](https://npmjs.com/package/highlight.js)]: Simple, fast, widespread.
    Limited functionality. Coarser grammars. Can bundle with support for up to
    180+ languages.

The following two "backends" are not actually syntax highlighters:

-   **`escape`:** You can use this backend if you want to escape braces and HTML
    characters that might otherwise interfere with Svelte's compiler, but leave
    the code as-is otherwise.
-   **`none`:** You can use this backend if you don't want any syntax
    highlighting at all.

Note that, with both of the above, custom transformers can still be used to pre-
and post-process the code.

## Configuration

::: warning

You should _not_ install plugins for your chosen markdown backend to handle the
syntax highlighting, since SvelTeX will take care of this for you.

If there's a syntax highlighter you'd like to use that isn't listed here and
isn't Prism, please open an issue on the [GitHub
repository](https://github.com/nvlang/sveltex).

:::



::: code-group
```ts twoslash [Shiki]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({ codeBackend: 'shiki' }, {
    code: {
        addLanguageClass: 'language-',
        appendNewline: true,
        inlineMeta: undefined, // See IntelliSense for default
        langAlias: {},
        parseMetaString: undefined, // See IntelliSense for default
        transformers: {
            pre: [],
            post: [],
        },
        shiki: {
            // Options passed to Shiki. See Shiki's
            // documentation for more info.
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
        inlineMeta: undefined, // See IntelliSense for default
        lang: null,
        langAlias: {},
        languages: 'common',
        theme: {
            cdn: 'jsdelivr',
            mode: 'both',
            name: 'default',
            type: 'cdn'
        },
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
        'highlight.js': {
            // Options passed to highlight.js. See highlight.js's
            // documentation for more info.
        },
        inlineMeta: undefined, // See IntelliSense for default
        langAlias: {},
        theme: {
            cdn: 'jsdelivr',
            min: true,
            name: 'default',
            type: 'cdn',
        },
        transformers: {
            pre: [],
            post: [],
        }
    }
})
```
```js twoslash [escape]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({ codeBackend: 'escape' }, {
    code: {
        addLanguageClass: 'language-',
        appendNewline: true,
        inlineMeta: undefined, // See IntelliSense for default
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
        inlineMeta: undefined, // See IntelliSense for default
        transformers: {
            pre: [],
            post: [],
        }
    }
})
```
:::


::: details What about Prism?

[Prism](https://github.com/PrismJS/prism/) is not supported as a backend for
syntax highlighting in code blocks. This isn't for lack of trying. Prism v1
is somewhat outdated (it's currently a CommonJS module), and though I got it to
work _somewhat_, I couldn't load any languages beyond JS or TS. In any event,
SvelTeX's use-case isn't really what Prism was designed for. One of Prism's main
selling points is it's small size, but this isn't a primary concern for
preprocessors such as SvelTeX.

Prism's maintainers' focus has shifted to v2, which is not yet available.
When v2 becomes available, I'll consider adding support for it in SvelTeX.

:::

