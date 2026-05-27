<script setup lang="ts">
// A compact two-column callout: a Phosphor icon in its own left column, the
// body (slot, with an inlined colored "WARNING"/"NOTE" label) on the right.
import { PhWarning, PhInfo } from '@phosphor-icons/vue';
defineProps<{ type: 'warning' | 'note' }>();
</script>

<template>
    <div class="api-cl" :class="`api-cl--${type}`">
        <PhWarning
            v-if="type === 'warning'"
            weight="fill"
            class="api-cl__icon"
        />
        <PhInfo v-else weight="fill" class="api-cl__icon" />
        <div class="api-cl__body"><slot /></div>
    </div>
</template>
