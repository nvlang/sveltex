<figure>

![Schematic overview of how Sveltex works](../../res/schematic-overview.svg)

<figcaption style="text-align: center; font-style: italic;">
Schematic overview of how Sveltex works and makes use of its "handlers".
</figcaption>
</figure>

# Handlers

The `src/handlers` directory contains the class definitions for the different
"handlers" to which Sveltex delegates the processing of the different types of
content in a `.sveltex` file. It also includes the class definition of the
`Handler` base class which _almost_ all handlers extend (the only exception
being `VerbatimHandler`).

## Overview

### `Handler`

Base class which all other handlers extend.

### `CodeHandler`

Handles code blocks and inline code snippets. This may involve:

-   Syntax highlighting
-   Escaping of special characters

### `MarkdownHandler`

Handles markdown content. It uses external dependencies (as specified by the
user), e.g. [Unified.js](https://unifiedjs.com), to parse markdown content and
convert it to HTML.

### `TexHandler`

Handles "basic" TeX content. It uses external dependencies (as specified by the
user), e.g. KaTeX or MathJax, to convert LaTeX content to HTML/etc.

### `AdvancedTexHandler`

Handles "advanced" TeX content. It uses the user's local TeX installation to
convert TeX content to SVG.

### `VerbatimHandler`

This class acts as an intermediary between `Sveltex` and the `CodeHandler` and
`AdvancedTexHandler` classes.

When Sveltex encounters fenced code blocks, it knows that it should delegate the
processing of the content to the `CodeHandler`. When it encounters content
enclosed in `$` delimiters, it knows that it should delegate the processing of
the content to the `TexHandler`. This is because these assignments rest on
well-established conventions and syntax.

However, Sveltex also supports "verbatim" environments. (We call them that
because usually the inner content will be escaped to allow some special
characters, like `{`, `}`, `<`, `>`, etc., to be used at will.) These
environments are delimited in the same way that a Svelte component or HTML tag
would be, i.e., `<Example>...</Example>`, and target two main use-cases:

-   "Advanced" TeX content: content that should be processed by the user's local
    TeX distribution to generate an SVG to then include in the final output as a
    Svelte component. This functionality is accessed and configured through the
    `advancedTex` property of the Sveltex configuration.
-   Code: content that should be rendered into a code block or inline code
    snippet in the final output, but which may benefit from the added
    customazibility that markdown's intentionally minimalistic syntax lacks.
    This may be useful if you'd like to be able to use custom components to
    render code blocks, or to pass a multitude of arguments to configure code
    blocks ad hoc, etc. This functionality is accessed and configured through
    the `general.verbatimEnvironments` property of the Sveltex configuration.

To detect these environments, Sveltex checks what tag names were configured for
advanced TeX content and which were configured for code, and matches and escapes
all content it finds within such tags. It then forwards all this to the
`VerbatimHandler` class, which then decides whether to forward the content to
the `AdvancedTexHandler` or the `CodeHandler`.

## Class diagram

![Class diagram of src/handlers directory, generated by classdiagram-ts VSCode extension.](../../res/handlers_diagram.png)