---
'create-sveltex': minor
---

Deprecate `create-sveltex` in favour of the new `@nvl/sv-sveltex` community add-on
for the Svelte CLI (`sv`). The `create-sveltex` binary no longer scaffolds
a project; it now prints a notice pointing to `npx sv add @nvl/sv-sveltex` (for
existing projects) and `npx sv create` (for new projects). The
`plop`/`inquirer`/`minimist` dependencies and the `template/` tree have
been removed.
