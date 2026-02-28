/**
 * build-projects.ts
 *
 * Builds every generated per-combo SvelteKit project in parallel (using
 * `vite build` inside each project directory).
 *
 * Each project is a fully self-contained SvelteKit app whose node_modules is
 * a symlink to `tests/e2e/_template/node_modules`, so there is no per-project
 * install step — only the build.
 *
 * Concurrency is capped to avoid OOM / CPU saturation:
 *   - Default: number of logical CPUs (one vite build per core).
 *   - Override: set the E2E_BUILD_CONCURRENCY env var.
 *
 * Exit code mirrors the worst exit code seen across all builds so CI fails
 * correctly if any project fails.
 *
 * Usage:
 *   node --import tsx/esm tests/e2e/build-projects.ts
 * or via the npm script:
 *   pnpm test:e2e:build
 */

import { backendCombos, comboId } from './backends.js';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

// ─── Paths ────────────────────────────────────────────────────────────────────

const E2E_DIR = join(fileURLToPath(import.meta.url), '..');
const PROJECTS_DIR = join(E2E_DIR, 'projects');

// ─── Concurrency ──────────────────────────────────────────────────────────────

const DEFAULT_CONCURRENCY = os.availableParallelism?.() ?? os.cpus().length ?? 4;
const CONCURRENCY = (() => {
    const env = process.env['E2E_BUILD_CONCURRENCY'];
    if (!env) return DEFAULT_CONCURRENCY;
    const n = parseInt(env, 10);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_CONCURRENCY;
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface BuildResult {
    id: string;
    exitCode: number;
    durationMs: number;
    stdout: string;
    stderr: string;
}

/**
 * Runs `vite build` inside `projectDir` and resolves with the result.
 * Never rejects — failures are captured in `exitCode`.
 */
function buildProject(id: string, projectDir: string): Promise<BuildResult> {
    return new Promise((resolve) => {
        const start = Date.now();
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        const child = spawn('pnpm', ['exec', 'vite', 'build'], {
            cwd: projectDir,
            // Inherit the parent's environment so that PATH, NODE_ENV, etc. are
            // available; but suppress interactive TTY features.
            env: { ...process.env, FORCE_COLOR: '0' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
        child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

        child.on('close', (code) => {
            resolve({
                id,
                exitCode: code ?? 1,
                durationMs: Date.now() - start,
                stdout: Buffer.concat(stdoutChunks).toString('utf-8').trim(),
                stderr: Buffer.concat(stderrChunks).toString('utf-8').trim(),
            });
        });

        child.on('error', (err) => {
            resolve({
                id,
                exitCode: 1,
                durationMs: Date.now() - start,
                stdout: '',
                stderr: err.message,
            });
        });
    });
}

// ─── Worker pool ──────────────────────────────────────────────────────────────

/**
 * Runs `tasks` with at most `concurrency` in-flight at any time.
 * Returns results in the same order as `tasks`.
 */
async function runWithConcurrency<T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number,
): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let nextIndex = 0;

    async function worker(): Promise<void> {
        while (nextIndex < tasks.length) {
            const index = nextIndex++;
            const task = tasks[index];
            if (!task) continue;
            results[index] = await task();
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const combos = backendCombos();

// Validate that all project directories exist before trying to build them.
const missing = combos
    .map(comboId)
    .filter((id) => !existsSync(join(PROJECTS_DIR, id)));

if (missing.length > 0) {
    console.error(
        `[build-projects] ERROR: The following project directories are missing:\n` +
            missing.map((id) => `  ${join(PROJECTS_DIR, id)}`).join('\n') +
            `\n\nRun 'pnpm generate-projects' first.`,
    );
    process.exit(1);
}

const total = combos.length;
console.log(
    `[build-projects] Building ${total} projects with concurrency=${CONCURRENCY} …`,
);

const buildStart = Date.now();
let completed = 0;
let failures = 0;

const tasks = combos.map((combo) => {
    const id = comboId(combo);
    const projectDir = join(PROJECTS_DIR, id);
    return () =>
        buildProject(id, projectDir).then((result) => {
            completed++;
            const status = result.exitCode === 0 ? '✓' : '✗';
            const duration = (result.durationMs / 1000).toFixed(1) + 's';
            const progress = `[${String(completed).padStart(String(total).length)}/${total}]`;

            if (result.exitCode === 0) {
                console.log(`${progress} ${status} ${id.padEnd(52)} ${duration}`);
            } else {
                failures++;
                console.error(`${progress} ${status} ${id.padEnd(52)} ${duration} (EXIT ${result.exitCode})`);
                if (result.stderr) {
                    // Indent stderr for readability.
                    const indented = result.stderr
                        .split('\n')
                        .map((line) => `    ${line}`)
                        .join('\n');
                    console.error(indented);
                }
            }
            return result;
        });
});

const results = await runWithConcurrency(tasks, CONCURRENCY);

const totalDuration = ((Date.now() - buildStart) / 1000).toFixed(1);
const succeeded = results.filter((r) => r.exitCode === 0).length;

console.log('');
console.log(
    `[build-projects] Done in ${totalDuration}s — ` +
        `${succeeded}/${total} succeeded` +
        (failures > 0 ? `, ${failures} FAILED` : ''),
);

if (failures > 0) {
    process.exit(1);
}
