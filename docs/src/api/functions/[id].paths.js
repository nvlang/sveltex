// Dynamic route: one page per documented function. The page markdown is derived
// from `@nvl/sveltex`'s TSDoc by `loadApi()` (see `scripts/api-data.mjs`).
// `watch` makes the dev server regenerate these pages whenever the package
// source changes.
import { loadApi } from '../../../scripts/api-data.mjs';

export default {
    watch: ['../../../../packages/sveltex/src/**/*.ts'],
    async paths() {
        const { functions } = await loadApi();
        return functions.map(([id, content]) => ({ params: { id }, content }));
    },
};
