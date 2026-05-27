<script setup lang="ts">
import { ref } from 'vue';
import { useData, withBase } from 'vitepress';
import { PhDotsThreeOutline } from '@phosphor-icons/vue';

// Editor setup tabs for the "Editor integration" page. Editor logos are used as
// provided (no recolouring or distortion), per each project's brand guidelines:
// VS Code permits its icon in documentation and as a link to its site; Zed
// permits its full-black / full-white marks, so `zed-light` / `zed-dark` are
// swapped for the active theme; Open VSX (an Eclipse Foundation mark) is used
// unmodified. The VS-Code-compatible editors are grouped under the Open VSX tab,
// and other editors under "Others".
const { isDark } = useData();

const editors = [
    { id: 'vscode', name: 'VS Code', logo: 'vscode.svg' },
    { id: 'zed', name: 'Zed', logo: 'zed-light.svg', logoDark: 'zed-dark.svg' },
    { id: 'openvsx', name: 'Open VSX', logo: 'open-vsx.svg' },
    { id: 'others', name: 'Others', icon: PhDotsThreeOutline },
];

const active = ref(editors[0].id);
const logoSrc = (e: (typeof editors)[number]) =>
    withBase('/logos/' + (isDark.value && e.logoDark ? e.logoDark : e.logo));
</script>

<template>
    <div class="editor-tabs">
        <div class="editor-tabs__bar" role="tablist" aria-label="Editor">
            <button
                v-for="e in editors"
                :key="e.id"
                type="button"
                role="tab"
                :aria-selected="active === e.id"
                :class="['editor-tabs__tab', { 'is-active': active === e.id }]"
                @click="active = e.id"
            >
                <img
                    v-if="e.logo"
                    class="editor-tabs__logo"
                    :src="logoSrc(e)"
                    :alt="`${e.name} logo`"
                    loading="lazy"
                />
                <component
                    :is="e.icon"
                    v-else
                    class="editor-tabs__icon"
                    :size="20"
                    weight="fill"
                />
                <span class="editor-tabs__name">{{ e.name }}</span>
            </button>
        </div>
        <div class="editor-tabs__panel" role="tabpanel">
            <slot :name="active" />
        </div>
    </div>
</template>
