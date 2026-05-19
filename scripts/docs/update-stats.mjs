// scripts/docs/update-stats.mjs
//
// Recomputes the project-stat figures quoted in `docs/src/docs/index.md` —
// lines of code, the Vitest unit-test count, and the Playwright E2E snapshot
// count — and rewrites them in place.
//
// Run on every change to the `@nvl/sveltex` package by the `docs-stats`
// workflow, which commits the result only when a *rounded* figure actually
// changed; the docs site is therefore redeployed only when a quoted number
// moves.
//
// Rounding keeps the prose honest as the real numbers drift:
//   - test/snapshot counts -> rounded DOWN to the nearest 100, quoted as "N+"
//   - lines of code        -> rounded UP to the nearest 1000, quoted as
//                             "just under N"

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

/** Run a command from the repository root and return its stdout. */
function run(command, args) {
    return execFileSync(command, args, {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
}

/** Parse JSON that may be preceded by an unrelated line of tool output. */
function parseJson(output, opener) {
    return JSON.parse(output.slice(output.indexOf(opener)));
}

// --- Lines of code -------------------------------------------------------
// `cloc`'s `code` tally for `packages/sveltex/src` (excluding `src/data`),
// summed over every language except Markdown. `code` already excludes
// comments and blank lines — matching the footnote in `index.md`.
const cloc = parseJson(
    run('cloc', ['packages/sveltex/src', '--exclude-dir=data', '--json']),
    '{',
);
const linesOfCode = Object.entries(cloc)
    .filter(([language]) => !['header', 'SUM', 'Markdown'].includes(language))
    .reduce((total, [, stats]) => total + stats.code, 0);

// --- Unit tests ----------------------------------------------------------
// Every Vitest test case in `@nvl/sveltex`, collected (`vitest list`) rather
// than run, so this stays fast.
const unitTests = parseJson(
    run('pnpm', [
        '--filter',
        '@nvl/sveltex',
        'exec',
        'vitest',
        'list',
        '--json',
    ]),
    '[',
).length;

// --- E2E snapshots -------------------------------------------------------
// Every committed Playwright screenshot under `tests/e2e/snapshots`.
const e2eSnapshots = run('git', [
    'ls-files',
    '--',
    'packages/sveltex/tests/e2e/snapshots',
])
    .split('\n')
    .filter((file) => file.endsWith('.png')).length;

// --- Round & format ------------------------------------------------------
const roundDown = (n, step) => Math.floor(n / step) * step;
const roundUp = (n, step) => Math.ceil(n / step) * step;
const format = (n) => n.toLocaleString('en-US');

const locFigure = format(roundUp(linesOfCode, 1000));
const testFigure = format(roundDown(unitTests, 100));
const snapshotFigure = format(roundDown(e2eSnapshots, 100));

// --- Rewrite the docs ----------------------------------------------------
const indexPath = join(repoRoot, 'docs/src/docs/index.md');

/** Apply one replacement, failing loudly if the pattern is no longer there. */
function rewrite(source, pattern, replacement, label) {
    if (!pattern.test(source)) {
        throw new Error(
            `Could not find the ${label} figure in docs/src/docs/index.md — ` +
                `the wording probably changed; update this script's pattern.`,
        );
    }
    return source.replace(pattern, replacement);
}

let markdown = readFileSync(indexPath, 'utf8');
markdown = rewrite(
    markdown,
    /At just (?:north of|under) [\d,]+ lines of code/u,
    `At just under ${locFigure} lines of code`,
    'lines-of-code',
);
markdown = rewrite(
    markdown,
    /[\d,]+\+ unit tests/u,
    `${testFigure}+ unit tests`,
    'unit-test',
);
markdown = rewrite(
    markdown,
    /\([\d,]+\+ snapshots\)/u,
    `(${snapshotFigure}+ snapshots)`,
    'snapshot',
);
writeFileSync(indexPath, markdown);

console.log(
    `lines of code: ${linesOfCode} -> just under ${locFigure}\n` +
        `unit tests:    ${unitTests} -> ${testFigure}+\n` +
        `E2E snapshots: ${e2eSnapshots} -> ${snapshotFigure}+`,
);
