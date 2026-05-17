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
// On top of the bare command set, each command is enriched with documentation
// metadata: a usage signature, the providing package and a one-line
// description, read from `scripts/data/<backend>-docs.json` (curated from each
// engine's reference docs); and, for symbol commands, the Unicode glyph the
// command renders as — taken from the engine's own symbol tables — plus that
// glyph's Unicode standard name, looked up in the Unicode Character Database.
// All of it is baked into the generated file; the published package keeps no
// runtime dependency and never touches the network.
//
// The imports below are deliberately dynamic and routed through `string`-typed
// specifier variables: that keeps the monorepo's root `tsc` from following into
// `katex`/`@mathjax/src` internals when it sweeps `**/scripts`. `katex` and
// `@mathjax/src` are devDependencies only — the published package ships the
// generated static data and has no runtime dependency on either.
//
// Run with: `pnpm --filter @nvl/sveltex-math-language-server generate`

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { format, resolveConfig } from 'prettier';

/** Directory holding this script (`scripts/`). */
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

/** Output path of the generated module, relative to this script. */
const OUTPUT = join(SCRIPT_DIR, '..', 'src', 'data', 'commands.generated.ts');

/**
 * The category a command falls into. Drives the LSP `CompletionItemKind` and
 * the wording of hover text.
 */
type CommandCategory = 'function' | 'symbol' | 'macro' | 'environment';

/** A single extracted, enriched TeX command. */
interface RawCommand {
    /** The command name, WITHOUT the leading backslash (e.g. `frac`). */
    name: string;
    /** The command's category. */
    category: CommandCategory;
    /** A usage signature (`\sqrt[degree]{radicand}`); args-taking commands. */
    signature?: string;
    /** The Unicode glyph the command renders as, if it stands for one. */
    unicode?: string;
    /** The Unicode standard name of `unicode`, lower-cased. */
    unicodeName?: string;
    /** The backend package/extension (or KaTeX doc section) it belongs to. */
    package?: string;
    /** A one-line description of what the command does. */
    description?: string;
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
 * @returns The de-duplicated, sorted KaTeX command list (with each symbol's
 * Unicode replacement glyph attached, where the source provides one).
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

    // KaTeX records each symbol's Unicode replacement glyph in the `replace`
    // field of its `symbols` entry; collect those so a symbol command can show
    // the glyph it stands for. Only `\`-prefixed keys are user-typeable names.
    const unicodeByName = new Map<string, string>();
    for (const table of [symbols.math, symbols.text]) {
        for (const [key, value] of Object.entries(table)) {
            if (!key.startsWith('\\')) continue;
            const name = bareName(key);
            const replace = (value as { replace?: unknown }).replace;
            if (
                typeof replace === 'string' &&
                replace.length > 0 &&
                !unicodeByName.has(name)
            ) {
                unicodeByName.set(name, replace);
            }
        }
    }

    return [...byName.entries()]
        .map(([name, category]): RawCommand => {
            const unicode = unicodeByName.get(name);
            return unicode
                ? { name, category, unicode }
                : { name, category };
        })
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
 * Reads the Unicode glyph off a MathJax symbol-map value.
 *
 * Symbol and delimiter maps store `Symbol` instances whose `char` property is
 * the replacement glyph (`new Symbol('alpha', 'α', …)`). Anything else — a
 * macro, a parser callback tuple — yields `undefined`.
 *
 * @param value - A value read from a captured MathJax token map.
 */
function mathjaxCharOf(value: unknown): string | undefined {
    let char: unknown;
    if (typeof value === 'string') {
        char = value;
    } else if (value && typeof value === 'object' && 'char' in value) {
        char = value.char;
    }
    if (typeof char === 'string' && char.length > 0 && char.length <= 8) {
        return char;
    }
    return undefined;
}

/**
 * Extracts every command the default MathJax TeX configuration supports.
 *
 * @returns The de-duplicated, sorted MathJax command list (with each symbol's
 * Unicode replacement glyph attached, where the source provides one).
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
    const unicodeByName = new Map<string, string>();
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
        for (const [key, value] of map.map.entries()) {
            add(key, category);
            // Symbol/delimiter maps carry the glyph each command renders as.
            if (category === 'symbol') {
                const name = bareName(key);
                const char = mathjaxCharOf(value);
                if (char && isCommandKey(name) && !unicodeByName.has(name)) {
                    unicodeByName.set(name, char);
                }
            }
        }
    }

    return [...byName.entries()]
        .map(([name, category]): RawCommand => {
            const unicode = unicodeByName.get(name);
            return unicode
                ? { name, category, unicode }
                : { name, category };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Documentation metadata
// ---------------------------------------------------------------------------

/** One entry of a `scripts/data/<backend>-docs.json` reference-metadata file. */
interface CommandDoc {
    /** Usage signature, e.g. `\sqrt[degree]{radicand}` (args-taking only). */
    signature?: string;
    /** The providing package/extension, or KaTeX support-table section. */
    package?: string;
    /** A one-line description of the command. */
    description?: string;
}

/**
 * Loads a backend's documentation-metadata file
 * (`scripts/data/<backend>-docs.json`) — a map of bare command name to
 * {@link CommandDoc}, curated from that engine's reference docs.
 *
 * Returns an empty map when the file is absent, so the generator still runs;
 * the commands simply carry no documentation metadata.
 *
 * @param backend - `'katex'` or `'mathjax'`.
 */
function loadDocs(backend: 'katex' | 'mathjax'): Record<string, CommandDoc> {
    const path = join(SCRIPT_DIR, 'data', `${backend}-docs.json`);
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as Record<
            string,
            CommandDoc
        >;
    } catch {
        process.stderr.write(
            `  (no ${backend}-docs.json — skipping doc metadata for ${backend})\n`,
        );
        return {};
    }
}

/**
 * Fetches the Unicode Character Database's `UnicodeData.txt` and builds a
 * code-point → standard-name map (names lower-cased).
 *
 * Best-effort: on any failure (offline, etc.) an empty map is returned and the
 * generated commands simply carry no `unicodeName`. The names that ARE found
 * are baked into the generated file, so the published package never fetches.
 */
async function fetchUnicodeNames(): Promise<Map<number, string>> {
    const url = 'https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt';
    const names = new Map<number, string>();
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
        const text = await response.text();
        for (const line of text.split('\n')) {
            if (!line) continue;
            const fields = line.split(';');
            const codePoint = Number.parseInt(fields[0] ?? '', 16);
            const name = fields[1] ?? '';
            // Names in angle brackets (`<control>`, `<CJK Ideograph, First>`)
            // are range/label placeholders, not real character names.
            if (Number.isNaN(codePoint) || !name || name.startsWith('<')) {
                continue;
            }
            names.set(codePoint, name.toLowerCase());
        }
    } catch (error) {
        process.stderr.write(
            `  (could not fetch Unicode names: ${String(error)})\n`,
        );
    }
    return names;
}

/**
 * Enriches a bare command list with documentation metadata and Unicode names.
 *
 * @param commands - The extracted commands (`name`, `category`, maybe
 * `unicode`).
 * @param unicodeNames - Code-point → name map from {@link fetchUnicodeNames}.
 * @param docs - The backend's {@link CommandDoc} map from {@link loadDocs}.
 * @returns The same commands with `unicodeName` / `signature` / `package` /
 * `description` filled in where data was available.
 */
function enrich(
    commands: RawCommand[],
    unicodeNames: Map<number, string>,
    docs: Record<string, CommandDoc>,
): RawCommand[] {
    return commands.map((command): RawCommand => {
        const enriched: RawCommand = { ...command };
        if (command.unicode) {
            const codePoint = command.unicode.codePointAt(0);
            const name =
                codePoint === undefined
                    ? undefined
                    : unicodeNames.get(codePoint);
            if (name) enriched.unicodeName = name;
        }
        const doc = docs[command.name];
        if (doc) {
            if (doc.signature) enriched.signature = doc.signature;
            if (doc.package) enriched.package = doc.package;
            if (doc.description) enriched.description = doc.description;
        }
        return enriched;
    });
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

/** Serialises a command list as a TypeScript array literal. */
function serialiseList(commands: RawCommand[]): string {
    const field = (key: string, value: string | undefined): string =>
        value === undefined ? '' : `, ${key}: ${JSON.stringify(value)}`;
    return commands
        .map(
            (c) =>
                `    { name: ${JSON.stringify(c.name)}` +
                `, category: ${JSON.stringify(c.category)}` +
                field('signature', c.signature) +
                field('unicode', c.unicode) +
                field('unicodeName', c.unicodeName) +
                field('package', c.package) +
                field('description', c.description) +
                ' },',
        )
        .join('\n');
}

/** Generates the `commands.generated.ts` module and writes it to disk. */
async function main(): Promise<void> {
    const unicodeNames = await fetchUnicodeNames();
    const katex = enrich(
        await extractKatex(),
        unicodeNames,
        loadDocs('katex'),
    );
    const mathjax = enrich(
        await extractMathjax(),
        unicodeNames,
        loadDocs('mathjax'),
    );

    const header = [
        '// File description: GENERATED FILE — do not edit by hand.',
        '//',
        '// The per-backend TeX command lists below are extracted directly from the',
        '// `katex` and `@mathjax/src` package sources by `scripts/generate-commands.ts`,',
        '// then enriched with documentation metadata and Unicode names.',
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

    // Enriched entries are long; let Prettier wrap them with the repo's own
    // config so the generated file is committable as-is — no manual reformat.
    const formatted = await format(header, {
        ...(await resolveConfig(OUTPUT)),
        parser: 'typescript',
    });
    writeFileSync(OUTPUT, formatted, 'utf8');
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
