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

![screenshot](https://raw.githubusercontent.com/nvlang/sveltex/main/packages/vscode-sveltex/res/screenshot-ayu-dark-bordered.png)

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

⚠ **Note:** You might need to reload the window for the changes to take effect.

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

### 1.0.1

#### Documentation

-   Improved `README.md` for rendering on the VS Code Marketplace.

### 1.0.2

#### Fixes

-   Increased specificity of scopes of some pattern injections to avoid
    conflicts with e.g. the comment or string scopes within script blocks.

#### Dev Dependencies

-   Updated `@types/node`: `^20.14.9` → `^20.14.10`.


### 1.0.3

#### Documentation

-   Fixed link to screenshot in `README.md`.

#### Build

-   Reduce extension size by not bundling unnecessary files.


[SvelTeX]: https://sveltex.dev/
