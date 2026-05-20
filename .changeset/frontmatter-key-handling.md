---
'@nvl/sveltex': minor
---

Remove the per-key instance-script `const` declarations that SvelTeX
previously emitted for every top-level frontmatter key (`const title =
…;` etc.). Frontmatter values are now reached exclusively through the
`metadata` export, which is reachable from inside the page itself (as
`metadata.title` in the markup or instance script) and from outside as
a named export — `import { metadata } from './page.sveltex'`.

The `metadata` object's keys are quoted when not valid JavaScript
identifiers, so `color-scheme: dark` produces a valid
`{ "color-scheme": "dark" }` rather than the previously invalid
`{ color-scheme: "dark" }`.

This is a breaking change for documents that referenced frontmatter
values as bare variables (`{title}` etc.); replace those with
`{metadata.title}`, or `{metadata['color-scheme']}` for keys that
aren't valid JavaScript identifiers.
