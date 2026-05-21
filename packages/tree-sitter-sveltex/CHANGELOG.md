# @nvl/tree-sitter-sveltex

## 0.2.0

### Minor Changes

- [`716a0a2`](https://github.com/nvlang/sveltex/commit/716a0a2bf61ad3e8b9afaa1daa13b19dc18e065b)
  Thanks [@nvlang](https://github.com/nvlang)! - Initial release of
  `@nvl/tree-sitter-sveltex`.

    A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for
    `.sveltex` documents. The grammar parses the top-level structure (YAML /
    TOML / JSON frontmatter, Markdown prose, inline / display math, `<tex>` /
    `<latex>` / `<tikz>` and `<verb>` / `<verbatim>` environments) and delegates
    every embedded language to an existing grammar via
    [tree-sitter injections](https://tree-sitter.github.io/tree-sitter/3-syntax-highlighting.html#language-injection):
    Markdown to `tree-sitter-markdown`, math and `tex`-type verbatim bodies to
    `tree-sitter-latex`, frontmatter to the appropriate data-format grammar.

    The split into `frontmatter` / `markdown` / `math` / `verbatim` mirrors the
    `RegionKind`s the SvelTeX language server computes. The grammar is used by
    the bundled Zed extension and any other editor whose highlighting pipeline
    accepts tree-sitter grammars.
