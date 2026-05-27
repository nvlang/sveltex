// Dynamic route: one page per documented interface / config type. The page
// markdown is derived from `@nvl/sveltex`'s TSDoc by `loadApi()` (see
// `scripts/api-data.mjs`). `watch` makes the dev server regenerate these pages
// whenever the package source changes.
import { loadApi } from '../../../scripts/api-data.mjs';

export default {
    watch: ['../../../../packages/sveltex/src/**/*.ts'],
    async paths() {
        const { interfaces } = await loadApi();
        return interfaces.map(([id, content]) => ({ params: { id }, content }));
    },
};
