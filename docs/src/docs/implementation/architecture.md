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
    code regions — is handed to the configured backend (micromark,
    markdown-it, unified or marked). See the [Markdown
    implementation](markdown) notes for how the backends are wrapped.

3.  **Re-insert + dispatch.** Once the markdown processor has produced
    HTML, SvelTeX walks the result and replaces each UUID with the
    processed form of its original content. Math UUIDs go to MathJax or
    KaTeX, code UUIDs go to Shiki / starry-night / highlight.js, and TeX
    UUIDs are compiled with LaTeX and converted to SVG via `dvisvgm`.
    Verbatim environments of type `escape` or `noop` are dropped back in
    largely as-is. See [TeX compilation](tex/compilation) for the LaTeX
    pipeline.

4.  **Svelte source.** What comes out the other end is regular Svelte —
    the original `<script>` / `<style>` blocks restored, plus the
    processed Markdown / math / code / TeX content slotted in. Svelte's
    compiler takes it from there.

The dispatch step (3) is the only one that branches: every other stage is
strictly linear, which keeps the data flow easy to reason about. The
escape / re-insert symmetry also means that anything inside a verbatim
environment is provably opaque to the Markdown processor — it can't break
your code.
