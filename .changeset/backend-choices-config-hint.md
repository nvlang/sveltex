---
'@nvl/sveltex': patch
---

Make the backend-choices warning actionable when a configuration key is
misplaced. Passing a single merged object to `sveltex()` — instead of the
backend choices first and the configuration second — previously produced only a
generic "Extraneous keys detected" warning. SvelTeX now recognises when the
stray keys are configuration options (`markdown`, `code`, `math`, `tex`,
`verbatim`, `frontmatter`, `extensions`) and points at the two-argument form,
e.g. `sveltex({ … }, { code: … })`. The recognised list is kept in sync with
the configuration type at compile time.
