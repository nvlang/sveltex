// File description: Get CDN URLs and fetch from them.

// Types
import type { SupportedCdn } from '$types/handlers/Css.js';

// Internal dependencies
import { cdnPrefixes } from '$data/cdn.js';
import { isArray } from '$typeGuards/utils.js';
import { log, prettifyError, runWithSpinner } from '$utils/debug.js';
import { fs } from '$utils/fs.js';

// External dependencies
import { AbortError, nodeFetch } from '$deps.js';
import type { StringLiteralUnion } from '$types/utils/utility-types.js';

export function cdnLink(
    pkg: StringLiteralUnion<
        | 'mathjax'
        | 'katex'
        | '@wooorm/starry-night'
        | 'highlight.js'
        | `mathjax-${string}-font`
    >,
    resource: string,
    version: string = 'latest',
    cdn: SupportedCdn = 'jsdelivr',
) {
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
 * @see
 * https://github.com/node-fetch/node-fetch?tab=readme-ov-file#request-cancellation-with-abortsignal
 */
export async function fetchWithTimeout(
    url: string,
    timeout: number = 5000,
): Promise<string | undefined> {
    // AbortController was added in node v14.17.0 globally
    const AbortController = globalThis.AbortController;

    const controller = new AbortController();
    const timeoutObj = setTimeout(() => {
        controller.abort();
    }, timeout);

    try {
        const response = await nodeFetch(url, {
            signal: controller.signal,
        });

        // Check if the response is ok (status in the range 200-299)
        if (!response.ok) {
            log(
                'error',
                `HTTP error ${String(response.status)} (${String(response.statusText)}): ${url}`,
            );
            clearTimeout(timeoutObj);
            return undefined;
        }

        // Return the CSS content
        return await response.text();
    } catch (error) {
        if (error instanceof AbortError) {
            log('warn', `Timed out (${String(timeout)}ms): ${url}`);
        } else {
            log('error', `Error fetching ${url}:\n${prettifyError(error)}\n`);
        }
    }
    clearTimeout(timeoutObj);
    return undefined;
}
