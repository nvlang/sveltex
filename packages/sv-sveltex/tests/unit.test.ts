import { describe, expect, it, vi, afterEach } from 'vitest';
import addon from '../src/index.js';

/**
 * Unit tests that drive the add-on's `setup`/`run`/`nextSteps` hooks directly,
 * with a fake `sv` API and a tiny in-memory file system. The real
 * `@sveltejs/sv-utils` `transforms` are used (not mocked), so the AST-rewriting
 * branches in `run` are exercised authentically against real config strings.
 *
 * The end-to-end `addon.test.ts` already proves the add-on works through the
 * actual `sv` CLI and a real `pnpm install`; these tests exist purely to lock
 * every branch of `src/index.ts` at 100% coverage without the cost of a real
 * scaffold.
 */

type RunHook = NonNullable<(typeof addon)['run']>;
type RunArg = Parameters<RunHook>[0];
type SetupHook = NonNullable<(typeof addon)['setup']>;
type SetupArg = Parameters<SetupHook>[0];
type NextStepsHook = NonNullable<(typeof addon)['nextSteps']>;
type Options = RunArg['options'];

/** A minimal stand-in for the `sv` workspace API used by `run`. */
interface FakeSv {
    files: Map<string, string>;
    devDeps: Record<string, string>;
    sv: RunArg['sv'];
}

/**
 * Build a fake `sv` API backed by an in-memory file map. `sv.file(path, edit)`
 * mirrors the real engine: it feeds the current content (`''` when the file
 * doesn't yet exist) through the curried transform and stores the result,
 * unless the transform returns `false` (abort) — in which case the original
 * content is kept.
 *
 * @param seed - initial file contents, keyed by path.
 */
function makeSv(seed: Record<string, string> = {}): FakeSv {
    const files = new Map<string, string>(Object.entries(seed));
    const devDeps: Record<string, string> = {};
    const sv = {
        // Unused by the add-on, but part of the API surface.
        pnpmBuildDependency: vi.fn(),
        dependency: vi.fn(),
        execute: vi.fn(),
        devDependency: (pkg: string, version: string) => {
            devDeps[pkg] = version;
        },
        file: (path: string, edit: (content: string) => string | false) => {
            const before = files.get(path) ?? '';
            const after = edit(before);
            if (after !== false) files.set(path, after);
        },
    } as unknown as RunArg['sv'];
    return { files, devDeps, sv };
}

/** Default backend selections (the add-on's recommended defaults). */
function defaultOptions(overrides: Partial<Options> = {}): Options {
    return {
        markdownBackend: 'unified',
        codeBackend: 'shiki',
        mathBackend: 'mathjax',
        demoRoute: true,
        ...overrides,
    };
}

/**
 * Invoke `addon.run` with a fake `sv` and sensible defaults for the rest of the
 * workspace fields the hook reads (`file`, `directory`). Extra seed files and
 * option overrides can be supplied per test.
 */
function runAddon({
    options = {},
    seed = {},
    packageManager = 'pnpm',
}: {
    options?: Partial<Options>;
    seed?: Record<string, string>;
    packageManager?: string;
} = {}): FakeSv {
    const fake = makeSv(seed);
    const arg = {
        sv: fake.sv,
        options: defaultOptions(options),
        cwd: '/project',
        packageManager,
        // Only `file.getRelative`, `file.svelteConfig`, and `file.findUp` are
        // read by `run`.
        file: {
            svelteConfig: 'svelte.config.js',
            getRelative: ({ to }: { from?: string; to: string }) => `./${to}`,
            findUp: (name: string) => name,
        },
        directory: { kitRoutes: 'src/routes' },
    } as unknown as RunArg;
    // `run` is typed as returning `void | Promise<void>`; the fake `sv.file`
    // is synchronous, so all side effects land before this returns.
    void addon.run(arg);
    return fake;
}

/** Read a file the add-on was expected to write, failing if it is absent. */
function readFile(files: Map<string, string>, path: string): string {
    const content = files.get(path);
    if (content === undefined) {
        throw new Error(`expected file to have been written: ${path}`);
    }
    return content;
}

/**
 * Assert that the SvelTeX preprocessor is listed *before* `vitePreprocess` in
 * the generated `preprocess` array. SvelTeX must turn `.sveltex` into valid
 * Svelte before any other markup preprocessor runs. The slice from
 * `preprocess:` skips the `import sveltexPreprocessor …` line at the top.
 */
function expectPreprocessOrder(svelteConfig: string): void {
    const fromPreprocess = svelteConfig.slice(
        svelteConfig.indexOf('preprocess:'),
    );
    const svIdx = fromPreprocess.indexOf('sveltexPreprocessor');
    const viteIdx = fromPreprocess.indexOf('vitePreprocess');
    expect(svIdx).toBeGreaterThanOrEqual(0);
    expect(viteIdx).toBeGreaterThanOrEqual(0);
    expect(svIdx).toBeLessThan(viteIdx);
}

/**
 * Invoke the add-on's (optional) `setup` hook. Throws if the hook is missing so
 * a regression that drops it surfaces as a failure rather than a silent no-op.
 */
function callSetup(
    isKit: boolean,
    unsupported: ReturnType<typeof vi.fn>,
): void {
    const { setup } = addon;
    if (!setup) throw new Error('addon.setup must be defined');
    void setup({ isKit, unsupported } as unknown as SetupArg);
}

/**
 * Invoke the add-on's (optional) `nextSteps` hook. Throws if the hook is
 * missing so a regression that drops it surfaces as a failure rather than
 * passing trivially against an empty array.
 */
function callNextSteps(options: Options): string[] {
    const { nextSteps } = addon;
    if (!nextSteps) throw new Error('addon.nextSteps must be defined');
    return nextSteps({ options } as unknown as Parameters<NextStepsHook>[0]);
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('addon metadata', () => {
    it('declares the expected identity and options', () => {
        expect(addon.id).toBe('sveltex');
        expect(addon.homepage).toBe('https://sveltex.dev');
        expect(addon.shortDescription).toBeTypeOf('string');
        // Every prompted option the tests rely on is present.
        expect(Object.keys(addon.options)).toEqual(
            expect.arrayContaining([
                'markdownBackend',
                'codeBackend',
                'mathBackend',
                'demoRoute',
            ]),
        );
    });
});

describe('setup', () => {
    it('marks the add-on unsupported outside SvelteKit', () => {
        const unsupported = vi.fn();
        callSetup(false, unsupported);
        expect(unsupported).toHaveBeenCalledWith('Requires SvelteKit');
    });

    it('does nothing when the project is SvelteKit', () => {
        const unsupported = vi.fn();
        callSetup(true, unsupported);
        expect(unsupported).not.toHaveBeenCalled();
    });
});

describe('run: dependencies', () => {
    it('adds @nvl/sveltex plus the chosen backend peer deps', () => {
        const { devDeps } = runAddon();
        expect(devDeps['@nvl/sveltex']).toBe('^0.5.0');
        // unified backend
        expect(devDeps['unified']).toBe('^11.0.4');
        expect(devDeps['remark-parse']).toBeDefined();
        // shiki backend
        expect(devDeps['shiki']).toBe('^4.0.0');
        // mathjax backend
        expect(devDeps['@mathjax/src']).toBe('^4.0.0');
    });

    it('pre-approves the core-js-pure build script for pnpm projects', () => {
        const { files } = runAddon({ packageManager: 'pnpm' });
        const workspace = files.get('pnpm-workspace.yaml');
        expect(workspace).toBeDefined();
        expect(workspace).toContain('core-js-pure');
    });

    it('does not touch pnpm-workspace.yaml for non-pnpm projects', () => {
        const { files } = runAddon({ packageManager: 'npm' });
        expect(files.has('pnpm-workspace.yaml')).toBe(false);
    });

    it('adds no backend peer deps when every backend is "none"', () => {
        const { devDeps } = runAddon({
            options: {
                markdownBackend: 'none',
                codeBackend: 'none',
                mathBackend: 'none',
                demoRoute: false,
            },
        });
        // Only @nvl/sveltex itself remains.
        expect(Object.keys(devDeps)).toEqual(['@nvl/sveltex']);
    });

    it('covers the remaining backend branches (starry-night / katex)', () => {
        const { devDeps } = runAddon({
            options: {
                markdownBackend: 'markdown-it',
                codeBackend: 'starry-night',
                mathBackend: 'katex',
            },
        });
        expect(devDeps['markdown-it']).toBeDefined();
        expect(devDeps['@wooorm/starry-night']).toBeDefined();
        expect(devDeps['hast-util-find-and-replace']).toBeDefined();
        expect(devDeps['katex']).toBeDefined();
    });
});

describe('run: sveltex.config.js', () => {
    it('writes a shiki-flavoured config for the default backends', () => {
        const { files } = runAddon();
        const config = readFile(files, 'sveltex.config.js');
        expect(config).toContain("import { sveltex } from '@nvl/sveltex'");
        expect(config).toContain("markdownBackend: 'unified'");
        expect(config).toContain("codeBackend: 'shiki'");
        expect(config).toContain("mathBackend: 'mathjax'");
        // The shiki branch injects concrete themes.
        expect(config).toContain('github-light-default');
        expect(config).toContain('github-dark-default');
    });

    it('leaves the <TeX> verbatim block commented out by default', () => {
        // <TeX> needs a local TeX distribution, so the block ships as
        // commented-out guidance rather than silently enabled.
        const { files } = runAddon();
        const config = readFile(files, 'sveltex.config.js');
        expect(config).toContain('// TeX: {');
        // Not active (no uncommented `TeX: {`).
        expect(config).not.toMatch(/\n\s*TeX: \{/u);
    });

    it('writes the generic code block when the backend is not shiki', () => {
        const { files } = runAddon({
            options: { codeBackend: 'highlight.js' },
        });
        const config = readFile(files, 'sveltex.config.js');
        expect(config).toContain("codeBackend: 'highlight.js'");
        expect(config).toContain('// Code options');
        expect(config).not.toContain('github-light-default');
    });

    it('keeps an existing config and warns on stderr', () => {
        const stderr = vi
            .spyOn(process.stderr, 'write')
            .mockImplementation(() => true);
        const existing = '// my hand-written config\n';
        const { files } = runAddon({ seed: { 'sveltex.config.js': existing } });
        // Untouched.
        expect(files.get('sveltex.config.js')).toBe(existing);
        expect(stderr).toHaveBeenCalledOnce();
        expect(stderr.mock.calls[0]?.[0]).toContain(
            'sveltex.config.js already exists',
        );
    });
});

describe('run: svelte.config.js wiring', () => {
    /** Read the post-run svelte config out of a fake run. */
    function svelteConfigAfter(
        seedConfig: string,
        options: Partial<Options> = {},
    ): string {
        const { files } = runAddon({
            options,
            seed: { 'svelte.config.js': seedConfig },
        });
        return readFile(files, 'svelte.config.js');
    }

    it('adds preprocess + extensions arrays to a bare config', () => {
        const out = svelteConfigAfter('export default {};\n');
        expect(out).toContain('sveltexPreprocessor');
        expect(out).toContain('sveltex.config');
        expect(out).toContain('preprocess');
        expect(out).toContain("'.svelte'");
        expect(out).toContain("'.sveltex'");
    });

    it('prepends to existing array-valued preprocess/extensions', () => {
        const seed = [
            "import vitePreprocess from 'foo';",
            'export default {',
            '\tpreprocess: [vitePreprocess()],',
            "\textensions: ['.svelte'],",
            '};',
            '',
        ].join('\n');
        const out = svelteConfigAfter(seed);
        // Existing entry preserved, SvelTeX inserted *before* it so it runs
        // first (otherwise vitePreprocess chokes on raw LaTeX backslashes).
        expect(out).toContain('vitePreprocess()');
        expectPreprocessOrder(out);
        // `.svelte` already present -> append is idempotent (still one).
        expect(out.match(/'\.svelte'/gu)).toHaveLength(1);
        expect(out).toContain("'.sveltex'");
    });

    it('coerces non-array preprocess/extensions values into arrays', () => {
        // `preprocess` is a single (non-array) expression and `extensions` is
        // an identifier — both hit the `else` coercion branches.
        const seed = [
            "import vitePreprocess from 'foo';",
            "const exts = ['.svelte'];",
            'export default {',
            '\tpreprocess: vitePreprocess(),',
            '\textensions: exts,',
            '};',
            '',
        ].join('\n');
        const out = svelteConfigAfter(seed);
        expectPreprocessOrder(out);
        // The original single preprocessor is wrapped, not dropped, and
        // SvelTeX is inserted ahead of it.
        expect(out).toContain('vitePreprocess()');
        // The identifier `exts` is wrapped into a fresh array alongside the
        // appended string literals.
        expect(out).toContain('exts');
        expect(out).toContain("'.sveltex'");
    });
});

describe('run: demo route', () => {
    it('creates a math-bearing demo route by default', () => {
        const { files } = runAddon();
        const demo = readFile(files, 'src/routes/sveltex-demo/+page.sveltex');
        expect(demo).toContain('# SvelTeX demo');
        expect(demo).toContain('title: SvelTeX demo');
        // mathjax (non-none) -> the math block is present.
        expect(demo).toContain('\\int_{a}^{b}');
    });

    it('omits the math block when the math backend is "none"', () => {
        const { files } = runAddon({ options: { mathBackend: 'none' } });
        const demo = readFile(files, 'src/routes/sveltex-demo/+page.sveltex');
        expect(demo).toContain('# SvelTeX demo');
        expect(demo).not.toContain('\\int_{a}^{b}');
    });

    it('does not create a demo route when demoRoute is false', () => {
        const { files } = runAddon({ options: { demoRoute: false } });
        expect(files.has('src/routes/sveltex-demo/+page.sveltex')).toBe(false);
    });

    it('keeps an existing demo route untouched', () => {
        const existing = '--- existing ---\n';
        const { files } = runAddon({
            seed: { 'src/routes/sveltex-demo/+page.sveltex': existing },
        });
        expect(files.get('src/routes/sveltex-demo/+page.sveltex')).toBe(
            existing,
        );
    });
});

describe('nextSteps', () => {
    it('includes the demo-route step when a demo route was added', () => {
        const steps = callNextSteps(defaultOptions());
        expect(steps.some((s) => s.includes('/sveltex-demo'))).toBe(true);
        expect(steps.some((s) => s.includes('sveltex.config.js'))).toBe(true);
        expect(steps.some((s) => s.includes('sveltex.dev'))).toBe(true);
    });

    it('omits the demo-route step when no demo route was added', () => {
        const steps = callNextSteps(defaultOptions({ demoRoute: false }));
        expect(steps.some((s) => s.includes('/sveltex-demo'))).toBe(false);
        expect(steps.some((s) => s.includes('sveltex.dev'))).toBe(true);
    });
});
