/* eslint-disable vitest/no-commented-out-tests */
import { suite, describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import { TexHandler } from '$handlers/TexHandler.js';
import { spy } from '$tests/fixtures.js';
import fetch, { type Response } from 'node-fetch';
import { v4 as uuid } from 'uuid';
import { range } from '$tests/utils.js';

suite("TexHandler<'katex'>", async () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    const { log } = await spy(
        ['fancyWrite', 'log', 'mkdir', 'existsSync'],
        true,
    );
    afterAll(() => {
        vi.restoreAllMocks();
    });
    describe('error handling', () => {
        it('should silently log error if there is a problem fetching KaTeX fonts', async () => {
            const id = uuid();
            vi.mock('node-fetch');
            vi.mocked(fetch).mockImplementation((url) => {
                if ((url as string).includes('fonts')) {
                    throw new Error(id);
                }
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve('test'),
                } as Response);
            });
            const th = await TexHandler.create('katex');
            await th.configure({ css: { type: 'self-hosted' } });
            await th.process('');
            expect(log).toHaveBeenCalledTimes(180); // 60 fonts * 3 CDNs
            range(1, 180).forEach((i) => {
                expect(log).toHaveBeenNthCalledWith(
                    i,
                    'error',
                    expect.stringContaining(id),
                );
            });
        });
    });
});
