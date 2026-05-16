# tree-sitter-sveltex

A [tree-sitter] grammar for **SvelTeX** (`.sveltex`) documents.

A `.sveltex` file is a [Svelte](https://svelte.dev) component whose markup is
written in Markdown, with embedded LaTeX/math, fenced/inline code,
YAML/TOML/JSON frontmatter and SvelTeX "verbatim" environments. See the
[`@nvl/sveltex`](https://sveltex.dev) documentation for the language itself.

## Design

This grammar deliberately **does not reimplement Markdown, Svelte or LaTeX**.
It parses only the `.sveltex` *top-level* structure — the constructs a plain
Markdown grammar would mis-tokenise — and delegates every embedded language to
an existing grammar through [tree-sitter injections](queries/injections.scm):

| `.sveltex` construct                         | Grammar node                                  | Injected language |
| -------------------------------------------- | ---------------------------------------------- | ----------------- |
| YAML/TOML/JSON frontmatter                   | `frontmatter` / `frontmatter_content`          | `yaml`/`toml`/`json` |
| Markdown prose (everything not below)        | `markdown_chunk`                               | `markdown` (combined) |
| Inline/display math `$…$`, `$$…$$`, `\(…\)`, `\[…\]` | `inline_math` / `display_math`         | `latex`           |
| `<tex>` / `<latex>` / `<tikz>` environments  | `verbatim_environment` → `tex_verbatim_body`   | `latex`           |
| `<verb>` / `<verbatim>` environments         | `verbatim_environment` → `plain_verbatim_body` | *(none — opaque)* |

The `markdown` grammar that each `markdown_chunk` is delegated to in turn
injects `markdown_inline`, the fenced-code languages, and `html`/`svelte` — so
Svelte `<script>` blocks, `{#if}`/`{#each}`/… logic blocks and `{expr}`
mustache tags are handled downstream, exactly as in a plain `.svelte`/`.md`
setup.

The split into `frontmatter` / `markdown` / `math` / `verbatim` mirrors the
`RegionKind`s the SvelTeX language server computes in
`packages/sveltex-language-server/src/core/regions.ts`.

### External scanner

`src/scanner.c` resolves the constructs an LR grammar cannot express:

- paired `$` / `$$` math fences (the same token opens and closes them);
- the matching `</tag>` of a verbatim environment, whose body is arbitrary
  text spanning many lines;
- the `---` / `+++` fences and body of frontmatter;
- maximal opaque Markdown runs that stop right before the next
  `.sveltex`-special token.

Crucially, the Markdown-chunk scanner **skips over fenced code blocks, inline
code spans, `<script>`/`<style>` blocks and `{ … }` mustache tags**, so a `$`
inside any of those (e.g. a `$state` rune, or `import x from '$lib/…'`) is
*not* mistaken for a math delimiter — matching SvelTeX's own escaper.

The scanner keeps no state between tokens, which makes it correct under
tree-sitter's speculative parsing.

## Layout

```
grammar.js              the grammar definition
src/scanner.c           the external scanner
src/parser.c            the generated parser (committed; run `tree-sitter
                        generate` to regenerate)
queries/highlights.scm  syntax highlighting for the structural delimiters
queries/injections.scm  delegation to the embedded-language grammars
queries/folds.scm       foldable regions
test/corpus/            tree-sitter test corpus
```

## Development

```sh
npm install            # installs tree-sitter-cli
npx tree-sitter generate
npx tree-sitter test
npx tree-sitter parse path/to/file.sveltex
```

## License

MIT
