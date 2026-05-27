<script setup lang="ts">
// A nested API property "field" card: monospace name (a permalink anchor to
// this field's id), a syntax-highlighted type (Shiki HTML via v-html), an
// optional source link, and the description (+ deeper fields) in the slot.
defineProps<{
    name?: string;
    optional?: boolean;
    src?: string;
    href?: string;
    id?: string;
    typeHtml?: string;
    typeTitle?: string;
}>();
</script>

<template>
    <div class="api-field" :class="{ 'api-field--nested': id }" :id="id">
        <div class="api-field__sig">
            <a
                v-if="id && name"
                class="api-field__name"
                :href="'#' + id"
                >{{ name }}<span v-if="optional" class="api-field__opt"
                    >?</span
                ></a
            >
            <code v-else-if="name" class="api-field__name"
                >{{ name }}<span v-if="optional" class="api-field__opt"
                    >?</span
                ></code
            >
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
        </div>
        <div class="api-field__doc"><slot /></div>
    </div>
</template>
