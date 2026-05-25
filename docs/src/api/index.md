---
outline: [2, 3]
pageClass: api-doc
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
