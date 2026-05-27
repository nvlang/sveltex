---
title: Architecture
---

<script setup>
import ArchitectureDiagram from './res/ArchitectureDiagram.vue';
</script>

# Architecture

SvelTeX is a [Svelte preprocessor](https://svelte.dev/docs/svelte/svelte-compiler#preprocess):
it takes a `.sveltex` source file, walks it through a fixed pipeline, and
hands the resulting Svelte source to the Svelte compiler.

<figure class="my-8 py-6 flex justify-center bg-[var(--vp-code-block-bg)] rounded-xl">
<ArchitectureDiagram class="max-w-3xl" />
</figure>

The pipeline has four meaningful stages, plus a dispatch step that fans out
to the per-type backends:

1.  **Escape.** Markdown processors don't understand Svelte. To get around
    that, SvelTeX walks the source once and UUID-substitutes anything that
    isn't plain prose: `<script>` / `<style>` blocks, `<svelte:*>` elements,
    verbatim environments (`<tex>`, `<Code>`, …), inline / block math,
    fenced code blocks, and Svelte mustache expressions (`{...}`). Each
    substitution stashes the original text in a map keyed by its UUID. See
    [Escaping](escaping) for the full ranking + range logic.

2.  **Markdown processing.** The escaped source — now Markdown with
    UUID-shaped opaque blobs sitting in for the Svelte / verbatim / math /
    code regions — is handed to the configured backend (`micromark`,
    `markdown-it`, `unified` or `marked`). See the [Markdown
    implementation](markdown) notes for how the backends are wrapped.

3.  **Re-insert + dispatch.** Once the markdown processor has produced
    HTML, SvelTeX walks the HTML and replaces each UUID with the processed
    form of its original content. The UUID's type (math / code / TeX /
    verbatim) decides which handler runs:

    -   Math UUIDs → MathJax or KaTeX,
    -   code UUIDs → Shiki, starry-night or `highlight.js`,
    -   TeX UUIDs → LaTeX compilation, then `dvisvgm` for SVG conversion
        (see [TeX compilation](tex/compilation)),
    -   verbatim `escape` / `noop` UUIDs → re-inserted largely as-is.

4.  **Svelte source.** What comes out the other end is regular Svelte —
    the original `<script>` / `<style>` blocks restored, plus the
    processed Markdown / math / code / TeX content slotted in. Svelte's
    compiler takes it from there.

The dispatch step (3) is the only one that branches: every other stage is
strictly linear, which keeps the data flow easy to reason about. The
escape / re-insert symmetry also means that anything inside a verbatim
environment is provably opaque to the Markdown processor — it can't break
your code.

## Why a Markdown processor is part of SvelTeX

Svelte itself doesn't speak Markdown — it speaks Svelte (HTML + `<script>`
+ `<style>` + mustache expressions). The transformation from Markdown to
HTML therefore has to happen **before** Svelte sees the file, which is
exactly what a [Svelte
preprocessor](https://svelte.dev/docs/svelte/svelte-compiler#preprocess)
does: it runs at build time, between "developer saves `Page.sveltex`" and
"Svelte compiler parses `Page.svelte`".

That's why a Markdown engine (`micromark`, `markdown-it`, `unified` or
`marked`) is part of SvelTeX's runtime pipeline: SvelTeX is the thing
that actually has to call it. The four engines are declared as **peer
dependencies**, so you only install the one you want — SvelTeX won't pull
all four into your `node_modules`.

The escape stage uses `micromark`'s parser and a handful of `mdast-util-*`
/ `micromark-extension-*` packages directly (those are regular
dependencies). It needs the parser regardless of which Markdown backend
you pick because the escape stage isn't doing Markdown→HTML — it's
finding the *Svelte* parts of your source so they can be hidden from the
Markdown backend you eventually run.
