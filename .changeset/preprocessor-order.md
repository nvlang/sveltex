---
'@nvl/sv-sveltex': minor
---

Insert the SvelTeX preprocessor at the **front** of the `preprocess` array,
ahead of any existing preprocessor (e.g. `vitePreprocess`). A markup
preprocessor running before SvelTeX would see a `.sveltex` file's raw LaTeX
backslashes and break the build — which happened on realistic
`sequence(...)`-wrapped configs.
