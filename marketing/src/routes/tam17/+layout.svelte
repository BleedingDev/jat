<script lang="ts">
	let { children } = $props();
</script>

<div class="tam-layout">{@render children()}</div>

<style>
	.tam-layout { min-height: 100vh; background: #000; }
</style>
