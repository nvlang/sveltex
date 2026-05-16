#!/usr/bin/env node
// Executable entry point for the SvelTeX language server.
//
// This file is intentionally tiny and dependency-free: editors (VS Code via
// `vscode-languageclient`, the future Zed extension over stdio, ...) launch it
// directly. All real work lives in the compiled core under `../dist`.

import { startServer } from '../dist/index.js';

startServer();
