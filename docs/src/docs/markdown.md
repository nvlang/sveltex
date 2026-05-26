---
title: Markdown
description: Use unified, markdown-it, micromark, or marked with SvelTeX.
outline: deep
pageClass: docs-md
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
Write your content in Markdown, interleaved with Svelte components and syntax,
and render it at build-time with the Markdown processor of your choice.
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

    **Frontmatter:** Set page metadata for SEO, import resources with
    `<link>`s, import Svelte components, and more, all from within
    frontmatter written in YAML, TOML, or JSON.

-   <PhGear color="var(--hig-pink)" class="opacity-80" :size="28" weight="duotone"/>

    **Custom transformers:** Inject custom transformers to pre- and post-process
    the in- and output of the math renderer, respectively.

</div>

## CommonMark differences

::: info SvelTeX disables some CommonMark syntax

To stay predictable alongside Svelte markup, SvelTeX turns off a couple of
CommonMark constructs in its Markdown parsing — via
[`micromark-extension-mdx-md`](https://github.com/micromark/micromark-extension-mdx-md),
the same approach [MDX](https://mdxjs.com) takes:

-   **Indented code blocks are disabled.** Four-space-indented prose stays a
    paragraph (its inline markup still rendered) instead of becoming a code
    block. Use a fenced code block (```` ``` ````) for code.
-   **Autolinks are disabled.** Write an explicit
    `[label](https://example.com)` rather than a bare
    `<https://example.com>`.

Raw HTML is *not* disabled but handled specially — see
[Markdown implementation](/docs/implementation/markdown). The bundled editor
support (VS Code, Zed) highlights `.sveltex` files to match these rules, so
what you see matches what SvelTeX compiles.

:::

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
    abstract syntax trees (ASTs). In this case, SvelTeX uses `remark` to
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
    CommonMark compliant, it'll seldom be the case that you should pick this
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

For every available option and its type, see the
[`MarkdownConfiguration`](/api/interfaces/MarkdownConfiguration) API reference.

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

export default await sveltex(
    { markdownBackend: 'unified' },
    {
        markdown: {
            remarkPlugins: [],
            retextPlugins: [],
            rehypePlugins: [],
            remarkRehypeOptions: {},
            rehypeStringifyOptions: {},
            // Common options
            components: [],
            prefersInline: () => true,
            strict: false,
            transformers: {
                pre: [],
                post: [],
            },
        },
    },
);
```

```js twoslash [markdown-it]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex(
    { markdownBackend: 'markdown-it' },
    {
        markdown: {
            extensions: [],
            options: {
                // markdown-it options
            },
            // Common options
            components: [],
            prefersInline: () => true,
            strict: false,
            transformers: {
                pre: [],
                post: [],
            },
        },
    },
);
```

```js twoslash [micromark]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex(
    { markdownBackend: 'micromark' },
    {
        markdown: {
            options: {
                // micromark options
                extensions: [],
                htmlExtensions: [],
                allowDangerousProtocol: false,
                defaultLineEnding: undefined,
            },
            // Common options
            components: [],
            prefersInline: () => true,
            strict: false,
            transformers: {
                pre: [],
                post: [],
            },
        },
    },
);
```

```js twoslash [marked]
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex(
    { markdownBackend: 'marked' },
    {
        markdown: {
            extensions: [],
            options: {
                // marked options
            },
            // Common options
            components: [],
            prefersInline: () => true,
            strict: false,
            transformers: {
                pre: [],
                post: [],
            },
        },
    },
);
```

:::

## Frontmatter

### Languages

::: code-group

```sveltex [YAML]
---
title: Example
---

# {metadata.title}

Lorem ipsum dolor.
```

```[TOML]
---toml
title = "Example"
---

# {metadata.title}

Lorem ipsum dolor.
```

```[JSON]
---json
{
    title: "Example"
}
---

# {metadata.title}

Lorem ipsum dolor.
```

:::

### Imports

The `imports` frontmatter key is a SvelTeX convenience for declaring
`import` statements without writing a `<script>` block. Each entry's key
is the module path, and its value is what to import — either a single
identifier (for a default import) or a list of identifiers (for named
imports).

::: code-group

```sveltex [sveltex]
---
imports:
  $lib/components/Example.svelte: Example
  $lib/utils.js:
    - a
    - b
---
```

```svelte [svelte]
<script module>

export const metadata = {
imports: {"$lib/components/Example.svelte":"Example","$lib/utils.js":["a","b"]},
};
</script>
<script>

import Example from '$lib/components/Example.svelte';
import { a, b } from '$lib/utils.js';
</script>

```

:::

`imports` is also an ordinary top-level frontmatter key, so it shows up
in the [`metadata` export](#metadata-export) too. The two steps can be
toggled independently — see [Disabling frontmatter
processing](#disabling-frontmatter-processing).

### Metadata export

The whole parsed frontmatter is exported from the page's _module_ script
as `export const metadata = { … }`. The same `metadata` binding is
available from inside the page itself (as in, e.g., `metadata.title`
in the markup or in the page's `<script>`), and from outside the page
as a named export (e.g., `import { metadata } from './page.sveltex'`).

::: code-group

```sveltex [sveltex]
---
title: Example
author: Jane Doe
color-scheme: dark
---
```

```svelte [svelte]
<svelte:head>
<title>Example</title>
<meta name="author" content="Jane Doe">
<meta name="color-scheme" content="dark">
</svelte:head>
<script module>

export const metadata = {
author: "Jane Doe",
"color-scheme": "dark",
title: "Example",
};
</script>
<script>
</script>

```

:::

Keys are preserved verbatim — hyphenated ones like `color-scheme` are
quoted in the object literal where JavaScript syntax requires it. A page
without any frontmatter still emits `export const metadata = undefined;`,
so consumers can always import `metadata` without a guard.

Using a frontmatter value in the page's markup is just an object access:

::: code-group

```sveltex [sveltex]
---
title: Welcome
---

# {metadata.title}

Posted by {metadata.author ?? 'anonymous'}.
```

```svelte [svelte]
<svelte:head>
<title>Welcome</title>
</svelte:head>
<script module>

export const metadata = {
title: "Welcome",
};
</script>
<script>
</script>

<h1>{metadata.title}</h1>
<p>Posted by {metadata.author ?? 'anonymous'}.</p>
```

:::

For keys that aren't valid JavaScript identifiers, use bracket access:
`{metadata['color-scheme']}`.

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

All [standard `<meta>` names] are supported.

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

Note that, while these forms are equivalent to the shorter form above in
terms of the `<meta>` tags they generate, the shape of the `metadata`
export differs — `metadata` always mirrors the frontmatter one-to-one.

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

### Disabling frontmatter processing

By default, SvelTeX puts the frontmatter to use in three independent ways:

-   **`head`** — generates a `<svelte:head>` block with the `<title>`,
    `<meta>`, `<link>`, `<base>`, and `<noscript>` elements described above;
-   **`metadata`** — adds an `export const metadata` statement to the
    module script (`<script module>`) — see
    [Metadata export](#metadata-export);
-   **`imports`** — honors the special `imports` key, letting a document
    declare `import` statements from within its frontmatter — see
    [Imports](#imports).

Each can be switched off through the `frontmatter` configuration option:
pass an object to toggle steps individually, or `false` to disable all
three at once.

```js twoslash
// sveltex.config.js
import { sveltex } from '@nvl/sveltex';

export default await sveltex(
    { markdownBackend: 'micromark' },
    {
        frontmatter: {
            head: false,
        },
    },
);
```

The most common reason to do this is to keep full control over the page's
`<head>` — for example, to append your site's name to every page title.
Because `metadata` is left on, the frontmatter values are still
available, so you can write the `<svelte:head>` yourself:

::: code-group

```sveltex [sveltex]
---
title: Welcome
---

<svelte:head>
<title>{metadata.title} — My Site</title>
</svelte:head>

# {metadata.title}
```

```svelte [svelte]
<script module>

export const metadata = {
title: "Welcome",
};
</script>
<script>
</script>

<svelte:head>
<title>{metadata.title} — My Site</title>
</svelte:head>
<h1>{metadata.title}</h1>
```

:::

::: tip

Switching a step off never stops the frontmatter block from being parsed and
removed from the rendered output, and never stops the parsed values from
being passed to your markdown and math transformers — it only suppresses the
corresponding generated code.

:::

<!-- [^1]: (Note: the processing of the directives is the markdown backend's responsibility.) -->

[standard `<meta>` names]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name
