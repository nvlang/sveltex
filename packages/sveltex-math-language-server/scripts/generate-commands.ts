// File description: Build-time generator for the per-backend TeX command lists
// shipped by `@nvl/sveltex-math-language-server`.
//
// The whole point of this server is ACCURACY: it must offer exactly the
// commands each backend (KaTeX / MathJax) actually understands, no more and no
// less. Rather than transcribe prose documentation (which drifts), this script
// reads the authoritative tables out of the `katex` and `@mathjax/src` package
// sources and emits `src/data/commands.generated.ts`.
//
//  - KaTeX declares its commands in four side-effect-populated default exports:
//      • `src/functions.ts`     — every `defineFunction({ names })`
//      • `src/symbols.ts`       — every `defineSymbol(...)` (math + text modes)
//      • `src/macros.ts`        — every `defineMacro(...)`
//      • `src/environments.ts`  — every `defineEnvironment({ names })`
//    KaTeX supports a finite, enumerable set; these four tables ARE that set.
//
//  - MathJax registers its TeX macros/symbols/environments through a global
//    `MapHandler`. Importing a package's `*Configuration.js` runs the
//    `new sm.XxxMap(...)` constructors, each of which self-registers. We patch
//    `MapHandler.register` to capture every map, import the packages that the
//    default `input/tex` config loads — plus the ones its `autoload` extension
//    pulls in on demand — and read the token keys back out.
//
// The imports below are deliberately dynamic and routed through `string`-typed
// specifier variables: that keeps the monorepo's root `tsc` from following into
// `katex`/`@mathjax/src` internals when it sweeps `**/scripts`. `katex` and
// `@mathjax/src` are devDependencies only — the published package ships the
// generated static data and has no runtime dependency on either.
//
// Run with: `pnpm --filter @nvl/sveltex-math-language-server generate`

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** Output path of the generated module, relative to this script. */
const OUTPUT = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'src',
    'data',
    'commands.generated.ts',
);

/**
 * The category a command falls into. Drives the LSP `CompletionItemKind` and
 * the wording of hover text.
 */
type CommandCategory = 'function' | 'symbol' | 'macro' | 'environment';

/** A single extracted TeX command. */
interface RawCommand {
    /** The command name, WITHOUT the leading backslash (e.g. `frac`). */
    name: string;
    /** The command's category. */
    category: CommandCategory;
}

/**
 * Tests whether a raw token key denotes a real, user-typeable TeX command.
 *
 * Accepted: an alphabetic word with an optional trailing `*` (`frac`, `align*`)
 * or a single ASCII punctuation character — the escaped symbols `\,`, `\;`,
 * `\{`, `\#`, ... Rejected: anything else, in particular raw Unicode glyphs
 * (KaTeX registers a symbol's replacement character as an alias key; `\—` is
 * not a command), multi-character punctuation, active characters, the empty
 * string. A backslash itself is rejected (`\\` is handled structurally).
 */
function isCommandKey(key: string): boolean {
    if (key.length === 0) return false;
    if (/^[a-zA-Z]+\*?$/u.test(key)) return true;
    // Single ASCII punctuation: ! " # $ % & ' ( ) * + , - . / : ; < = > ? @
    // [ \ ] ^ _ ` { | } ~  — minus the backslash, which is not a command name.
    return key.length === 1 && /^[!-/:-@[\]^_`{-~]$/u.test(key);
}

/**
 * Normalises a token key to a bare command name (no leading backslash).
 *
 * KaTeX's `functions`/`macros` keys already carry a `\`; its `symbols` keys are
 * mixed; MathJax keys never do. Stripping a leading `\` unifies all three.
 */
function bareName(key: string): string {
    return key.startsWith('\\') ? key.slice(1) : key;
}

// ---------------------------------------------------------------------------
// KaTeX
// ---------------------------------------------------------------------------

/**
 * Extracts every command KaTeX supports from the `katex` package source.
 *
 * @returns The de-duplicated, sorted KaTeX command list.
 */
async function extractKatex(): Promise<RawCommand[]> {
    // Routed through `string` variables so `tsc` does not resolve into these.
    const functionsSpec = 'katex/src/functions.ts';
    const symbolsSpec = 'katex/src/symbols.ts';
    const macrosSpec = 'katex/src/macros.ts';
    const environmentsSpec = 'katex/src/environments.ts';

    // `tsx` interop wraps the source's `export default` under a `.default`
    // namespace key; unwrap it defensively (works with or without the wrap).
    const unwrap = (mod: unknown): unknown => {
        if (mod && typeof mod === 'object' && 'default' in mod) {
            return mod.default;
        }
        return mod;
    };

    const functions = unwrap(await import(functionsSpec)) as Record<
        string,
        unknown
    >;
    const symbols = unwrap(await import(symbolsSpec)) as {
        math: Record<string, unknown>;
        text: Record<string, unknown>;
    };
    const macros = unwrap(await import(macrosSpec)) as Record<string, unknown>;
    const environments = unwrap(await import(environmentsSpec)) as Record<
        string,
        unknown
    >;

    const byName = new Map<string, CommandCategory>();
    /**
     * Records a command. `requireBackslash` is `true` for the `functions` /
     * `symbols` / `macros` tables (KaTeX registers a symbol under its
     * `\`-prefixed name AND its raw replacement glyph — only the former is
     * user-typeable) and `false` for the environments table, whose keys are
     * always bare names used inside `\begin{...}`.
     */
    const add = (
        key: string,
        category: CommandCategory,
        requireBackslash: boolean,
    ): void => {
        if (requireBackslash && !key.startsWith('\\')) return;
        const name = bareName(key);
        if (!isCommandKey(name)) return;
        // A name already recorded keeps its first (higher-priority) category;
        // functions/symbols are recorded before macros.
        if (!byName.has(name)) byName.set(name, category);
    };

    // Environments first: a name shared with a command (rare) is best surfaced
    // as the `\begin{...}`-completable environment.
    for (const key of Object.keys(environments)) {
        add(key, 'environment', false);
    }
    for (const key of Object.keys(functions)) add(key, 'function', true);
    for (const key of Object.keys(symbols.math)) add(key, 'symbol', true);
    for (const key of Object.keys(symbols.text)) add(key, 'symbol', true);
    for (const key of Object.keys(macros)) add(key, 'macro', true);

    return [...byName.entries()]
        .map(([name, category]) => ({ name, category }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// MathJax
// ---------------------------------------------------------------------------

/**
 * The MathJax `input/tex` packages loaded by default, plus every package its
 * `autoload` extension can pull in on demand. With `autoload` active (the
 * default), a command in any of these is "supported out of the box". Packages
 * that need an explicit `\require{}` (`mathtools`, `physics`, ...) are
 * deliberately excluded — they are not available without extra configuration.
 */
const MATHJAX_PACKAGES: readonly string[] = [
    // Always loaded by the `input/tex` component.
    'base/BaseConfiguration.js',
    'ams/AmsConfiguration.js',
    'newcommand/NewcommandConfiguration.js',
    'textmacros/TextMacrosConfiguration.js',
    'configmacros/ConfigMacrosConfiguration.js',
    // Reachable through the `autoload` extension.
    'action/ActionConfiguration.js',
    'amscd/AmsCdConfiguration.js',
    'bbox/BboxConfiguration.js',
    'boldsymbol/BoldsymbolConfiguration.js',
    'braket/BraketConfiguration.js',
    'bussproofs/BussproofsConfiguration.js',
    'cancel/CancelConfiguration.js',
    'color/ColorConfiguration.js',
    'enclose/EncloseConfiguration.js',
    'extpfeil/ExtpfeilConfiguration.js',
    'html/HtmlConfiguration.js',
    'mhchem/MhchemConfiguration.js',
    'unicode/UnicodeConfiguration.js',
    'verb/VerbConfiguration.js',
];

/**
 * Map names registered by MathJax that hold lexer/parser machinery rather than
 * user commands (regular-expression matchers for letters/digits, the active
 * character handler, and the input/output character remappers).
 */
const MATHJAX_SKIP_MAPS: ReadonlySet<string> = new Set([
    'letter',
    'digit',
    'command',
    'special',
    'remap',
    'not_remap',
]);

/** A MathJax token map, as seen after patching `MapHandler.register`. */
interface MathjaxMap {
    name: string;
    /** `AbstractParseMap` subclasses expose a `Map`; `RegExpMap` does not. */
    map?: Map<string, unknown>;
    constructor: { name: string };
}

/**
 * Extracts every command the default MathJax TeX configuration supports.
 *
 * @returns The de-duplicated, sorted MathJax command list.
 */
async function extractMathjax(): Promise<RawCommand[]> {
    const handlerSpec = '@mathjax/src/mjs/input/tex/MapHandler.js';
    const handlerModule = (await import(handlerSpec)) as {
        MapHandler: { register: (map: MathjaxMap) => void };
    };
    const handler = handlerModule.MapHandler;

    const captured: MathjaxMap[] = [];
    const original = handler.register.bind(handler);
    handler.register = (map: MathjaxMap): void => {
        captured.push(map);
        original(map);
    };

    const base = '@mathjax/src/mjs/input/tex/';
    for (const pkg of MATHJAX_PACKAGES) {
        // Each import runs the package's `new sm.XxxMap(...)` side effects.
        await import(base + pkg);
    }

    const byName = new Map<string, CommandCategory>();
    const add = (key: string, category: CommandCategory): void => {
        const name = bareName(key);
        if (!isCommandKey(name)) return;
        if (!byName.has(name)) byName.set(name, category);
    };

    for (const map of captured) {
        if (MATHJAX_SKIP_MAPS.has(map.name)) continue;
        if (!map.map || typeof map.map.keys !== 'function') continue;
        const kind = map.constructor.name;
        const category: CommandCategory =
            kind === 'EnvironmentMap'
                ? 'environment'
                : kind === 'CommandMap' || kind === 'MacroMap'
                  ? 'macro'
                  : 'symbol';
        for (const key of map.map.keys()) add(key, category);
    }

    return [...byName.entries()]
        .map(([name, category]) => ({ name, category }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

/** Serialises a command list as a TypeScript array literal. */
function serialiseList(commands: RawCommand[]): string {
    return commands
        .map((c) => `    { name: ${JSON.stringify(c.name)}, category: ${JSON.stringify(c.category)} },`)
        .join('\n');
}

/** Generates the `commands.generated.ts` module and writes it to disk. */
async function main(): Promise<void> {
    const katex = await extractKatex();
    const mathjax = await extractMathjax();

    const header = [
        '// File description: GENERATED FILE — do not edit by hand.',
        '//',
        '// The per-backend TeX command lists below are extracted directly from the',
        '// `katex` and `@mathjax/src` package sources by `scripts/generate-commands.ts`.',
        '// Regenerate with: `pnpm --filter @nvl/sveltex-math-language-server generate`.',
        '',
        "import type { CommandCategory, MathCommand } from '../core/commands.js';",
        '',
        '/**',
        ` * Every TeX command KaTeX supports (${String(katex.length)} entries), extracted from`,
        " * `katex`'s `functions`, `symbols` and `macros` tables.",
        ' */',
        'export const KATEX_COMMANDS: readonly MathCommand[] = [',
        serialiseList(katex),
        '];',
        '',
        '/**',
        ` * Every TeX command the default MathJax \`input/tex\` configuration supports`,
        ` * (${String(mathjax.length)} entries), extracted from \`@mathjax/src\`'s registered token maps`,
        ' * for the always-loaded and `autoload`-reachable packages.',
        ' */',
        'export const MATHJAX_COMMANDS: readonly MathCommand[] = [',
        serialiseList(mathjax),
        '];',
        '',
        '// Re-export the category type so consumers can import everything from here.',
        'export type { CommandCategory, MathCommand };',
        '',
    ].join('\n');

    writeFileSync(OUTPUT, header, 'utf8');
    process.stdout.write(
        `Generated ${OUTPUT}\n` +
            `  KaTeX:   ${String(katex.length)} commands\n` +
            `  MathJax: ${String(mathjax.length)} commands\n`,
    );
}

void main().catch((error: unknown) => {
    process.stderr.write(`generate-commands failed: ${String(error)}\n`);
    process.exitCode = 1;
});
