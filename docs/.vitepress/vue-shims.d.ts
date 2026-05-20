/**
 * Vue SFC module shim — declares that `*.vue` files default-export a Vue
 * component so that imports like `import Foo from './Foo.vue'` resolve in
 * IDEs running plain `tsc` (rather than `vue-tsc`). VitePress builds the
 * SFCs internally with its own pipeline; this file only exists for the
 * type-checker's view of `.ts` source.
 */
declare module '*.vue' {
    import type { DefineComponent } from 'vue';
    const component: DefineComponent<object, object, unknown>;
    export default component;
}

/**
 * Style-asset shims. Vite handles `*.css` / `*.pcss` / `*.scss` /
 * `*.sass` imports natively, but TS 6's `noUncheckedSideEffectImports`
 * (on by default) rejects `import './style.css'` without a declaration.
 * Declare them as opaque modules so the side-effect imports type-check
 * while the bundler does the real work at build time.
 */
declare module '*.css';
declare module '*.pcss';
declare module '*.scss';
declare module '*.sass';
