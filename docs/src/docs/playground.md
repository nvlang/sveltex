---
title: Playground
---

# Playground

This is a live, interactive playground for the SvelTeX preprocessor. Edit the
SvelTeX source on the left, and watch each stage of the preprocessing pipeline
update on the right.

SvelTeX preprocesses a document in a few significant stages:

1.  **Escaped document** — potentially tricky content (fenced code blocks,
    inline code spans, math, and verbatim environments) is pulled out and
    replaced with placeholders, so that the Markdown processor leaves it
    untouched.
2.  **Rendered Markdown** — the escaped document is handed to the Markdown
    backend, which turns the Markdown into HTML.
3.  **Svelte output** — the processed snippets are substituted back in, and the
    final Svelte component is emitted. This is what the Svelte compiler
    receives.

The tabs below correspond to these stages, with the final **Svelte output**
selected by default.

::: info Everything runs in your browser
The playground runs entirely client-side: the SvelTeX preprocessor is loaded
into a Web Worker, and only its text-transformation routine
(`Sveltex.trace`) is invoked. Your document is never executed, mounted, or
rendered as a Svelte component — every tab shows inert, escaped text. There is
no server involved.
:::

<Playground />

The playground uses the `marked` Markdown backend, the `escape` code backend
(code is shown verbatim, not syntax-highlighted), and the `katex` math backend.
For the full list of available backends and configuration options, see the
[Markdown](/docs/markdown), [Code](/docs/code), and [Math](/docs/math) pages.
