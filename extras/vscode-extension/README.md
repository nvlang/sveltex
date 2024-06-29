# SvelTeX language support

This extension adds syntax highlighting intended for [SvelTeX] files. SvelTeX is a
preprocessor for Svelte that aims to combine markdown, Svelte, and (some) LaTeX.

## Features

-   Svelte + Markdown syntax highlighting (incl. fenced code blocks, though only with ~40 languages).
-   Syntax highlighting for math expressions in `$...$`, `$$...$$`, `\(...\)`, and
    `\[...\]` delimiters.
-   LaTeX syntax highlighting in "LaTeX tags" (configurable).
-   Turn off highlighting in "Escape tags" (configurable).
-   `<script>` languages: JavaScript, TypeScript
-   `<style>` languages: CSS, SCSS, SASS, PostCSS, Stylus

![screenshot](res/screenshot-ayu-dark-bordered.png)

## Requirements

This extension requires the `svelte.svelte-vscode` VS Code extension to be installed.
This is because the TextMate grammar for SvelTeX depends on Svelte's TextMate
grammar.

## Extension Settings

This extension contributes the following settings:

-   `sveltex.latexTags`: Tags to use for LaTeX components. In effect, this will
    just modify this extension's TextMate grammar so that the contents of these
    tags are highlighted as LaTeX.
-   `sveltex.escapeTags`: Tags to use for non-TeX verbatim components. In
    effect, this will just modify this extension's TextMate grammar so that the
    contents of these tags are highlighted the same way as a plaintext fenced
    code block would in markdown.

> [!NOTE]
> You might need to reload the window for the changes to take effect.

## Limitations

-   In LaTeX / math expressions, you may sometimes wish to have unbalanced
    brackets (e.g., `[0, 1)` for intervals). Because of this, bracket matching
    inside math scopes is turned off.

## Known Issues

-   For `<style>` tags, LESS is not supported.
-   For `<script>` tags, CoffeeScript is not supported. However, since SvelteKit
    doesn't support CoffeeScript, this is not a priority.

## Release Notes

### 1.0.0

Initial release.


[SvelTeX]: https://sveltex.dev/