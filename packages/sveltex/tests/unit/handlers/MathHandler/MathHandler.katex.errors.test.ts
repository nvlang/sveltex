import {
    describe,
    it,
    expect,
    afterAll,
    vi,
    beforeEach,
    beforeAll,
    type MockInstance,
} from 'vitest';
import { MathHandler } from '../../../../src/handlers/MathHandler.js';
import { spy } from '../../fixtures.js';
import fetch, { type Response } from 'node-fetch';
import { v4 as uuid } from 'uuid';
import { range } from '../../utils.js';

describe("MathHandler<'katex'>", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    let log: MockInstance;
    beforeAll(async () => {
        vi.spyOn(
            await import('../../../../src/deps.js'),
            'ora',
        ).mockImplementation((() => ({
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
            const mathHandler = await MathHandler.create('katex', {
                css: { type: 'cdn', cdn: [] as unknown as 'jsdelivr' },
            });
            await mathHandler.process('');
            expect(log).toHaveBeenCalled();
            expect(log).toHaveBeenCalledWith('error', expect.any(String));
            log.mockClear();
            vi.mock('node-fetch');
            vi.mocked(fetch).mockImplementation(() => {
                throw new Error(id);
            });
            const th1 = await MathHandler.create('katex', {
                css: { type: 'hybrid' },
            });
            await th1.process('');
            expect(log).toHaveBeenCalledTimes(4);
            range(1, 4).forEach((i) => {
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
            const th2 = await MathHandler.create('katex', {
                css: { type: 'hybrid' },
            });
            await th2.process('');
            expect(log).toHaveBeenCalledTimes(4);
            range(1, 4).forEach((i) => {
                expect(log).toHaveBeenNthCalledWith(
                    i,
                    'error',
                    expect.stringContaining('404'),
                );
            });
        });
    });
});
