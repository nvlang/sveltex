# `create-sveltex` (deprecated)

> [!WARNING]
> **`create-sveltex` is deprecated.** SvelTeX is now distributed as a community
> add-on for the official [Svelte CLI](https://svelte.dev/docs/cli/overview)
> (`sv`). This package no longer scaffolds a project; running it only prints a
> notice pointing to the supported workflows below.

## What to use instead

### Add SvelTeX to an existing SvelteKit project

```bash
npx sv add @nvl/sveltex-sv
```

This applies the [`@nvl/sveltex-sv`](https://www.npmjs.com/package/@nvl/sveltex-sv)
community add-on: it installs [SvelTeX] and the backends you pick, creates a
`sveltex.config.{js,ts}`, and wires the preprocessor into your
`svelte.config.{js,ts}`.

### Create a new SvelteKit project

```bash
npx sv create
```

...then run `npx sv add @nvl/sveltex-sv` inside the new project.

## Why the change?

The Svelte CLI now [supports community
add-ons](https://github.com/sveltejs/cli/issues/184). Rather than maintaining a
separate project scaffolder (which duplicated tooling already provided by `sv
add`, such as TailwindCSS, ESLint, Prettier, and adapters), SvelTeX integration
is now a focused `sv` add-on. See [issue
#12](https://github.com/nvlang/sveltex/issues/12).

[SvelTeX]: https://www.npmjs.com/package/@nvl/sveltex
