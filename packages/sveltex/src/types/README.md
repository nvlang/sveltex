<!--
Directory description: Contains type definitions used throughout SvelTeX.
-->

# `src/types`

The `src/types` directory contains type definitions used throughout SvelTeX.

More importantly, it doesn't contain anything other than type definitions. In
particular, it doesn't contain type guards, either — those can be found in
`src/typeGuards`.

| Location | Description |
|:---|:---|
| [`handlers/`](handlers/) | Types for each handler (`CodeHandler`, `MathHandler`, …): backend identifiers, resolved configuration shapes, processor/process function types. |
| [`utils/`](utils/) | Type definitions for the various utility modules (CDN handling, escape regions, frontmatter parsing, …). |
| [`Sveltex.ts`](Sveltex.ts) | Re-declares the Svelte compiler's `Processed` type so it's not pulled in transitively. |
| [`SveltexConfiguration.ts`](SveltexConfiguration.ts) | Type definitions for the `SveltexConfiguration` interface (the second argument to the `sveltex()` factory) and its backend-choices counterpart. |
