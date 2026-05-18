<script setup lang="ts">
// File description: Compiler-Explorer-style playground for the SvelTeX
// preprocessing pipeline. The user edits SvelTeX source on the left; the right
// side shows each significant pipeline stage in a tabbed view, with the final
// emitted Svelte code as the default tab.
//
// SAFETY: this component is 100% client-side and runs *only* `Sveltex.trace`
// (pure text transformation) inside a Web Worker. The source document's code is
// never executed. Every output tab renders inert, escaped text inside a `<pre>`
// element, and the input editor's syntax-highlight layer renders each Shiki
// token as inert, escaped text too (only a token's `color`/`font-style` come
// from the theme) -- the input and the generated output are never mounted,
// `eval`-ed, rendered as Svelte, or bound via `v-html` into any executable
// context.

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
    | { id: number; ok: false; error: string };

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

const input = ref(DEFAULT_INPUT);

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

/** Re-tokenize the current input into `editorTokens`. */
function updateHighlight(): void {
    const flat = flattenTokenLines(tokenize(input.value, 'sveltex'));
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
 * Lazily build the Shiki highlighter: in parallel, import Shiki and fetch the
 * editor grammars staged into `public/playground/` by
 * `scripts/build-playground.mjs`, then load the grammars (with both the light
 * and dark themes) into a highlighter and re-highlight.
 */
async function loadHighlighter(): Promise<void> {
    try {
        const [{ createHighlighter }, grammarsResponse] = await Promise.all([
            import('shiki'),
            fetch('/playground/editor-grammars.json'),
        ]);
        const grammars = (await grammarsResponse.json()) as object[];
        const hl = await createHighlighter({
            themes: ['github-light-default', 'github-dark-default'],
            langs: [],
        });
        await hl.loadLanguage(
            ...(grammars as Parameters<typeof hl.loadLanguage>),
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

const worker = shallowRef<Worker | null>(null);
let requestId = 0;
let latestRequestId = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

/** Tabs to render. Empty until the first successful trace. */
const tabs = computed(() => stageNames.value);

/** Text of the currently selected tab. */
const activeOutput = computed(() => outputs.value[activeTab.value] ?? '');

/**
 * The active tab's output, tokenized for syntax highlighting. Every pipeline
 * stage is Svelte-flavored markup, so all tabs use the `svelte` grammar.
 */
const outputTokens = computed(() =>
    flattenTokenLines(tokenize(activeOutput.value, 'svelte')),
);

function sendTrace(): void {
    const w = worker.value;
    if (!w) return;
    status.value = status.value === 'error' ? 'loading' : status.value;
    const id = ++requestId;
    latestRequestId = id;
    w.postMessage({ id, input: input.value });
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
        stageNames.value = [
            ...stages.map((s) => s.name),
            SVELTE_OUTPUT_TAB,
        ];
        if (!stageNames.value.includes(activeTab.value)) {
            activeTab.value = SVELTE_OUTPUT_TAB;
        }
        status.value = 'ready';
        errorMessage.value = '';
    } else {
        status.value = 'error';
        errorMessage.value = data.error;
    }
}

watch(input, () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(sendTrace, 250);
});

// Re-highlight the input on every edit, and whenever the site theme is
// toggled (the light and dark themes assign different token colors).
watch([input, isDark], () => {
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

function resetInput(): void {
    input.value = DEFAULT_INPUT;
}
</script>

<template>
    <div class="stx-playground not-prose">
        <div class="stx-playground__panes">
            <!-- Input pane -->
            <section class="stx-pane">
                <header class="stx-pane__head">
                    <span class="stx-pane__title">Input</span>
                    <code class="stx-pane__file">+page.sveltex</code>
                    <button
                        type="button"
                        class="stx-reset"
                        title="Reset the input to the example document"
                        @click="resetInput"
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
                    ><span
                            v-for="(token, i) in editorTokens"
                            :key="i"
                            :style="tokenStyle(token)"
                        >{{ token.content }}</span></div>
                    <textarea
                        ref="inputEl"
                        v-model="input"
                        class="stx-input"
                        spellcheck="false"
                        autocapitalize="off"
                        autocomplete="off"
                        autocorrect="off"
                        aria-label="SvelTeX source input"
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
                    <span
                        class="stx-status"
                        :class="`stx-status--${status}`"
                    >
                        <template v-if="status === 'loading'"
                            >Preprocessing…</template
                        >
                        <template v-else-if="status === 'ready'"
                            >Up to date</template
                        >
                        <template v-else-if="status === 'error'"
                            >Error</template
                        >
                    </span>
                </header>

                <div class="stx-output">
                    <div
                        v-if="status === 'error'"
                        class="stx-message stx-message--error"
                    >
                        <strong>Preprocessing failed.</strong>
                        <p>{{ errorMessage }}</p>
                    </div>
                    <div
                        v-else-if="tabs.length === 0"
                        class="stx-message"
                    >
                        Loading the SvelTeX preprocessor…
                    </div>
                    <!--
                        Inert output: each token of `activeOutput` is rendered
                        as a Vue-escaped text interpolation; only its color and
                        font style come from Shiki. No markup in the generated
                        output is ever interpreted, executed, or `v-html`-ed.
                    -->
                    <pre
                        v-else
                        class="stx-code"
                        role="tabpanel"
                    ><code><span
                            v-for="(token, i) in outputTokens"
                            :key="i"
                            :style="tokenStyle(token)"
                        >{{ token.content }}</span></code></pre>
                </div>
            </section>
        </div>
        <p class="stx-note">
            Runs entirely in your browser via a Web Worker. The playground
            only performs SvelTeX's text transformation
            (<code>Sveltex.trace</code>); your document's code is never
            executed.
        </p>
    </div>
</template>

<style scoped>
.stx-playground {
    margin: 1.5rem 0;
}

/*
 * On wide viewports the playground would otherwise be capped at the narrow
 * VitePress prose-column width, leaving each output pane too cramped for the
 * tab bar to fit on one row. Break the playground out of that column,
 * expanding it rightward (into the otherwise-empty right margin) so both panes
 * are roomy. The expansion grows with the viewport and is capped so the
 * playground never overflows the page content area; below 1280px it is 0, so
 * narrow layouts are unaffected.
 */
@media (min-width: 1280px) {
    .stx-playground {
        --stx-expand: clamp(0px, 100vw - 1010px, 300px);
        width: calc(100% + var(--stx-expand));
        margin-right: calc(-1 * var(--stx-expand));
    }
}

.stx-playground__panes {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
}

@media (min-width: 960px) {
    .stx-playground__panes {
        grid-template-columns: 1fr 1fr;
    }
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
    /*
     * Keep the tab bar a single horizontal row. On wide viewports the widened
     * output pane (see `.stx-playground` above) has ample room for every tab;
     * on narrow ones the row scrolls horizontally rather than stacking the
     * tabs vertically.
     */
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

.stx-status {
    margin-left: auto;
    padding-right: 0.75rem;
    font-size: 0.7rem;
    font-weight: 500;
    white-space: nowrap;
}

.stx-status--loading {
    color: var(--vp-c-text-3);
}

.stx-status--ready {
    color: var(--vp-c-green-1, var(--vp-c-brand-1));
}

.stx-status--error {
    color: var(--vp-c-red-1, var(--vp-c-danger-1));
}

.stx-editor {
    position: relative;
    flex: 1;
    min-height: 22rem;
    resize: vertical;
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
    flex: 1;
    min-height: 22rem;
    overflow: auto;
}

.stx-code {
    margin: 0;
    padding: 0.85rem 1rem;
    background: transparent;
    overflow: auto;
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
