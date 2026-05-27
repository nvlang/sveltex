<script setup lang="ts">
// Theme-adaptive architecture diagram. All colours reference VitePress CSS
// variables (`--vp-c-*`) and brand variables, so dark/light just works.
//
// Layout: a horizontal main pipeline on top (six stages), with four backend
// "branches" drawn as a dispatch fan from the Re-insert stage. The whole SVG
// scales to its container via `width: 100%` + a fixed `viewBox`.
</script>

<template>
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 820 250"
        width="100%"
        height="auto"
        role="img"
        aria-labelledby="arch-title arch-desc"
        class="architecture-diagram"
    >
        <title id="arch-title">SvelTeX preprocessor architecture</title>
        <desc id="arch-desc">
            A .sveltex source file is escaped, markdown-processed, and
            re-inserted with per-type handlers (math, code, TeX/TikZ,
            verbatim) before being passed to the Svelte compiler as a
            Svelte component.
        </desc>

        <!-- Arrowhead marker (currentColor follows each stroke's colour). -->
        <defs>
            <marker
                id="arch-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
            >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
        </defs>

        <!-- ── Main pipeline (top row) ────────────────────────────── -->
        <g class="diagram-pipeline">
            <!-- 1. .sveltex source -->
            <g class="node node--input">
                <rect x="10" y="30" width="120" height="56" rx="10" ry="10" />
                <text x="70" y="58" text-anchor="middle">.sveltex</text>
                <text x="70" y="74" text-anchor="middle" class="sub">source file</text>
            </g>

            <!-- 2. Escape -->
            <g class="node">
                <rect x="160" y="30" width="110" height="56" rx="10" ry="10" />
                <text x="215" y="58" text-anchor="middle">Escape</text>
                <text x="215" y="74" text-anchor="middle" class="sub">UUID substitute</text>
            </g>

            <!-- 3. Markdown processing -->
            <g class="node">
                <rect x="300" y="30" width="150" height="56" rx="10" ry="10" />
                <text x="375" y="58" text-anchor="middle">Markdown</text>
                <text x="375" y="74" text-anchor="middle" class="sub">micromark / md-it / unified / marked</text>
            </g>

            <!-- 4. Re-insert (dispatch hub) -->
            <g class="node node--hub">
                <rect x="475" y="30" width="135" height="56" rx="10" ry="10" />
                <text x="542" y="58" text-anchor="middle">Re-insert UUIDs</text>
                <text x="542" y="74" text-anchor="middle" class="sub">dispatch to handlers</text>
            </g>

            <!-- 5. Svelte source (terminal — this is what SvelTeX outputs;
                 the Svelte compiler downstream isn't part of SvelTeX itself
                 and is described in the prose, not the diagram). -->
            <g class="node node--terminal">
                <rect x="640" y="30" width="160" height="56" rx="10" ry="10" />
                <text x="720" y="58" text-anchor="middle">Svelte source</text>
                <text x="720" y="74" text-anchor="middle" class="sub">→ Svelte compiler</text>
            </g>

            <!-- Arrows along the main pipeline -->
            <g class="connector connector--main">
                <path d="M 130 58 L 158 58" marker-end="url(#arch-arrow)" />
                <path d="M 270 58 L 298 58" marker-end="url(#arch-arrow)" />
                <path d="M 450 58 L 473 58" marker-end="url(#arch-arrow)" />
                <path d="M 610 58 L 638 58" marker-end="url(#arch-arrow)" />
            </g>
        </g>

        <!-- ── Backend handlers (dispatched from Re-insert) ─────────── -->
        <g class="diagram-handlers">
            <g class="node node--handler">
                <rect x="20" y="180" width="140" height="46" rx="9" ry="9" />
                <text x="90" y="202" text-anchor="middle">Math</text>
                <text x="90" y="216" text-anchor="middle" class="sub">MathJax / KaTeX</text>
            </g>
            <g class="node node--handler">
                <rect x="180" y="180" width="170" height="46" rx="9" ry="9" />
                <text x="265" y="202" text-anchor="middle">Code</text>
                <text x="265" y="216" text-anchor="middle" class="sub">Shiki / starry-night / hljs</text>
            </g>
            <g class="node node--handler">
                <rect x="370" y="180" width="190" height="46" rx="9" ry="9" />
                <text x="465" y="202" text-anchor="middle">TeX / TikZ</text>
                <text x="465" y="216" text-anchor="middle" class="sub">LaTeX → dvisvgm → SVG</text>
            </g>
            <g class="node node--handler">
                <rect x="580" y="180" width="160" height="46" rx="9" ry="9" />
                <text x="660" y="202" text-anchor="middle">Verbatim</text>
                <text x="660" y="216" text-anchor="middle" class="sub">escape / noop</text>
            </g>

            <!-- Dispatch lines: hub → handlers. Arrowheads make the
                 downstream direction explicit; the handlers process the UUID
                 contents and return them to the hub for re-insertion (the
                 return path is implicit — keeping it on the diagram clutters
                 things). -->
            <g class="connector connector--dispatch">
                <path d="M 542 88 L 542 150 L 90  150 L 90  178" marker-end="url(#arch-arrow)" />
                <path d="M 542 88 L 542 150 L 265 150 L 265 178" marker-end="url(#arch-arrow)" />
                <path d="M 542 88 L 542 150 L 465 150 L 465 178" marker-end="url(#arch-arrow)" />
                <path d="M 542 88 L 542 150 L 660 150 L 660 178" marker-end="url(#arch-arrow)" />
            </g>
        </g>
    </svg>
</template>

<style scoped>
.architecture-diagram {
    display: block;
    max-width: 100%;
    font-family: var(--vp-font-family-base);
}

/* ── Boxes (nodes) ───────────────────────────────────────────────── */
.node rect {
    fill: var(--vp-c-bg-soft);
    stroke: var(--vp-c-divider);
    stroke-width: 1;
}
.node text {
    font-size: 13px;
    font-weight: 600;
    fill: var(--vp-c-text-1);
}
.node text.sub {
    font-size: 11px;
    font-weight: 400;
    fill: var(--vp-c-text-2);
}

/* The dispatch hub is brand-tinted so the eye lands there. */
.node--hub rect {
    fill: color-mix(in srgb, var(--vp-c-brand-1) 14%, var(--vp-c-bg-soft));
    stroke: color-mix(in srgb, var(--vp-c-brand-1) 38%, var(--vp-c-divider));
}

/* The terminal node (Svelte compiler) is muted — it's outside SvelTeX. */
.node--terminal rect {
    fill: var(--vp-c-bg-alt);
    stroke-dasharray: 4 3;
    opacity: 0.9;
}

/* Handler row sits at lower opacity until hovered. */
.node--handler rect {
    fill: color-mix(in srgb, var(--vp-c-brand-1) 7%, var(--vp-c-bg-soft));
    stroke: color-mix(in srgb, var(--vp-c-brand-1) 24%, var(--vp-c-divider));
}

/* ── Connectors (arrows + dashed lines) ──────────────────────────── */
.connector path {
    fill: none;
    stroke: var(--vp-c-text-2);
    stroke-width: 1.4;
    color: var(--vp-c-text-2); /* drives the arrowhead via `currentColor` */
}
.connector--dispatch path {
    stroke-dasharray: 5 3;
    opacity: 0.7;
}
</style>
