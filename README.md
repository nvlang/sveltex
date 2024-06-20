# SvelTeX

[![JSR](https://jsr.io/badges/@nvl/sveltex?style=flat-square&labelColor=1A3644)](https://jsr.io/@nvl/sveltex)
[![NPM Version](https://img.shields.io/npm/v/@nvl/sveltex?style=flat-square&logo=npm&logoColor=white&label=&labelColor=BD453B&color=BD453B)](https://npmjs.com/@nvl/sveltex)
[![GitHub Tag](https://img.shields.io/github/v/tag/nvlang/sveltex?style=flat-square&logo=GitHub&logoColor=aaa&label=&labelColor=333&color=333)](https://github.com/nvlang/sveltex)
[![Codecov](https://img.shields.io/codecov/c/github/nvlang/sveltex?style=flat-square&logo=codecov&label=&logoColor=aaa&labelColor=333&color=333)]()

## Installation

```sh
pnpm add -D @nvl/sveltex # If using PNPM
bun  add -D @nvl/sveltex # If using Bun
npm  add -D @nvl/sveltex # If using NPM
yarn add -D @nvl/sveltex # If using Yarn
```

## Documentation

### Quickstart

```js
// svelte.config.js
import { sveltex } from '@nvl/sveltex';
```

## How it works

![Schematic overview of how Sveltex works](res/schematic-overview.svg)

## Roadmap

In alphabetical order:

- [ ] VSCode extension for proper syntax highlighting of `.sveltex` files.
- [ ] Yeoman generator for scaffolding new Sveltex projects.

## Contributing

Contributions are very welcome. In lieu of proper contribution guidelines,
please discuss your ideas with the maintainers before starting work on a PR,
especially if the changes are substantial.

## Acknowledgements

- The TSDoc comments for many of this project's interfaces, particularly those describing options to
 be passed to external libraries, may be copies, paraphrasings, or adaptations
  of the official documentations of the respective libraries. Some notable examples:
  - MathJax
  - TikZ


## Lessons learned

### Tips

- Always run your linter before you run your tests. In particular, note that
  VSCode's ESLint extension only runs on files that are currently open, so even
  if the problems pane is clear, you might still have linting errors in files
  that are not currently open.
- Generally speaking, don't combine `.ts` and `.d.ts` files. In short, it's
  either `.ts` or it's `.js` + (optionally) `.d.ts`. This is almost certainly an
  egregious oversimplification, but it's the feeling I got after spending a
  bunch of time trying to debug issues caused by me mixing `.ts` and `.d.ts` files.

### Cool software I didn't know before

- `fast-check`, for fuzzy testing.
- `shiki`, for code highlighting.
- VitePress.
