/**
 * generate.ts
 *
 * Generates one isolated SvelteKit project directory per backend combo under
 * tests/e2e/projects/<combo-id>/.
 *
 * Run with:
 *   node --import tsx/esm generate.ts
 * or via the npm script:
 *   pnpm generate-projects
 *
 * What each generated project contains:
 *   sveltex.config.js   — auto-generated, single preprocessor for this combo
 *   svelte.config.js    — auto-generated, imports the above
 *   vite.config.js      — auto-generated, unique preview port
 *   package.json        — symlink → _template/package.json (shared deps)
 *   tsconfig.json       — symlink → _template/tsconfig.json
 *   node_modules        — symlink → _template/node_modules (shared install)
 *   .npmrc              — symlink → _template/.npmrc
 *   src/app.html        — symlink → _template/src/app.html
 *   src/app.d.ts        — symlink → _template/src/app.d.ts
 *   src/lib             — symlink → _template/src/lib
 *   static/app.css      — symlink → _template/static/app.css
 *   static/favicon.png  — symlink → _template/static/favicon.png
 *   src/routes/         — generated: one +page.<ext> per pages/*.md file
 *   src/routes/+page.svelte — generated: index listing all routes
 */

import {
    backendCombos,
    comboId,
    comboExtension,
    comboPort,
    parseMathBackendKey,
    pageIncludedForCombo,
    type BackendCombo,
} from './backends.js';

import { globSync } from 'glob';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Paths ────────────────────────────────────────────────────────────────────

const E2E_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(E2E_DIR, '_template');
const PROJECTS_DIR = join(E2E_DIR, 'projects');
const PAGES_DIR = join(E2E_DIR, 'pages');

// ─── Main ─────────────────────────────────────────────────────────────────────

const combos = backendCombos();

// Wipe and recreate the output directory so stale combos don't linger.
rmSync(PROJECTS_DIR, { recursive: true, force: true });
mkdirSync(PROJECTS_DIR, { recursive: true });

// Collect all markdown page source files (relative to PAGES_DIR).
const allPagePaths = globSync('**/*.md', { cwd: PAGES_DIR, absolute: false }).sort();

for (const [index, combo] of combos.entries()) {
    generateProject(combo, index, allPagePaths);
}

console.log(`[generate] Done — ${combos.length} projects written to ${PROJECTS_DIR}`);

// ─── Per-project generator ────────────────────────────────────────────────────

function generateProject(combo: BackendCombo, index: number, allPagePaths: string[]): void {
    const id = comboId(combo);
    const port = comboPort(index);
    const ext = comboExtension(combo);
    const projectDir = join(PROJECTS_DIR, id);

    // ── Directories we own (we write files into them) ──────────────────────
    mkdirSync(join(projectDir, 'src', 'routes'), { recursive: true });
    mkdirSync(join(projectDir, 'static'), { recursive: true });

    // ── Symlinks to shared _template files ─────────────────────────────────
    link(join(TEMPLATE_DIR, 'package.json'), join(projectDir, 'package.json'));
    link(join(TEMPLATE_DIR, 'tsconfig.json'), join(projectDir, 'tsconfig.json'));
    link(join(TEMPLATE_DIR, '.npmrc'), join(projectDir, '.npmrc'));
    link(join(TEMPLATE_DIR, 'node_modules'), join(projectDir, 'node_modules'));
    link(join(TEMPLATE_DIR, 'src', 'app.html'), join(projectDir, 'src', 'app.html'));
    link(join(TEMPLATE_DIR, 'src', 'app.d.ts'), join(projectDir, 'src', 'app.d.ts'));
    // Symlink the whole lib directory (we never write generated files there).
    link(join(TEMPLATE_DIR, 'src', 'lib'), join(projectDir, 'src', 'lib'));
    link(join(TEMPLATE_DIR, 'static', 'app.css'), join(projectDir, 'static', 'app.css'));
    link(join(TEMPLATE_DIR, 'static', 'favicon.png'), join(projectDir, 'static', 'favicon.png'));

    // ── Generated config files ──────────────────────────────────────────────
    writeSveltexConfig(projectDir, combo, ext);
    writeSvelteConfig(projectDir, ext);
    writeViteConfig(projectDir, port);

    // ── Generated routes ────────────────────────────────────────────────────
    writeRoutes(projectDir, combo, ext, allPagePaths);

    console.log(`[generate] ${id.padEnd(50)} port ${port}`);
}

// ─── Config writers ───────────────────────────────────────────────────────────

function writeSveltexConfig(projectDir: string, combo: BackendCombo, ext: string): void {
    const [md, code, mathKey] = combo;
    const id = comboId(combo);
    const math = parseMathBackendKey(mathKey);

    // Build the math options object literal (as source text).
    const mathOptions =
        math.engine === 'mathjax'
            ? `{ outputFormat: '${math.outputFormat}', font: '${math.font}' }`
            : `{}`;

    // Build the code options object literal (as source text).
    const codeOptions =
        code === 'starry-night'
            ? `{ languages: 'all' }`
            : code === 'shiki'
              ? `{ shiki: { theme: 'github-dark-default' } }`
              : `{}`;

    writeFileSync(
        join(projectDir, 'sveltex.config.js'),
        `\
// Auto-generated by generate.ts — do not edit.
// Combo: ${id}
import { sveltex } from '@nvl/sveltex';

export const preprocessor = await sveltex(
    {
        markdownBackend: '${md}',
        codeBackend: '${code}',
        mathBackend: '${math.engine}',
    },
    {
        tex: {
            caching: {
                enabled: false,
                cacheDirectory: 'node_modules/.cache/@nvl/sveltex/${id}',
            },
        },
        extensions: ['.${ext}'],
        verbatim: {
            Verb: { type: 'escape', component: 'p' },
            tex: {
                type: 'tex',
                aliases: ['tikz', 'TikZ', 'TeX'],
                preamble: [
                    '\\\\usepackage{mathtools}',
                    '\\\\usepackage{amsmath}',
                    '\\\\usepackage{microtype}',
                    '\\\\usepackage{tikz}',
                ].join('\\n'),
            },
        },
        math: ${mathOptions},
        code: ${codeOptions},
    },
);
`,
    );
}

function writeSvelteConfig(projectDir: string, ext: string): void {
    writeFileSync(
        join(projectDir, 'svelte.config.js'),
        `\
// Auto-generated by generate.ts — do not edit.
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { preprocessor } from './sveltex.config.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: [vitePreprocess(), preprocessor],
    extensions: ['.svelte', '.${ext}'],
    onwarn: (warning, defaultHandler) => {
        if (warning.code === 'a11y-no-noninteractive-tabindex') return;
        defaultHandler(warning);
    },
    kit: {
        adapter: adapter({ fallback: '404.html' }),
    },
};

export default config;
`,
    );
}

function writeViteConfig(projectDir: string, port: number): void {
    writeFileSync(
        join(projectDir, 'vite.config.js'),
        `\
// Auto-generated by generate.ts — do not edit.
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [sveltekit()],
    preview: { port: ${port}, strictPort: true },
    server:  { port: ${port + 1000}, strictPort: false },
});
`,
    );
}

// ─── Route writer ─────────────────────────────────────────────────────────────

function writeRoutes(
    projectDir: string,
    combo: BackendCombo,
    ext: string,
    allPagePaths: string[],
): void {
    const routesDir = join(projectDir, 'src', 'routes');
    const id = comboId(combo);
    const includedHrefs: string[] = [];

    for (const pageRelPath of allPagePaths) {
        if (!pageIncludedForCombo(pageRelPath, combo)) continue;

        // "math/basic.md"  →  "math/basic"
        const routeSegment = pageRelPath.replace(/\.md$/, '');
        const routeDir = join(routesDir, routeSegment);
        mkdirSync(routeDir, { recursive: true });

        // Write the page file (replacing @@@ placeholders with the combo id).
        const raw = readFileSync(join(PAGES_DIR, pageRelPath), 'utf-8');
        const content = raw.replace(/@@@/g, id);
        writeFileSync(join(routeDir, `+page.${ext}`), content);

        includedHrefs.push('/' + routeSegment);
    }

    // Generate a simple index page that links to every route in this project.
    const indexContent = [
        '<nav>',
        '<ul>',
        ...includedHrefs
            .sort()
            .map((href) => `<li><a href="${href}"><code>${href}</code></a></li>`),
        '</ul>',
        '</nav>\n',
    ].join('\n');

    writeFileSync(join(routesDir, '+page.svelte'), indexContent);
}

// ─── Symlink helper ───────────────────────────────────────────────────────────

/**
 * Creates a relative symlink at `dest` pointing to `src`.
 * Skips silently if `dest` already exists (idempotent).
 */
function link(src: string, dest: string): void {
    if (existsSync(dest)) return;
    const rel = relative(dirname(dest), src);
    symlinkSync(rel, dest);
}
