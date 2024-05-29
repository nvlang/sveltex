import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { CodeHandler } from '$handlers/CodeHandler.js';
import { missingDeps } from '$utils/env.js';
import { consoles } from '$utils/debug.js';
import { CodeBackend } from '$types/handlers/Code.js';
import { enquote } from '$utils/diagnosers/Diagnoser.js';

vi.spyOn(consoles, 'error').mockImplementation(() => undefined);

describe('throws helpful error if dependencies are missing', () => {
    beforeAll(() => {
        vi.mock('highlight.js', () => {
            throw new Error();
        });
        vi.mock('shiki', () => {
            throw new Error();
        });
        vi.mock('@wooorm/starry-night', () => {
            throw new Error();
        });
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });
    describe.each([
        ['highlight.js'],
        ['shiki'],
        [
            'starry-night',
            [
                '@wooorm/starry-night',
                'hast-util-find-and-replace',
                'hast-util-to-html',
            ],
        ],
    ] as [CodeBackend, string[]?][])(
        "CodeHandler.create('%s')",
        (backend, dependencies) => {
            const deps = dependencies ?? [backend];
            it(`pushes ${String(deps.map(enquote).join(', '))} to missingDeps and then throws error`, async () => {
                await expect(() =>
                    CodeHandler.create(backend, {}),
                ).rejects.toThrowError();
                deps.forEach((dep) => {
                    expect(missingDeps).toContain(dep);
                });
            });
        },
    );

    describe("CodeHandler.create('unsupported')", () => {
        it('throws error', async () => {
            await expect(() =>
                CodeHandler.create('unsupported' as 'none', {}),
            ).rejects.toThrowError();
        });
    });
});
