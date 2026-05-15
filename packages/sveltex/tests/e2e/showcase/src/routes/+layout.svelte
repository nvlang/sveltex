<script>
    let { children } = $props();

    const pages = [
        { href: '/markdown', label: 'Markdown' },
        { href: '/code', label: 'Code' },
        { href: '/math', label: 'Math' },
        { href: '/diagrams', label: 'Diagrams' },
        { href: '/components', label: 'Components' },
        { href: '/blog', label: 'Blog' },
    ];
</script>

<div class="site">
    <header class="site-header">
        <a href="/" class="brand">SvelTeX</a>
        <nav class="site-nav">
            {#each pages as page (page.href)}
                <a href={page.href}>{page.label}</a>
            {/each}
        </nav>
    </header>
    <main class="site-main">
        {@render children()}
    </main>
    <footer class="site-footer">
        <p>Built with SvelteKit and SvelTeX &middot; compiled with Deno.</p>
    </footer>
</div>
