<script>
    /**
     * @type {{
     *     type?: 'note' | 'tip' | 'warning';
     *     children: import('svelte').Snippet;
     * }}
     */
    let { type = 'note', children } = $props();
</script>

<aside class="callout callout-{type}">
    <p class="callout-label">{type}</p>
    <div class="callout-body">
        {@render children()}
    </div>
</aside>

<style>
    .callout {
        margin: 1.4rem 0;
        border: 1px solid #e3e3ea;
        border-left-width: 4px;
        border-radius: 6px;
        padding: 0.6rem 1rem;
        background: #fff;
    }

    .callout-note {
        border-left-color: #6b3fd4;
    }

    .callout-tip {
        border-left-color: #2f9e8f;
    }

    .callout-warning {
        border-left-color: #d4773f;
    }

    .callout-label {
        margin: 0 0 0.3rem;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #5b5b66;
    }

    .callout-body :global(p:last-child) {
        margin-bottom: 0;
    }
</style>
