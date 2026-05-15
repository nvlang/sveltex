---
'@nvl/sveltex': major
---

Update the `mathjax` math backend to **MathJax v4**.

- The optional `mathjax` backend now targets `@mathjax/src` v4. If you use it,
  ensure your `@mathjax/src` peer dependency is `>=4`. MathJax v4 ships fonts
  as separate packages, so also install the `@mathjax/mathjax-<font>-font`
  package matching your configured `math.font`.
- MathJax v4 initializes a single, process-global document, so each build uses
  one math `outputFormat` (`svg` or `chtml`) — sufficient for any SvelteKit
  build, which has a single preprocessor configuration.
- **Accessible math by default.** The `mathjax` backend emits assistive MathML
  while leaving MathJax's own speech-string generation off — emitting both can
  make some screen readers announce an expression twice. KaTeX likewise emits
  MathML by default now.
- Modernized SvelTeX's element-detecting regexes (#25).
- Updated dependencies, including some breaking major-version bumps.
