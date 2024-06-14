# `src`


| Location | Description |
|:---|:---|
| [`config/`](config/) | Default configurations. |
| [`handlers/`](handlers/) | Handlers to which Sveltex delegates the rendering of the different kinds of content it encounters. |
| [`typeGuards/`](typeGuards/) | Type guards and similar verification functions. |
| [`types/`](types/) | Type definitions. |
| [`utils/`](utils/) | Utility functions. |
| [`deps.ts`](deps.ts) | Exports all (regular) dependencies used by SvelTeX. Inspired by [Deno](https://docs.deno.com/runtime/tutorials/manage_dependencies). |
| [`dev_deps.ts`](dev_deps.ts) | Exports _some_ dev dependencies used by SvelTeX. Inspired by [Deno](https://docs.deno.com/runtime/tutorials/manage_dependencies). _(Notable exception: `vitest` isn't exported here, because importing it from `dev_deps.ts` in the test files would cause problems with Vitest's mocking mechanisms.)_ |
| [`mod.ts`](mod.ts) | Entry point of the module. |
| [`Sveltex.ts`](Sveltex.ts) | Definition of the `Sveltex` class, which implements Svelte's `PreprocessorGroup` interface. |
