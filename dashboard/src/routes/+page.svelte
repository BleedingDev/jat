<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Redirect / to /work (default route)
	onMount(() => {
		goto('/work', { replaceState: true });
	});
</script>

<!-- Redirecting to /work... -->
<div class="min-h-screen bg-base-200 flex items-center justify-center">
	<span class="loading loading-spinner loading-lg"></span>
</div>
