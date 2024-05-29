---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "SvelTeX"
  text: "Flexible preprocessor"
  tagline: Svelte + Markdown + LaTeX
  actions:
    - theme: brand
      text: Documentation
      link: /markdown-examples
    - theme: alt
      text: Examples
      link: /api-examples

features:
  - title: Markdown
    details: Use your favorite markdown compiler and plugin ecosystem — built-in support for <code>remark-rehype</code>, <code>marked</code>, <code>markdown-it</code>, and <code>micromark</code>.
    link: /docs/markdown
  - title: Code Blocks
    details: Highlight code in fenced code blocks or custom components with <code>starry-night</code>, <code>highlight.js</code>, or a custom highlighter.
    link: /docs/code
  - title: LaTeX
    details: Compile any LaTeX code in your markup at build-time into optimized SVG components using your local TeX distribution.
    link: /docs/advanced-tex
  - title: Math
    details: Render math expressions that don't require a full TeX distribution at build-time with MathJax or KaTeX.
    link: /docs/tex
---


