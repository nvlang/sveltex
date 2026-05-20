---
'@nvl/sveltex': minor
---

Runtime and platform updates:

- **`engines.node` is now `>=22`** (was `>=16`). Migrating off
  `node-fetch` to the global `fetch` makes Node 18 the hard minimum,
  and the project standardises on Node 22+ across the monorepo. Older
  Node versions will refuse to install the package.
- **`exports` field added** that narrows deep imports to `./dist/*`.
  Consumers that imported internals via source paths (e.g.
  `@nvl/sveltex/src/...`) will need to switch to the `./dist/*`
  equivalent or to a public export from the package root.
- **`hast-util-to-html` reclassified** from a peer dependency to a
  runtime dependency. Downstream consumers no longer need to install
  it themselves.
- Runtime `uuid` dependency bumped from v13 to v14 (no SvelTeX-facing
  API change; flagged here for visibility in the transitive tree).
