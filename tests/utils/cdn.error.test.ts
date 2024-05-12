import { fancyFetch, fetchWithTimeout } from '$utils/cdn.js';
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

suite.sequential('utils/cdn', async () => {
    fixture();
    const { log } = await spy(
        ['writeFileEnsureDir', 'log', 'existsSync'],
        true,
    );
    afterAll(() => {
        vi.restoreAllMocks();
        vi.unmock('node-fetch');
    });
    beforeAll(() => {
        vi.mock(
            'node-fetch',
            async (orig: () => Promise<typeof import('node-fetch')>) => ({
                ...(await orig()),
                default: vi
                    .fn()
                    .mockRejectedValueOnce(
                        new Error('6da12ed8-b5ff-447d-a16c-166e67cd0301'),
                    )
                    .mockRejectedValueOnce(
                        new Error('968b000c-a8df-4595-beb3-0e2a8c5eb9e6'),
                    ),
            }),
        );
    });
    describe('fancyFetch', () => {
        fixture();
        it('should fail gracefully', async () => {
            await fancyFetch('https://httpstat.us/200');
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining('6da12ed8-b5ff-447d-a16c-166e67cd0301'),
            );
        });
    });
    describe('fetchWithTimeout', () => {
        fixture();
        it('should silently log unexpected errors', async () => {
            const css = await fetchWithTimeout('https://httpstat.us/200');
            expect(css).not.toBeDefined();
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(
                1,
                'error',
                expect.stringContaining('968b000c-a8df-4595-beb3-0e2a8c5eb9e6'),
            );
        });
    });
    describe('fancyFetch (2)', () => {
        fixture();
        it('should fail gracefully (2)', async () => {
            vi.spyOn(
                await import('$utils/cdn.js'),
                'fetchWithTimeout',
            ).mockImplementationOnce(() => {
                throw new Error('346ca4ae-c33c-487a-8d61-d907cc2e239e');
            });
            await fancyFetch('https://httpstat.us/200');
            expect(log).toHaveBeenCalledTimes(1);
            expect(log).toHaveBeenNthCalledWith(1, 'error', expect.any(String));
        });
    });
});
