import { suite, describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import { TexHandler } from '$handlers';
import { spy } from '$tests/fixtures.js';
import { consoles } from '$utils/debug.js';

function fixture() {
    beforeEach(() => {
        vi.clearAllMocks();
    });
}

suite("TexHandler<'mathjax'>", async () => {
    await spy(['writeFile', 'log', 'existsSync', 'mkdir'], true);
    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe('error handling during stylesheet generation', () => {
        fixture();
        it('should gracefully deal with unexpected behavior from clean-css', async () => {
            // `log` mock is not enough here, see comment in
            // TexHandler.mathjax.test.ts for details
            const consoleErrorMock = vi
                .spyOn(consoles, 'error')
                .mockImplementation(() => undefined);
            vi.mock('clean-css', () => {
                return {
                    default: vi.fn().mockImplementation(() => {
                        return {
                            minify: () => {
                                return {
                                    errors: [
                                        '46a16350-db41-48b4-8f20-1dc24983e194',
                                    ],
                                };
                            },
                        };
                    }),
                };
            });
            await TexHandler.create('mathjax');
            expect(consoleErrorMock).toHaveBeenCalledTimes(1);
            expect(consoleErrorMock).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining('46a16350-db41-48b4-8f20-1dc24983e194'),
            );
            consoleErrorMock.mockRestore();
        });
    });
});
