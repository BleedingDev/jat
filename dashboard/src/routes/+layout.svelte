<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { themeChange } from 'theme-change';
	import CommandPalette from '$lib/components/CommandPalette.svelte';

	let { children } = $props();

	// Initialize theme-change library for DaisyUI themes
	onMount(() => {
		themeChange(false);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Global Command Palette (Cmd+K / Ctrl+K) -->
<CommandPalette />

{@render children()}
