<!--
Directory description:
Contains utility functions and classes that are used internally throughout Sveltex.
-->

# `src/utils`

The `src/utils` directory contains utility functions and classes that are used
internally throughout Sveltex.

| Location | Description |
|:---|:---|
| [`diagnosers/`](diagnosers/) | Contains "diagnosers", which verify validity of certain objects, and log helpful error messages if they are not valid.  |
| [`micromark/`](micromark/) | Contains a `micromark` extension used by SvelTeX to make it skip HTML tags (but not their content) when parsing Markdown.  |
| [`ast.ts`](ast.ts) | Walk MDASTs. |
| [`cache.ts`](cache.ts) | Caching mechanism for `TexHandler`. |
| [`cdn.ts`](cdn.ts) | Get CDN URLs and fetch from them. |
| [`cli.ts`](cli.ts) | Spawn Node.js child processes. |
| [`css.ts`](css.ts) | Escape CSS color variables in TeX content for compilation, and unescape them in the rendered SVG afterwards. |
| [`debug.ts`](debug.ts) | Log messages to console. |
| [`dvisvgm.ts`](dvisvgm.ts) |  Set command-line flags for `dvisvgm`. |
| [`env.ts`](env.ts) | Read `package.json` and parse version numbers and the package manager being used. |
| [`escape.ts`](escape.ts) | Escape and unescape different kinds of content in a Sveltex file. |
| [`frontmatter.ts`](frontmatter.ts) |  Parse frontmatter from a Sveltex file. |
| [`fs.ts`](fs.ts) | File system operations (re-exported from `node:fs` and `node:fs/promises` for easier mocking in test files). |
| [`markdown.ts`](markdown.ts) | `remark` and `micromark` extensions to disable autolinks and indented code blocks. Also, `adjustHtmlSpacing` and `detectAndImportComponents` functions to adjust whitespace in markup and detect and import (some) components, respectively. |
| [`merge.ts`](merge.ts) | Custom deep merge function intended for merging user-provided configuration with default configuration. |
| [`misc.ts`](misc.ts) | Miscellaneous utility functions. |
| [`parseComponent.ts`](parseComponent.ts) | Parse a generic HTML component into its tag name, attributes, and inner content. |
| [`TexComponent.ts`](TexComponent.ts) | Intermediary class with `compile` method used by `TexHandler` to render TeX content. Because of the nature of how and when preprocessors run, any instance of this class is gets its `compile` method called exactly once. |
| [`transformers.ts`](transformers.ts) | Apply transformers to content. |
