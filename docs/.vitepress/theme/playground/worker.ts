// File description: Web Worker that runs the SvelTeX preprocessor pipeline for
// the docs playground.
//
// The worker imports the pre-built browser bundle of SvelTeX as a *runtime
// URL* (`/playground/sveltex-playground.mjs`, produced by
// `scripts/build-playground.mjs`). Importing it as a URL -- rather than as a
// bare specifier -- deliberately sidesteps the docs Vite config, which
// externalizes `@nvl/sveltex`.
//
// The user-supplied SvelTeX source is never executed: the worker only calls
// `Sveltex.trace`, a pure text transformation. The user-supplied SvelTeX
// *configuration*, however, IS executed -- the worker evaluates the config
// source via `new Function` to construct the preprocessor. That code runs
// locally, in the user's browser, inside this worker; it never leaves the
// machine.

/// <reference lib="webworker" />

interface TraceResult {
    code: string;
    stages: { name: string; output: string }[];
}

interface SveltexPreprocessor {
    trace: (content: string, filename?: string) => Promise<TraceResult>;
}

interface SveltexConfigBundle {
    backends: Record<string, string>;
    configuration: Record<string, unknown>;
}

interface SveltexModule {
    sveltex: (
        backendChoices: Record<string, string>,
        configuration: Record<string, unknown>,
    ) => Promise<SveltexPreprocessor>;
    /**
     * MathJax v4 component-loader hook. MathJax lazily `import()`s its
     * components and font data; in a Web Worker those bare specifiers are not
     * resolvable, so the bundle ships a hook that maps them to modules bundled
     * at build time. See `scripts/playground/mathjax-loader.ts`.
     */
    mathjaxRequire: (file: string) => Promise<unknown>;
}

/** Request message sent from the playground component to this worker. */
interface RequestMessage {
    id: number;
    input: string;
    /**
     * The SvelTeX configuration as a JavaScript function body. It runs with
     * `mathjaxRequire` in scope and must `return { backends, configuration }`,
     * the two arguments to {@link SveltexModule.sveltex}.
     */
    config: string;
}

/** Response message sent back from this worker to the component. */
type ResponseMessage =
    | { id: number; ok: true; result: TraceResult }
    | {
          id: number;
          ok: false;
          /**
           * `'config'` -- the configuration source failed to evaluate or
           * `sveltex()` rejected. `'trace'` -- the preprocessor was built
           * successfully but transforming the input threw.
           */
          where: 'config' | 'trace';
          error: string;
      };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/**
 * Absolute URL of the pre-built SvelTeX browser bundle.
 *
 * The bundle lives in `src/public/` and is served verbatim at the site root
 * (`/playground/sveltex-playground.mjs`). It is referenced by a *fully
 * qualified* `http(s)://` URL, built from the worker's own `location.origin`
 * at runtime: Vite's dev server treats absolute network URLs in a dynamic
 * `import()` as external and leaves them alone, whereas a site-root-relative
 * path would be (incorrectly) resolved as a project module and rejected for
 * living inside `/public`.
 */
const bundleUrl =
    self.location.origin +
    '/' +
    ['playground', 'sveltex-playground.mjs'].join('/');

/**
 * Lazily-loaded SvelTeX bundle. Built once on the first request and reused;
 * the bundle is large and the dynamic `import()` is the slowest single step.
 */
let modulePromise: Promise<SveltexModule> | undefined;

function getModule(): Promise<SveltexModule> {
    if (!modulePromise) {
        // Runtime URL import: served from `src/public/` at the site root.
        modulePromise = import(
            /* @vite-ignore */ bundleUrl
        ) as Promise<SveltexModule>;
    }
    return modulePromise;
}

/**
 * Lazily-constructed preprocessor instance, scoped to the most recent
 * configuration source. Rebuilding the preprocessor is expensive
 * (each rebuild reloads MathJax's components and re-instantiates Shiki),
 * so we hold onto the previous one as long as the config hasn't changed.
 */
let preprocessorPromise: Promise<SveltexPreprocessor> | undefined;
let cachedConfigSource: string | undefined;

/**
 * Evaluate the user-supplied configuration source. The source is the body of
 * a JavaScript function that has `mathjaxRequire` in scope and returns
 * `{ backends, configuration }`. Throws if evaluation fails or if the return
 * value is not shaped as expected; the caller surfaces the message to the UI.
 */
function evaluateConfigSource(
    configSource: string,
    mathjaxRequire: SveltexModule['mathjaxRequire'],
): SveltexConfigBundle {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const factory = new Function('mathjaxRequire', configSource) as (
        mathjaxRequire: SveltexModule['mathjaxRequire'],
    ) => unknown;
    const value = factory(mathjaxRequire);
    if (
        value === null ||
        typeof value !== 'object' ||
        !('backends' in value) ||
        !('configuration' in value) ||
        typeof (value as SveltexConfigBundle).backends !== 'object' ||
        typeof (value as SveltexConfigBundle).configuration !== 'object'
    ) {
        throw new Error(
            'Configuration must `return { backends, configuration }` -- ' +
                'two objects passed verbatim to `sveltex()`.',
        );
    }
    return value as SveltexConfigBundle;
}

function getPreprocessor(configSource: string): Promise<SveltexPreprocessor> {
    if (preprocessorPromise && cachedConfigSource === configSource) {
        return preprocessorPromise;
    }
    const next = (async () => {
        const mod = await getModule();
        const { backends, configuration } = evaluateConfigSource(
            configSource,
            mod.mathjaxRequire,
        );
        return mod.sveltex(backends, configuration);
    })();
    // If this build fails, clear the cache so the next request retries
    // (e.g. after the user fixes the config). Without this, every subsequent
    // request would re-await the same rejected promise.
    next.catch(() => {
        if (preprocessorPromise === next) {
            preprocessorPromise = undefined;
            cachedConfigSource = undefined;
        }
    });
    preprocessorPromise = next;
    cachedConfigSource = configSource;
    return next;
}

ctx.addEventListener('message', (event: MessageEvent<RequestMessage>) => {
    const { id, input, config } = event.data;
    void (async () => {
        let pp: SveltexPreprocessor;
        try {
            pp = await getPreprocessor(config);
        } catch (err) {
            const response: ResponseMessage = {
                id,
                ok: false,
                where: 'config',
                error: err instanceof Error ? err.message : String(err),
            };
            ctx.postMessage(response);
            return;
        }
        try {
            const result = await pp.trace(input);
            const response: ResponseMessage = { id, ok: true, result };
            ctx.postMessage(response);
        } catch (err) {
            const response: ResponseMessage = {
                id,
                ok: false,
                where: 'trace',
                error: err instanceof Error ? err.message : String(err),
            };
            ctx.postMessage(response);
        }
    })();
});
