import { defineConfig } from 'vitepress';
import { transformerTwoslash } from '@shikijs/vitepress-twoslash';

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: 'SvelTeX',
    description: 'Flexible Svelte preprocessor with extensive LaTeX support.',
    markdown: {
        codeTransformers: [transformerTwoslash()],
    },
    themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Docs', link: '/docs' },
        ],
        editLink: {
            pattern: 'https://github.com/nvlang/sveltex/edit/main/docs/:path',
            text: 'Edit this page on GitHub',
        },
        darkModeSwitchLabel: 'Theme',
        lastUpdated: {
            formatOptions: {
                dateStyle: 'full',
            },
        },
        search: { provider: 'local' },
        notFound: {},
        logo: '/logo.svg',
        sidebar: [
            {
                text: 'Introduction',
                base: '/docs',
                collapsed: false,
                items: [
                    { text: 'Getting Started', link: '/getting-started' },
                    { text: 'Configuration', link: '/config' },
                ],
            },
            {
                text: 'Essentials',
                base: '/docs',
                collapsed: false,
                items: [
                    { text: 'Markdown', link: '/markdown' },
                    { text: 'Code', link: '/code' },
                    { text: 'Math', link: '/math' },
                ],
            },
            {
                text: 'LaTeX',
                base: '/docs',
                collapsed: false,
                items: [
                    { text: 'Overview', link: '/overview' },
                    {
                        text: 'Compilation: TeX --> DVI',
                        link: '/compilation',
                    },
                    {
                        text: 'Conversion: DVI --> SVG',
                        link: '/conversion',
                    },
                    {
                        text: 'Optimization: SVG --> Svelte',
                        link: '/optimization',
                    },
                ],
            },
        ],

        socialLinks: [
            { icon: 'github', link: 'https://github.com/nvlang/sveltex' },
        ],
    },
    lastUpdated: true,
    srcDir: 'src',
    cleanUrls: true,
    lang: 'en-US',
});
