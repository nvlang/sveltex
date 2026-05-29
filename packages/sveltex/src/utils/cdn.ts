// File description: Get CDN URLs and fetch from them.

// Types
import type { SupportedCdn } from '../types/handlers/Css.js';
import type { StringLiteralUnion } from '../types/utils/utility-types.js';
import type { MathjaxFont } from '../types/handlers/Math.js';

// Internal dependencies
import { cdnPrefixes } from '../data/cdn.js';
import { isArray } from '../typeGuards/utils.js';
import { log, prettifyError, runWithSpinner } from './debug.js';
import { fs } from './fs.js';
import { join } from '../deps.js';

export function cdnLink(
    pkg: StringLiteralUnion<
        | 'mathjax'
        | 'katex'
        | '@wooorm/starry-night'
        | 'highlight.js'
        | `mathjax-${MathjaxFont}-font`
    >,
    resource: string,
    version: string = 'latest',
    cdn: SupportedCdn = 'jsdelivr',
): string {
    let separator = '@';
    if (cdn === 'cdnjs') {
        if (pkg === '@wooorm/starry-night') cdn = 'jsdelivr';
        else separator = '/';
    }
    return `${cdnPrefixes[cdn]}${pkg}${separator}${version}/${resource}`;
}

export async function fancyWrite(
    path: string,
    content: string,
    timeout: number = 1000,
): Promise<number> {
    return await runWithSpinner(
        async () => {
            await fs.writeFileEnsureDir(path, content);
        },
        {
            startMessage: `Writing ${path}`,
            failMessage: (t) => `Couldn't write ${path} after ${t}`,
            successMessage: (t) => `Wrote ${path} in ${t}`,
        },
        [timeout],
    );
}

/**
 * Remove stale self-hosted stylesheets SvelTeX previously wrote for a backend
 * family. When the active backend, its version, or its output format changes,
 * the old `<prefix>@<version>…css` file in `dir` would otherwise linger and
 * keep shipping in the build (it has nothing to overwrite it, since the new
 * backend may use a CDN and write nothing).
 *
 * Only files SvelTeX itself names are touched: a name must start with one of
 * the given `prefixes` followed by `@` and end in `.css`. Anything in `keep`
 * (the currently-active stylesheet(s)) is preserved.
 *
 * @param dir - Directory the stylesheets live in (e.g. `static/sveltex`).
 * @param prefixes - Backend prefixes the calling handler owns — e.g.
 * `['mathjax', 'katex']` for math, `['highlight.js', 'starry-night']` for code.
 * @param keep - Basenames to preserve (the active stylesheet, if self-hosted).
 */
export async function pruneStaleSelfHostedCss(
    dir: string,
    prefixes: string[],
    keep: string[],
): Promise<void> {
    let entries: string[];
    try {
        entries = await fs.readdir(dir);
    } catch {
        // The directory doesn't exist yet (nothing self-hosted) or can't be
        // read — either way there's nothing to prune.
        return;
    }
    const stale = entries.filter(
        (name) =>
            name.endsWith('.css') &&
            !keep.includes(name) &&
            prefixes.some((p) => name.startsWith(`${p}@`)),
    );
    for (const name of stale) {
        const path = join(dir, name);
        await fs.rm(path);
        log('info', `Removed stale self-hosted stylesheet "${path}".`);
    }
}

export async function fancyFetch(
    url: string | string[],
    timeout: number = 5000,
): Promise<string | undefined> {
    if (isArray(url)) {
        let result: string | undefined;
        for (const u of url) {
            result = await fancyFetch(u, timeout);
            if (result) return result;
        }
        return undefined;
    }
    let result: string | undefined;
    await runWithSpinner(
        async () => {
            result = await fetchWithTimeout(url);
        },
        {
            startMessage: `Fetching ${url}`,
            successMessage: (t) => `Fetched ${url} (${t})`,
        },
        [timeout],
    );
    return result;
}

/**
 * Fetches `url`, returning its body as text — or `undefined` if the request
 * fails or does not complete within `timeout` milliseconds.
 */
export async function fetchWithTimeout(
    url: string,
    timeout: number = 5000,
): Promise<string | undefined> {
    const controller = new AbortController();
    const timeoutObj = setTimeout(() => {
        controller.abort();
    }, timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
        });

        // Check if the response is ok (status in the range 200-299)
        if (!response.ok) {
            log(
                'error',
                `HTTP error ${String(response.status)} (${response.statusText}): ${url}`,
            );
            clearTimeout(timeoutObj);
            return undefined;
        }

        // Return the CSS content
        return await response.text();
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            log('warn', `Timed out (${String(timeout)}ms): ${url}`);
        } else {
            log('error', `Error fetching ${url}:\n${prettifyError(error)}\n`);
        }
    }
    clearTimeout(timeoutObj);
    return undefined;
}
