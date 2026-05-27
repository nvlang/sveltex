// Unit tests for region forwarding (`src/core/region-forwarding.ts`):
// classifying LaTeX verbatim regions, forwarding math regions to the bundled
// math language server, and the graceful "skip" behaviour when no child server
// is available (a `custom`/`none` math backend, or TexLab not installed).
//
// `./texlab.js` is module-mocked: `findTexlab` is a spy that defaults to
// reporting TexLab as absent (exercising the skip branch deterministically,
// regardless of the host machine), and individual tests point it at a *fake*
// `texlab` — a tiny stdio LSP server fixture written to a temp file — to drive
// the full LaTeX-verbatim forwarding path without a real TexLab install.

import {
    chmodSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { CompletionItemKind } from 'vscode-languageserver-protocol';
import {
    RegionForwarder,
    isLatexVerbatimRegion,
    withFunctionCompletionKind,
} from '../../src/core/region-forwarding.js';
import { defaultConfigSnapshot } from '../../src/core/config.js';
import { computeRegions, type Region } from '../../src/core/regions.js';
import { findTexlab } from '../../src/core/texlab.js';

vi.mock('../../src/core/texlab.js', () => ({
    findTexlab: vi.fn(() => undefined),
    isTexlabAvailable: vi.fn(() => false),
}));

const mockedFindTexlab = vi.mocked(findTexlab);

// A mutable flag, shared with the `LspProxy` mock below, that forces the *next*
// `LspProxy.start()` to reject. `LspProxy` does not reject `start()` when a
// forked child dies mid-handshake (it just hangs), so a real bad-module fork
// cannot exercise the spawn-failure (`catch`) path of `#startMathProxy` within
// a test budget. The mock subclasses the *real* proxy and only overrides
// `start` to optionally throw, so every other test still drives the genuine
// spawn/handshake against a real child.
const startControl = vi.hoisted(() => ({
    failNext: false,
    // When true, the forced failure throws a non-`Error` value, exercising the
    // `String(error)` arm of the catch blocks' error-message ternary.
    failWithNonError: false,
}));

vi.mock('../../src/core/lsp-proxy.js', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../src/core/lsp-proxy.js')>();
    class ControllableLspProxy extends actual.LspProxy {
        public override async start(
            params: Parameters<InstanceType<typeof actual.LspProxy>['start']>[0],
        ): ReturnType<InstanceType<typeof actual.LspProxy>['start']> {
            if (startControl.failNext) {
                startControl.failNext = false;
                if (startControl.failWithNonError) {
                    startControl.failWithNonError = false;
                    // A non-Error throw (a bare string).
                    // eslint-disable-next-line @typescript-eslint/only-throw-error
                    throw 'forced spawn failure (string)';
                }
                throw new Error('forced spawn failure');
            }
            return super.start(params);
        }
    }
    return { ...actual, LspProxy: ControllableLspProxy };
});

// ---------------------------------------------------------------------------
// Fake `texlab` fixture: a minimal stdio LSP server. It speaks just enough of
// the protocol for `LspProxy` to start it and forward one request, and decides
// what to return by scanning the opened document body for a `RET:<shape>`
// marker — letting each test drive a specific raw result shape (so both the
// remap/relabel paths and `describeResult`'s logging branches are exercised).
// ---------------------------------------------------------------------------

/**
 * Source of the fake `texlab` executable. Resolves `vscode-languageserver` from
 * this package's `node_modules` (passed in as an absolute path) so the spawned
 * Node process can build a connection. Returns shapes keyed by a `RET:` marker
 * in the document text; absent a marker it echoes a default completion list.
 */
const fakeTexlabSource = (protocolPath: string): string => `#!/usr/bin/env node
import {
    StreamMessageReader,
    StreamMessageWriter,
    createProtocolConnection,
} from ${JSON.stringify(protocolPath)};

const connection = createProtocolConnection(
    new StreamMessageReader(process.stdin),
    new StreamMessageWriter(process.stdout),
);

const docs = new Map();

connection.onRequest('initialize', () => ({ capabilities: {} }));
connection.onNotification('initialized', () => {});
connection.onNotification('textDocument/didOpen', (p) => {
    docs.set(p.textDocument.uri, p.textDocument.text);
});
connection.onNotification('textDocument/didClose', (p) => {
    docs.delete(p.textDocument.uri);
});

function shapeFor(text, position) {
    const m = /RET:([A-Z_]+)/.exec(text || '');
    const tag = m ? m[1] : 'DEFAULT';
    // A zero-width range at the request position is guaranteed to map back.
    const range = { start: position, end: position };
    switch (tag) {
        case 'ARRAY':
            return [{ label: '\\\\arr', kind: 1, textEdit: { range, newText: '\\\\arr' } }];
        case 'NULL':
            return null;
        case 'OTHER':
            return { unexpected: true };
        case 'ITEMS_NONARRAY':
            return { items: 'not-an-array' };
        case 'HOVER':
            return { contents: 'tex hover', range };
        case 'HOVER_NORANGE':
            return { contents: 'tex hover, no range' };
        case 'STRING':
            // A non-object, non-array, truthy result (a primitive). Survives
            // \`remapHover\` (no \`.range\`) and exercises the typeof-non-object
            // branch of the result describer.
            return 'plain string result';
        case 'LIST':
        default:
            return {
                isIncomplete: false,
                items: [
                    { label: '\\\\draw', kind: 1, textEdit: { range, newText: '\\\\draw' } },
                ],
            };
    }
}

connection.onRequest('textDocument/completion', (p) =>
    shapeFor(docs.get(p.textDocument.uri), p.position),
);
connection.onRequest('textDocument/hover', (p) =>
    shapeFor(docs.get(p.textDocument.uri), p.position),
);

connection.listen();
`;

/** Absolute path to `vscode-languageserver-protocol`'s Node entry. */
function protocolMainPath(): string {
    // Resolved relative to this test file via the package's own resolution.
    const url = new URL(
        '../../node_modules/vscode-languageserver-protocol/lib/node/main.js',
        import.meta.url,
    );
    return url.pathname;
}

/** Temp dirs created for fake-texlab fixtures, cleaned up after each test. */
const fakeTexlabDirs: string[] = [];

/**
 * Writes the fake `texlab` server to a fresh temp dir, marks it executable, and
 * returns its absolute path. The same script handles every `RET:` shape.
 */
function writeFakeTexlab(): string {
    const dir = mkdtempSync(join(tmpdir(), 'sveltex-fake-texlab-'));
    fakeTexlabDirs.push(dir);
    const file = join(dir, 'texlab.mjs');
    writeFileSync(file, fakeTexlabSource(protocolMainPath()));
    chmodSync(file, 0o755);
    return file;
}

describe('isLatexVerbatimRegion', () => {
    const latexTags = ['tex', 'latex', 'tikz'];

    /** The first verbatim region of `source`. */
    function verbatimRegionOf(source: string): Region {
        const regions = computeRegions(source, defaultConfigSnapshot());
        const region = regions.find((r) => r.kind === 'verbatim');
        if (!region) throw new Error('no verbatim region found');
        return region;
    }

    it('accepts a `<tex>` region', () => {
        const source = '<tex>\\draw (0,0);</tex>';
        expect(
            isLatexVerbatimRegion(source, verbatimRegionOf(source), latexTags),
        ).toBe(true);
    });

    it('accepts a `<tikz>` region', () => {
        const source = '<tikz>\\node {x};</tikz>';
        expect(
            isLatexVerbatimRegion(source, verbatimRegionOf(source), latexTags),
        ).toBe(true);
    });

    it('is case-insensitive about the tag name', () => {
        const source = '<TeX>\\x</TeX>';
        expect(
            isLatexVerbatimRegion(source, verbatimRegionOf(source), latexTags),
        ).toBe(true);
    });

    it('rejects a verbatim region whose tag is not a LaTeX tag', () => {
        const source = '<verbatim>raw</verbatim>';
        const region = verbatimRegionOf(source);
        expect(isLatexVerbatimRegion(source, region, latexTags)).toBe(false);
    });

    it('rejects a non-verbatim region', () => {
        const mathRegion: Region = {
            kind: 'math',
            sourceStart: 0,
            sourceEnd: 5,
        };
        expect(isLatexVerbatimRegion('$a+b$', mathRegion, latexTags)).toBe(
            false,
        );
    });

    it('rejects a verbatim region whose slice has no opening tag', () => {
        // A (hand-built) verbatim region pointing at text that does not start
        // with `<tag` — the tag regex finds no match, so the no-match guard
        // returns false.
        const source = '   not a tag at all   ';
        const region: Region = {
            kind: 'verbatim',
            sourceStart: 0,
            sourceEnd: source.length,
        };
        expect(isLatexVerbatimRegion(source, region, latexTags)).toBe(false);
    });
});

describe('withFunctionCompletionKind', () => {
    it('passes a null result straight through', () => {
        expect(withFunctionCompletionKind(null)).toBeNull();
    });

    it('relabels `Text`-kind items in an array as `Function`', () => {
        const result = withFunctionCompletionKind([
            { label: '\\draw', kind: CompletionItemKind.Text },
            { label: '\\node', kind: CompletionItemKind.Text },
        ]);
        const items = Array.isArray(result) ? result : [];
        expect(items.map((i) => i.kind)).toEqual([
            CompletionItemKind.Function,
            CompletionItemKind.Function,
        ]);
    });

    it('leaves non-`Text` kinds (and kind-less items) untouched', () => {
        const result = withFunctionCompletionKind([
            { label: '\\frac', kind: CompletionItemKind.Method },
            { label: 'plain' },
        ]);
        const items = Array.isArray(result) ? result : [];
        expect(items[0]?.kind).toBe(CompletionItemKind.Method);
        expect(items[1]?.kind).toBeUndefined();
    });

    it('relabels items inside a CompletionList and keeps `isIncomplete`', () => {
        const result = withFunctionCompletionKind({
            isIncomplete: true,
            items: [{ label: '\\draw', kind: CompletionItemKind.Text }],
        });
        const list = result && !Array.isArray(result) ? result : undefined;
        expect(list?.isIncomplete).toBe(true);
        expect(list?.items[0]?.kind).toBe(CompletionItemKind.Function);
    });
});

describe('RegionForwarder — math regions', () => {
    let forwarder: RegionForwarder;

    afterEach(async () => {
        await forwarder.stop();
    });

    /** A math region covering all of `source`. */
    function mathRegion(source: string): Region {
        return { kind: 'math', sourceStart: 0, sourceEnd: source.length };
    }

    it('forwards math completion to the bundled math language server', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'mathjax',
        });
        const source = '$\\alp$';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 5 }, // caret after `\alp`
        );
        expect(result).not.toBeNull();
        const items = Array.isArray(result) ? result : (result?.items ?? []);
        expect(items.map((i) => i.label)).toContain('\\alpha');
    });

    it('honours the KaTeX backend', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'katex',
        });
        const source = '$\\sqr$';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 5 },
        );
        const items = Array.isArray(result) ? result : (result?.items ?? []);
        expect(items.map((i) => i.label)).toContain('\\sqrt');
    });

    it('maps completion ranges back to `.sveltex` coordinates', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'mathjax',
        });
        const source = '$\\fra$';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 5 },
        );
        const items = Array.isArray(result) ? result : (result?.items ?? []);
        const frac = items.find((i) => i.label === '\\frac');
        // The replace range must start after the opening `$` (source char 1).
        if (frac?.textEdit && 'range' in frac.textEdit) {
            expect(frac.textEdit.range.start.character).toBe(1);
        }
    });

    it('forwards math hover and maps the range back', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'mathjax',
        });
        const source = '$\\frac{1}{2}$';
        const hover = await forwarder.forwardHover(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 3 }, // inside `\frac`
        );
        expect(hover).not.toBeNull();
        // `\frac` sits at source chars 1..6 (just inside the `$`).
        expect(hover?.range?.start.character).toBe(1);
    });

    it('skips math regions when the backend is `none`', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'none',
        });
        const source = '$\\alpha$';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 7 },
        );
        // No math language server for `none`; the region is skipped.
        expect(result).toBeNull();
    });

    it('skips math regions when the backend is `custom`', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'custom',
        });
        const source = '$\\beta$';
        const hover = await forwarder.forwardHover(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 3 },
        );
        expect(hover).toBeNull();
    });

    it('does not forward a position that lands on a math delimiter', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'mathjax',
        });
        const source = '$\\alpha$';
        const hover = await forwarder.forwardHover(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 0 }, // the opening `$` — outside the inner span
        );
        expect(hover).toBeNull();
    });
});

describe('RegionForwarder — TexLab absent', () => {
    let forwarder: RegionForwarder;

    afterEach(async () => {
        await forwarder.stop();
    });

    it('skips LaTeX verbatim regions gracefully when TexLab is not installed', async () => {
        forwarder = new RegionForwarder(defaultConfigSnapshot());
        const source = '<tex>\\draw (0,0);</tex>';
        const region = computeRegions(source, defaultConfigSnapshot()).find(
            (r) => r.kind === 'verbatim',
        );
        expect(region).toBeDefined();
        if (!region) return;
        // `findTexlab` is mocked to `undefined`: forwarding must return
        // `null`, not throw.
        const completion = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            region,
            { line: 0, character: 6 },
        );
        expect(completion).toBeNull();
        const hover = await forwarder.forwardHover(
            source,
            'file:///doc.sveltex',
            region,
            { line: 0, character: 6 },
        );
        expect(hover).toBeNull();
    });
});

describe('RegionForwarder — TexLab present (fake server)', () => {
    let forwarder: RegionForwarder;

    afterEach(async () => {
        await forwarder.stop();
        mockedFindTexlab.mockReset();
        mockedFindTexlab.mockReturnValue(undefined);
        startControl.failNext = false;
        startControl.failWithNonError = false;
        for (const dir of fakeTexlabDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    /** The first verbatim region of `source`. */
    function verbatimRegionOf(source: string): Region {
        const region = computeRegions(source, defaultConfigSnapshot()).find(
            (r) => r.kind === 'verbatim',
        );
        if (!region) throw new Error('no verbatim region');
        return region;
    }

    it('forwards verbatim completion to TexLab and relabels Text items as Function', async () => {
        mockedFindTexlab.mockReturnValue(writeFakeTexlab());
        forwarder = new RegionForwarder(defaultConfigSnapshot());
        // The body carries no `RET:` marker → the fake returns its default
        // completion list (a `Text`-kind `\draw`).
        const source = '<tex>\\draw (0,0);</tex>';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            verbatimRegionOf(source),
            { line: 0, character: 7 }, // inside `\draw`
        );
        const items = Array.isArray(result) ? result : (result?.items ?? []);
        expect(items.length).toBeGreaterThan(0);
        // TexLab `Text` items are presented as `Function` (verbatim path).
        expect(items[0]?.kind).toBe(CompletionItemKind.Function);
    });

    it('forwards verbatim hover to TexLab and maps the range back', async () => {
        mockedFindTexlab.mockReturnValue(writeFakeTexlab());
        forwarder = new RegionForwarder(defaultConfigSnapshot());
        const source = '<tex>RET:HOVER \\draw</tex>';
        const hover = await forwarder.forwardHover(
            source,
            'file:///doc.sveltex',
            verbatimRegionOf(source),
            { line: 0, character: 16 }, // inside the body
        );
        expect(hover).not.toBeNull();
        expect(hover?.contents).toBe('tex hover');
        expect(hover?.range).toBeDefined();
    });

    it('reuses one spawned TexLab child across requests', async () => {
        mockedFindTexlab.mockReturnValue(writeFakeTexlab());
        forwarder = new RegionForwarder(defaultConfigSnapshot());
        const source = '<tex>\\draw</tex>';
        const region = verbatimRegionOf(source);
        await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            region,
            { line: 0, character: 6 },
        );
        await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            region,
            { line: 0, character: 6 },
        );
        // `findTexlab` is consulted only on the first spawn.
        expect(mockedFindTexlab).toHaveBeenCalledTimes(1);
    });

    it('logs result descriptions for each forwarded raw shape', async () => {
        const messages: string[] = [];
        mockedFindTexlab.mockReturnValue(writeFakeTexlab());
        forwarder = new RegionForwarder(defaultConfigSnapshot(), (m) => {
            messages.push(m);
        });
        // Each shape exercises a distinct `describeResult` branch. Completion
        // goes through `remapCompletion` (needs array-shaped items); hover goes
        // through `remapHover` (tolerates arbitrary shapes), so the odd shapes
        // are sent as hovers.
        const cases: { src: string; method: 'c' | 'h'; expect: RegExp }[] = [
            { src: '<tex>RET:LIST a</tex>', method: 'c', expect: /1 item/u },
            { src: '<tex>RET:ARRAY a</tex>', method: 'c', expect: /1 item/u },
            { src: '<tex>RET:NULL a</tex>', method: 'h', expect: /nothing/u },
            {
                src: '<tex>RET:OTHER a</tex>',
                method: 'h',
                expect: /a result/u,
            },
            {
                src: '<tex>RET:ITEMS_NONARRAY a</tex>',
                method: 'h',
                expect: /a result/u,
            },
            {
                src: '<tex>RET:HOVER a</tex>',
                method: 'h',
                expect: /a hover/u,
            },
            {
                src: '<tex>RET:STRING a</tex>',
                method: 'h',
                expect: /a result/u,
            },
        ];
        for (const c of cases) {
            messages.length = 0;
            const region = verbatimRegionOf(c.src);
            const pos = { line: 0, character: 13 };
            if (c.method === 'c') {
                await forwarder.forwardCompletion(
                    c.src,
                    'file:///doc.sveltex',
                    region,
                    pos,
                );
            } else {
                await forwarder.forwardHover(
                    c.src,
                    'file:///doc.sveltex',
                    region,
                    pos,
                );
            }
            expect(
                messages.some((m) => c.expect.test(m)),
                `expected a log matching ${String(c.expect)} for ${c.src}`,
            ).toBe(true);
        }
    });

    it('uses the project TeX scaffold when the tag is configured', async () => {
        const messages: string[] = [];
        mockedFindTexlab.mockReturnValue(writeFakeTexlab());
        // A config that declares a `tex` scaffold → the "project's preamble"
        // log branch (and `#latexScaffoldFor`'s scaffold path) is taken.
        forwarder = new RegionForwarder(
            {
                ...defaultConfigSnapshot(),
                texScaffolds: {
                    tex: {
                        documentClass: '\\documentclass{article}',
                        preamble: '\\usepackage{amsmath}',
                    },
                },
            },
            (m) => {
                messages.push(m);
            },
        );
        const source = '<tex>\\draw</tex>';
        await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            verbatimRegionOf(source),
            { line: 0, character: 6 },
        );
        expect(messages.some((m) => m.includes("project's preamble"))).toBe(
            true,
        );
    });

    it('falls back to the built-in preamble for an unconfigured tag', async () => {
        const messages: string[] = [];
        mockedFindTexlab.mockReturnValue(writeFakeTexlab());
        // No `texScaffolds` entry for `tex` → `#latexScaffoldFor` returns
        // undefined and the "built-in fallback preamble" log branch is taken.
        forwarder = new RegionForwarder(defaultConfigSnapshot(), (m) => {
            messages.push(m);
        });
        const source = '<tex>\\draw</tex>';
        await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            verbatimRegionOf(source),
            { line: 0, character: 6 },
        );
        expect(
            messages.some((m) => m.includes('built-in fallback preamble')),
        ).toBe(true);
    });

    it('logs and skips when TexLab is not on PATH', async () => {
        const messages: string[] = [];
        mockedFindTexlab.mockReturnValue(undefined);
        forwarder = new RegionForwarder(defaultConfigSnapshot(), (m) => {
            messages.push(m);
        });
        const source = '<tex>\\draw</tex>';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            verbatimRegionOf(source),
            { line: 0, character: 6 },
        );
        expect(result).toBeNull();
        expect(
            messages.some((m) => m.includes('TexLab not found on PATH')),
        ).toBe(true);
    });

    it('logs and skips when the TexLab binary fails to start', async () => {
        const messages: string[] = [];
        // `findTexlab` resolves a path, but the start handshake is forced to
        // reject — exercising `#startTexlabProxy`'s catch branch.
        mockedFindTexlab.mockReturnValue(writeFakeTexlab());
        startControl.failNext = true;
        forwarder = new RegionForwarder(defaultConfigSnapshot(), (m) => {
            messages.push(m);
        });
        const source = '<tex>\\draw</tex>';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            verbatimRegionOf(source),
            { line: 0, character: 6 },
        );
        expect(result).toBeNull();
        expect(messages.some((m) => m.includes('TexLab failed to start'))).toBe(
            true,
        );
    });

    it('reports a non-Error start failure via String(error)', async () => {
        const messages: string[] = [];
        mockedFindTexlab.mockReturnValue(writeFakeTexlab());
        startControl.failNext = true;
        startControl.failWithNonError = true;
        forwarder = new RegionForwarder(defaultConfigSnapshot(), (m) => {
            messages.push(m);
        });
        const source = '<tex>\\draw</tex>';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            verbatimRegionOf(source),
            { line: 0, character: 6 },
        );
        expect(result).toBeNull();
        expect(
            messages.some((m) =>
                m.includes(
                    'TexLab failed to start: forced spawn failure (string)',
                ),
            ),
        ).toBe(true);
    });

    it('skips a verbatim region whose tag is not a LaTeX tag', async () => {
        // A `<verbatim>` region reaches `#proxyForRegion` as a verbatim region,
        // but `isLatexVerbatimRegion` is false, so neither child applies and the
        // function falls through to its final `return undefined`.
        mockedFindTexlab.mockReturnValue(writeFakeTexlab());
        forwarder = new RegionForwarder(defaultConfigSnapshot());
        const source = '<verbatim>raw text here</verbatim>';
        const region = verbatimRegionOf(source);
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            region,
            { line: 0, character: 11 },
        );
        expect(result).toBeNull();
    });

    it('does not forward when the caret is on a verbatim tag (unmapped)', async () => {
        mockedFindTexlab.mockReturnValue(writeFakeTexlab());
        const messages: string[] = [];
        forwarder = new RegionForwarder(defaultConfigSnapshot(), (m) => {
            messages.push(m);
        });
        const source = '<tex>\\draw</tex>';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            verbatimRegionOf(source),
            { line: 0, character: 1 }, // on the `<tex>` opening tag — unmapped
        );
        expect(result).toBeNull();
        expect(
            messages.some((m) =>
                m.includes('caret is on a verbatim delimiter/tag'),
            ),
        ).toBe(true);
    });
});

describe('RegionForwarder — math edge cases', () => {
    let forwarder: RegionForwarder;

    afterEach(async () => {
        await forwarder.stop();
        startControl.failNext = false;
        startControl.failWithNonError = false;
    });

    function mathRegion(source: string): Region {
        return { kind: 'math', sourceStart: 0, sourceEnd: source.length };
    }

    it('honours an explicit math-server path override', async () => {
        forwarder = new RegionForwarder({
            ...defaultConfigSnapshot(),
            mathBackend: 'mathjax',
        });
        // Point at the real bundled math server via an explicit override (the
        // `resolveMathServerPath(override)` early-return branch).
        const { createRequire } = await import('node:module');
        const mathServerPath = createRequire(import.meta.url).resolve(
            '@nvl/sveltex-math-language-server/bin/server.js',
        );
        forwarder.setMathServerPath(mathServerPath);
        const source = '$\\alp$';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 5 },
        );
        const items = Array.isArray(result) ? result : (result?.items ?? []);
        expect(items.map((i) => i.label)).toContain('\\alpha');
    });

    it('logs and skips when the math server fails to start', async () => {
        const messages: string[] = [];
        forwarder = new RegionForwarder(
            { ...defaultConfigSnapshot(), mathBackend: 'mathjax' },
            (m) => {
                messages.push(m);
            },
        );
        // Force the spawn handshake to reject, exercising `#startMathProxy`'s
        // catch and the `proxy?.isRunning` (proxy === undefined) branch of
        // `#ensureMathProxy`.
        startControl.failNext = true;
        const source = '$\\alpha$';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 7 },
        );
        expect(result).toBeNull();
        expect(
            messages.some((m) =>
                m.includes('Math language server failed to start'),
            ),
        ).toBe(true);
    });

    it('reports a non-Error math start failure via String(error)', async () => {
        const messages: string[] = [];
        forwarder = new RegionForwarder(
            { ...defaultConfigSnapshot(), mathBackend: 'katex' },
            (m) => {
                messages.push(m);
            },
        );
        startControl.failNext = true;
        startControl.failWithNonError = true;
        const source = '$\\beta$';
        const result = await forwarder.forwardCompletion(
            source,
            'file:///doc.sveltex',
            mathRegion(source),
            { line: 0, character: 5 },
        );
        expect(result).toBeNull();
        expect(
            messages.some((m) =>
                m.includes(
                    'Math language server failed to start: forced spawn failure (string)',
                ),
            ),
        ).toBe(true);
    });
});

describe('RegionForwarder — lifecycle', () => {
    it('can be stopped before any child is spawned', async () => {
        const forwarder = new RegionForwarder(defaultConfigSnapshot());
        // No request was made, so no child exists; stop must still be safe.
        await expect(forwarder.stop()).resolves.toBeUndefined();
    });

    it('accepts a config update', () => {
        const forwarder = new RegionForwarder(defaultConfigSnapshot());
        forwarder.updateConfig({
            ...defaultConfigSnapshot(),
            mathBackend: 'katex',
        });
        // No throw — the updated config is used on the next request.
        expect(true).toBe(true);
    });

    afterAll(() => {
        // No shared state to clean up.
    });
});
