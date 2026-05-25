// https://vitepress.dev/guide/custom-theme
import { h } from 'vue';
import type { Theme } from 'vitepress';

import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client';
import '@shikijs/vitepress-twoslash/style.css';

import FloatingVue from 'floating-vue';
// import 'floating-vue/dist/style.css';

import DefaultTheme from 'vitepress/theme-without-fonts';
import './style.css';
import './custom.pcss';
import './fonts/fonts.pcss';
import './api.css';

import { PhArrowUDownRight, PhInfo, PhWarning } from '@phosphor-icons/vue';

import Playground from './playground/Playground.vue';
import ApiField from './components/ApiField.vue';
import ApiSig from './components/ApiSig.vue';
import ApiCallout from './components/ApiCallout.vue';

export default {
    extends: DefaultTheme,
    Layout: () => {
        return h(DefaultTheme.Layout, null, {
            // https://vitepress.dev/guide/extending-default-theme#layout-slots
        });
    },
    enhanceApp({ app }) {
        app.use(TwoslashFloatingVue);
        app.use(FloatingVue, { boundary: 'body' });
        app.component('PhInfo', PhInfo);
        app.component('PhWarning', PhWarning);
        app.component('PhArrowUDownRight', PhArrowUDownRight);
        app.component('Playground', Playground);
        app.component('ApiField', ApiField);
        app.component('ApiSig', ApiSig);
        app.component('ApiCallout', ApiCallout);
        // app.component('PhLightning', PhLightning);
        // app.component('PhHammer', PhHammer);
        // app.component('PhTextT', PhTextT);
        // app.component('PhDatabase', PhDatabase);
        // app.component('PhPalette', PhPalette);
        // app.component('PhBird', PhBird);
    },
} satisfies Theme;
