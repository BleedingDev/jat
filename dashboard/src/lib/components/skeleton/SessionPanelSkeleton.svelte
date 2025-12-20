<script lang="ts">
	/**
	 * SessionPanelSkeleton Component
	 * Shows multiple SessionCardSkeleton components in a horizontal scroll layout
	 * Matches the SessionPanel structure during initial loading
	 */
	import SessionCardSkeleton from './SessionCardSkeleton.svelte';

	interface Props {
		/** Number of skeleton cards to show */
		cards?: number;
	}

	let { cards = 3 }: Props = $props();
</script>

<!-- Session Panel Skeleton - Horizontal scrolling container - Theme-aware -->
<div class="h-full flex flex-col overflow-hidden bg-base-300">
	<!-- Header skeleton -->
	<div class="flex items-center justify-between px-4 py-2 flex-shrink-0 bg-base-200 border-b border-base-content/20">
		<div class="flex items-center gap-3">
			<!-- Title skeleton -->
			<div class="skeleton h-5 w-28 rounded bg-base-content/15"></div>
			<!-- Count badge skeleton -->
			<div class="skeleton h-5 w-8 rounded-full bg-base-content/10"></div>
		</div>
		<!-- Action button skeleton -->
		<div class="skeleton h-8 w-24 rounded bg-base-content/15"></div>
	</div>

	<!-- Cards container - horizontal scroll -->
	<div class="flex-1 overflow-x-auto overflow-y-hidden p-4">
		<div class="flex gap-4 h-full">
			{#each Array(cards) as _, i}
				<div style="animation: fadeIn 0.3s ease-out; animation-delay: {i * 100}ms; animation-fill-mode: both;">
					<SessionCardSkeleton width="w-96" />
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
