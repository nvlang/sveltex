// Unit tests for the module-level helpers pulled out of `server.ts`
// (`src/core/server-helpers.ts`). Every function here is pure, so they are
// exercised directly — no fake connection or child process needed.
//
// Covered branch-for-branch: `pickDefined` (absent/defined/undefined keys),
// `withoutPullDiagnostics` (no `textDocument`, no `diagnostic`, present
// `diagnostic`), the `markNativeCompletion` / `isNativeCompletionItem` pair
// (null / array / list inputs and origin matching), and the `initialize`-time
// helpers `workspaceRootOf`, `uriToPath`, `readServerPaths`, `readClientName`.

import { describe, expect, it } from 'vitest';
import type {
    ClientCapabilities,
    CompletionItem,
    CompletionList,
    InitializeParams,
} from 'vscode-languageserver-protocol';
import {
    DEFAULT_SVELTEX_EXTENSION,
    isNativeCompletionItem,
    markNativeCompletion,
    pickDefined,
    readClientName,
    readServerPaths,
    uriToPath,
    withoutPullDiagnostics,
    workspaceRootOf,
} from '../../src/core/server-helpers.js';

describe('DEFAULT_SVELTEX_EXTENSION', () => {
    it('is `.sveltex`', () => {
        expect(DEFAULT_SVELTEX_EXTENSION).toBe('.sveltex');
    });
});

describe('pickDefined', () => {
    it('returns an empty object when source is undefined', () => {
        expect(pickDefined(undefined, ['a', 'b'] as const)).toEqual({});
    });

    it('keeps defined keys and omits undefined / unlisted ones', () => {
        const source = { a: 1, b: undefined, c: 3 } as {
            a: number;
            b: number | undefined;
            c: number;
        };
        // `b` is undefined → omitted; `c` is not requested → omitted.
        expect(pickDefined(source, ['a', 'b'] as const)).toEqual({ a: 1 });
    });
});

describe('withoutPullDiagnostics', () => {
    it('returns the same object when there is no `textDocument`', () => {
        const caps: ClientCapabilities = { workspace: {} };
        // No textDocument → nothing to strip; the same reference is returned.
        expect(withoutPullDiagnostics(caps)).toBe(caps);
    });

    it('returns the same object when `textDocument.diagnostic` is absent', () => {
        const caps: ClientCapabilities = { textDocument: { hover: {} } };
        expect(withoutPullDiagnostics(caps)).toBe(caps);
    });

    it('strips `textDocument.diagnostic` without mutating the input', () => {
        const caps: ClientCapabilities = {
            textDocument: {
                hover: {},
                diagnostic: { dynamicRegistration: true },
            },
        };
        const stripped = withoutPullDiagnostics(caps);
        expect(stripped.textDocument?.diagnostic).toBeUndefined();
        expect(stripped.textDocument?.hover).toBeDefined();
        // Input untouched.
        expect(caps.textDocument?.diagnostic).toBeDefined();
        expect(stripped).not.toBe(caps);
    });
});

describe('markNativeCompletion / isNativeCompletionItem', () => {
    it('passes a null result through unchanged', () => {
        expect(markNativeCompletion(null)).toBeNull();
    });

    it('marks every item of an array result and recognises them', () => {
        const marked = markNativeCompletion([
            { label: '\\alpha' },
            { label: '\\beta' },
        ]) as CompletionItem[];
        expect(Array.isArray(marked)).toBe(true);
        for (const item of marked) {
            expect(isNativeCompletionItem(item)).toBe(true);
        }
    });

    it('marks items inside a CompletionList and keeps `isIncomplete`', () => {
        const marked = markNativeCompletion({
            isIncomplete: true,
            items: [{ label: '\\gamma' }],
        }) as CompletionList;
        expect(marked.isIncomplete).toBe(true);
        const [first] = marked.items;
        expect(first).toBeDefined();
        if (first) expect(isNativeCompletionItem(first)).toBe(true);
    });

    it('does not recognise an item with no data', () => {
        expect(isNativeCompletionItem({ label: 'x' })).toBe(false);
    });

    it('does not recognise an item whose data is null', () => {
        // `typeof null === 'object'` — the explicit null guard must hold.
        expect(isNativeCompletionItem({ label: 'x', data: null })).toBe(false);
    });

    it('does not recognise a foreign-origin data object', () => {
        expect(
            isNativeCompletionItem({
                label: 'x',
                data: { sveltexOrigin: 'something-else' },
            }),
        ).toBe(false);
    });

    it('does not recognise a non-object data value', () => {
        expect(isNativeCompletionItem({ label: 'x', data: 42 })).toBe(false);
    });
});

describe('workspaceRootOf', () => {
    const base: InitializeParams = {
        processId: null,
        rootUri: null,
        capabilities: {},
    };

    it('prefers the first workspace folder', () => {
        const root = workspaceRootOf({
            ...base,
            workspaceFolders: [
                { uri: 'file:///work/a', name: 'a' },
                { uri: 'file:///work/b', name: 'b' },
            ],
        });
        expect(root).toBe('/work/a');
    });

    it('falls back to `rootUri` when no workspace folders', () => {
        const root = workspaceRootOf({
            ...base,
            rootUri: 'file:///legacy/root',
        });
        expect(root).toBe('/legacy/root');
    });

    it('falls back to `rootPath` when neither folders nor rootUri', () => {
        const root = workspaceRootOf({
            ...base,
            rootPath: '/very/old/root',
        });
        expect(root).toBe('/very/old/root');
    });

    it('returns undefined when nothing is provided', () => {
        expect(workspaceRootOf(base)).toBeUndefined();
    });

    it('returns undefined when the folder URI is not a file: URI', () => {
        // A non-`file:` folder URI maps to `undefined` via `uriToPath`.
        const root = workspaceRootOf({
            ...base,
            workspaceFolders: [{ uri: 'untitled:scratch', name: 'x' }],
        });
        expect(root).toBeUndefined();
    });
});

describe('uriToPath', () => {
    it('converts a file: URI to a path', () => {
        expect(uriToPath('file:///a/b/c')).toBe('/a/b/c');
    });

    it('returns undefined for a non-file scheme', () => {
        expect(uriToPath('https://example.com/x')).toBeUndefined();
    });

    it('returns undefined when URI parsing throws', () => {
        // `URI.parse` coerces its argument with `String()`; an argument whose
        // `toString` throws drives the function's `catch` branch. The public
        // type is `string`, so the throwing object is cast in.
        const bomb = {
            toString(): string {
                throw new Error('boom');
            },
        } as unknown as string;
        expect(uriToPath(bomb)).toBeUndefined();
    });
});

describe('readServerPaths', () => {
    it('returns empty paths for a non-object initializationOptions', () => {
        expect(readServerPaths('nope')).toEqual({
            svelteLanguageServer: undefined,
            mathLanguageServer: undefined,
        });
    });

    it('returns empty paths for null initializationOptions', () => {
        expect(readServerPaths(null)).toEqual({
            svelteLanguageServer: undefined,
            mathLanguageServer: undefined,
        });
    });

    it('returns empty paths when `serverPaths` is absent', () => {
        expect(readServerPaths({ client: 'zed' })).toEqual({
            svelteLanguageServer: undefined,
            mathLanguageServer: undefined,
        });
    });

    it('returns empty paths when `serverPaths` is not an object', () => {
        expect(readServerPaths({ serverPaths: 'x' })).toEqual({
            svelteLanguageServer: undefined,
            mathLanguageServer: undefined,
        });
    });

    it('returns empty paths when `serverPaths` is null', () => {
        expect(readServerPaths({ serverPaths: null })).toEqual({
            svelteLanguageServer: undefined,
            mathLanguageServer: undefined,
        });
    });

    it('reads valid string paths', () => {
        expect(
            readServerPaths({
                serverPaths: {
                    svelteLanguageServer: '/abs/svelte.js',
                    mathLanguageServer: '/abs/math.js',
                },
            }),
        ).toEqual({
            svelteLanguageServer: '/abs/svelte.js',
            mathLanguageServer: '/abs/math.js',
        });
    });

    it('ignores non-string and empty-string entries', () => {
        expect(
            readServerPaths({
                serverPaths: {
                    svelteLanguageServer: 42,
                    mathLanguageServer: '',
                },
            }),
        ).toEqual({
            svelteLanguageServer: undefined,
            mathLanguageServer: undefined,
        });
    });
});

describe('readClientName', () => {
    it('returns undefined for a non-object initializationOptions', () => {
        expect(readClientName(undefined)).toBeUndefined();
    });

    it('returns undefined for null initializationOptions', () => {
        expect(readClientName(null)).toBeUndefined();
    });

    it('lowercases a string client identifier', () => {
        expect(readClientName({ client: 'VSCode' })).toBe('vscode');
    });

    it('returns undefined for an empty-string client', () => {
        expect(readClientName({ client: '' })).toBeUndefined();
    });

    it('returns undefined for a non-string client', () => {
        expect(readClientName({ client: 123 })).toBeUndefined();
    });
});
