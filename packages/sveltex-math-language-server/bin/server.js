#!/usr/bin/env node
// Executable entry point for the SvelTeX math language server.
//
// This file is intentionally tiny and dependency-free: editors and host
// servers (notably `@nvl/sveltex-language-server`, which spawns one of these
// per math backend) launch it directly. All real work lives in the compiled
// core under `../dist`.

import { startServer } from '../dist/index.js';

startServer();
