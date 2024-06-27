# sveltex README

This is the README for your extension "sveltex". After writing up a brief description, we recommend including the following sections.

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.

For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

This extension requires the `svelte.svelte-vscode` VS Code extension to be installed.
This is because the TextMate grammar for SvelTeX depends on Svelte's TextMate
grammar.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Limitations

- In LaTeX / math expressions, you may sometimes wish to have unbalanced
  brackets (e.g., `[0, 1)` for intervals). Because of this, bracket matching
  inside math scopes is turned off.

## Known Issues

- For `<style>` tags, only CSS is supported thus far; no SCSS, SASS, LESS, etc.
- For `<script>` tags, only JavaScript is supported thus far; no TypeScript (though JS highlighting is very similar), CoffeeScript, etc.

## Release Notes

### 1.0.0

Initial release.
