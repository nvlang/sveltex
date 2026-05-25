<script setup lang="ts">
// Inline type + source link, rendered on a property heading's line (so the
// heading text stays just the name, keeping the ToC clean). Type HTML is
// Shiki-highlighted and injected via v-html.
defineProps<{
    typeHtml?: string;
    typeTitle?: string;
    src?: string;
    href?: string;
}>();
</script>

<template>
    <span class="api-sig ignore-header">
        <code
            v-if="typeHtml"
            class="api-type"
            :title="typeTitle || undefined"
            v-html="typeHtml"
        ></code>
        <a
            v-if="href"
            class="api-field__src"
            :href="href"
            target="_blank"
            rel="noreferrer noopener"
            >{{ src }}</a
        >
    </span>
</template>
