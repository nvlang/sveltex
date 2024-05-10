import { isArray } from '$type-guards/utils.js';
import { SupportedCdn } from '$types/handlers/misc.js';
import { log, prettifyError, runWithSpinner } from '$utils/debug.js';
import { fs } from '$utils/fs.js';
import fetch, { AbortError } from 'node-fetch';
import { cdnPrefixes } from 'src/data/cdn.js';

export async function fetchFromCdn(
    pkg: 'katex' | '@wooorm/starry-night' | 'highlight.js',
    resource: string,
    version: string = 'latest',
    cdns: SupportedCdn[] = ['jsdelivr', 'esm.sh', 'unpkg'],
    timeout: number = 1000,
): Promise<string | undefined> {
    let result: string | undefined;
    if (cdns.length === 0) throw new Error('No CDNs specified');
    await runWithSpinner(
        async (spinner) => {
            for (const cdn of cdns) {
                const url = cdnLink(pkg, resource, version, cdn);
                spinner.text = `Fetching ${url}`;
                result = await fetchWithTimeout(url, timeout);
                if (result) return 0; // Breaks out of runWithSpinner
            }
            return 1;
        },
        {
            startMessage: `Fetching ${resource} for ${pkg}`,
            failMessage: (t) =>
                `Couldn't fetch ${resource} for ${pkg} (took ${t})`,
            successMessage: (t) => `Fetched ${resource} for ${pkg} in ${t}`,
        },
        [1],
    );
    return result;
}

export function cdnLink(
    pkg: 'katex' | '@wooorm/starry-night' | 'highlight.js',
    resource: string,
    version: string = 'latest',
    cdn: SupportedCdn = 'jsdelivr',
) {
    return `${cdnPrefixes[cdn]}${pkg}@${version}/${resource}`;
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
            failMessage: (t) => `Couldn't write ${path} (${t})`,
            successMessage: (t) => `Wrote ${path} (${t})`,
        },
        [timeout],
    );
}

export async function fancyFetch(
    url: string | string[],
    timeout: number = 1000,
): Promise<string | undefined> {
    if (isArray(url)) {
        let result: string | undefined;
        for (const u of url) {
            // console.log(`${String(n++)}: ${u}`);
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

export async function fetchWithTimeout(
    url: string,
    timeout: number = 1000,
): Promise<string | undefined> {
    // AbortController was added in node v14.17.0 globally
    const AbortController = globalThis.AbortController;

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

/**
 * Gets the version of the specified package.
 */
export async function getVersion(
    pkg: keyof (typeof import('package.json'))['peerDependencies'],
): Promise<string | undefined> {
    let backendVersion: string | undefined;
    try {
        backendVersion = (
            (await import(`${pkg}/package.json`, {
                with: { type: 'json' },
            })) as { default: { version: string } }
        ).default.version;
    } catch (err) {
        backendVersion = undefined;
        log(
            'error',
            `Error getting ${pkg} version:\n\n${prettifyError(err)}\n\n`,
        );
    }
    return backendVersion;
}
