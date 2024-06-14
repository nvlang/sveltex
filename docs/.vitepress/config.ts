import container from 'markdown-it-container';
import { defineConfig } from 'vitepress';
import { transformerTwoslash } from '@shikijs/vitepress-twoslash';
import { githubDarkDefault } from './theme/code-theme.js';

import markdownItMultimdTable from 'markdown-it-multimd-table';

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: 'SvelTeX',
    description: 'Flexible Svelte preprocessor with extensive LaTeX support.',
    markdown: {
        theme: {
            light: 'github-light-default',
            dark: githubDarkDefault,
        },
        math: true,
        codeTransformers: [transformerTwoslash()],
        config: (md) => {
            (md as any).use(markdownItMultimdTable, {
                autolabel: true,
                headerless: true,
                multibody: true,
                multiline: true,
                rowspan: true,
            });
            md.use(container, 'info', {
                render: (tokens, idx) => {
                    const token = tokens[idx];
                    if (token.nesting === 1) {
                        // Opening tag
                        return (
                            '<div class="custom-block info">' +
                            '<div class="icon">' +
                            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info">' +
                            '<circle cx="12" cy="12" r="10"/>' +
                            '<path d="M12 16v-4"/><path d="M12 8h.01"/>' +
                            '</svg>' +
                            '</div>' +
                            '<div class="content">'
                        );
                    } else {
                        // Closing tag
                        return '</div>' + '</div>\n';
                    }
                },
            });
            md.use(container, 'warning', {
                render: (tokens, idx) => {
                    const token = tokens[idx];
                    if (token.nesting === 1) {
                        // Opening tag
                        return (
                            '<div class="custom-block warning">' +
                            '<div class="icon">' +
                            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-triangle-alert">' +
                            '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>' +
                            '<path d="M12 9v4"/>' +
                            '<path d="M12 17h.01"/>' +
                            '</svg>' +
                            '</div>' +
                            '<div class="content">'
                        );
                    } else {
                        // Closing tag
                        return '</div>' + '</div>\n';
                    }
                },
            });
            md.use(container, 'danger', {
                render: (tokens, idx) => {
                    const token = tokens[idx];
                    if (token.nesting === 1) {
                        // Opening tag
                        return (
                            '<div class="custom-block danger">' +
                            '<div class="icon">' +
                            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-x">' +
                            '<circle cx="12" cy="12" r="10"/>' +
                            '<path d="m15 9-6 6"/>' +
                            '<path d="m9 9 6 6"/>' +
                            '</svg>' +
                            '</div>' +
                            '<div class="content">'
                        );
                    } else {
                        // Closing tag
                        return '</div>' + '</div>\n';
                    }
                },
            });
        },
    },
    vue: {},
    appearance: {},

    themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Docs', link: '/docs' },
        ],
        editLink: {
            pattern: 'https://github.com/nvlang/sveltex/edit/main/docs/:path',
            text: 'Suggest changes to this page',
        },
        darkModeSwitchLabel: 'Theme',
        lastUpdated: {
            formatOptions: {
                dateStyle: 'full',
            },
        },
        search: { provider: 'local' },
        notFound: {},
        logo: {
            light: '/light/logo.svg',
            dark: '/dark/logo.svg',
        },
        sidebar: [
            {
                text: 'Introduction',
                base: '/docs',
                collapsed: false,
                items: [
                    { text: 'Overview', link: '/' },
                    { text: 'Getting Started', link: '/getting-started' },
                    { text: 'Acknowledgments', link: '/acknowledgments' },
                ],
            },
            {
                text: 'Usage',
                base: '/docs',
                collapsed: false,
                items: [
                    { text: 'Markdown', link: '/markdown' },
                    { text: 'Code', link: '/code' },
                    { text: 'Math', link: '/math' },
                    { text: 'TeX', link: '/tex' },
                ],
            },
            {
                text: 'Examples',
                link: '/docs/examples',
            },
            {
                text: 'Implementation',
                base: '/docs/implementation',
                collapsed: true,
                items: [
                    { text: 'Escaping', link: '/escaping' },
                    { text: 'Markdown', link: '/markdown' },
                    { text: 'Testing', link: '/testing' },
                    {
                        text: 'TeX',
                        collapsed: false,
                        base: '/docs/implementation/tex',
                        items: [
                            { text: 'Overview', link: '/' },
                            {
                                text: 'Compilation: TeX → DVI',
                                link: '/compilation',
                            },
                            {
                                text: 'Conversion: DVI → SVG',
                                link: '/conversion',
                            },
                            {
                                text: 'Optimization: SVG → Svelte',
                                link: '/optimization',
                            },
                            { text: 'Caching', link: '/caching' },
                            { text: 'Benchmarks', link: '/benchmarks' },
                        ],
                    },
                ],
            },
        ],

        socialLinks: [
            { icon: 'github', link: 'https://github.com/nvlang/sveltex' },
            { icon: 'npm', link: 'https://npmjs.com/package/@nvl/sveltex' },
            {
                icon: {
                    svg: '<svg role="img" style="scale: 1.4; margin-left: 10px;" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>JSR</title><path d="M3.692 5.538v3.693H0v7.384h7.385v1.847h12.923v-3.693H24V7.385h-7.385V5.538Zm1.846 1.847h1.847v7.384H1.846v-3.692h1.846v1.846h1.846zm3.693 0h5.538V9.23h-3.692v1.846h3.692v5.538H9.231V14.77h3.692v-1.846H9.231Zm7.384 1.846h5.539v3.692h-1.846v-1.846h-1.846v5.538h-1.847z"/></svg>',
                },
                link: 'https://jsr.io/@nvl/sveltex',
            },
        ],
    },
    lastUpdated: true,
    srcDir: 'src',
    cleanUrls: true,
    lang: 'en-US',
});
