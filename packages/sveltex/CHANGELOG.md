# @nvl/sveltex

## 0.5.0

### Minor Changes

- [`33b8d16`](https://github.com/nvlang/sveltex/commit/33b8d167966e6148df72e55b4b761e7587ae9149)
  Thanks [@nvlang](https://github.com/nvlang)! - Add a `frontmatter`
  configuration option controlling which of SvelTeX's three
  frontmatter-processing steps run. Each toggles independently — `head` (the
  generated `<svelte:head>`), `metadata` (the `export const metadata`
  module-script export), and `imports` (the `imports` frontmatter key) — or all
  at once via `frontmatter: false`.

    This makes the `<svelte:head>` injection opt-out: set
    `frontmatter: { head: false }` to build the document's `<head>` yourself
    while still reading the frontmatter from the `metadata` export. The
    frontmatter block is still parsed, stripped from the output, and passed to
    transformers regardless. Resolves
    [#24](https://github.com/nvlang/sveltex/issues/24).

- [`33b8d16`](https://github.com/nvlang/sveltex/commit/33b8d167966e6148df72e55b4b761e7587ae9149)
  Thanks [@nvlang](https://github.com/nvlang)! - Remove the per-key
  instance-script `const` declarations that SvelTeX previously emitted for every
  top-level frontmatter key (`const title = …;` etc.). Frontmatter values are
  now reached exclusively through the `metadata` export, which is reachable from
  inside the page itself (as `metadata.title` in the markup or instance script)
  and from outside as a named export —
  `import { metadata } from './page.sveltex'`.

    The `metadata` object's keys are quoted when not valid JavaScript
    identifiers, so `color-scheme: dark` produces a valid
    `{ "color-scheme": "dark" }` rather than the previously invalid
    `{ color-scheme: "dark" }`.

    This is a breaking change for documents that referenced frontmatter values
    as bare variables (`{title}` etc.); replace those with `{metadata.title}`,
    or `{metadata['color-scheme']}` for keys that aren't valid JavaScript
    identifiers.

- [`4381c80`](https://github.com/nvlang/sveltex/commit/4381c808c8ffe0e6c78549a331d267b7a6f24a70)
  Thanks [@nvlang](https://github.com/nvlang)! - Update the `mathjax` math
  backend to **MathJax v4**.
    - The optional `mathjax` backend now targets `@mathjax/src` v4. If you use
      it, ensure your `@mathjax/src` peer dependency is `>=4`. MathJax v4 ships
      fonts as separate packages, so also install the
      `@mathjax/mathjax-<font>-font` package matching your configured
      `math.font`.
    - MathJax v4 initializes a single, process-global document, so each build
      uses one math `outputFormat` (`svg` or `chtml`) — sufficient for any
      SvelteKit build, which has a single preprocessor configuration.
    - **Accessible math by default.** The `mathjax` backend emits assistive
      MathML while leaving MathJax's own speech-string generation off — emitting
      both can make some screen readers announce an expression twice. SvelTeX's
      `enable*` accessibility options now select which MathJax extensions are
      loaded, so opting into speech, braille or semantic enrichment works as
      documented.
    - Modernized SvelTeX's element-detecting regexes
      ([#25](https://github.com/nvlang/sveltex/issues/25)).
    - Updated dependencies, including some breaking major-version bumps.

- [`ad1a3fa`](https://github.com/nvlang/sveltex/commit/ad1a3fa5503a211e3f04710cbdfe04a945bc1a64)
  Thanks [@nvlang](https://github.com/nvlang)! - Runtime and platform updates:
    - **`engines.node` is now `>=22`** (was `>=16`). Migrating off `node-fetch`
      to the global `fetch` makes Node 18 the hard minimum, and the project
      standardises on Node 22+ across the monorepo. Older Node versions will
      refuse to install the package.
    - **`exports` field added** that narrows deep imports to `./dist/*`.
      Consumers that imported internals via source paths (e.g.
      `@nvl/sveltex/src/...`) will need to switch to the `./dist/*` equivalent
      or to a public export from the package root.
    - **`hast-util-to-html` reclassified** from a peer dependency to a runtime
      dependency. Downstream consumers no longer need to install it themselves.
    - Runtime `uuid` dependency bumped from v13 to v14 (no SvelTeX-facing API
      change; flagged here for visibility in the transitive tree).

### Patch Changes

- [`33b8d16`](https://github.com/nvlang/sveltex/commit/33b8d167966e6148df72e55b4b761e7587ae9149)
  Thanks [@nvlang](https://github.com/nvlang)! - Fix `charset` frontmatter
  handling to emit the HTML-correct `<meta charset="…">` instead of the invalid
  `<meta name="charset" content="…">`. The fix covers all three input shapes:
    - top-level `charset: utf-8`,
    - `meta:` mapping form (`meta: { charset: utf-8 }`),
    - `meta:` array form (`meta: [{ name: charset, content: utf-8 }]`).

    Duplicate `charset` entries are deduplicated (last one wins, with a
    warning); other `<meta>` and `<meta http-equiv>` entries are preserved when
    a `charset` is added (and vice versa).

- [`6895bc6`](https://github.com/nvlang/sveltex/commit/6895bc6556a72baac5a739ad747454dbc1d0b8f2)
  Thanks [@nvlang](https://github.com/nvlang)! - When the `mathjax` backend is
  selected with a non-default `math.font`, SvelTeX now probes the matching
  `@mathjax/mathjax-<font>-font` package upfront via `import.meta.resolve` and
  surfaces a missing one through the end-of-build missing-dependencies summary.
  Previously, an uninstalled non-default font package would only manifest as an
  opaque "Cannot find module" error deep inside MathJax's lazy font loader, with
  no hint about which package to install.

    The default font (`newcm`) is unaffected: `@mathjax/src` already declares
    `@mathjax/mathjax-newcm-font` as a regular dependency, so it's always
    present whenever `@mathjax/src` is.

- [`badb34e`](https://github.com/nvlang/sveltex/commit/badb34ecbcf50b0e588ebe61cd33a9305d0173a7)
  Thanks [@nvlang](https://github.com/nvlang)! - Emit Svelte 5's
  `<script module>` for the frontmatter `metadata` export, instead of the
  `<script context="module">` syntax that Svelte 5 deprecated
  (`script_context_deprecated`) and Svelte 6 removes. Building a `.sveltex` page
  with frontmatter no longer logs a deprecation warning. User-authored
  `<script context="module">` blocks are still recognized.

## 0.4.4

### Patch Changes

- [`c7d30fd`](https://github.com/nvlang/sveltex/commit/c7d30fdf9f45706af3af50a354753b087d3e026b)
  Thanks [@nvlang](https://github.com/nvlang)! - Correct Deno install
  instructions in README.

- [`1918771`](https://github.com/nvlang/sveltex/commit/1918771fdaeae035efd9ab1046158eca6fd176ef)
  Thanks [@nvlang](https://github.com/nvlang)! - Add screenshot to README.

## 0.4.3

### Patch Changes

- [`09fcfe9`](https://github.com/nvlang/sveltex/commit/09fcfe971e674f0d56380ec6aa8b7733419f1d8b)
  Thanks [@nvlang](https://github.com/nvlang)! - Fix issue where whitespace
  would collapse in inline code when highlighted with Shiki (#18).

## 0.4.2

### Patch Changes

- [`e838e5c`](https://github.com/nvlang/sveltex/commit/e838e5c8055cd8f9ea6a309bbb14176bd117621e)
  Thanks [@nvlang](https://github.com/nvlang)! - Fixes a bug where the line
  number wouldn't be parsed correctly from some LaTeX logs.
