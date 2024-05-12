// Node.js
export { default as nodeAssert } from 'node:assert';
export { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process';
export { createHash, type BinaryToTextEncoding } from 'node:crypto';
export { existsSync, readFileSync } from 'node:fs';
export { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
export { homedir } from 'node:os';
export { dirname, join, normalize, relative, resolve } from 'node:path';
export { inspect } from 'node:util';

export { default as CleanCSS, Output } from 'clean-css';
export { deepmergeCustom } from 'deepmerge-ts';
export { default as findCacheDirectory } from 'find-cache-dir';
export { Glob } from 'glob';
export { escape as escapeHtml } from 'html-escaper';
export { htmlTagNames } from 'html-tag-names';
export { default as MagicString, type SourceMap } from 'magic-string';
export { AbortError, default as nodeFetch } from 'node-fetch';
export { default as ora, type Ora } from 'ora';
export { default as pc } from 'picocolors';
export { type Colors } from 'picocolors/types.js';
export { default as prettyBytes } from 'pretty-bytes';
export { get as getKey, get as getProperty, set as setProperty } from 'radash';
export { default as rfdc } from 'rfdc'; // "Really Fast Deep Clone"
export { rimraf } from 'rimraf';
export { major as semverMajor } from 'semver';
export { default as sorcery } from 'sorcery';
export { VERSION, parse as svelteParse } from 'svelte/compiler';
export { type HTMLAttributes } from 'svelte/elements';
export { optimize as svgoOptimize, type Config as SvgoOptions } from 'svgo';
export { assert, is, type Equals, type Extends } from 'tsafe';
export { v4 as uuid } from 'uuid';
export { default as YAML } from 'yaml';
