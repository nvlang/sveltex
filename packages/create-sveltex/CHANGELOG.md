# Change Log

## 0.3.0

### Minor Changes

- [`975a770`](https://github.com/nvlang/sveltex/commit/975a770780ef38707b33d0524766a2c41f0b75e4)
  Thanks [@nvlang](https://github.com/nvlang)! - Deprecate `create-sveltex` in
  favour of the new `@nvl/sv-sveltex` community add-on for the Svelte CLI
  (`sv`). The `create-sveltex` binary no longer scaffolds a project; it now
  prints a notice pointing to `npx sv add @nvl/sv-sveltex` (for existing
  projects) and `npx sv create` (for new projects). The
  `plop`/`inquirer`/`minimist` dependencies and the `template/` tree have been
  removed.

## 0.1.4

### Patch Changes

- [`e838e5c`](https://github.com/nvlang/sveltex/commit/e838e5c8055cd8f9ea6a309bbb14176bd117621e)
  Thanks [@nvlang](https://github.com/nvlang)! - Make Svelte 5 mandatory, since
  it's not in beta anymore.

## [0.1.0] - 2024-07-10

Initial release.

## [0.1.1] - 2024-07-10

### Fixes

- Moved `plop` and `picocolors` from `devDependencies` to `dependencies`.
- Removed `esbuild` from `devDependencies`.

### Documentation

- Added `CHANGELOG.md`.

## [0.1.2] - 2024-09-01

### Fixes

- Fixed issue #9 by hard-coding `inquirer` version in `package.json` as a
  workaround for https://github.com/plopjs/plop/issues/445.

## [0.1.3] - 2024-09-01

### Fixes

- Try to further hard-code `inquirer` version in `package.json` (this time by
  falsely listing it as a direct dependency, instead of a peer dependency),
  again as a workaround for https://github.com/plopjs/plop/issues/445, given
  that the previous attempt didn't fix the behavior for `pnpm dlx` or `bunx`.
