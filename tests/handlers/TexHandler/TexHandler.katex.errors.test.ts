import {
    describe,
    it,
    expect,
    afterAll,
    vi,
    beforeEach,
    beforeAll,
    MockInstance,
} from 'vitest';
import { TexHandler } from '$handlers/TexHandler.js';
import { spy } from '$tests/fixtures.js';
import fetch, { type Response } from 'node-fetch';
import { v4 as uuid } from 'uuid';
import { range } from '$tests/utils.js';

describe("TexHandler<'katex'>", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    let log: MockInstance;
    beforeAll(async () => {
        vi.spyOn(await import('$deps.js'), 'ora').mockImplementation((() => ({
            start: vi.fn().mockReturnValue({
                stop: vi.fn(),
                text: vi.fn(),
                succeed: vi.fn(),
                fail: vi.fn(),
            }),
        })) as unknown as typeof import('ora').default);
        const mocks = await spy(
            ['writeFile', 'log', 'mkdir', 'existsSync'],
            true,
        );
        log = mocks.log;
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });
    describe('error handling', () => {
        it('should silently log error if there is a problem fetching KaTeX stylesheet', async () => {
            const id = uuid();
            vi.mock('node-fetch');
            vi.mocked(fetch).mockImplementation(() => {
                throw new Error(id);
            });
            const th1 = await TexHandler.create('katex');
            await th1.configure({ css: { type: 'hybrid' } });
            await th1.process('');
            expect(log).toHaveBeenCalledTimes(3);
            range(1, 3).forEach((i) => {
                expect(log).toHaveBeenNthCalledWith(
                    i,
                    'error',
                    expect.stringContaining(id),
                );
            });
            log.mockClear();
            vi.mocked(fetch).mockResolvedValue({
                ok: false,
                status: 404,
            } as Response);
            const th2 = await TexHandler.create('katex');
            await th2.configure({ css: { type: 'hybrid' } });
            await th2.process('');
            expect(log).toHaveBeenCalledTimes(3);
            range(1, 3).forEach((i) => {
                expect(log).toHaveBeenNthCalledWith(
                    i,
                    'error',
                    expect.stringContaining('404'),
                );
            });
        });
    });
});
