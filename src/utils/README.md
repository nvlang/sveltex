# `src/utils`

The `src/utils` directory contains utility functions and classes that are used
internally throughout Sveltex.

A brief overview of each file in this directory and its main function: e

-   `ast.ts`: Walk Svelte ASTs (Abstract Syntax Trees, as returned by Svelte's
    parser).
-   `cli.ts`: Spawn Node.js child processes.
-   `css.ts`: Escape CSS color variables in TeX contnt for compilation,
    and unescape them in the rendered SVG afterwards.
-   `debug.ts`: Log messages to console.
-   `diagnosers.ts`: Verify validity of certain objects, and log helpful error
    messages if they are not valid.
-   `dvisvgm.ts`: Set command line arguments for `dvisvgm`.
-   `escape.ts`: Escape and unescape content in a Sveltex file.
-   `frontmatter.ts`: (TODO) Parse frontmatter from a Sveltex file.
-   `fs.ts`: File system operations (re-exported from `node:fs` and
    `node:fs/promises` for easier mocking in test files).
-   `globals.ts`: Global variables.
-   `html.ts`: Utilities related to HTML syntax.
-   `merge.ts`: Deeply merge objects.
-   `misc.ts`: Miscellaneous utility functions, including:
    -   `interpretAttributes`: Transform something like
        `{ a: 'null', b: 'true' }` into `{ a: null, b: true }`.
    -   `re`: Write more readable and maintainable regular expressions.
    -   `sha256`: Compute the SHA-256 hash of a string.
    -   `splitContent`: Split content of a Svelte(x) file according to whether
        its surrounded by a `<script>` tag, a `<style>` tag, or neither.
-   `parseComponent.ts`: Parse a generic HTML component into its tag name,
    attributes, and inner content.
-   `TexComponent.ts`: Intermediary class with `compile` method used by
    `TexHandler` to render TeX content. Because of the nature
    of how and when preprocessors run, any instance of this class is compiled at
    most once (if we consider cache hits "compilations", or if caching is turned
    off, then exactly once) (when content changes, it is re-instantiated; if
    content didn't change, it may be instantiated but the `compile` method will
    get a cache hit).
