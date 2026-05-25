// Build-time data for the API index table — intro line plus interface/function
// rows (name, link, one-line description rendered to inline HTML). Derived from
// `@nvl/sveltex`'s TSDoc by `loadApi()`; `watch` regenerates on source changes.
import { loadApi } from '../../scripts/api-data.mjs';

export default {
    watch: ['../../../packages/sveltex/src/**/*.ts'],
    async load() {
        const { index } = await loadApi();
        return index;
    },
};
