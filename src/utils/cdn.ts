import { isArray } from '$type-guards/utils.js';
import { RequiredNonNullable } from '$types';
import {
    FullCodeThemeConfiguration,
    ThemableCodeBackend,
} from '$types/handlers/Code.js';
import {
    SupportedCdn,
    FullKatexCssConfiguration,
    HighlightJsTheme,
    StarryNightTheme,
} from '$types/handlers/misc.js';
import { log, prettifyError, runWithSpinner } from '$utils/debug.js';
import fetch, { AbortError } from 'node-fetch';

export async function fetchCss<Pkg extends 'katex' | ThemableCodeBackend>(
    pkg: Pkg,
    config: Pkg extends 'katex'
        ? FullKatexCssConfiguration
        : FullCodeThemeConfiguration<ThemableCodeBackend>,
    version: string = 'latest',
): Promise<string | undefined> {
    const { timeout, cdn } = config;
    const cdns = isArray(cdn) ? cdn : [cdn];
    const resource =
        pkg === 'katex'
            ? 'dist/katex.min.css'
            : pkg === 'starry-night'
              ? starryNightThemeResource(
                    config as FullCodeThemeConfiguration<'starry-night'>,
                )
              : highlightJsThemeResource(
                    config as FullCodeThemeConfiguration<'highlight.js'>,
                );
    return await fetchFromCdn(
        pkg === 'starry-night' ? '@wooorm/starry-night' : pkg,
        resource,
        version,
        cdns,
        timeout,
    );
}

export async function fetchFromCdn(
    pkg: 'katex' | '@wooorm/starry-night' | 'highlight.js',
    resource: string,
    version: string = 'latest',
    cdns: SupportedCdn[] = ['jsdelivr', 'esm.sh', 'unpkg'],
    timeout: number = 1000,
): Promise<string | undefined> {
    let css: string | undefined;
    if (cdns.length === 0) throw new Error('No CDNs specified');
    await runWithSpinner(
        async (spinner) => {
            for (const cdn of cdns) {
                const url = linkify(pkg, resource, version, cdn);
                spinner.text = `Fetching CSS for ${pkg} from ${cdn}`;
                css = await fetchWithTimeout(url, timeout);
                if (css) return 0;
            }
            return 1;
        },
        {
            startMessage: `Fetching CSS for ${pkg}`,
            failMessage: (t) => `Couldn't fetch CSS for ${pkg} (took ${t})`,
            successMessage: (t) => `Fetched CSS for ${pkg} in ${t}`,
        },
        [1],
    );
    return css;
}

export function linkify(
    pkg: 'katex' | '@wooorm/starry-night' | 'highlight.js',
    resource: string,
    version: string = 'latest',
    cdn: SupportedCdn = 'jsdelivr',
) {
    switch (cdn) {
        case 'jsdelivr':
            return `https://cdn.jsdelivr.net/npm/${pkg}@${version}/${resource}`;
        case 'esm.sh':
            return `https://esm.sh/${pkg}@${version}/${resource}`;
        case 'unpkg':
            return `https://unpkg.com/${pkg}@${version}/${resource}`;
    }
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

export function starryNightThemeResource(
    theme: RequiredNonNullable<StarryNightTheme>,
): string {
    const { name, mode } = theme;
    return `style/${name === 'default' ? '' : `${name}-`}${mode}.css`;
}

export function highlightJsThemeResource(
    theme: RequiredNonNullable<HighlightJsTheme>,
): string {
    const { name, min } = theme;
    return `styles/${name}${min ? '.min' : ''}.css`;
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
