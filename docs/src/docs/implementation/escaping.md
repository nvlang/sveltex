---
title: Escaping
---

<script setup>
import EscapingRanges from './res/EscapingRanges.vue';
</script>

# Escaping

In the text below, when we say that we "escape" something, we mean that we
replace it with an UUIDv4 (possibly without the dashes), and store the original
value in a map indexed by the UUIDs.

1.  Escape colons inside special Svelte elements (e.g. `<svelte:component>`),
    since these would otherwise confuse the markdown processor.

2.  Parse content and determine possible ranges to escape.

    1.  Parse with `fromMarkdown` method from `mdast-util-from-markdown`, with the help of a bunch of micromark extensions:

        -   `micromark-extension-frontmatter`: Detects YAML frontmatter.
        -   `micromark-extension-directive`: Detects markdown directives. Only
            used if directives are enabled.
        -   `micromark-extension-mdx-md`: Disables the following CommonMark
            syntax: indented code blocks, autolinks, and HTML (flow and text).
        -   "Homemade" `micromarkSkip` extension: This extension was written
            specifically for SvelTeX, and is used to skip content inside
            `<script>`, `<style>`, and verbatim tags. I might publish the
            extension as a standalone package in the future.
        -   `micromark-extension-math`: Detects math delimited by dollar signs.
            Only used if dollar sign delimiters are enabled.
        -   `micromark-extension-mdx-expression`: Detects expressions delimited by curly braces, i.e., Svelte "mustache tags" or "interpolations".

    2.  Find the following components:

        -   `<script>...</script>`
        -   `<style>...</style>`
        -   `<svelte:head>...</svelte:head>`
        -   `<svelte:window>...</svelte:window>` and `<svelte:window ... />`
        -   `<svelte:document>...</svelte:document>`
        -   `<svelte:body>...</svelte:body>`
        -   `<svelte:options>...</svelte:options>`

    3.  Find math in `\(...\)` and `\[...\]` delimiters (if enabled).
    4.  Find verbatim components.

3.  **Determine the ranges to escape.** The sub-steps from the previous steps
    are run on the same content independently from one another, so the ranges
    they find might overlap. This overlap is undesired, and we resolve it by
    prioritizing ranges that start earlier. Note that the type of range (e.g.,
    math expression, verbatim component, script tag, etc.) is not taken into
    consideration during this process.

    <p class="pt-3">
    For example, in the figure below, the topmost two ranges would be
    prioritized (where the relation "starting earlier" is visualized with the
    horizontal axis, with the leftmost point being the "earliest"). The large
    rectangles in the background below the two topmost ranges are meant as a
    visual aid for comparing the starting and ending points of different ranges.
    </p>

    <figure class="flex justify-center my-4 py-6 bg-[var(--vp-code-block-bg)] rounded-xl"><EscapingRanges class="max-w-sm" /></figure>

    <p class="pt-3">
    Consider the following, more concrete example. Here, each group of
    highlighted lines would be escaped into one UUID each.
    </p>

    ````sveltex
    ``` // [!code highlight:3]
    <script>
    ```

    <Verbatim> // [!code highlight:4]
    ```
    </script>
    </Verbatim>

    ``` // [!code highlight:3]
    we're inside of an unterminated fenced code block here

    ````

4.  **Escape the ranges.** This is pretty much the simplest part of the entire
    ordeal. The only real difficulty would be keeping track of how the escaping
    of one range would shift the offsets defining the other ranges, but we let
    [`magic-string`] take care of all this for us.





[`magic-string`]: https://www.npmjs.com/package/magic-string
