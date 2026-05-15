<script>
    let count = $state(0);
</script>

<button class="counter" onclick={() => (count += 1)}>
    Clicked {count} {count === 1 ? 'time' : 'times'}
</button>

<style>
    .counter {
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        padding: 0.4rem 0.9rem;
        border: 1px solid #6b3fd4;
        border-radius: 6px;
        background: #efe9fc;
        color: #2c2740;
    }

    .counter:hover {
        background: #6b3fd4;
        color: #fff;
    }
</style>
