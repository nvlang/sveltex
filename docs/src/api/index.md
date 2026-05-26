---
outline: [2, 3]
pageClass: api-doc api-index
---

<script setup>
import { data } from './index.data.js'
</script>

# API reference

{{ data.intro }}

## Interfaces

<table class="api-index">
<thead><tr><th>Interface</th><th>Description</th></tr></thead>
<tbody>
<tr v-for="row in data.interfaces" :key="row.name">
<td><a :href="row.link"><code>{{ row.name }}</code></a></td>
<td v-html="row.desc"></td>
</tr>
</tbody>
</table>

## Functions

<table class="api-index">
<thead><tr><th>Function</th><th>Description</th></tr></thead>
<tbody>
<tr v-for="row in data.functions" :key="row.name">
<td><a :href="row.link"><code>{{ row.name }}</code></a></td>
<td v-html="row.desc"></td>
</tr>
</tbody>
</table>

## Inspecting defaults programmatically

If you're building tooling around SvelTeX — a config wizard, a custom
preprocessor that extends SvelTeX, or anything that needs to know what the
implicit defaults actually are — you can ask for them directly:

```ts twoslash
import {
    getDefaultSveltexConfig,
    getDefaultCodeConfig,
    getDefaultMarkdownConfig,
    getDefaultMathConfig,
    getDefaultTexConfig,
    getDefaultVerbEnvConfig,
    getTexPresetDefaults,
    getDefaultCacheDirectory,
} from '@nvl/sveltex';

// The full default config for a `unified` / `shiki` / `katex` combo.
const defaults = getDefaultSveltexConfig('unified', 'shiki', 'katex');

// Just the math slice, with the `'hybrid'` CSS approach.
const mathDefaults = getDefaultMathConfig('mathjax', 'hybrid');

// The bundled `tikz` preset's defaults.
const tikz = getTexPresetDefaults('tikz');
```

Each helper returns a freshly-cloned object — mutating it has no effect on
subsequent calls.
