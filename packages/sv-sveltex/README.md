# `@nvl/sveltex-sv`

A community [`sv`](https://svelte.dev/docs/cli/overview) add-on for
[SvelTeX](https://sveltex.dev) (Svelte + Markdown + LaTeX).

It adds SvelTeX to an **existing SvelteKit project**: it installs
[`@nvl/sveltex`](https://www.npmjs.com/package/@nvl/sveltex) and the peer
dependencies for the backends you pick, creates a `sveltex.config.{js,ts}`, and
wires the SvelTeX preprocessor and the `.sveltex` extension into your
`svelte.config.{js,ts}`.

> [!IMPORTANT]
> Svelte maintainers have not reviewed community add-ons for malicious code. Use
> at your discretion.

> [!NOTE]
> To create a **new** project, run `npx sv create` instead. To add SvelTeX to an
> existing project, use this add-on.

## Usage

In an existing SvelteKit project, run:

```shell
npx sv add @nvl/sveltex-sv
```

...and follow the prompts.

## Options

All options can be set non-interactively via the `sv` CLI:

```shell
npx sv add @nvl/sveltex-sv="markdownBackend:unified+codeBackend:shiki+mathBackend:mathjax+demoRoute:yes"
```

### `markdownBackend`

The Markdown backend (parser). One of `unified` (default), `markdown-it`,
`micromark`, `marked`, or `none`.

### `codeBackend`

The code backend (syntax highlighter). One of `shiki` (default),
`starry-night`, `highlight.js`, `escape`, or `none`.

### `mathBackend`

The math backend. One of `mathjax` (default), `katex`, or `none`.

### `demoRoute`

Whether to add a sample `+page.sveltex` route at `/sveltex-demo`. `yes`
(default) or `no`.

## What it does

- Adds `@nvl/sveltex` and the chosen backends' peer dependencies as
  `devDependencies`.
- Creates `sveltex.config.{js,ts}` with the SvelTeX factory.
- Adds the SvelTeX preprocessor and the `.sveltex` extension to
  `svelte.config.{js,ts}`.
- Optionally creates a sample `src/routes/sveltex-demo/+page.sveltex` route.

## License

[MIT](./LICENSE)
