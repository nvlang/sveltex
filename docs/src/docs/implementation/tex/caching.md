---
title: Caching
---

# Caching

<p class="text-lg">
SvelTeX implements a simple but robust caching mechanism to prevent unnecessary recompilations of LaTeX content.
</p>

## Introduction

SvelTeX's LaTeX pipeline makes use of two directories (both of which are
configurable):

-   `node_modules/.cache/@nvl/sveltex`: The caching directory, where TeX files
    and their corresponding DVI, PDF, or XDV output files are stored.
-   `src/sveltex`: The output directory, where the final Svelte SVG components
    are stored.

Now, if we have a TeX component in a Svelte file on which SvelTeX is run, one of
the first things that SvelTeX will do is check the component's HTML tag and its
mandatory `ref` attribute. For example, consider the following TeX component:

```sveltex
<!-- src/routes/example/+page.sveltex -->
<TeX ref="ref1">...</TeX>
```

The tag and `ref` attribute are combined into a composite key with which the
component is identified. In this case, the composite key would be `TeX/ref1`.
This key is also used to determine the path at which to compile the component's
content and store its output; in this case, these paths would be:
-   `node_modules/.cache/@nvl/sveltex/TeX/ref1/root.tex`, and
-   `src/sveltex/TeX/ref1.svelte`.
