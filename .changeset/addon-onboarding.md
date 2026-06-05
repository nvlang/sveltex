---
'@nvl/sv-sveltex': minor
---

Smoother onboarding and a less surprising default config:

- Pre-approve `core-js-pure`'s build script in `pnpm-workspace.yaml` for pnpm
  projects, so `pnpm install` no longer fails with `ERR_PNPM_IGNORED_BUILDS`
  (nor leaves a `set this to true or false` placeholder).
- Ship the `<TeX>` verbatim block commented out by default — it needs a local
  TeX distribution, so it's now opt-in instead of a silent system-tool
  dependency.
- Add next-steps guidance for enabling `<TeX>` and for getting `.sveltex`
  editor support (via the SvelTeX extension / language server, rather than
  Prettier or ESLint, which can't parse a `.sveltex` file's non-Svelte
  regions).
