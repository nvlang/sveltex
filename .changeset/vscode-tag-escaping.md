---
'vscode-sveltex': patch
---

Harden the runtime TextMate-grammar regeneration:

- **Regex-escape verbatim tag names** before splicing them into the generated
  grammar, and **anchor** the tag validator (`^…$`). Previously a tag
  containing a regex metacharacter (e.g. `a.b`) matched too broadly, and the
  unanchored validator let a malformed or hostile config inject regex syntax
  into the grammar.
- **Guard grammar regeneration** so a filesystem error (a read-only install, a
  missing template) can no longer throw out of `activate()` and take the
  language server and syntax highlighting down with it.

Also refreshes the Marketplace README, which still documented the removed
`sveltex.latexTags` / `sveltex.escapeTags` settings.
