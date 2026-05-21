# Working notes for Claude sessions on this repo

## Commit messages

Subject lines are usually fine — they're already in conventional-commit form
and rarely need work.

Bodies should be **focused git-log entries**, not in-chat answers:

- **5–15 body lines is the right size**, occasionally up to 20 for genuinely
  complex commits (e.g. multi-aspect migrations).
- Plain prose in 1–3 short paragraphs, wrapped at ~72 chars.
- Say what changed and why a reader of `git log` cares.

**Do not** include:

- Markdown H2 headings (`## Verification`, `## Setup`, `## Adopted`, etc.)
- First-person preambles (`you asked`, `I missed`, `Apologies for the noise`,
  `the honest answer`).
- Detailed setup walkthroughs — those belong in `docs/` or a PR description.
- Verification log sections (`all 8226 tests pass; tsc clean`) unless the
  commit's whole point is the test/verification.
- Old-vs-new comparison tables, file-listing tables (`git diff --stat`
  already does that), section banners.
- Multi-paragraph rationale where one sentence would do.

Every commit gets the trailer:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

…unless the commit was authored by the user without Claude's involvement.

## Destructive git ops

- **Force-push is never implicitly authorized by an earlier force-push.**
  Confirm each one separately, especially when scope expands (e.g. adding a
  new commit that changes code, not just messages).
- Before a force-push to `main`, create a `backup/main-pre-<reason>` ref on
  the remote so the prior state is recoverable.
- `git filter-branch` strips GPG/SSH signatures unless paired with a
  `--commit-filter` that re-signs:
  ```bash
  git filter-branch -f --commit-filter '
    git commit-tree -S "$@"
  ' <range>
  ```
  Plain `cherry-pick + git commit --amend` honors `commit.gpgsign` and
  preserves signing. `filter-branch` does not.

## Process

- Work without stopping for clarifying questions unless the call is genuinely
  ambiguous; make the reasonable choice and continue.
- For destructive or large-scope operations, use `AskUserQuestion` to confirm
  scope rather than asking unstructured.
- `rm` is aliased to `nocorrect rm -i`; use `command rm -f` for unattended
  removal.
- Don't bypass git hooks (`--no-verify`, `HUSKY=0`) or signing
  (`--no-gpg-sign`) unless the user explicitly asks.

## Repo specifics

- Monorepo with pnpm workspaces; packages under `packages/*/`.
- Docs site (`docs/`) is a standalone pnpm root, not a workspace member.
- Renovate (peer-dep widening only) + Dependabot (everything else) — scoped
  to disjoint dep types to avoid duplicate PRs. (May consolidate to one tool
  later.)
- Release workflow uses a GitHub App (`sveltex-release`); secrets
  `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY`.
- Husky pre-commit runs lint + commit-msg runs commitlint.
