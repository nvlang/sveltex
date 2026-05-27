#!/usr/bin/env node

// SVELTEX FORK: regenerate both sub-grammars (block + inline) with the
// monorepo's tree-sitter CLI. Upstream passed `--no-bindings`, which
// tree-sitter-cli 0.26+ removed; each sub-grammar ships its own
// `tree-sitter.json`, so `generate` does not scaffold bindings anyway.

const { execSync } = require("child_process");
const { join } = require("path");

for (const dir of ["tree-sitter-markdown", "tree-sitter-markdown-inline"]) {
  console.log(`building ${dir}`);
  execSync("tree-sitter generate", {
    stdio: "inherit",
    cwd: join(__dirname, "..", dir)
  });
}
