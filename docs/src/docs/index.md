---
title: Overview
description: Some highlights from SvelTeX's features.
---

<script lang="ts" setup>
import { PhGear, PhLightning, PhShieldCheck, PhPackage, PhFeather, PhBooks, PhVectorTwo, PhMarkdownLogo, PhCube, PhInfo, PhUmbrellaSimple, PhTextAlignLeft } from '@phosphor-icons/vue';
</script>

# Overview

## Summary

SvelTeX is a
[preprocessor](https://kit.svelte.dev/docs/integrations#preprocessors) for
[Svelte](https://svelte.dev/) that allows you to write
[markdown](https://en.wikipedia.org/wiki/Markdown) and
[LaTeX](https://en.wikipedia.org/wiki/LaTeX) directly in your `.svelte` files.
It does so by escaping special syntax and parsing content into four categories:

-   **Markdown:** Processed by a markdown processor: unified (remark + rehype), markdown-it, micromark, or marked.
-   **Code:** Processed by a syntax highlighter: Shiki, `starry-night`, or highlight.js.
-   **Math:** Processed by a math renderer: MathJax or KaTeX.
-   **TeX:** Processed by your local TeX distribution.

It then runs these processors on the corresponding content, and stitches the
output of each back together into a single Svelte file and unescapes previously
escaped special syntax. After this, the Svelte compiler or the next Svelte
preprocessor can take over.

## Highlights

<div class="features-list mt-8">


-   <PhMarkdownLogo :size="28" weight="duotone"/>

    **Markdown-in-Svelte:** Intersperse markdown and Svelte syntax for a better
    developer and authoring experience. Pick your favorite markdown processor
    and use plugins to fine-tune the output, or let SvelTeX take care of the
    details for you.

-   <PhVectorTwo :size="28" weight="duotone"/>

    **LaTeX-in-Svelte:** Take advantage of your local TeX distribution and
    generate highly optimized SVGs for complex graphics using familiar syntax,
    all without leaving your Svelte files.

-   <PhPackage :size="28" weight="duotone"/>

    **Out-of-the-box:** Sensible defaults and helpful features such as automatic
    CSS injection for MathJax and KaTeX make it easy to get started with
    SvelTeX.

-   <PhLightning :size="28" weight="duotone"/>

    **Zero runtime:** Being a preprocessor, SvelTeX runs entirely at build-time,
    so there's no need for client-side JavaScript.

-   <PhGear :size="28" weight="duotone"/>

    **Customizable:** SvelTeX is extremely customizable. It supports multiple
    different backends for markdown, syntax highlighting, and math rendering,
    letting you work with your favorite ecosystem of plugins. Furthermore, it
    also allows you to inject your own custom transformers into the pipeline for
    each of these processors.

-   <PhTextAlignLeft :size="28" weight="duotone"/>

    **SvelTeX language support:** A TextMate grammar for SvelTeX, and a VS Code
    extension shipping the same, enables most IDEs to properly highlight SvelTeX
    code.

-   <PhBooks :size="28" weight="duotone"/>

    **Extensive documentation:** With these docs and the extensive IntelliSense
    that 7,000+ lines of comments provides, you'll find that just about every
    function or type in SvelTeX is documented, be it user-facing or internal.

-   <PhFeather :size="28" weight="duotone"/>

    **Small codebase:** At under 10,000 lines of code[^1], SvelTeX's core is
    relatively small, making it easier to maintain and contribute to.

-   <PhShieldCheck :size="28" weight="duotone"/>

    **TypeScript-first:** SvelTeX is exclusively written in TypeScript.
    Consistent use of generics and precise types make SvelTeX not only type-safe
    and easier to maintain, but also ensures that the right IntelliSense is
    provided in any given situation.

-   <PhCube :size="28" weight="duotone"/>

    **HMR support:** None of SvelTeX's functionality interferes with Vite's
    excellent hot module replacement (HMR) support; in fact, it's a joy to watch
    the output of your TeX code update on your dev server as you go.

-   <PhUmbrellaSimple :size="28" weight="duotone"/>

    **Robust:** [Fuzzy](https://en.wikipedia.org/wiki/Fuzzing) testing with
    [fast-check](https://github.com/dubzzz/fast-check), E2E visual regression
    tests with [Playwright](https://playwright.dev/) (1,000+ snapshots), and
    5,000+ unit tests with [Vitest](https://vitest.dev/) provide 100% code
    coverage.

-   <PhInfo :size="28" weight="duotone"/>

    **Helpful error messages:** A lot of effort has gone into trying to make
    error messages as helpful as possible, offering suggestions and context
    where possible.

</div>

[^1]: Lines of code in `src` directory, excluding `src/data` directory. This
    count excludes comments and blank lines.
