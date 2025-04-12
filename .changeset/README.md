## Changesets

### This Folder

> [!IMPORTANT]
> Files should only be added to this folder with the `changeset` command.

> [!INFO]
> This folder is supposed to contain changesets for all changes made to the
> codebase _since the last release_. When a release is made, the changeset bot
> will, before the release is published, do the following:
> 1.  remove all changesets from this folder,
> 2.  add info from changesets to the release notes and to the changelog, and
> 3.  bump the versions of the packages in accordance with the changesets.

Other contents of this folder:

-   [`config.json`](./config.json): Configuration for the changeset tool.
-   [`README.md`](./README.md): This file.

### Resources

- `changeset` docs: https://github.com/changesets/changesets
- `changeset` FAQ: https://github.com/changesets/changesets/blob/main/docs/common-questions.md
