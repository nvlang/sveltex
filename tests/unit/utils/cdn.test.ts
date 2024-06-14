import { fetchWithTimeout, cdnLink } from '$utils/cdn.js';
import { spy } from '$tests/unit/fixtures.js';
import {
    describe,
    it,
    expect,
    vi,
    afterAll,
    beforeEach,
    afterEach,
    type MockInstance,
    beforeAll,
} from 'vitest';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });
}

describe('utils/cdn', () => {
    let log: MockInstance;
    fixture();
    beforeAll(async () => {
        const mocks = await spy(
            ['writeFileEnsureDir', 'log', 'existsSync'],
            true,
        );
        log = mocks.log;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe('fetchWithTimeout', () => {
        fixture();
        it.each([
            [
                'https://httpstat.us/503',
                1000,
                undefined,
                'HTTP error 503 (Service Unavailable): https://httpstat.us/503',
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
                        logMessage,
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
                expect(cdnLink(pkg, resource, version, cdn)).toBe(expected);
            },
        );
    });
});
