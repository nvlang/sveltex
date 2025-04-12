# `create-sveltex`

`create-sveltex` is a Node.js package intended to be run with `pnpm dlx`,
`bunx`, `npx`, or `yarn dlx` to create a new SvelTeX project. It should not be
used to add [SvelTeX] to an existing project.

## Creating a project

```bash
pnpm dlx create-sveltex # If using PNPM
bunx     create-sveltex # If using Bun
npx      create-sveltex # If using NPM
yarn dlx create-sveltex # If using Yarn
```

...and follow the prompts.

## Supported tools

Always included:
-   [TypeScript], for type-checking.

Pick one:
-   Preferred package manager: [PNPM], [Bun], [NPM], or [Yarn].

Optional:
-   [Prettier], for code formatting.
-   [ESLint], for linting.
-   [Playwright], for end-to-end testing.
-   [Vitest], for unit testing.
-   [TailwindCSS], for utility-first CSS.
-   [Husky], for Git hooks. Includes [`lint-staged`] pre-commit git hook.
-   [Commitlint], for commit message linting. Adds a commit-msg git hook if
    Husky is also selected.
-   `.vscode` folder with some helpful workspace settings.

## Acknowledgments

`create-sveltex` is inspired by [`create-svelte`], from which it borrows some
code for the template files.

`create-sveltex` is powered by [Plop], a great tool for code generation which
uses [Inquirer.js] for prompts and [Handlebars] for templating.

[SvelTeX]: https://www.npmjs.com/package/@nvl/sveltex
[TypeScript]: https://www.typescriptlang.org/
[PNPM]: https://pnpm.io/
[Bun]: https://bun.sh/
[NPM]: https://www.npmjs.com/
[Yarn]: https://yarnpkg.com/
[Prettier]: https://prettier.io/
[ESLint]: https://eslint.org/
[Playwright]: https://playwright.dev/
[Vitest]: https://vitest.dev/
[TailwindCSS]: https://tailwindcss.com/
[Husky]: https://typicode.github.io/husky/
[`lint-staged`]: https://github.com/lint-staged/lint-staged
[Commitlint]: https://commitlint.js.org/
[`create-svelte`]: https://www.npmjs.com/package/create-svelte
[Plop]: https://plopjs.com/
[Inquirer.js]: https://github.com/SBoudrias/Inquirer.js
[Handlebars]: https://github.com/handlebars-lang/handlebars.js
