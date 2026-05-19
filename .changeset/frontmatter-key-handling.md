---
'@nvl/sveltex': minor
---

Fix invalid JavaScript emitted for frontmatter keys that aren't valid
JavaScript identifiers. The W3C metadata names SvelTeX accepts at the top
level (`color-scheme`, `theme-color`, `content-security-policy`, …) all
contain hyphens, and used to produce `const color-scheme = "…";` and
unquoted `color-scheme:` object keys — both syntax errors that broke any
page that used them.

The `metadata` export now quotes non-identifier object keys
(`"color-scheme": "…"`); the per-key `<script>` variables are derived from
the key via camelCasing (`color-scheme` → `colorScheme`, `my key` →
`myKey`). Keys that still can't form a valid identifier (`123abc`, `---`,
…), as well as keys whose camelCase form is a JavaScript reserved word
(`class`, `default`, `if`, …), are dropped from the variables step; they
remain accessible through the `metadata` export under their original
name.

The derivation helper is exported as `keyToIdentifier`.
