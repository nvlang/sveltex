<!--
Thanks for contributing! A few notes before you submit:

- Commit subjects follow Conventional Commits (https://conventionalcommits.org).
  commitlint runs in the commit-msg hook; non-conforming subjects will be
  rejected.
- Any user-visible change to a published package needs a changeset: run
  `pnpm changeset` from the repo root, pick the affected packages and the
  bump level, and commit the generated file under `.changeset/`.
- See CONTRIBUTING.md for the full process, and SECURITY.md if this PR
  touches anything security-sensitive.
-->

## Summary

<!-- One or two sentences on what this PR changes and why. -->

## Affected packages

- [ ] `@nvl/sveltex` (core preprocessor)
- [ ] `@nvl/sveltex-language-server`
- [ ] `@nvl/sveltex-math-language-server`
- [ ] `@nvl/tree-sitter-sveltex`
- [ ] `@nvl/sv-sveltex` (Svelte CLI add-on)
- [ ] VS Code extension
- [ ] Zed extension
- [ ] Docs site (`docs/`)
- [ ] Monorepo tooling / CI

## Related issues

<!--
Link related issues, e.g. "Closes #123" or "Refs #456". A PR without a
tracking issue is fine for small fixes.
-->

## Checklist

- [ ] Tests cover the new code paths and edge cases (or: the change is not testable — explain below).
- [ ] `pnpm lint` and `pnpm test` pass locally.
- [ ] A changeset has been added (or: this PR has no user-visible change — e.g. docs, CI, internal refactor).
- [ ] Documentation, TSDoc, and inline comments have been updated where relevant.

## Notes for reviewers

<!-- Trade-offs, deliberate omissions, follow-ups, screenshots — anything that would help review. -->
