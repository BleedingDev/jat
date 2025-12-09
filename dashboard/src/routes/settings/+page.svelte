<script lang="ts">
	import ReviewRulesEditor from '$lib/components/ReviewRulesEditor.svelte';
	import SignalDebugWidget from '$lib/components/SignalDebugWidget.svelte';
</script>

<div class="p-6 max-w-4xl mx-auto">
	<h1 class="text-2xl font-bold mb-6">Settings</h1>

	<div class="space-y-8">
		<ReviewRulesEditor />

		<!-- Debug section -->
		<div>
			<h2 class="text-lg font-semibold mb-4" style="color: oklch(0.75 0.02 250);">Debug Tools</h2>
			<SignalDebugWidget />
		</div>
	</div>
</div>
