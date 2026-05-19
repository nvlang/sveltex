// scripts/docs/update-stats.mjs
//
// Recomputes the project-stat figures quoted in `docs/src/docs/index.md` —
// lines of code, lines of comments, the Vitest unit-test count and the
// Playwright E2E snapshot count — and rewrites them in place.
//
// The `Deploy docs` workflow runs this at build time, so the published site
// always quotes current figures. Nothing is committed back to the repository;
// the `docs-stats` workflow runs this only to decide whether a figure moved
// (and a redeploy is therefore due).
//
//   - stdout: a single `figures=<loc>-<comments>-<tests>-<snapshots>` line,
//     consumed by the `docs-stats` workflow via `$GITHUB_OUTPUT`.
//   - stderr: a human-readable summary.
//
// Rounding keeps the prose honest as the real numbers drift:
//   - test / snapshot counts -> rounded DOWN to the nearest 100  ("N+")
//   - lines of comments      -> rounded DOWN to the nearest 1000 ("N+")
//   - lines of code          -> rounded UP to the nearest 1000   ("just
//                               under N")

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Run a command from the repository root and return its stdout. The child's
 * own stdout is captured (never leaked to ours, which must carry only the
 * `figures=` line); its stderr is passed through for visibility.
 */
function run(command, args) {
    return execFileSync(command, args, {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'inherit'],
    });
}

/** Parse JSON that may be preceded by an unrelated line of tool output. */
function parseJson(output, opener) {
    return JSON.parse(output.slice(output.indexOf(opener)));
}

// --- Count ---------------------------------------------------------------

// `cloc`'s `code` and `comment` tallies for `packages/sveltex/src` (excluding
// `src/data`), summed over every language except Markdown — matching the
// footnote in `index.md`.
const cloc = parseJson(
    run('cloc', ['packages/sveltex/src', '--exclude-dir=data', '--json']),
    '{',
);
const sumExceptMarkdown = (field) =>
    Object.entries(cloc)
        .filter(([lang]) => !['header', 'SUM', 'Markdown'].includes(lang))
        .reduce((total, [, stats]) => total + stats[field], 0);
const linesOfCode = sumExceptMarkdown('code');
const linesOfComments = sumExceptMarkdown('comment');

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

// Every committed Playwright screenshot under `tests/e2e/snapshots`.
const e2eSnapshots = run('git', [
    'ls-files',
    '--',
    'packages/sveltex/tests/e2e/snapshots',
])
    .split('\n')
    .filter((file) => file.endsWith('.png')).length;

// --- Round ---------------------------------------------------------------

const roundDown = (n, step) => Math.floor(n / step) * step;
const roundUp = (n, step) => Math.ceil(n / step) * step;

const rounded = {
    linesOfCode: roundUp(linesOfCode, 1000),
    linesOfComments: roundDown(linesOfComments, 1000),
    unitTests: roundDown(unitTests, 100),
    e2eSnapshots: roundDown(e2eSnapshots, 100),
};

// --- Rewrite `index.md` --------------------------------------------------

const format = (n) => n.toLocaleString('en-US');
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
    `At just under ${format(rounded.linesOfCode)} lines of code`,
    'lines-of-code',
);
markdown = rewrite(
    markdown,
    /[\d,]+\+ lines of comments/u,
    `${format(rounded.linesOfComments)}+ lines of comments`,
    'lines-of-comments',
);
markdown = rewrite(
    markdown,
    /[\d,]+\+ unit tests/u,
    `${format(rounded.unitTests)}+ unit tests`,
    'unit-test',
);
markdown = rewrite(
    markdown,
    /\([\d,]+\+ snapshots\)/u,
    `(${format(rounded.e2eSnapshots)}+ snapshots)`,
    'snapshot',
);
writeFileSync(indexPath, markdown);

// --- Report --------------------------------------------------------------

// stdout: one machine-readable line for `$GITHUB_OUTPUT`. It must be the only
// thing this script writes to stdout.
console.log(
    `figures=${rounded.linesOfCode}-${rounded.linesOfComments}-` +
        `${rounded.unitTests}-${rounded.e2eSnapshots}`,
);
// stderr: the human-readable summary.
console.error(
    `lines of code:     ${linesOfCode} -> just under ${format(rounded.linesOfCode)}\n` +
        `lines of comments: ${linesOfComments} -> ${format(rounded.linesOfComments)}+\n` +
        `unit tests:        ${unitTests} -> ${format(rounded.unitTests)}+\n` +
        `E2E snapshots:     ${e2eSnapshots} -> ${format(rounded.e2eSnapshots)}+`,
);
