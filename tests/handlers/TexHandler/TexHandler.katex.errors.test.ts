/* eslint-disable vitest/no-commented-out-tests */
import { suite, describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import { TexHandler } from '$handlers';
import { spy } from '$tests/fixtures.js';
import fetch, { type Response } from 'node-fetch';
import { v4 as uuid } from 'uuid';

suite("TexHandler<'katex'>", async () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    const { log } = await spy(['writeFile', 'log', 'mkdir'], true);
    afterAll(() => {
        vi.restoreAllMocks();
    });
    describe('error handling', () => {
        it('should silently log error if there is a problem fetching KaTeX stylesheet', async () => {
            const id = uuid();
            vi.mock('node-fetch');
            vi.mocked(fetch).mockImplementationOnce(() => {
                throw new Error(id);
            });
            await TexHandler.create('katex');
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining(id),
            );
            log.mockClear();
            vi.mocked(fetch).mockResolvedValueOnce({
                ok: false,
                status: 404,
            } as Response);
            await TexHandler.create('katex');
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining('404'),
            );
        });
    });
});
