# `create-sveltex`

`create-sveltex` is a Node.js package intended to be run with `pnpm dlx`,
`bunx`, `npx`, or `yarn dlx` to create a new SvelTeX project. It should not be
used to add SvelTeX to an existing project.

## Creating a project

```bash
pnpm dlx create-sveltex # If using PNPM
bunx create-sveltex     # If using Bun
npx create-sveltex      # If using NPM
yarn dlx create-sveltex # If using Yarn
```

...and follow the prompts.

## Supported tools

Always:
-   [TypeScript](https://www.typescriptlang.org/), for type-checking.

Choice:
-   Preferred package manager: [PNPM](https://pnpm.io/), [Bun](https://bun.sh/), [NPM](https://www.npmjs.com/), or [Yarn](https://yarnpkg.com/).

Optional:
-   [Prettier](https://prettier.io/), for code formatting.
-   [ESLint](https://eslint.org/), for linting.
-   [Playwright](https://playwright.dev/), for end-to-end testing.
-   [Vitest](https://vitest.dev/), for unit testing.
-   [TailwindCSS](https://tailwindcss.com/), for utility-first CSS.
-   [Husky](https://typicode.github.io/husky/), for Git hooks.
-   [Commitlint](https://commitlint.js.org/), for commit message linting.
-   `.vscode` folder with some helpful workspace settings.

## Acknowledgments

`create-sveltex` is inspired by
[`create-svelte`](https://www.npmjs.com/package/create-svelte), from which it
borrows some code for the template files.

`create-sveltex` is powered by [Plop](https://plopjs.com/), a great tool for
code generation which uses
[Inquirer.js](https://github.com/SBoudrias/Inquirer.js) for propmts and
[Handlebars](https://github.com/handlebars-lang/handlebars.js) for templating.
