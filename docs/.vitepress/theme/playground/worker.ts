// File description: Web Worker that runs the SvelTeX preprocessor pipeline for
// the docs playground.
//
// The worker imports the pre-built browser bundle of SvelTeX as a *runtime
// URL* (`/playground/sveltex-playground.mjs`, produced by
// `scripts/build-playground.mjs`). Importing it as a URL -- rather than as a
// bare specifier -- deliberately sidesteps the docs Vite config, which
// externalizes `@nvl/sveltex`.
//
// The preprocessor is constructed once and reused for every request. The
// worker only ever calls `Sveltex.trace` (pure text transformation); it never
// executes, mounts, or evaluates the user's source.

/// <reference lib="webworker" />

interface TraceResult {
    code: string;
    stages: { name: string; output: string }[];
}

interface SveltexPreprocessor {
    trace: (content: string, filename?: string) => Promise<TraceResult>;
}

interface SveltexModule {
    sveltex: (
        backendChoices: Record<string, string>,
        configuration: Record<string, unknown>,
    ) => Promise<SveltexPreprocessor>;
}

/** Request message sent from the playground component to this worker. */
interface RequestMessage {
    id: number;
    input: string;
}

/** Response message sent back from this worker to the component. */
type ResponseMessage =
    | { id: number; ok: true; result: TraceResult }
    | { id: number; ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/**
 * Lazily-constructed preprocessor instance. Built once, on the first request,
 * then reused -- constructing it is the expensive part.
 */
let preprocessorPromise: Promise<SveltexPreprocessor> | undefined;

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
    self.location.origin + '/' + ['playground', 'sveltex-playground.mjs'].join('/');

function getPreprocessor(): Promise<SveltexPreprocessor> {
    if (!preprocessorPromise) {
        preprocessorPromise = (async () => {
            // Runtime URL import: served from `src/public/` at the site root.
            const mod = (await import(
                /* @vite-ignore */ bundleUrl
            )) as SveltexModule;
            return mod.sveltex(
                {
                    markdownBackend: 'marked',
                    codeBackend: 'escape',
                    mathBackend: 'katex',
                },
                // `css.type: 'cdn'` => SvelTeX emits a `<link>` to a CDN and
                // never tries to write a stylesheet to disk.
                { math: { css: { type: 'cdn' } } },
            );
        })();
    }
    return preprocessorPromise;
}

ctx.addEventListener('message', (event: MessageEvent<RequestMessage>) => {
    const { id, input } = event.data;
    void (async () => {
        try {
            const pp = await getPreprocessor();
            const result = await pp.trace(input);
            const response: ResponseMessage = { id, ok: true, result };
            ctx.postMessage(response);
        } catch (err) {
            const response: ResponseMessage = {
                id,
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            };
            ctx.postMessage(response);
        }
    })();
});
