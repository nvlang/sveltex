// File description: Locates and loads the user's `sveltex.config.*` file and
// distills it into a `SveltexConfigSnapshot` — the minimal slice of
// configuration that the region detector ({@link computeRegions}) needs.

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
     * Absolute path of the config file the snapshot was loaded from, or
     * `undefined` if no config file was found and defaults are in use.
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
 * Loads the SvelTeX config for a workspace and distills it into a
 * {@link SveltexConfigSnapshot}.
 *
 * @param workspaceRoot - Absolute path of the workspace folder to search.
 * @returns The resolved snapshot. If no config file is found, or if it cannot
 * be loaded (syntax error, TS-only config without a loader, ...), the built-in
 * {@link defaultConfigSnapshot} is returned instead — the LSP must never fail
 * to start just because the config is unreadable.
 *
 * @remarks
 * Only `.js` / `.mjs` / `.cjs` configs are dynamically importable here; a
 * `.ts` config is detected (so its presence is reported) but not executed,
 * since transpiling it would require pulling a bundler into the language
 * server. In that case the defaults — extended with anything statically
 * recoverable — are used. This is a deliberate v1 limitation.
 *
 * TODO: support `.ts` configs by resolving the project's TypeScript loader.
 */
export async function loadConfigSnapshot(
    workspaceRoot: string,
): Promise<SveltexConfigSnapshot> {
    const base = defaultConfigSnapshot();
    const configPath = findConfigFile(workspaceRoot);
    if (!configPath) return base;

    // A TypeScript config cannot be `import()`-ed without a loader; report its
    // path but otherwise use defaults.
    if (configPath.endsWith('.ts')) {
        return { ...base, configPath };
    }

    try {
        const imported: unknown = await import(pathToFileURL(configPath).href);
        const mod = isObject(imported) ? imported : {};
        const { candidate, mathBackend } = resolveConfigCandidate(mod);

        return {
            verbatimTags: readVerbatimTags(candidate) ?? base.verbatimTags,
            latexTags: readLatexTags(candidate) ?? base.latexTags,
            extensions: readExtensions(candidate, base.extensions),
            mathDelims: readMathDelims(candidate, base.mathDelims),
            mathBackend: mathBackend ?? base.mathBackend,
            directives: readDirectives(candidate),
            configPath,
        };
    } catch {
        return { ...base, configPath };
    }
}

/**
 * Picks, out of an imported config module, the object to read settings from
 * and the math backend.
 *
 * A SvelTeX config file usually does one of:
 *
 *  - `export const preprocessor = await sveltex(choices, config)` — the export
 *    is a resolved `Sveltex` instance. The instance exposes `mathBackend`
 *    directly and a fully-merged `configuration` object (verbatim, math, ...).
 *  - `export default { ... }` / `export const config = { ... }` — a plain
 *    config object, possibly alongside a `backendChoices` object.
 *
 * This walks every export, prefers a `Sveltex`-instance-shaped value, and
 * otherwise falls back to a plain `default` / `config` object.
 *
 * @param mod - The imported config module namespace.
 * @returns The object to read region settings from, and the math backend if
 * one could be determined.
 */
function resolveConfigCandidate(mod: Record<string, unknown>): {
    candidate: Record<string, unknown>;
    mathBackend: MathBackend | undefined;
} {
    // A resolved `Sveltex` instance has both a `mathBackend` and a
    // `configuration` getter; prefer it wherever it is exported.
    for (const value of Object.values(mod)) {
        if (
            isObject(value) &&
            'mathBackend' in value &&
            'configuration' in value &&
            isObject(value['configuration'])
        ) {
            return {
                candidate: value['configuration'],
                mathBackend: readMathBackend(value),
            };
        }
    }
    // Otherwise fall back to a plain config object.
    const candidate = isObject(mod['default'])
        ? mod['default']
        : isObject(mod['config'])
          ? mod['config']
          : mod;
    return { candidate, mathBackend: readMathBackend(candidate) };
}
