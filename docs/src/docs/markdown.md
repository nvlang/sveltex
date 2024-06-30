---
title: Math
description: Use MathJax or KaTeX with SvelTeX.
outline: deep
---

<script lang="ts" setup>
import { PhMarkdownLogo, PhLifebuoy, PhDotsSix, PhGear, PhListDashes } from '@phosphor-icons/vue';
</script>

<style scoped>
/* pre.shiki.vp-code .line {
    text-wrap: wrap;
} */
.multicol {
    margin: 1rem 0;
}
.multicol div {
    margin: 0;
}
</style>

# Markdown

<p class="text-lg py-2">
Render math expressions that don't require a full TeX distribution at build-time
with MathJax or KaTeX.
</p>

<div class="features-list mt-8">

-   <PhMarkdownLogo color="var(--hig-pink)" class="opacity-80" :size="28" weight="duotone"/>

    **Markdown + Svelte:** Interweave markdown and Svelte components and syntax
    in your Svelte files.

-   <PhLifebuoy color="var(--hig-pink)" class="opacity-80" :size="28" weight="duotone"/>

    **Forgiving:** SvelTeX will try to ensure your markup wouldn't yield
    unexpected results according to CommonMark, possibly making whitespace
    adjustments before passing it to the markdown processor.

-   <PhDotsSix color="var(--hig-pink)" class="opacity-80" :size="28" weight="duotone"/>

    **Directives:** Use markdown directives syntax, incl. curly brackets,
    without confusing the Svelte compiler.

-   <PhListDashes color="var(--hig-pink)" class="opacity-80" :size="28" weight="duotone"/>

    **Frontmatter:** Set page metadata for SEO, import resources with `<link>`s,
    define JS variables, and more, all from within frontmatter written in YAML,
    TOML, or JSON.

-   <PhGear color="var(--hig-pink)" class="opacity-80" :size="28" weight="duotone"/>

    **Custom transformers:** Inject custom transformers to pre- and post-process
    the in- and output of the math renderer, respectively.

</div>

## Backends

In order of recommendation:

-   **unified** _(recommended)_ [[web](https://unifiedjs.com/) /
    [github](https://github.com/unifiedjs/unified) /
    [npm](https://www.npmjs.com/package/unified)]: The backbone of MDX (among
    many other things), unified has the largest ecosystem of plugins, many of
    which are maintained by the core team. Furthermore, it has several big
    [sponsors](https://opencollective.com/unified), so it's continued
    maintenance and development is all but assured.

    Note that unified is not a markdown parser in and of itself, but rather an
    umbrella term for an ecosystem of parsers and processors working with
    abstract syntax trees (ASTs). In this case, the SvelTeX uses `remark` to
    parse the markdown into a [MDAST](https://github.com/syntax-tree/mdast)
    (Markdown AST), [`remark-rehype`](https://github.com/remarkjs/remark-rehype)
    to convert the MDAST to a [HAST](https://github.com/syntax-tree/hast)
    (Hypertext AST), and [`rehype`](https://github.com/rehypejs/rehype) to
    serialize the HAST to HTML.

    The only downsides that I can think of are that the sheer size of the
    ecosystem can be somewhat overwhelming (especially due to its highly
    modularized nature, though said modularity is also a big advantage in many
    other ways), and that, in my view, plugin development or low-level
    customization within the unified ecosystem has a rather steep learning
    curve. However, this only matters if you're actually planning to develop
    plugins or do low-level customization, which, given the vastness of the
    plugin ecosystem, will probably not be necessary in the majority of
    use-cases.

-   **`markdown-it`** [[github](https://github.com/markdown-it/markdown-it) /
    [npm](https://www.npmjs.com/package/markdown-it) /
    [demo](https://markdown-it.github.io)]: This robust, CommonMark-compliant
    markdown parser is used by many SSGs, including Eleventy, Hugo, and
    VitePress. It has a solid ecosystem of plugins, and is generally
    well-maintained.

-   **`micromark`** [[github](https://github.com/micromark/micromark) /
    [npm](https://www.npmjs.com/package/micromark)]: The parser powering
    unified, this is an extremely tiny dependency. Though extensible and fully
    CommonMark compliant, It'll seldom be the case that you should pick this
    over `remark`/`rehype` (which we refer to as "unified" above), since the
    latter offer a more high-level API and generally a more extensive ecosystem
    of plugins. Nonetheless, it's still supported, and a solid option.

-   **`marked`** [[web](https://marked.js.org) /
    [github](https://github.com/markedjs/marked) /
    [npm](https://www.npmjs.com/package/marked) / [demo](https://marked.js.org/demo/)]: The oldest of the
    bunch, `marked` is a fast and widespread markdown parser. However, it's
    plugin ecosystem is not as extensive as that of `markdown-it` or `unified`,
    and it lags behind the other two in terms of
    [CommonMark](https://spec.commonmark.org/current/) and
    [GFM](https://github.github.com/gfm/) compliance.

## Configuration

::: warning

Don't try to enable MDX syntax in your markdown parser when using SvelTeX, as
it may conflict with SvelTeX's own parsing.

:::

**Hint:** Hover over the different properties in the code block to show some
IntelliSense.


::: code-group
```js twoslash [unified]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({ markdownBackend: 'unified' }, {
    markdown: {
        remarkPlugins: [],
        rehypePlugins: [],
        // Common options
        prefersInline: () => true,
        strict: false,
        transformers: {
            pre: [],
            post: [],
        },
    }
})
```
```js twoslash [markdown-it]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({ markdownBackend: 'markdown-it' }, {
    markdown: {
        extensions: [],
        options: {
            // markdown-it options
        },
        // Common options
        prefersInline: () => true,
        strict: false,
        transformers: {
            pre: [],
            post: [],
        },
    }
})
```
```js twoslash [micromark]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({ markdownBackend: 'micromark' }, {
    markdown: {
        options: {
            // micromark options
            extensions: [],
            htmlExtensions: [],
            allowDangerousProtocol: false,
            defaultLineEnding: undefined,
        },
        // Common options
        prefersInline: () => true,
        strict: false,
        transformers: {
            pre: [],
            post: [],
        },
    }
})
```
```js twoslash [marked]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex({ markdownBackend: 'marked' }, {
    markdown: {
        extensions: [],
        options: {
            // marked options
        },
        // Common options
        prefersInline: () => true,
        strict: false,
        transformers: {
            pre: [],
            post: [],
        },
    }
})
```
:::







## Frontmatter

### Languages

::: code-group
```sveltex [YAML]
---
title: Example
---

# {title}

Lorem ipsum dolor.
```
``` [TOML]
---toml
title = "Example"
---

# {title}

Lorem ipsum dolor.
```
``` [JSON]
---json
{
    title: "Example"
}
---

# {title}

Lorem ipsum dolor.
```
:::

### Variables

All properties defined in the frontmatter are accessible in the markup as
    variables:
-   Top-level properties are accessible as variables of the same name.
-   Nested properties are accessible as nested objects.

::: details Example

```sveltex
---
prop: Example
arr:
  - a
  - b: text
    c: 299792458
  - - d
    - e
obj:
  a: foo
  b:
    b1: bar
    b2: baz
  c:
    - c1
    - 2
---

Use the frontmatter variables like you would any other variable:
- As-is: {prop}
- In markdown: _{arr[1].b}_
- In HTML: <span>{arr[1].c}</spa.n>
- In attributes: <img src={objb.b2} alt={obj.c[0]}>
- In Svelte components: <Example>{obj.b.b1}</Example>
- In Svelte component attributes: <Example {prop} x={obj.a}/>
```

In effect, the frontmatter above will result in the following lines being added to the Svelte file's `<script>` block:

```svelte
<script>
// ...
const prop = 'Example';
const arr = ['a', { b: 'text', c: 299792458 }, ['d', 'e']];
const obj = { a: 'foo', b: { b1: 'bar', b2: 'baz' }, c: ['c1', 2] };
</script>
```

:::

**NB**: You can't use the variables in math expressions, code spans, code
blocks, or verbatim environments.


### Head elements

You can set many of the page's `<head>` elements from the frontmatter.

::: warning

The frontmatter content is _not_ sanitized or validated by SvelTeX. In
particular, if you pass in invalid content to the properties described below,
you may end up with invalid HTML elements in your page's `<head>` element.

:::

#### Title, noscript

The `title` and `noscript` properties set the page's `<title>` and `<noscript>`
elements, respectively.

::: code-group
```sveltex
---
title: Example
noscript: JS disabled.
---
```
```svelte
<svelte:head>
<title>Example</title>
<noscript>JS disabled</noscript>
</svelte:head>
```
:::

#### Meta

All [standard metadata names] are supported.

::: code-group
```sveltex
---
application-name: Name
author: Alice
charset: utf-8
color-scheme: normal
description: Text
generator: Svelte
keywords: a, b
referrer: no-referrer
theme-color: black
viewport: width=device-width, initial-scale=1
---
```
```svelte
<svelte:head>
<meta name="application-name" content="Name">
<meta name="author" content="Alice">
<meta charset="utf-8">
<meta name="color-scheme" content="normal">
<meta name="description" content="Text">
<meta name="generator" content="Svelte">
<meta name="keywords" content="a, b">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="black">
<meta name="viewport" content="width=device-width, initial-scale=1">
</svelte:head>
```
:::

:::: details Alternative forms

You can also set the meta tags with a `meta` object or array. Meta tags defined
in a `meta` object or array have precedence over those defined as top-level
properties.

Note that, while these forms are equivalent to the shorter form
above in terms of the `meta` tags they generate, the variables that will be
defined in the `script` tag will be different, as these always follow the
structure of the frontmatter one-to-one.

::: code-group
```sveltex [Object]
---
meta:
  application-name: Name
  author: Alice
  charset: utf-8
  color-scheme: normal
  description: Text
  generator: Svelte
  keywords: a, b
  referrer: no-referrer
  theme-color: black
  viewport: width=device-width, initial-scale=1
---
```
```sveltex [Array]
---
meta:
  - name: application-name
    content: Name
  - name: author
    content: Alice
  - name: charset
    content: utf-8
  - name: color-scheme
    content: normal
  - name: description
    content: Text
  - name: generator
    content: Svelte
  - name: keywords
    content: a, b
  - name: referrer
    content: no-referrer
  - name: theme-color
    content: black
  - name: viewport
    content: width=device-width, initial-scale=1
---
```
:::
::::


#### Link

::: code-group
```sveltex
---
link:
  - rel: stylesheet
    href: styles.css
  - rel: preload
    href: someFont.woff2
    as: font
    type: font/woff2
    crossorigin: anonymous
---
```
```svelte
<svelte:head>
<link rel="stylesheet" href="styles.css">
<link rel="preload" href="someFont.woff2" as="font" type="font/woff2" crossorigin="anonymous">
</svelte:head>
```
:::


#### Base

::: code-group
```sveltex
---
base: https://example.com
---
```
```svelte
<svelte:head>
<base href="https://example.com"/>
</svelte:head>
```
:::

:::: details Alternative forms

You can also set the `base` tag with an object. The object _must_ have a `href`
property, and _may_ have a `target` property.

::: code-group

```sveltex
---
base:
  href: https://example.com
  target: _blank
---
```
```svelte
<svelte:head>
<base href="https://example.com" target="_blank"/>
</svelte:head>
```
:::
::::

<!-- [^1]: (Note: the processing of the directives is the markdown backend's responsibility.) -->

[standard metadata names]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name
