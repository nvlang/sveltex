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
      link: /docs
    - theme: alt
      text: Examples
      link: /examples

features:
  - title: Markdown
    details: Use your favorite markdown compiler and plugin ecosystem — built-in support for <code>remark-rehype</code>, <code>marked</code>, <code>markdown-it</code>, and <code>micromark</code>.
    link: /docs/markdown
    icon:
      light: /light/markdown-logo-duotone.svg
      dark: /dark/markdown-logo-duotone.svg
      alt: code icon
  - title: Code Blocks
    details: Highlight and transform code in fenced code blocks or custom "verbatim" components with Shiki, <code>starry-night</code>, or highlight.js.
    link: /docs/code
    icon:
      light: /light/brackets-curly-duotone.svg
      dark: /dark/brackets-curly-duotone.svg
      alt: code icon
  - title: LaTeX
    details: Compile any LaTeX code in your markup at build-time into optimized SVG components using your local TeX distribution.
    link: /docs/tex
    icon:
      light: /light/vector-two-duotone.svg
      dark: /dark/vector-two-duotone.svg
      alt: code icon
  - title: Math
    details: Render math expressions that don't require a full TeX distribution at build-time with MathJax or KaTeX.
    link: /docs/math
    icon:
      light: /light/pi-duotone.svg
      dark: /dark/pi-duotone.svg
      alt: code icon


