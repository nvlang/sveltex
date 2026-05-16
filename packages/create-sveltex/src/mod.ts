#!/usr/bin/env node

/**
 * `create-sveltex` is **deprecated**.
 *
 * SvelTeX is now distributed as a community add-on for the official Svelte CLI
 * (`sv`). This binary no longer scaffolds a project; it only prints a notice
 * pointing users to the supported workflows.
 */

import pc from 'picocolors';

const lines = [
    '',
    pc.bgYellow(pc.black(' create-sveltex is deprecated ')),
    '',
    'SvelTeX is now a community add-on for the official Svelte CLI (sv).',
    '',
    pc.bold('To add SvelTeX to an existing SvelteKit project:'),
    '  ' + pc.cyan('npx sv add @nvl/sveltex-sv'),
    '',
    pc.bold('To create a new SvelteKit project from scratch:'),
    '  ' + pc.cyan('npx sv create'),
    '  (then run ' + pc.cyan('npx sv add @nvl/sveltex-sv') + ' inside it)',
    '',
    'See ' + pc.underline('https://sveltex.dev') + ' for documentation.',
    '',
];

console.log(lines.join('\n'));

// Exit non-zero so that scripted/CI usage of `create-sveltex` surfaces the
// deprecation instead of silently succeeding with nothing scaffolded.
process.exit(1);
