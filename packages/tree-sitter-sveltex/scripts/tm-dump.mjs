#!/usr/bin/env node
/**
 * Per-token TextMate scope dump for a single `.sveltex` source file. Loads
 * the SvelTeX TM grammar (with zero-pattern stubs for every external scope
 * it `include`s — `source.yaml`, `text.tex.latex`, `source.svelte`, etc.)
 * and prints one line per token: `offset "text" scope1 / scope2 / …`.
 *
 * Useful when the parity bench reports a divergence and you need to see
 * which TM rule actually fired (or failed to fire) at the divergent bytes
 * — e.g. for diagnosing whether a verbatim block's `end:` pattern is
 * matching the closing tag.
 *
 * Run:    node scripts/tm-dump.mjs path/to/fixture.sveltex
 */
import jsYaml from 'js-yaml';
import vsctm from 'vscode-textmate';
import oniguruma from 'vscode-oniguruma';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..');

await oniguruma.loadWASM(
  readFileSync(resolve(PACKAGE_ROOT, 'node_modules/vscode-oniguruma/release/onig.wasm')).buffer,
);
const sveltexYaml = readFileSync(
  resolve(REPO_ROOT, 'packages/vscode-sveltex/syntaxes/sveltex.tmLanguage.yaml'),
  'utf-8',
);
const mdYaml = readFileSync(
  resolve(REPO_ROOT, 'packages/vscode-sveltex/syntaxes/markdown.tmLanguage.yaml'),
  'utf-8',
);
const stubs = [
  'source.yaml', 'source.toml', 'source.json', 'source.svelte',
  'source.js', 'source.ts', 'source.css', 'source.css.scss',
  'source.sass', 'source.css.postcss', 'source.stylus',
  'text.tex.latex', 'text.html.basic', 'text.html.derivative',
];

const registry = new vsctm.Registry({
  onigLib: Promise.resolve({
    createOnigScanner: (s) => new oniguruma.OnigScanner(s),
    createOnigString: (s) => new oniguruma.OnigString(s),
  }),
  loadGrammar: async (s) => {
    if (s === 'source.sveltex') return vsctm.parseRawGrammar(JSON.stringify(jsYaml.load(sveltexYaml)), 'sveltex.json');
    if (s === 'text.markdown') return vsctm.parseRawGrammar(JSON.stringify(jsYaml.load(mdYaml)), 'markdown.json');
    if (stubs.includes(s)) return vsctm.parseRawGrammar(JSON.stringify({ scopeName: s, patterns: [] }), s + '.stub.json');
    return null;
  },
});
const g = await registry.loadGrammar('source.sveltex');
const file = process.argv[2];
const src = readFileSync(file, 'utf-8');
let stack = vsctm.INITIAL, off = 0;
for (const line of src.split(/(?<=\n)/)) {
  // Feed the line WITHOUT its trailing newline — vscode-textmate's `$`/`while`
  // anchoring misfires when the `\n` is present (lists never terminate).
  const lineText = line.replace(/\r?\n$/, '');
  const { tokens, ruleStack } = g.tokenizeLine(lineText, stack);
  stack = ruleStack;
  for (const t of tokens) {
    const slice = JSON.stringify(lineText.slice(t.startIndex, t.endIndex)).padEnd(28);
    const scopes = t.scopes.slice(1).join(' / ') || '(none)';
    console.log(`${(off + t.startIndex).toString().padStart(3)} ${slice} ${scopes}`);
  }
  off += line.length;
}
