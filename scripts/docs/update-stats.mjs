// scripts/docs/update-stats.mjs
//
// Substitutes the current project-stat figures into the placeholders in
// `docs/src/docs/index.md`:
//
//   %LINES_OF_CODE%  %LINES_OF_COMMENTS%  %UNIT_TESTS%  %E2E_SNAPSHOTS%
//
// The committed `index.md` keeps the placeholders — it never holds a number
// that can go stale. The "Deploy docs to GitHub Pages" workflow runs this at
// build time so the published site shows current figures; the `docs-stats`
// workflow runs it to detect when a figure moved.
//
//   - stdout: a single `figures=<loc>-<comments>-<tests>-<snapshots>` line.
//   - stderr: a human-readable summary.
//
// Rounding keeps the prose honest as the real numbers drift:
//   - test / snapshot counts -> rounded DOWN to the nearest 100  ("N+")
//   - lines of comments      -> rounded DOWN to the nearest 1000 ("N+")
//   - lines of code          -> rounded UP to the nearest 1000   ("just
//                               under N")
//
// Once SvelTeX's core grows past SMALL_CODEBASE_MAX_LOC lines of code it is
// no longer a "small codebase", so that feature card and its footnote are
// dropped from the page entirely. The threshold may be overridden with the
// `SMALL_CODEBASE_MAX_LOC` environment variable.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const indexPath = join(repoRoot, 'docs/src/docs/index.md');
const SMALL_CODEBASE_MAX_LOC = Number(
    process.env.SMALL_CODEBASE_MAX_LOC ?? 20000,
);

/**
 * Run a command from the repository root and return its stdout. The child's
 * stdout is captured (never leaked to ours, which carries only the `figures=`
 * line); its stderr is passed through for visibility.
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

// Every Vitest test case in `@nvl/sveltex`, collected rather than run.
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
const format = (n) => n.toLocaleString('en-US');

// --- Rewrite `index.md` --------------------------------------------------

let markdown = readFileSync(indexPath, 'utf8');

/** Replace every occurrence of a placeholder, failing loudly if it is gone. */
function substitute(placeholder, value) {
    if (!markdown.includes(placeholder)) {
        throw new Error(
            `Placeholder ${placeholder} is missing from docs/src/docs/index.md.`,
        );
    }
    markdown = markdown.replaceAll(placeholder, value);
}

/** Delete a block matched by `pattern`, failing loudly if it is not found. */
function deleteBlock(pattern, label) {
    if (!pattern.test(markdown)) {
        throw new Error(
            `Could not find the ${label} in docs/src/docs/index.md.`,
        );
    }
    markdown = markdown.replace(pattern, '');
}

if (linesOfCode > SMALL_CODEBASE_MAX_LOC) {
    // No longer a "small codebase" — drop that feature card, its footnote
    // (which held `%LINES_OF_CODE%`) and its now-unused icon import.
    deleteBlock(
        /^-   <PhFeather\b[\s\S]*?\n\n(?=-   <Ph|<\/div>)/mu,
        'small-codebase feature card',
    );
    deleteBlock(/^\[\^1\]:\n[\s\S]*?\n\n/mu, 'small-codebase footnote');
    deleteBlock(/, PhFeather|PhFeather, /u, 'PhFeather icon import');
} else {
    substitute('%LINES_OF_CODE%', format(rounded.linesOfCode));
}
substitute('%LINES_OF_COMMENTS%', format(rounded.linesOfComments));
substitute('%UNIT_TESTS%', format(rounded.unitTests));
substitute('%E2E_SNAPSHOTS%', format(rounded.e2eSnapshots));

writeFileSync(indexPath, markdown);

// --- Report --------------------------------------------------------------

// stdout: one machine-readable line, consumed by the `docs-stats` workflow.
console.log(
    `figures=${rounded.linesOfCode}-${rounded.linesOfComments}-` +
        `${rounded.unitTests}-${rounded.e2eSnapshots}`,
);
// stderr: the human-readable summary.
const codebaseNote =
    linesOfCode > SMALL_CODEBASE_MAX_LOC
        ? ` (over ${format(SMALL_CODEBASE_MAX_LOC)} — "small codebase" card dropped)`
        : '';
console.error(
    `lines of code:     ${linesOfCode} -> just under ${format(rounded.linesOfCode)}${codebaseNote}\n` +
        `lines of comments: ${linesOfComments} -> ${format(rounded.linesOfComments)}+\n` +
        `unit tests:        ${unitTests} -> ${format(rounded.unitTests)}+\n` +
        `E2E snapshots:     ${e2eSnapshots} -> ${format(rounded.e2eSnapshots)}+`,
);
