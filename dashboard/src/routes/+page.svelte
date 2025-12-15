<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Redirect / to /projects (default route)
	onMount(() => {
		goto('/projects', { replaceState: true });
	});
</script>

<!-- Redirecting to /projects... -->
<div class="min-h-screen bg-base-200 flex items-center justify-center">
	<span class="loading loading-spinner loading-lg"></span>
</div>
