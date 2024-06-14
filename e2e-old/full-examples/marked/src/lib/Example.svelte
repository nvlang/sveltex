<script lang="ts">
    export let title: string;
</script>

<span>
    {#if title}
        <strong>{title}</strong>:
    {/if}
    <slot />
</span>

<style>
    span {
        border: 1px solid #ccc;
        padding: 2px 5px;
    }
</style>
