// File description: The TeX-command model plus the per-backend lookup API.
//
// `@nvl/sveltex-math-language-server` answers completion and hover requests for
// TeX math written in SvelTeX `$...$` / `$$...$$` regions. The set of commands
// it offers must be EXACTLY what the selected backend understands — KaTeX and
// MathJax support overlapping but distinct sets. The raw lists are extracted
// from each backend's own package source by `scripts/generate-commands.ts`
// (see `../data/commands.generated.ts`); this module turns those flat lists
// into an indexed `CommandTable` for fast prefix and exact lookup.

import {
    KATEX_COMMANDS,
    MATHJAX_COMMANDS,
} from '../data/commands.generated.js';

/**
 * The category a TeX command falls into.
 *
 * - `function`: a command that consumes arguments (`\frac`, `\sqrt`, `\text`).
 * - `symbol`: a no-argument command standing for a glyph (`\alpha`, `\sum`).
 * - `macro`: a command defined in terms of others (`\TeX`, `\operatorname`).
 * - `environment`: a name used with `\begin{...}` / `\end{...}` (`align`,
 *   `matrix`). Completing `\begin{` offers these.
 */
export type CommandCategory = 'function' | 'symbol' | 'macro' | 'environment';

/**
 * One TeX command supported by a backend.
 *
 * @remarks
 * `name` never includes the leading backslash — it is the bare control word
 * (e.g. `frac`). The backslash is added by the completion/hover layer so the
 * data is uniform regardless of how the user typed the trigger.
 */
export interface MathCommand {
    /** The command name without its leading backslash (e.g. `frac`). */
    name: string;
    /** Which {@link CommandCategory} the command belongs to. */
    category: CommandCategory;
}

/** The math backends this server can emulate. */
export type MathLspBackend = 'katex' | 'mathjax';

/**
 * An indexed, queryable view of one backend's command set.
 *
 * Built once per backend by {@link createCommandTable} and cached, so repeated
 * completion requests do no repeated work.
 */
export class CommandTable {
    /** All commands, sorted by name — the basis for completion lists. */
    readonly #all: readonly MathCommand[];
    /** Exact-name index, for hover. */
    readonly #byName: ReadonlyMap<string, MathCommand>;
    /** Only the `environment` commands, for `\begin{...}` completion. */
    readonly #environments: readonly MathCommand[];
    /** Every command that is NOT an environment, for `\command` completion. */
    readonly #nonEnvironments: readonly MathCommand[];

    private constructor(commands: readonly MathCommand[]) {
        const sorted = [...commands].sort((a, b) =>
            a.name.localeCompare(b.name),
        );
        this.#all = sorted;
        this.#byName = new Map(sorted.map((c) => [c.name, c]));
        this.#environments = sorted.filter((c) => c.category === 'environment');
        this.#nonEnvironments = sorted.filter(
            (c) => c.category !== 'environment',
        );
    }

    /**
     * Builds a {@link CommandTable} from a raw command list.
     *
     * @param commands - The backend's commands (typically one of the generated
     * arrays). Order does not matter; the table sorts internally.
     */
    public static create(commands: readonly MathCommand[]): CommandTable {
        return new CommandTable(commands);
    }

    /** The total number of commands in the table. */
    public get size(): number {
        return this.#all.length;
    }

    /** Every command in the table, sorted by name. */
    public get all(): readonly MathCommand[] {
        return this.#all;
    }

    /**
     * Looks a command up by its exact (backslash-free) name.
     *
     * @param name - The bare command name, e.g. `frac`.
     * @returns The command, or `undefined` if the backend does not support it.
     */
    public get(name: string): MathCommand | undefined {
        return this.#byName.get(name);
    }

    /**
     * Returns the commands whose name starts with `prefix`.
     *
     * @param prefix - A bare (backslash-free) prefix. An empty prefix matches
     * every command.
     * @param environmentsOnly - When `true`, only `environment` commands are
     * considered (for `\begin{...}` completion); when `false`, environments are
     * excluded (for ordinary `\command` completion).
     * @returns The matching commands, sorted by name.
     */
    public withPrefix(
        prefix: string,
        environmentsOnly: boolean,
    ): readonly MathCommand[] {
        const pool = environmentsOnly
            ? this.#environments
            : this.#nonEnvironments;
        if (prefix.length === 0) return pool;
        // Case-sensitive: TeX commands are case-sensitive (`\Pi` ≠ `\pi`).
        return pool.filter((c) => c.name.startsWith(prefix));
    }
}

/** Lazily-built, cached {@link CommandTable}s keyed by backend. */
const tableCache = new Map<MathLspBackend, CommandTable>();

/**
 * Returns the {@link CommandTable} for a backend, building it on first use.
 *
 * @param backend - `'katex'` or `'mathjax'`.
 * @returns The backend's command table.
 */
export function createCommandTable(backend: MathLspBackend): CommandTable {
    const cached = tableCache.get(backend);
    if (cached) return cached;
    const table = CommandTable.create(
        backend === 'katex' ? KATEX_COMMANDS : MATHJAX_COMMANDS,
    );
    tableCache.set(backend, table);
    return table;
}
