# E2E Tests

Visual regression tests for `@nvl/sveltex`, covering every supported combination of
markdown, code, and math backends.

## Architecture

Each backend combination gets its own **isolated SvelteKit project** with its own
preview server running on a unique port.  Playwright runs all combinations in parallel,
with no shared state between them.

```
tests/e2e/
├── _template/              # Shared SvelteKit scaffold (installed once)
│   ├── src/
│   │   ├── app.html
│   │   ├── app.d.ts
│   │   └── lib/
│   │       └── Example.svelte
│   ├── static/
│   │   ├── app.css
│   │   └── favicon.png
│   ├── package.json        # Shared deps (symlinked into every project)
│   ├── tsconfig.json       # Shared TS config (symlinked)
│   └── .npmrc
│
├── pages/                  # Source markdown pages (backend-agnostic)
│   ├── code/
│   ├── markdown/
│   ├── math/
│   └── tex/
│
├── projects/               # ← GENERATED (git-ignored)
│   ├── unified-shiki-katex/
│   │   ├── node_modules -> ../../_template/node_modules   (symlink)
│   │   ├── package.json  -> ../../_template/package.json  (symlink)
│   │   ├── src/lib       -> ../../../_template/src/lib    (symlink)
│   │   ├── sveltex.config.js   ← generated for this combo
│   │   ├── svelte.config.js    ← generated for this combo
│   │   ├── vite.config.js      ← generated (unique port)
│   │   └── src/routes/         ← generated pages
│   ├── unified-shiki-mathjax-svg-newcm/
│   │   └── …
│   └── … (80 projects total)
│
├── snapshots/              # Visual regression golden images (committed)
│
├── backends.ts             # Single source of truth: all backend combos + helpers
├── generate.ts             # Generator: writes per-combo project directories
├── build-projects.ts       # Builder: runs `vite build` across all projects in parallel
└── combo.spec.ts           # Shared Playwright spec (parameterised by project name)
```

### Backend dimensions

| Axis     | Values |
|----------|--------|
| Markdown | `unified`, `markdown-it`, `micromark`, `marked` |
| Code     | `shiki`, `starry-night`, `highlight.js`, `escape` |
| Math     | `katex`, `mathjax-svg-newcm`, `mathjax-svg-fira`, `mathjax-chtml-newcm`, `mathjax-chtml-fira` |

4 × 4 × 5 = **80 combinations**.

Browsers are Playwright **projects** (`chrome`, `firefox`, `galaxy-s9`); each backend
combo is a `describe` block within the single shared `combo.spec.ts`. Every browser
project runs the full combo matrix, for a total of ~1900 screenshot tests.

### How `combo.spec.ts` is parameterised

A test file's module scope runs **once**, before Playwright assigns tests to projects,
so a spec cannot know "which project am I". Instead, `combo.spec.ts` enumerates every
combo at collection time, globs that combo's `projects/<combo-id>/src/routes/`
directory, and registers one screenshot test per page — each pointed at its combo's own
preview server via an absolute `http://localhost:<port>` URL.

---

## Running the tests

### Full run (from `packages/sveltex/`)

```sh
# 1. Build sveltex, install template deps, generate + build all 80 projects:
pnpm test:e2e:prepare

# 2. Run Playwright (servers are started automatically):
pnpm playwright

# 3. Or do both in one command:
pnpm test:e2e
```

### Update golden snapshots

```sh
pnpm test:e2e:golden
# or, if the projects are already built:
pnpm playwright:golden
```

### Run a single combo (across all browsers)

```sh
pnpm playwright -g "unified-shiki-katex"
```

### Run a single browser

```sh
pnpm playwright --project chrome
```

### Re-generate projects without reinstalling

Useful when you change `pages/` content or `backends.ts`:

```sh
pnpm generate-projects   # rewrites tests/e2e/projects/
pnpm test:e2e:build      # rebuilds all SvelteKit static sites
pnpm playwright          # run tests
```

---

## Adding a new backend combination

1. Edit `backends.ts` — add the new value to the appropriate dimension array
   (`MARKDOWN_BACKENDS`, `CODE_BACKENDS`, or `MATH_BACKEND_KEYS`).
2. If the new backend needs special config options, extend `writeSveltexConfig()`
   in `generate.ts` (analogous to the existing `shiki`/`starry-night` branches).
3. Add the new backend package to `_template/package.json` if it is a new dependency.
4. Re-run the full prepare step to install, generate, and build.
5. Update golden snapshots: `pnpm test:e2e:golden`.

## Adding a new test page

1. Drop a `.md` file anywhere under `pages/` (subdirectory = route segment).
2. Use `@@@` as a placeholder for the current combo ID if you need it in page content.
3. If the page only makes sense for a subset of backends (like commutative diagrams
   for MathJax), add a filter to `pageIncludedForCombo()` in `backends.ts`.
4. Re-run `pnpm generate-projects && pnpm test:e2e:build`.
5. Update golden snapshots: `pnpm test:e2e:golden`.

## Adding a new browser

Add an entry to the `projects` array in `playwright.config.ts`. No other changes are
needed.

---

## How isolation works

- Each generated project has its own `sveltex.config.js` that registers **exactly one**
  sveltex preprocessor, recognising **exactly one** file extension unique to that combo.
- Each project runs its own `vite preview` process on a **unique port** (`3100 + index`).
- There is **no shared Vite/SvelteKit instance** between combos — a crash or hang in one
  project cannot affect any other.
- `node_modules` is shared (via a symlink to `_template/node_modules`) to avoid
  redundant disk usage, but each project has its own `.svelte-kit/` build cache.

## CI considerations

- Set `E2E_BUILD_CONCURRENCY` to control how many `vite build` processes run in
  parallel during `pnpm test:e2e:build` (defaults to the number of logical CPUs).
- Playwright's `--workers` flag (or the `workers` key in `playwright.config.ts`)
  controls test-run parallelism.  The config defaults to `8` in CI and `50%` of CPUs
  locally.
- Preview servers are always freshly started in CI (`reuseExistingServer: false`).
  Locally, existing servers are reused for faster iteration.