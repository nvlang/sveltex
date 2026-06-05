import {
    fetchWithTimeout,
    cdnLink,
    fancyWrite,
    warnAboutStaleSelfHostedCss,
} from '../../../src/utils/cdn.js';
import { spy } from '../fixtures.js';
import {
    mkdir as nodeMkdir,
    readdir as nodeReaddir,
    rm as nodeRm,
    writeFile as nodeWriteFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
    describe,
    it,
    expect,
    vi,
    afterAll,
    beforeEach,
    afterEach,
    beforeAll,
} from 'vitest';

import { setupServer } from 'msw/node';
import { delay, http, HttpResponse } from 'msw';

const server = setupServer(
    http.get('https://85b973d4c9e1.com/418', async () => {
        await delay(100);
        // HttpResponse.json({ error: "I'm a teapot" }, { status: 418 });
    }),
    http.get('https://85b973d4c9e1.com/503', () => {
        return HttpResponse.json(
            { error: 'Service Unavailable' },
            { status: 503 },
        );
    }),
);

beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
});
afterAll(() => {
    server.close();
});

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
        server.resetHandlers();
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
                'https://85b973d4c9e1.com/503',
                2000,
                undefined,
                'HTTP error 503 (Service Unavailable): https://85b973d4c9e1.com/503',
            ],
            [
                'https://85b973d4c9e1.com/418',
                -100,
                undefined,
                'Timed out (-100ms): https://85b973d4c9e1.com/418',
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
                        expect.stringMatching(/error|warn/u),
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

    describe('warnAboutStaleSelfHostedCss', () => {
        it('warns about stale SvelTeX stylesheets, ignoring the active and non-SvelTeX files', async () => {
            const log = await spy('log');
            const dir = `tmp/tests/${randomUUID()}/sveltex`;
            await nodeMkdir(dir, { recursive: true });
            await Promise.all([
                nodeWriteFile(join(dir, 'mathjax@4.1.1.chtml.css'), 'x'),
                nodeWriteFile(join(dir, 'katex@0.16.0.min.css'), 'x'),
                nodeWriteFile(join(dir, 'katex@0.17.0.min.css'), 'x'),
                nodeWriteFile(join(dir, 'notes.txt'), 'x'),
                nodeWriteFile(join(dir, 'custom.css'), 'x'),
            ]);
            await warnAboutStaleSelfHostedCss(
                dir,
                ['mathjax', 'katex'],
                ['katex@0.17.0.min.css'],
            );
            // Nothing is deleted: warning only.
            expect((await nodeReaddir(dir)).length).toBe(5);
            // Warns about the two stale SvelTeX files, not the active file,
            // the non-CSS file, or the non-SvelTeX CSS file.
            const warned = log.mock.calls
                .filter((c) => c[0] === 'warn')
                .map((c) => String(c[1]));
            expect(warned).toHaveLength(2);
            expect(warned.join('\n')).toContain('mathjax@4.1.1.chtml.css');
            expect(warned.join('\n')).toContain('katex@0.16.0.min.css');
            expect(warned.join('\n')).not.toContain('katex@0.17.0.min.css');
            expect(warned.join('\n')).not.toContain('custom.css');
            await nodeRm(dir, { recursive: true, force: true });
        });

        it('does nothing when the directory does not exist', async () => {
            await expect(
                warnAboutStaleSelfHostedCss(
                    `tmp/tests/${randomUUID()}/missing`,
                    ['mathjax'],
                    [],
                ),
            ).resolves.toBeUndefined();
        });
    });
});
