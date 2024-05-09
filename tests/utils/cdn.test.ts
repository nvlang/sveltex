import {
    fetchFromCdn,
    fetchWithTimeout,
    getVersion,
    highlightJsThemeResource,
    linkify,
    starryNightThemeResource,
} from '$utils/cdn.js';
import { spy } from '$tests/fixtures.js';
import {
    suite,
    describe,
    it,
    expect,
    vi,
    afterAll,
    beforeEach,
    afterEach,
} from 'vitest';
import { getDefaultCodeConfiguration } from '$config';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

suite('utils/cdn', async () => {
    fixture();
    const { log } = await spy(
        ['writeFileEnsureDir', 'log', 'existsSync'],
        true,
    );
    afterAll(() => {
        vi.restoreAllMocks();
    });
    describe('getCss', () => {
        fixture();
        it('should fetch CSS from CDNs', async () => {
            const css = await fetchFromCdn('katex', 'dist/katex.min.css');
            expect(css).toBeDefined();
            expect(css).toContain('@font-face{font-family:KaTeX_AMS;');
        });

        it('should throw an error if no CDNs are specified', async () => {
            await expect(
                fetchFromCdn('katex', 'dist/katex.min.css', 'latest', []),
            ).rejects.toThrow('No CDNs specified');
        });
    });

    describe('fetchWithTimeout', () => {
        fixture();
        it.each([
            [
                'https://httpstat.us/418',
                2000,
                undefined,
                "HTTP error 418 \\(I'm a teapot\\): https://httpstat.us/418",
            ],
            [
                'https://httpstat.us/418',
                -100,
                undefined,
                'Timed out (-100ms): https://httpstat.us/418',
            ],
        ])(
            'fetchWithTimeout(%o, %o) === %o',
            { timeout: 1500, retry: 1 },
            async (url, timeout, expected, logMessage) => {
                expect(await fetchWithTimeout(url, timeout)).toEqual(expected);
                if (logMessage) {
                    expect(log).toHaveBeenCalledTimes(1);
                    expect(log).toHaveBeenNthCalledWith(
                        1,
                        expect.stringMatching(/error|warn/),
                        expect.stringMatching(
                            new RegExp(`(${logMessage}|Timed out.*)`),
                        ),
                    );
                }
            },
        );
    });

    describe('linkify', () => {
        fixture();
        it.each([
            [
                'katex',
                'dist/katex.min.css',
                'latest',
                'jsdelivr',
                'https://cdn.jsdelivr.net/npm/katex@latest/dist/katex.min.css',
            ],
            [
                '@wooorm/starry-night',
                'dist/index.css',
                'latest',
                'esm.sh',
                'https://esm.sh/@wooorm/starry-night@latest/dist/index.css',
            ],
            [
                'highlight.js',
                'styles/default.css',
                '10.7.2',
                'unpkg',
                'https://unpkg.com/highlight.js@10.7.2/styles/default.css',
            ],
        ] as const)(
            'linkify(%o, %o, %o, %o) === %o',
            (pkg, resource, version, cdn, expected) => {
                expect(linkify(pkg, resource, version, cdn)).toBe(expected);
            },
        );
    });

    describe('starryNightThemeResource', () => {
        fixture();
        it.each([
            [
                {
                    ...getDefaultCodeConfiguration('starry-night').theme,
                    name: 'default',
                    mode: 'light',
                },
                'style/light.css',
            ],
            [
                {
                    ...getDefaultCodeConfiguration('starry-night').theme,
                    name: 'dimmed',
                    mode: 'both',
                },
                'style/dimmed-both.css',
            ],
        ] as const)(
            'starryNightThemeResource(%o) === %o',
            (theme, expected) => {
                expect(starryNightThemeResource(theme)).toEqual(expected);
            },
        );
    });

    describe('highlightJsThemeResource', () => {
        fixture();
        it.each([
            [
                {
                    ...getDefaultCodeConfiguration('highlight.js').theme,
                    name: 'default',
                },
                'styles/default.min.css',
            ],
            [
                {
                    ...getDefaultCodeConfiguration('highlight.js').theme,
                    name: 'default',
                    min: false,
                },
                'styles/default.css',
            ],
            [
                {
                    ...getDefaultCodeConfiguration('highlight.js').theme,
                    name: 'tokyo-night-dark',
                    min: true,
                },
                'styles/tokyo-night-dark.min.css',
            ],
        ] as const)(
            'highlightJsThemeResource(%o) === %o',
            (theme, expected) => {
                expect(highlightJsThemeResource(theme)).toEqual(expected);
            },
        );
    });

    describe('getVersion', () => {
        fixture();
        it.each(['katex', 'highlight.js', 'mathjax-full'] as const)(
            'getVersion(%o) has format "x.y.z"',
            async (dep) => {
                expect(await getVersion(dep)).toMatch(/(\d+\.\d+\.\d+)/);
            },
        );
    });
});
