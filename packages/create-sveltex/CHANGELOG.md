# Change Log

## [0.1.0] - 2024-07-10

Initial release.

## [0.1.1] - 2024-07-10

### Fixes

-   Moved `plop` and `picocolors` from `devDependencies` to `dependencies`.
-   Removed `esbuild` from `devDependencies`.

### Documentation

-   Added `CHANGELOG.md`.

## [0.1.2] - 2024-09-01

### Fixes

-   Fixed issue #9 by hard-coding `inquirer` version in `package.json` as a
    workaround for https://github.com/plopjs/plop/issues/445.

## [0.1.3] - 2024-09-01

### Fixes

-   Try to further hard-code `inquirer` version in `package.json` (this time by
    falsely listing it as a direct dependency, instead of a peer dependency),
    again as a workaround for https://github.com/plopjs/plop/issues/445, given
    that the previous attempt didn't fix the behavior for `pnpm dlx` or `bunx`.
