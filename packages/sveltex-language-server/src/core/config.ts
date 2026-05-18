// File description: Locates the user's SvelTeX configuration — a dedicated
// `sveltex.config.*` file, or, failing that, the `svelte.config.*` that wires
// SvelTeX in as a preprocessor — and distills it into a
// `SveltexConfigSnapshot`: the minimal slice of configuration that the region
// detector ({@link computeRegions}) needs.

import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
 * The minimal, immutable view of a resolved `sveltex.config.*` that the LSP
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
     * Absolute path of the file the snapshot was loaded from — a
     * `sveltex.config.*`, or a `svelte.config.*` fallback — or `undefined` if
     * neither was found and the built-in defaults are in use.
     */
    configPath: string | undefined;
}

/** Candidate file names for a SvelTeX config, in priority order. */
const CONFIG_FILE_NAMES = [
    'sveltex.config.js',
    'sveltex.config.mjs',
    'sveltex.config.cjs',
    'sveltex.config.ts',
] as const;

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
 * Searches `workspaceRoot` for a `sveltex.config.*` file.
 *
 * @returns The absolute path of the first config file found, or `undefined`.
 */
export function findConfigFile(workspaceRoot: string): string | undefined {
    for (const name of CONFIG_FILE_NAMES) {
        const candidate = join(workspaceRoot, name);
        if (existsSync(candidate)) return candidate;
    }
    return undefined;
}

/**
 * Candidate file names for a Svelte config, in priority order. SvelTeX must be
 * registered there as a preprocessor, which makes `svelte.config.*` the
 * fallback source of configuration when no `sveltex.config.*` exists. Svelte
 * has no TypeScript-config support, so only the JS variants are listed.
 */
const SVELTE_CONFIG_FILE_NAMES = [
    'svelte.config.js',
    'svelte.config.mjs',
    'svelte.config.cjs',
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
function readLatexTags(
    config: Record<string, unknown>,
): string[] | undefined {
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

/**
 * Loads the SvelTeX configuration for a workspace and distills it into a
 * {@link SveltexConfigSnapshot}.
 *
 * Resolution order:
 *
 *  1. A loadable, dedicated `sveltex.config.{js,mjs,cjs}` at the workspace
 *     root.
 *  2. Otherwise `svelte.config.{js,mjs,cjs}` — SvelTeX is, by definition,
 *     registered there as a preprocessor, so its resolved configuration is
 *     reachable even when the project keeps no separate `sveltex.config.*`
 *     (or the one it keeps is a `.ts` file this loader cannot execute).
 *  3. Otherwise the built-in {@link defaultConfigSnapshot}.
 *
 * @param workspaceRoot - Absolute path of the workspace folder to search.
 * @returns The resolved snapshot. Loading never throws: a missing,
 * syntactically broken, or otherwise unloadable config falls through to the
 * next source, and ultimately to the defaults — the LSP must never fail to
 * start just because the configuration is unreadable.
 *
 * @remarks
 * Only `.js` / `.mjs` / `.cjs` modules are dynamically importable here. A
 * `.ts` `sveltex.config` is detected (so its presence can be reported) but not
 * executed, since transpiling it would require pulling a bundler into the
 * language server; such a project still gets its real configuration via its
 * `svelte.config.{js,mjs,cjs}` (step 2).
 */
export async function loadConfigSnapshot(
    workspaceRoot: string,
): Promise<SveltexConfigSnapshot> {
    const base = defaultConfigSnapshot();
    const configPath = findConfigFile(workspaceRoot);

    // 1. A dedicated, loadable `sveltex.config.{js,mjs,cjs}`.
    if (configPath && !configPath.endsWith('.ts')) {
        const snapshot = await snapshotFromConfigModule(configPath, base);
        if (snapshot) return { ...snapshot, configPath };
    }

    // 2. Fall back to `svelte.config.{js,mjs,cjs}`.
    const svelteConfigPath = findSvelteConfigFile(workspaceRoot);
    if (svelteConfigPath) {
        const snapshot = await snapshotFromConfigModule(svelteConfigPath, base);
        if (snapshot) return { ...snapshot, configPath: svelteConfigPath };
    }

    // 3. Nothing usable: defaults. A `sveltex.config.*` path is still
    //    reported when one exists (e.g. an unloadable `.ts` config).
    return configPath ? { ...base, configPath } : base;
}

/**
 * Imports a config module — a `sveltex.config.*` or a `svelte.config.*` — and
 * distills a {@link SveltexConfigSnapshot} from it.
 *
 * @returns The snapshot (with `configPath` left `undefined` for the caller to
 * fill in), or `undefined` if the module could not be imported at all.
 */
async function snapshotFromConfigModule(
    modulePath: string,
    base: SveltexConfigSnapshot,
): Promise<SveltexConfigSnapshot | undefined> {
    let mod: Record<string, unknown>;
    try {
        const imported: unknown = await import(pathToFileURL(modulePath).href);
        mod = isObject(imported) ? imported : {};
    } catch {
        return undefined;
    }
    const { candidate, mathBackend } = resolveConfigCandidate(mod);
    return {
        verbatimTags: readVerbatimTags(candidate) ?? base.verbatimTags,
        latexTags: readLatexTags(candidate) ?? base.latexTags,
        extensions: readExtensions(candidate, base.extensions),
        mathDelims: readMathDelims(candidate, base.mathDelims),
        mathBackend: mathBackend ?? base.mathBackend,
        directives: readDirectives(candidate),
        texScaffolds: readTexScaffolds(candidate),
        configPath: undefined,
    };
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
 * Picks, out of an imported config module, the object to read settings from
 * and the math backend. It accommodates the shapes of both supported config
 * files:
 *
 *  - `sveltex.config.*` — usually `export const preprocessor = await
 *    sveltex(choices, config)`, i.e. the export is a resolved `Sveltex`
 *    instance (which exposes `mathBackend` and a fully-merged `configuration`);
 *    or a plain `export default { ... }` / `export const config = { ... }`,
 *    possibly alongside a `backendChoices` object.
 *  - `svelte.config.*` — `export default { preprocess: [..., sveltex(...)] }`,
 *    where the `Sveltex` instance is nested in the `preprocess` array.
 *
 * @param mod - The imported config module namespace.
 * @returns The object to read region settings from, and the math backend if
 * one could be determined.
 */
function resolveConfigCandidate(mod: Record<string, unknown>): {
    candidate: Record<string, unknown>;
    mathBackend: MathBackend | undefined;
} {
    // (a) A resolved `Sveltex` instance exported directly.
    for (const value of Object.values(mod)) {
        if (isSveltexInstance(value)) {
            return {
                candidate: value.configuration,
                mathBackend: readMathBackend(value),
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
            };
        }
    }
    // (c) A plain config object.
    const candidate = isObject(mod['default'])
        ? mod['default']
        : isObject(mod['config'])
          ? mod['config']
          : mod;
    return { candidate, mathBackend: readMathBackend(candidate) };
}
