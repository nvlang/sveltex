<script setup lang="ts">
// File description: Compiler-Explorer-style playground for the SvelTeX
// preprocessing pipeline. The user edits SvelTeX source on the left; the right
// side shows each significant pipeline stage in a tabbed view, with the final
// emitted Svelte code as the default tab. The input pane is itself tabbed --
// the user can switch between the document and a live `sveltex.config.js`
// that is fed to the worker to rebuild the preprocessor.
//
// SAFETY: this component is 100% client-side; everything runs in the user's
// browser, inside a Web Worker. The user's SvelTeX *document* is only ever
// passed to `Sveltex.trace` (pure text transformation) -- it is never mounted,
// `eval`-ed, rendered as Svelte, or bound via `v-html`. The user's SvelTeX
// *configuration*, on the other hand, IS evaluated by the worker via
// `new Function` to construct the preprocessor; that is the whole point of the
// config tab. Config code never leaves the worker and never leaves the
// machine. Every output tab renders inert, escaped text inside a `<pre>`
// element, and the input editor's syntax-highlight layer renders each Shiki
// token as inert, escaped text too (only a token's `color`/`font-style` come
// from the theme).

import {
    ref,
    computed,
    shallowRef,
    onMounted,
    onBeforeUnmount,
    watch,
    nextTick,
} from 'vue';
import { useData } from 'vitepress';
import type { Highlighter } from 'shiki';

interface TraceResult {
    code: string;
    stages: { name: string; output: string }[];
}

type ResponseMessage =
    | { id: number; ok: true; result: TraceResult }
    | {
          id: number;
          ok: false;
          where: 'config' | 'trace';
          error: string;
      };

/** Tab shown when the final Svelte output is selected. */
const SVELTE_OUTPUT_TAB = 'Svelte output';

/** Default SvelTeX source: exercises every pipeline stage. */
const DEFAULT_INPUT = `---
title: SvelTeX Playground
---

# Hello, {data.title}!

This document is being preprocessed **live, in your browser**. Edit the
text on the left and watch each pipeline stage update.

Prose supports _Markdown_: **bold**, \`inline code\`, and [links](https://sveltex.dev).

Inline math like $a^2 + b^2 = c^2$ and display math:

$$
\\int_0^1 x \\, \\mathrm{d}x = \\frac{1}{2}
$$

A fenced code block:

\`\`\`ts
const greet = (name: string): string => \`Hello, \${name}!\`;
\`\`\`
`;

/**
 * Default contents of the `sveltex.config.js` tab: a JavaScript function body
 * the worker evaluates with `mathjaxRequire` in scope to construct the
 * preprocessor. Mirrors what the worker used to hard-code.
 */
const DEFAULT_CONFIG = `// Edit me -- the playground rebuilds the preprocessor on every change.
// This source is the body of a function that runs in the playground's Web
// Worker with \`mathjaxRequire\` injected (so MathJax v4 can lazy-load its
// components and font data, which a browser can't resolve on its own).
// It must \`return { backends, configuration }\` -- the two arguments to
// SvelTeX's \`sveltex()\` factory.

return {
    backends: {
        markdownBackend: 'unified',
        codeBackend: 'shiki',
        mathBackend: 'mathjax',
    },
    configuration: {
        code: {
            // Shiki applies no theme by default; pick a bundled theme so the
            // highlighted code in the output shows colors.
            shiki: { theme: 'github-dark-default' },
        },
        math: {
            // MathJax's css.type accepts only 'hybrid' or 'none' (unlike
            // KaTeX, which also accepts 'cdn'). 'none' tells SvelTeX to
            // manage no MathJax CSS at all.
            css: { type: 'none' },
            // MathJax v4 loads its components and fonts lazily through this
            // hook; the playground's bundle resolves them to modules baked
            // in at build time.
            mathjax: { loader: { require: mathjaxRequire } },
        },
    },
};
`;

const input = ref(DEFAULT_INPUT);
const configText = ref(DEFAULT_CONFIG);
/** Which tab of the input pane is currently shown. */
const inputTab = ref<'document' | 'config'>('document');

// --- Input editor syntax highlighting -----------------------------------
// The input editor is a transparent <textarea> layered over a Shiki-
// highlighted mirror of its text. Highlighting is a progressive enhancement:
// until (or unless) the highlighter loads, the mirror shows plain, uncolored
// text and the editor stays fully usable.

interface EditorToken {
    content: string;
    color?: string;
    fontStyle?: number;
}

const { isDark } = useData();

/** The Shiki highlighter, created lazily on mount. */
const highlighter = shallowRef<Highlighter | null>(null);
/**
 * Flat token stream for the highlight layer: every line's tokens, with the
 * stripped newlines reinserted as `\n` tokens and a trailing zero-width space
 * so the layer's last line always has the same height as the textarea's.
 */
const editorTokens = ref<EditorToken[]>([]);
/** The editable <textarea> and the highlight layer beneath it. */
const inputEl = ref<HTMLTextAreaElement | null>(null);
const highlightEl = ref<HTMLElement | null>(null);

/** Inline style for one token: theme color plus any bold/italic/underline. */
function tokenStyle(token: EditorToken): Record<string, string> {
    const style: Record<string, string> = {};
    if (token.color) style.color = token.color;
    // Shiki's `FontStyle` is a bit field: italic = 1, bold = 2, underline = 4.
    const fontStyle = token.fontStyle ?? 0;
    if (fontStyle & 1) style['font-style'] = 'italic';
    if (fontStyle & 2) style['font-weight'] = '600';
    if (fontStyle & 4) style['text-decoration'] = 'underline';
    return style;
}

/**
 * Tokenize `text` with the given grammar. With no highlighter yet (or if it
 * failed to load), fall back to one plain, uncolored token per line.
 */
function tokenize(text: string, lang: string): EditorToken[][] {
    const hl = highlighter.value;
    if (!hl) return text.split('\n').map((line) => [{ content: line }]);
    return hl.codeToTokensBase(text, {
        lang,
        theme: isDark.value ? 'github-dark-default' : 'github-light-default',
    });
}

/**
 * Flatten tokenized lines into a single stream, reinserting the newlines that
 * `codeToTokensBase` strips between lines as `\n` tokens.
 */
function flattenTokenLines(lines: EditorToken[][]): EditorToken[] {
    const flat: EditorToken[] = [];
    lines.forEach((line, index) => {
        flat.push(...line);
        if (index < lines.length - 1) flat.push({ content: '\n' });
    });
    return flat;
}

/**
 * The text of the editor for the currently active input tab. Reading returns
 * the document or the config; writing forwards back into the right ref so
 * `v-model` on the single underlying textarea Just Works.
 */
const currentEditorText = computed<string>({
    get: () => (inputTab.value === 'document' ? input.value : configText.value),
    set: (val) => {
        if (inputTab.value === 'document') input.value = val;
        else configText.value = val;
    },
});

/** Grammar id used to syntax-highlight the active editor. */
const currentEditorLang = computed(() =>
    inputTab.value === 'document' ? 'sveltex' : 'javascript',
);

/** Re-tokenize the current editor's text into `editorTokens`. */
function updateHighlight(): void {
    const flat = flattenTokenLines(
        tokenize(currentEditorText.value, currentEditorLang.value),
    );
    // Trailing zero-width space: see `editorTokens`.
    flat.push({ content: '\u200b' });
    editorTokens.value = flat;
}

/** Keep the highlight layer scrolled in lockstep with the textarea. */
function syncScroll(): void {
    const textarea = inputEl.value;
    const layer = highlightEl.value;
    if (textarea && layer) {
        layer.scrollTop = textarea.scrollTop;
        layer.scrollLeft = textarea.scrollLeft;
    }
}

/**
 * Lazily build the Shiki highlighter: in parallel, import Shiki, fetch the
 * editor grammars staged into `public/playground/` by
 * `scripts/build-playground.mjs`, and load Shiki's bundled JavaScript grammar
 * (for the `sveltex.config.js` tab). Then load all of them, with both the
 * light and dark themes, into a highlighter and re-highlight.
 */
async function loadHighlighter(): Promise<void> {
    try {
        const [{ createHighlighter }, grammarsResponse, jsGrammarModule] =
            await Promise.all([
                import('shiki'),
                fetch('/playground/editor-grammars.json'),
                import('shiki/langs/javascript.mjs'),
            ]);
        const grammars = (await grammarsResponse.json()) as object[];
        const hl = await createHighlighter({
            themes: ['github-light-default', 'github-dark-default'],
            langs: [],
        });
        await hl.loadLanguage(
            ...(grammars as Parameters<typeof hl.loadLanguage>),
            ...(jsGrammarModule.default as Parameters<typeof hl.loadLanguage>),
        );
        highlighter.value = hl;
        updateHighlight();
    } catch {
        // Highlighting is optional; on failure the plain-text fallback stays.
    }
}

// Initial render of the default input -- uncolored until the highlighter is
// ready, so the editor is never visually blank.
updateHighlight();

/** All tab names, in display order. Populated once the first trace returns. */
const stageNames = ref<string[]>([]);
/** Map of tab name -> stage output text. */
const outputs = ref<Record<string, string>>({});
/** Currently selected tab. Defaults to the final Svelte output. */
const activeTab = ref<string>(SVELTE_OUTPUT_TAB);

const status = ref<'idle' | 'loading' | 'ready' | 'error'>('loading');
const errorMessage = ref<string>('');
/**
 * `'config'` when the most recent failure was building the preprocessor from
 * `configText`; `'trace'` when it was the input itself. Used to give the
 * error panel a more accurate headline.
 */
const errorWhere = ref<'config' | 'trace'>('trace');

const worker = shallowRef<Worker | null>(null);
let requestId = 0;
let latestRequestId = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

/** Tabs to render. Empty until the first successful trace. */
const tabs = computed(() => stageNames.value);

/** Text of the currently selected tab. */
const activeOutput = computed(() => outputs.value[activeTab.value] ?? '');

/**
 * The grammar each output tab is highlighted with. The escaped document is
 * still Markdown (the Markdown backend has not run yet); the later stages are
 * Svelte-flavored markup. Tabs not listed here fall back to `svelte`.
 */
const OUTPUT_TAB_LANGS: Record<string, string> = {
    'Escaped document': 'markdown',
};

/** The active tab's output, tokenized for syntax highlighting. */
const outputTokens = computed(() =>
    flattenTokenLines(
        tokenize(
            activeOutput.value,
            OUTPUT_TAB_LANGS[activeTab.value] ?? 'svelte',
        ),
    ),
);

function sendTrace(): void {
    const w = worker.value;
    if (!w) return;
    status.value = status.value === 'error' ? 'loading' : status.value;
    const id = ++requestId;
    latestRequestId = id;
    w.postMessage({
        id,
        input: input.value,
        config: configText.value,
    });
}

function handleResponse(event: MessageEvent<ResponseMessage>): void {
    const data = event.data;
    // Ignore responses superseded by a newer request.
    if (data.id !== latestRequestId) return;

    if (data.ok) {
        const { code, stages } = data.result;
        if (stages.length === 0 && code.length === 0) {
            // `trace` returns `{ code: '', stages: [] }` when preprocessing
            // throws (e.g. malformed input).
            status.value = 'error';
            errorWhere.value = 'trace';
            errorMessage.value =
                'SvelTeX could not preprocess this input. ' +
                'Check the document for syntax errors and try again.';
            return;
        }
        const next: Record<string, string> = {};
        for (const stage of stages) {
            next[stage.name] = stage.output;
        }
        next[SVELTE_OUTPUT_TAB] = code;
        outputs.value = next;
        stageNames.value = [...stages.map((s) => s.name), SVELTE_OUTPUT_TAB];
        if (!stageNames.value.includes(activeTab.value)) {
            activeTab.value = SVELTE_OUTPUT_TAB;
        }
        status.value = 'ready';
        errorMessage.value = '';
    } else {
        status.value = 'error';
        errorWhere.value = data.where;
        errorMessage.value = data.error;
    }
}

// A change to either the document or the config retraces. The config edit
// triggers a worker-side rebuild of the preprocessor (slow); the document
// edit just re-traces with the cached preprocessor (fast). Both paths funnel
// through the same debounce.
watch([input, configText], () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(sendTrace, 250);
});

// Re-highlight the active editor whenever its content changes, when the user
// switches tabs (the grammar changes), or when the site theme is toggled
// (the two themes assign different token colors).
watch([currentEditorText, inputTab, isDark], () => {
    updateHighlight();
    void nextTick(syncScroll);
});

onMounted(() => {
    // Build the syntax highlighter in the background; until it is ready the
    // editor shows the plain-text fallback rendered during setup.
    void loadHighlighter();

    // The worker is an ES module worker; it imports the pre-built SvelTeX
    // browser bundle from a runtime URL.
    const w = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
    });
    w.addEventListener('message', handleResponse);
    w.addEventListener('error', (e: ErrorEvent) => {
        status.value = 'error';
        errorMessage.value =
            e.message || 'The playground worker failed to start.';
    });
    worker.value = w;
    // Kick off the first trace immediately (no debounce).
    sendTrace();
});

onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    worker.value?.terminate();
    highlighter.value?.dispose();
});

/** Reset the active editor's contents to its default. */
function resetActiveInput(): void {
    if (inputTab.value === 'document') input.value = DEFAULT_INPUT;
    else configText.value = DEFAULT_CONFIG;
}

/** Headline used by the error panel; depends on what failed most recently. */
const errorHeadline = computed(() =>
    errorWhere.value === 'config'
        ? 'Configuration error.'
        : 'Preprocessing failed.',
);
</script>

<template>
    <div class="stx-playground not-prose">
        <div class="stx-playground__panes">
            <!-- Input pane -->
            <section class="stx-pane">
                <header class="stx-pane__head stx-pane__head--tabs">
                    <div
                        class="stx-tabs"
                        role="tablist"
                        aria-label="Input source"
                    >
                        <button
                            type="button"
                            role="tab"
                            class="stx-tab"
                            :class="{
                                'stx-tab--active': inputTab === 'document',
                            }"
                            :aria-selected="inputTab === 'document'"
                            @click="inputTab = 'document'"
                        >
                            +page.sveltex
                        </button>
                        <button
                            type="button"
                            role="tab"
                            class="stx-tab"
                            :class="{
                                'stx-tab--active': inputTab === 'config',
                            }"
                            :aria-selected="inputTab === 'config'"
                            @click="inputTab = 'config'"
                        >
                            sveltex.config.js
                        </button>
                    </div>
                    <button
                        type="button"
                        class="stx-reset"
                        :title="
                            inputTab === 'document'
                                ? 'Reset the document to the example'
                                : 'Reset the configuration to the defaults'
                        "
                        @click="resetActiveInput"
                    >
                        Reset
                    </button>
                </header>
                <div class="stx-editor">
                    <!--
                        Highlight layer: a syntax-colored, non-interactive
                        mirror of the textarea's text. Each token's text is a
                        Vue-escaped interpolation; only its color and font
                        style come from Shiki -- nothing is `v-html`-ed.
                    -->
                    <div
                        ref="highlightEl"
                        class="stx-editor__highlight"
                        aria-hidden="true"
                    >
                        <span
                            v-for="(token, i) in editorTokens"
                            :key="i"
                            :style="tokenStyle(token)"
                            >{{ token.content }}</span
                        >
                    </div>
                    <textarea
                        ref="inputEl"
                        v-model="currentEditorText"
                        class="stx-input"
                        spellcheck="false"
                        autocapitalize="off"
                        autocomplete="off"
                        autocorrect="off"
                        :aria-label="
                            inputTab === 'document'
                                ? 'SvelTeX document source'
                                : 'SvelTeX configuration source'
                        "
                        @scroll="syncScroll"
                    ></textarea>
                </div>
            </section>

            <!-- Output pane -->
            <section class="stx-pane">
                <header class="stx-pane__head stx-pane__head--tabs">
                    <div
                        v-if="tabs.length > 0"
                        class="stx-tabs"
                        role="tablist"
                        aria-label="Pipeline stages"
                    >
                        <button
                            v-for="tab in tabs"
                            :key="tab"
                            type="button"
                            role="tab"
                            class="stx-tab"
                            :class="{ 'stx-tab--active': tab === activeTab }"
                            :aria-selected="tab === activeTab"
                            @click="activeTab = tab"
                        >
                            {{ tab }}
                        </button>
                    </div>
                    <span v-else class="stx-pane__title">Output</span>
                </header>

                <div class="stx-output">
                    <div
                        v-if="status === 'error'"
                        class="stx-message stx-message--error"
                    >
                        <strong>{{ errorHeadline }}</strong>
                        <p>{{ errorMessage }}</p>
                    </div>
                    <div v-else-if="tabs.length === 0" class="stx-message">
                        Loading the SvelTeX preprocessor…
                    </div>
                    <!--
                        Inert output: each token of `activeOutput` is rendered
                        as a Vue-escaped text interpolation; only its color and
                        font style come from Shiki. No markup in the generated
                        output is ever interpreted, executed, or `v-html`-ed.
                    -->
                    <pre v-else class="stx-code" role="tabpanel"><code><span
                            v-for="(token, i) in outputTokens"
                            :key="i"
                            :style="tokenStyle(token)"
                        >{{ token.content }}</span></code></pre>
                </div>
            </section>
        </div>
        <p class="stx-note">
            Runs entirely in your browser — no server is involved, and nothing
            you type leaves your machine. The
            <code>+page.sveltex</code> document is only ever fed to SvelTeX's
            text-only <code>trace</code> step; its code is never executed. The
            <code>sveltex.config.js</code> tab <em>is</em> evaluated (that's the
            point — it constructs the preprocessor), in this worker, never
            elsewhere.
        </p>
    </div>
</template>

<style scoped>
.stx-playground {
    margin: 1.5rem 0;
}

/* The two panes are always stacked vertically, at the page's content width
   -- intentionally simple, and it keeps the playground clear of VitePress's
   right-hand outline column. */
.stx-playground__panes {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
}

.stx-pane {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border: 1px solid var(--vp-c-divider);
    border-radius: 12px;
    overflow: hidden;
    background: var(--vp-code-block-bg, var(--vp-c-bg-alt));
}

.stx-pane__head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--vp-c-bg-soft);
    border-bottom: 1px solid var(--vp-c-divider);
    min-height: 2.75rem;
}

.stx-pane__head--tabs {
    padding: 0 0.75rem 0 0;
}

/* The tab row sits flush-left (each tab carries its own padding); the
   fallback "Output" title, shown until the tabs load, needs that padding. */
.stx-pane__head--tabs .stx-pane__title {
    padding-left: 0.75rem;
}

.stx-pane__title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--vp-c-text-1);
}

.stx-pane__file {
    font-family: var(--vp-font-family-mono);
    font-size: 0.72rem;
    color: var(--vp-c-text-2);
    background: var(--vp-c-default-soft);
    padding: 0.1rem 0.4rem;
    border-radius: 5px;
}

.stx-reset {
    margin-left: auto;
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--vp-c-text-2);
    padding: 0.2rem 0.55rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    transition:
        color 0.2s,
        border-color 0.2s;
}

.stx-reset:hover {
    color: var(--vp-c-brand-1);
    border-color: var(--vp-c-brand-1);
}

.stx-tabs {
    display: flex;
    /* Keep the tab bar on one row; if it ever runs out of width it scrolls
       horizontally rather than wrapping the tabs onto a second row. */
    flex-wrap: nowrap;
    overflow-x: auto;
}

.stx-tab {
    font-size: 0.76rem;
    font-weight: 500;
    color: var(--vp-c-text-2);
    padding: 0.7rem 0.85rem;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    cursor: pointer;
    white-space: nowrap;
    transition:
        color 0.2s,
        border-color 0.2s;
}

.stx-tab:hover {
    color: var(--vp-c-text-1);
}

.stx-tab--active {
    color: var(--vp-c-brand-1);
    border-bottom-color: var(--vp-c-brand-1);
}

.stx-editor {
    position: relative;
    height: 22rem;
    overflow: hidden;
}

/*
 * The highlight layer and the textarea are stacked, pixel-identical boxes:
 * the user types into the transparent textarea on top, and the colored text
 * of the layer beneath shows through. Every property that affects where a
 * glyph lands -- font, size, line height, padding, wrapping, scrollbar
 * gutter -- must match exactly, or the colors drift away from the text.
 */
.stx-editor__highlight,
.stx-input {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 0.85rem 1rem;
    border: none;
    font-family: var(--vp-font-family-mono);
    font-size: 0.82rem;
    line-height: 1.6;
    tab-size: 2;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    scrollbar-gutter: stable;
}

.stx-editor__highlight {
    overflow: hidden;
    pointer-events: none;
    color: var(--vp-c-text-1);
    background: transparent;
}

.stx-input {
    resize: none;
    outline: none;
    overflow: auto;
    background: transparent;
    /* Transparent glyphs -- the highlight layer beneath supplies the color --
       but keep the caret and the text selection visible. */
    color: transparent;
    -webkit-text-fill-color: transparent;
    caret-color: var(--vp-c-text-1);
}

.stx-output {
    height: 22rem;
    overflow: auto;
}

.stx-code {
    margin: 0;
    padding: 0.85rem 1rem;
    background: transparent;
    /*
     * `.stx-output` is the single scroll container, so its scrollbars sit at
     * the pane's edges. This <pre> must not scroll on its own -- otherwise a
     * tab whose output is short but wide (e.g. "Rendered Markdown") gets a
     * horizontal scrollbar partway down the pane instead of at its foot.
     * `width: max-content` lets the <pre> grow to its widest line (so the
     * right padding stays past the end of long lines); `min-width` keeps it
     * filling the pane for short output.
     */
    width: max-content;
    min-width: 100%;
}

.stx-code code {
    display: block;
    font-family: var(--vp-font-family-mono);
    font-size: 0.8rem;
    line-height: 1.6;
    color: var(--vp-c-text-1);
    background: transparent;
    white-space: pre;
    padding: 0;
}

.stx-message {
    padding: 1rem;
    font-size: 0.85rem;
    color: var(--vp-c-text-2);
}

.stx-message--error {
    color: var(--vp-c-text-1);
}

.stx-message--error strong {
    color: var(--vp-c-red-1, var(--vp-c-danger-1));
}

.stx-message--error p {
    margin: 0.4rem 0 0;
    font-family: var(--vp-font-family-mono);
    font-size: 0.78rem;
    color: var(--vp-c-text-2);
    white-space: pre-wrap;
}

.stx-note {
    margin: 0.85rem 0 0;
    font-size: 0.78rem;
    color: var(--vp-c-text-3);
    line-height: 1.5;
}

.stx-note code {
    font-family: var(--vp-font-family-mono);
    font-size: 0.74rem;
}
</style>
