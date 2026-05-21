// File description: Locates the user's `svelte.config.*` — which always wires
// SvelTeX in as a preprocessor — and distills the SvelTeX configuration it
// carries into a `SveltexConfigSnapshot`: the minimal slice of configuration
// that the region detector ({@link computeRegions}) needs.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Readable } from 'node:stream';
import { getDefaultMathConfig } from '@nvl/sveltex';
// `DirectiveEscapeSettings` is not part of `@nvl/sveltex`'s public `mod.ts`
// surface, so it is imported from the package's emitted type declarations.
// TODO: re-export this type from `@nvl/sveltex` and import it from the root.
import type { DirectiveEscapeSettings } from '@nvl/sveltex/dist/types/utils/Escape.js';

/**
 * The math-delimiter settings shape consumed by SvelTeX's region detectors.
 *
 * This mirrors `WithFullDelims['delims']` from `@nvl/sveltex` but is restated
 * here so that the LSP does not depend on a deep `dist/` type path. The detector
 * functions only ever _read_ these fields.
 */
export interface MathDelimsSnapshot {
    dollars: boolean;
    inline: {
        singleDollar: boolean;
        escapedParentheses: boolean;
    };
    display: {
        escapedSquareBrackets: boolean;
    };
    doubleDollarSignsDisplay: 'always' | 'newline' | 'fenced';
}

/**
 * The math backend a SvelTeX project renders its math with.
 *
 * Mirrors `@nvl/sveltex`'s `MathBackend`. Only `mathjax` and `katex` have a
 * corresponding math language server; `custom` and `none` mean no math
 * assistance is offered.
 */
export type MathBackend = 'mathjax' | 'katex' | 'custom' | 'none';

/**
 * The `\documentclass` line and preamble that SvelTeX wraps a TeX verbatim
 * environment's content in when it compiles it to a `.tex` file.
 *
 * The LSP mirrors this when building the virtual document it forwards to
 * TexLab, so completion / hover see the project's _actual_ packages and
 * preamble macros (`\usepackage{…}`, `\newcommand{…}`, …) rather than a
 * generic guess.
 */
export interface TexScaffold {
    /** The full `\documentclass[…]{…}` line. */
    documentClass: string;
    /** Everything between `\documentclass` and `\begin{document}`. */
    preamble: string;
}

/**
 * The minimal, immutable view of a resolved `svelte.config.*` that the LSP
 * core needs in order to split a document into {@link Region}s and route
 * region-specific language requests.
 */
export interface SveltexConfigSnapshot {
    /**
     * Names of configured verbatim environments (`tex`, `verbatim`, ...). Used
     * both to detect verbatim regions and to tell SvelTeX's Markdown parser
     * which elements to treat as opaque.
     */
    verbatimTags: string[];
    /**
     * The subset of {@link verbatimTags} that denote LaTeX / TeX environments
     * (a verbatim entry whose `type` is `'tex'`, plus its aliases). Requests
     * inside one of these are forwarded to TexLab when it is available.
     */
    latexTags: string[];
    /** File extensions handled by SvelTeX (e.g. `['.sveltex']`). */
    extensions: string[];
    /** Math-delimiter settings. */
    mathDelims: MathDelimsSnapshot;
    /**
     * The math backend the project uses. Drives which math language server
     * (if any) math regions are forwarded to.
     */
    mathBackend: MathBackend;
    /** Markdown directive settings. */
    directives: DirectiveEscapeSettings;
    /**
     * Per-tag {@link TexScaffold} for the project's TeX verbatim environments,
     * keyed by lower-cased tag name (every alias of a `type: 'tex'` entry maps
     * to the same scaffold). Empty when no config file declares one — in which
     * case the LSP falls back to a generic built-in scaffold.
     */
    texScaffolds: Record<string, TexScaffold>;
    /**
     * Absolute path of the `svelte.config.*` the snapshot was loaded from, or
     * `undefined` if none was found and the built-in defaults are in use.
     */
    configPath: string | undefined;
}

/**
 * Returns a {@link SveltexConfigSnapshot} populated entirely from SvelTeX's
 * built-in defaults. Used as the base that a loaded config is merged onto, and
 * as the fallback when no config file exists or loading fails.
 */
export function defaultConfigSnapshot(): SveltexConfigSnapshot {
    return {
        verbatimTags: ['tex', 'latex', 'tikz', 'verb', 'verbatim'],
        // The VS Code extension's `sveltex.latexTags` setting defaults to the
        // same three; keep them in step.
        latexTags: ['tex', 'latex', 'tikz'],
        extensions: ['.sveltex'],
        mathDelims: getDefaultMathConfig('mathjax').delims,
        mathBackend: 'mathjax',
        directives: { enabled: false, bracesArePartOfDirective: null },
        texScaffolds: {},
        configPath: undefined,
    };
}

/**
 * Candidate file names for a Svelte config, in priority order.
 * `svelte.config.*` is the SvelTeX configuration's only reliable source:
 * SvelTeX has to be registered there as a preprocessor to be active at all,
 * whereas a dedicated `sveltex.config.*` file is optional. Recent Svelte
 * tooling also accepts TypeScript configs, so those extensions are matched.
 */
const SVELTE_CONFIG_FILE_NAMES = [
    'svelte.config.js',
    'svelte.config.mjs',
    'svelte.config.cjs',
    'svelte.config.ts',
    'svelte.config.mts',
    'svelte.config.cts',
] as const;

/**
 * Searches `workspaceRoot` for a `svelte.config.*` file.
 *
 * @returns The absolute path of the first one found, or `undefined`.
 */
export function findSvelteConfigFile(
    workspaceRoot: string,
): string | undefined {
    for (const name of SVELTE_CONFIG_FILE_NAMES) {
        const candidate = join(workspaceRoot, name);
        if (existsSync(candidate)) return candidate;
    }
    return undefined;
}

/**
 * Narrowing helper: `true` for non-null objects.
 */
function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * Extracts the verbatim environment names from a user config object.
 *
 * A SvelTeX config's `verbatim` field is a record keyed by environment name, so
 * its keys are exactly the verbatim tags.
 */
function readVerbatimTags(
    config: Record<string, unknown>,
): string[] | undefined {
    const verbatim = config['verbatim'];
    if (!isObject(verbatim)) return undefined;
    const keys = Object.keys(verbatim);
    return keys.length > 0 ? keys : undefined;
}

/**
 * Extracts the LaTeX / TeX verbatim environment names from a user config
 * object: the names (and aliases) of every `verbatim` entry whose `type` is
 * `'tex'`.
 *
 * @returns The deduplicated tag list, or `undefined` if the config declares no
 * `tex`-typed verbatim environment.
 */
function readLatexTags(config: Record<string, unknown>): string[] | undefined {
    const verbatim = config['verbatim'];
    if (!isObject(verbatim)) return undefined;
    const tags = new Set<string>();
    for (const [name, entry] of Object.entries(verbatim)) {
        if (!isObject(entry) || entry['type'] !== 'tex') continue;
        tags.add(name);
        const aliases = entry['aliases'];
        if (Array.isArray(aliases)) {
            for (const alias of aliases) {
                if (typeof alias === 'string') tags.add(alias);
            }
        }
    }
    return tags.size > 0 ? [...tags] : undefined;
}

/**
 * SvelTeX's default TeX preamble — used when a `type: 'tex'` verbatim entry
 * declares none. Mirrors the documented default of `verbatim.<env>.preamble`.
 */
const DEFAULT_TEX_PREAMBLE = [
    '\\usepackage{microtype}',
    '\\usepackage{tikz}',
    '\\usepackage{mathtools}',
    '\\usepackage{xcolor}',
].join('\n');

/**
 * Renders a verbatim entry's `documentClass` setting (a string, or a
 * `{ name, options }` object, or absent) into a `\documentclass[…]{…}` line.
 * SvelTeX's default class for TeX components is `standalone`.
 */
function readDocumentClass(value: unknown): string {
    if (typeof value === 'string') return `\\documentclass{${value}}`;
    let name = 'standalone';
    let options: string[] = [];
    if (isObject(value)) {
        if (typeof value['name'] === 'string') name = value['name'];
        if (Array.isArray(value['options'])) {
            options = value['options'].filter(
                (option): option is string => typeof option === 'string',
            );
        }
    }
    return options.length > 0
        ? `\\documentclass[${options.join(',')}]{${name}}`
        : `\\documentclass{${name}}`;
}

/**
 * Extracts a {@link TexScaffold} for every `type: 'tex'` verbatim environment
 * in a user config object, keyed by lower-cased tag (its name and each alias).
 *
 * This is the `\documentclass` + `preamble` SvelTeX itself wraps the
 * environment's content in; the LSP reuses it so TexLab sees the project's
 * real packages and preamble macros. (SvelTeX additionally folds in
 * preset-derived packages via its internal `extendedPreamble`; the explicit
 * `preamble` string read here is the part that carries the user's intent.)
 */
function readTexScaffolds(
    config: Record<string, unknown>,
): Record<string, TexScaffold> {
    const verbatim = config['verbatim'];
    if (!isObject(verbatim)) return {};
    const scaffolds: Record<string, TexScaffold> = {};
    for (const [name, entry] of Object.entries(verbatim)) {
        if (!isObject(entry) || entry['type'] !== 'tex') continue;
        const scaffold: TexScaffold = {
            documentClass: readDocumentClass(entry['documentClass']),
            preamble:
                typeof entry['preamble'] === 'string'
                    ? entry['preamble']
                    : DEFAULT_TEX_PREAMBLE,
        };
        const tags = [name];
        const aliases = entry['aliases'];
        if (Array.isArray(aliases)) {
            for (const alias of aliases) {
                if (typeof alias === 'string') tags.push(alias);
            }
        }
        for (const tag of tags) scaffolds[tag.toLowerCase()] = scaffold;
    }
    return scaffolds;
}

/**
 * Extracts the math backend from a SvelTeX object.
 *
 * The backend can sit in two places: directly as a `mathBackend` property (a
 * resolved `Sveltex` instance exposes one) or, for a config that just declares
 * backend choices, as `backendChoices.mathBackend`.
 *
 * @returns The backend, or `undefined` if none is declared.
 */
function readMathBackend(
    config: Record<string, unknown>,
): MathBackend | undefined {
    const isBackend = (value: unknown): value is MathBackend =>
        value === 'mathjax' ||
        value === 'katex' ||
        value === 'custom' ||
        value === 'none';
    if (isBackend(config['mathBackend'])) return config['mathBackend'];
    const choices = config['backendChoices'];
    if (isObject(choices) && isBackend(choices['mathBackend'])) {
        return choices['mathBackend'];
    }
    return undefined;
}

/**
 * Extracts math-delimiter settings from a user config object, falling back to
 * `base` for any field the user did not specify.
 */
function readMathDelims(
    config: Record<string, unknown>,
    base: MathDelimsSnapshot,
): MathDelimsSnapshot {
    const math = config['math'];
    if (!isObject(math)) return base;
    const delims = math['delims'];
    if (!isObject(delims)) return base;
    const inline = isObject(delims['inline']) ? delims['inline'] : {};
    const display = isObject(delims['display']) ? delims['display'] : {};
    return {
        dollars:
            typeof delims['dollars'] === 'boolean'
                ? delims['dollars']
                : base.dollars,
        inline: {
            singleDollar:
                typeof inline['singleDollar'] === 'boolean'
                    ? inline['singleDollar']
                    : base.inline.singleDollar,
            escapedParentheses:
                typeof inline['escapedParentheses'] === 'boolean'
                    ? inline['escapedParentheses']
                    : base.inline.escapedParentheses,
        },
        display: {
            escapedSquareBrackets:
                typeof display['escapedSquareBrackets'] === 'boolean'
                    ? display['escapedSquareBrackets']
                    : base.display.escapedSquareBrackets,
        },
        doubleDollarSignsDisplay:
            delims['doubleDollarSignsDisplay'] === 'always' ||
            delims['doubleDollarSignsDisplay'] === 'newline' ||
            delims['doubleDollarSignsDisplay'] === 'fenced'
                ? delims['doubleDollarSignsDisplay']
                : base.doubleDollarSignsDisplay,
    };
}

/**
 * Extracts markdown directive settings from a user config object.
 */
function readDirectives(
    config: Record<string, unknown>,
): DirectiveEscapeSettings {
    const markdown = config['markdown'];
    if (!isObject(markdown)) return { enabled: false };
    const directives = markdown['directives'];
    if (!isObject(directives)) return { enabled: false };
    return {
        enabled:
            typeof directives['enabled'] === 'boolean'
                ? directives['enabled']
                : false,
    };
}

/**
 * Extracts the SvelTeX file extensions from a user config object.
 */
function readExtensions(
    config: Record<string, unknown>,
    base: string[],
): string[] {
    const extensions = config['extensions'];
    if (!Array.isArray(extensions)) return base;
    const strings = extensions.filter(
        (e): e is string => typeof e === 'string',
    );
    return strings.length > 0 ? strings : base;
}

/** How long the config-loader child process may run before it is killed. */
const CONFIG_LOAD_TIMEOUT_MS = 10_000;

/** Upper bound on the JSON a config-loader child may emit, as a guard. */
const CONFIG_LOAD_MAX_BYTES = 16 * 1024 * 1024;

/**
 * Source of the ES-module script run by the config-loader child process (see
 * {@link loadConfigViaChild}).
 *
 * It imports the `svelte.config.*` named in the `SVELTEX_CONFIG_PATH`
 * environment variable and writes a JSON rendering of the module namespace to
 * file descriptor 3. A resolved `Sveltex` instance exposes `configuration` and
 * `mathBackend` as getters — which `JSON.stringify` would drop — so each is
 * copied onto a plain object, both where the instance is a direct export and
 * where it sits inside a Svelte config's `preprocess`. {@link
 * resolveConfigCandidate} then reads that rendering exactly as if it had
 * imported the module itself.
 *
 * The script deliberately contains no backtick or `${...}`, so it survives
 * being embedded verbatim in the template literal below.
 */
const CONFIG_LOADER_SCRIPT = `
import { pathToFileURL } from 'node:url';
import { writeSync } from 'node:fs';

const isObject = (value) => typeof value === 'object' && value !== null;

const isSveltexInstance = (value) =>
    isObject(value) &&
    'configuration' in value &&
    'mathBackend' in value &&
    isObject(value.configuration);

const plainify = (value) =>
    isSveltexInstance(value)
        ? { configuration: value.configuration, mathBackend: value.mathBackend }
        : value;

const mod = await import(pathToFileURL(process.env.SVELTEX_CONFIG_PATH).href);

const rendered = {};
for (const [key, value] of Object.entries(mod)) {
    if (isSveltexInstance(value)) {
        rendered[key] = plainify(value);
    } else if (isObject(value) && 'preprocess' in value) {
        const list = Array.isArray(value.preprocess)
            ? value.preprocess
            : [value.preprocess];
        rendered[key] = { ...value, preprocess: list.map(plainify) };
    } else {
        rendered[key] = value;
    }
}

writeSync(3, JSON.stringify(rendered));
`;

/**
 * Extracts a one-line, human-readable summary from a child process's stderr:
 * the line that names the error (`SyntaxError: …`, `Error [ERR_…]: …`) if
 * there is one, else the first non-empty line. Capped so a stack trace cannot
 * flood the log.
 */
function summarizeStderr(stderr: string): string {
    const lines = stderr
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    const errorLine = lines.find((line) => /[A-Za-z]*Error\b/u.test(line));
    return (errorLine ?? lines[0] ?? 'unknown error').slice(0, 300);
}

/**
 * Imports a `svelte.config.*` in a short-lived child process and returns a
 * JSON-safe rendering of its module namespace.
 *
 * A throwaway process has a throwaway ES-module cache, so every call re-reads
 * the config *and everything it imports* — a separate `sveltex.config.*`,
 * shared helper modules, … — none of which an in-process `import()` could
 * invalidate (a cache-busting query only ever defeats the cache for the entry
 * URL, never for the modules that entry transitively imports). This is what
 * lets a live config reload actually observe edits.
 *
 * The rendering comes back over a private file descriptor 3, never stdout, so
 * any logging the config (or `sveltex()`) performs cannot corrupt it.
 *
 * @param configPath - Absolute path of the `svelte.config.*` to import.
 * @returns The parsed module namespace.
 */
async function loadConfigViaChild(
    configPath: string,
): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const child = spawn(
            process.execPath,
            ['--input-type=module', '--eval', CONFIG_LOADER_SCRIPT],
            {
                cwd: dirname(configPath),
                env: {
                    ...process.env,
                    // When this server itself runs under Electron (the VS Code
                    // extension host), the child must be told to behave as
                    // plain Node; the variable is harmless for a real Node
                    // `execPath`.
                    ELECTRON_RUN_AS_NODE: '1',
                    SVELTEX_CONFIG_PATH: configPath,
                },
                // stdin/stdout are dropped (config logging to stdout is
                // discarded); stderr is captured so a failed load can report
                // its real reason; the JSON rendering returns on the private
                // fd 3.
                stdio: ['ignore', 'ignore', 'pipe', 'pipe'],
                // A config that hangs on import must not wedge the reloader.
                timeout: CONFIG_LOAD_TIMEOUT_MS,
            },
        );

        let settled = false;
        const fail = (error: Error): void => {
            if (settled) return;
            settled = true;
            child.kill();
            reject(error);
        };

        const resultPipe = child.stdio[3] as Readable | null;
        if (!resultPipe) {
            fail(new Error('config loader: result pipe unavailable'));
            return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        resultPipe.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > CONFIG_LOAD_MAX_BYTES) {
                fail(new Error('config loader: output too large'));
                return;
            }
            chunks.push(chunk);
        });
        // Collect the child's stderr so a failed import/eval can be reported
        // with its real reason (`SyntaxError`, `Cannot find package`, …)
        // rather than a bare exit code.
        const errChunks: Buffer[] = [];
        child.stderr?.on('data', (chunk: Buffer) => {
            if (errChunks.length < 64) errChunks.push(chunk);
        });

        child.on('error', fail);
        child.on('close', (code) => {
            if (settled) return;
            if (code !== 0) {
                const stderr = Buffer.concat(errChunks).toString('utf8');
                fail(
                    new Error(
                        stderr.trim()
                            ? summarizeStderr(stderr)
                            : `exited with code ${String(code)}`,
                    ),
                );
                return;
            }
            settled = true;
            try {
                const parsed: unknown = JSON.parse(
                    Buffer.concat(chunks).toString('utf8'),
                );
                resolve(isObject(parsed) ? parsed : {});
            } catch (error) {
                reject(
                    error instanceof Error
                        ? error
                        : new Error('config loader: invalid JSON output'),
                );
            }
        });
    });
}

/**
 * Loads the SvelTeX configuration for a workspace and distills it into a
 * {@link SveltexConfigSnapshot}.
 *
 * The configuration is read from the project's `svelte.config.*`: SvelTeX has
 * to be registered there as a preprocessor to be active at all, so the
 * resolved `Sveltex` instance — and thus the project's real verbatim tags,
 * TeX preamble, math backend, … — is reachable from it. A dedicated
 * `sveltex.config.*` file, if the project keeps one, is necessarily imported
 * into `svelte.config.*`, so reading the latter captures it either way.
 *
 * @param workspaceRoot - Absolute path of the workspace folder to search.
 * @param log - Optional sink for a one-line, human-readable account of the
 * load outcome (config located and loaded, located but unloadable — with the
 * reason —, or absent). Wired by the host to the editor's output channel so a
 * misconfigured project is diagnosable rather than a silent fall-back.
 * @returns The resolved snapshot. Loading never throws: a missing,
 * syntactically broken, or otherwise unloadable config falls back to the
 * built-in {@link defaultConfigSnapshot} — the LSP must never fail to start
 * just because the configuration is unreadable.
 *
 * @remarks
 * The config is imported in a short-lived child process ({@link
 * loadConfigViaChild}), so each call — and thus each live reload — re-reads
 * the config and everything it imports. A `.ts` config relies on the child
 * Node's type-stripping support; the child reuses this server's own Node
 * binary, so it strips types exactly where the server's runtime would, and on
 * a Node too old for it the child errors and the defaults are used.
 */
export async function loadConfigSnapshot(
    workspaceRoot: string,
    log?: (message: string) => void,
): Promise<SveltexConfigSnapshot> {
    const base = defaultConfigSnapshot();
    const configPath = findSvelteConfigFile(workspaceRoot);
    if (!configPath) {
        log?.('No svelte.config.* found — using the built-in defaults.');
        return base;
    }

    let mod: Record<string, unknown>;
    try {
        mod = await loadConfigViaChild(configPath);
    } catch (error) {
        // Loading must never fail the server: a missing, broken, or
        // otherwise unloadable config falls back to the defaults (the
        // located config path is still reported).
        const reason = error instanceof Error ? error.message : String(error);
        log?.(
            `Failed to load ${configPath}: ${reason}. ` +
                'Using the built-in defaults.',
        );
        return { ...base, configPath };
    }

    const { candidate, mathBackend, sveltexInstanceFound } =
        resolveConfigCandidate(mod);
    const snapshot: SveltexConfigSnapshot = {
        verbatimTags: readVerbatimTags(candidate) ?? base.verbatimTags,
        latexTags: readLatexTags(candidate) ?? base.latexTags,
        extensions: readExtensions(candidate, base.extensions),
        mathDelims: readMathDelims(candidate, base.mathDelims),
        mathBackend: mathBackend ?? base.mathBackend,
        directives: readDirectives(candidate),
        texScaffolds: readTexScaffolds(candidate),
        configPath,
    };

    if (!sveltexInstanceFound) {
        log?.(
            `Loaded ${configPath}, but found no SvelTeX preprocessor in ` +
                'it — SvelTeX settings fall back to the built-in defaults.',
        );
    } else {
        const scaffoldTags = Object.keys(snapshot.texScaffolds);
        log?.(
            `Loaded SvelTeX config from ${configPath} (math backend: ` +
                `${snapshot.mathBackend}; LaTeX tags: ` +
                `${snapshot.latexTags.join(', ') || 'none'}; TeX preamble ` +
                `scaffolds: ${scaffoldTags.join(', ') || 'none'}).`,
        );
    }
    return snapshot;
}

/**
 * Narrowing helper: `true` for a resolved `Sveltex` instance — or anything
 * that quacks like one — exposing both a `mathBackend` and a `configuration`
 * object.
 */
function isSveltexInstance(
    value: unknown,
): value is { configuration: Record<string, unknown>; mathBackend: unknown } {
    return (
        isObject(value) &&
        'mathBackend' in value &&
        'configuration' in value &&
        isObject(value['configuration'])
    );
}

/**
 * Finds a `Sveltex` instance inside a Svelte config's `preprocess` field —
 * the shape of a `svelte.config.*` that configures SvelTeX inline, e.g.
 * `preprocess: [vitePreprocess(), await sveltex(...)]`. `preprocess` may also
 * be a single preprocessor rather than an array.
 *
 * @returns The instance, or `undefined` if `value` carries no SvelTeX
 * preprocessor.
 */
function findSveltexInPreprocess(
    value: unknown,
):
    | { configuration: Record<string, unknown>; mathBackend: unknown }
    | undefined {
    if (!isObject(value)) return undefined;
    const preprocess = value['preprocess'];
    const list = Array.isArray(preprocess) ? preprocess : [preprocess];
    for (const entry of list) {
        if (isSveltexInstance(entry)) return entry;
    }
    return undefined;
}

/**
 * Picks, out of an imported `svelte.config.*` module, the object to read
 * SvelTeX settings from and the math backend.
 *
 * The SvelTeX preprocessor — a resolved `Sveltex` instance, exposing
 * `mathBackend` and a fully-merged `configuration` — is found either as a
 * direct module export or, in the usual case, nested in the Svelte config's
 * `preprocess` array (`preprocess: [..., await sveltex(...)]`). Failing that,
 * a plain `default` / `config` object is used as a best effort.
 *
 * @param mod - The imported config module namespace.
 * @returns The object to read region settings from, the math backend if one
 * could be determined, and whether a resolved `Sveltex` preprocessor instance
 * was actually found (as opposed to falling back to a plain config object).
 */
function resolveConfigCandidate(mod: Record<string, unknown>): {
    candidate: Record<string, unknown>;
    mathBackend: MathBackend | undefined;
    sveltexInstanceFound: boolean;
} {
    // (a) A resolved `Sveltex` instance exported directly.
    for (const value of Object.values(mod)) {
        if (isSveltexInstance(value)) {
            return {
                candidate: value.configuration,
                mathBackend: readMathBackend(value),
                sveltexInstanceFound: true,
            };
        }
    }
    // (b) A `Sveltex` instance nested in a Svelte config's `preprocess`.
    for (const value of Object.values(mod)) {
        const instance = findSveltexInPreprocess(value);
        if (instance) {
            return {
                candidate: instance.configuration,
                mathBackend: readMathBackend(instance),
                sveltexInstanceFound: true,
            };
        }
    }
    // (c) A plain config object.
    const candidate = isObject(mod['default'])
        ? mod['default']
        : isObject(mod['config'])
          ? mod['config']
          : mod;
    return {
        candidate,
        mathBackend: readMathBackend(candidate),
        sveltexInstanceFound: false,
    };
}
