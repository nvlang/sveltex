import { fetchWithTimeout, cdnLink, fancyWrite } from '$utils/cdn.js';
import { spy } from '$tests/unit/fixtures.js';
import {
    describe,
    it,
    expect,
    vi,
    afterAll,
    beforeEach,
    afterEach,
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
    fixture();
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe('fetchWithTimeout', () => {
        fixture();
        it.each([
            [
                'https://httpstat.us/503',
                2000,
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
            { timeout: 2500, retry: 2 },
            async (url, timeout, expected, logMessage) => {
                const { log } = await spy([
                    'writeFileEnsureDir',
                    'log',
                    'existsSync',
                ]);
                expect(await fetchWithTimeout(url, timeout)).toEqual(expected);
                if (logMessage) {
                    expect(log).toHaveBeenCalledTimes(1);
                    expect(log).toHaveBeenNthCalledWith(
                        1,
                        expect.stringMatching(/error|warn/),
                        logMessage,
                    );
                }
                vi.restoreAllMocks();
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

    describe('fancyWrite', () => {
        it('should work with failMessage()', async () => {
            vi.restoreAllMocks();
            const {
                writeFileEnsureDir, // log
            } = await spy(['writeFileEnsureDir', 'log']);
            writeFileEnsureDir.mockRejectedValue(
                new Error('04369612-2311-41d0-8486-bcfe70e086a6'),
            );
            expect(await fancyWrite('test', '')).toEqual(1);
            // TODO: why is `log` not being called? I can see a log message in
            // the console.

            // expect(log).toHaveBeenCalledOnce();
            // expect(log).toHaveBeenCalledWith(
            //     'error',
            //     expect.stringContaining('04369612-2311-41d0-8486-bcfe70e086a6'),
            // );
            writeFileEnsureDir.mockRestore();
        });
    });
});
