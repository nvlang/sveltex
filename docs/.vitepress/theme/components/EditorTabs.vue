<script setup lang="ts">
import { ref } from 'vue';
import { useData, withBase } from 'vitepress';

// Editor setup tabs for the "Editor integration" page. Each editor's logo is
// used as provided (no recolouring or distortion), per the respective brand
// guidelines; Theia and Zed ship light/dark marks, so we swap to the legible
// one for the active theme.
const { isDark } = useData();

const editors = [
    { id: 'vscode', name: 'VS Code', logo: 'vscode.svg' },
    { id: 'cursor', name: 'Cursor', logo: 'cursor.svg' },
    { id: 'vscodium', name: 'VSCodium', logo: 'vscodium.svg' },
    {
        id: 'theia',
        name: 'Theia',
        logo: 'theia-light.svg',
        logoDark: 'theia-dark.svg',
    },
    { id: 'zed', name: 'Zed', logo: 'zed-light.svg', logoDark: 'zed-dark.svg' },
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
                    class="editor-tabs__logo"
                    :src="logoSrc(e)"
                    :alt="`${e.name} logo`"
                    loading="lazy"
                />
                <span class="editor-tabs__name">{{ e.name }}</span>
            </button>
        </div>
        <div class="editor-tabs__panel" role="tabpanel">
            <slot :name="active" />
        </div>
    </div>
</template>
