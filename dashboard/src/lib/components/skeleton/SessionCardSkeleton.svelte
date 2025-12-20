<script lang="ts">
	/**
	 * SessionCardSkeleton Component
	 * Shows animated placeholder matching the SessionCard integrated header bar layout (Concept B)
	 * Used during initial work session loading
	 */

	interface Props {
		/** Width of the card (matches SessionCard default) */
		width?: string;
		/** Mode: 'agent' or 'server' */
		mode?: 'agent' | 'server';
	}

	let { width = 'w-96', mode = 'agent' }: Props = $props();
</script>

<!-- Session Card Skeleton - Theme-aware with integrated header bar -->
<div class="{width} flex-shrink-0 rounded-lg overflow-hidden flex flex-col bg-base-200 border border-base-content/20">
	<!-- Status accent bar - left edge -->
	<div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-base-content/30"></div>

	{#if mode === 'agent'}
		<!-- Task content skeleton (Task-First Layout) -->
		<div class="px-3 py-2 flex-shrink-0 border-b border-base-content/20">
			<!-- Task ID + Title row -->
			<div class="flex items-start gap-2 mb-1">
				<div class="skeleton h-5 w-16 rounded bg-base-content/15"></div>
				<div class="skeleton h-5 flex-1 rounded bg-base-content/12"></div>
			</div>
			<!-- Description -->
			<div class="skeleton h-4 w-4/5 rounded bg-base-content/8"></div>
		</div>

		<!-- Agent bar skeleton (below task) -->
		<div class="flex items-center justify-between px-3 py-1.5 flex-shrink-0 bg-base-100 border-b border-base-content/15">
			<!-- Left: Avatar + Name + Elapsed Time -->
			<div class="flex items-center gap-2 min-w-0">
				<div class="skeleton h-6 w-6 rounded-full shrink-0 bg-base-content/12"></div>
				<div class="flex flex-col min-w-0 gap-0.5">
					<div class="skeleton h-3.5 w-16 rounded bg-base-content/15"></div>
					<div class="skeleton h-3 w-12 rounded bg-base-content/10"></div>
				</div>
			</div>
			<!-- Right: Sparkline + Context + Status -->
			<div class="flex items-center gap-2">
				<div class="skeleton h-3.5 w-14 rounded bg-base-content/10"></div>
				<div class="skeleton h-1.5 w-14 rounded bg-base-content/12"></div>
				<div class="w-px h-4 bg-base-content/20"></div>
				<div class="skeleton h-5 w-16 rounded-full bg-base-content/12"></div>
			</div>
		</div>
	{:else}
		<!-- Server header bar skeleton -->
		<div class="flex items-center justify-between px-3 py-2 flex-shrink-0 bg-base-100 border-b border-base-content/20">
			<div class="flex items-center gap-2 min-w-0">
				<div class="skeleton h-7 w-7 rounded shrink-0 bg-base-content/15"></div>
				<div class="flex flex-col min-w-0 gap-0.5">
					<div class="skeleton h-4 w-20 rounded bg-base-content/18"></div>
					<div class="skeleton h-3.5 w-14 rounded bg-base-content/12"></div>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<div class="skeleton h-4 w-12 rounded bg-base-content/10"></div>
				<div class="w-px h-5 bg-base-content/20"></div>
				<div class="skeleton h-6 w-18 rounded-full bg-base-content/15"></div>
			</div>
		</div>
	{/if}

	<!-- Terminal output skeleton -->
	<div class="flex-1 min-h-0 p-3 space-y-2 bg-base-300 border-t border-base-content/10">
		<!-- Fake terminal lines with staggered animation -->
		{#each [1, 2, 3, 4, 5, 6] as line, i}
			<div
				class="flex items-center gap-2"
				style="animation: pulse 1.5s ease-in-out infinite; animation-delay: {i * 100}ms;"
			>
				<!-- Prompt skeleton -->
				<div class="skeleton h-3 w-4 rounded opacity-50 bg-base-content/20"></div>
				<!-- Line content - varying widths -->
				<div
					class="skeleton h-3 rounded bg-base-content/10"
					style="width: {[70, 45, 85, 30, 60, 50][i % 6]}%;"
				></div>
			</div>
		{/each}
	</div>

	<!-- Input section skeleton -->
	<div class="flex items-center gap-2 px-3 py-2 flex-shrink-0 bg-base-200 border-t border-base-content/20">
		<div class="skeleton h-8 flex-1 rounded bg-base-content/8"></div>
		<div class="skeleton h-8 w-16 rounded bg-base-content/12"></div>
	</div>
</div>

<style>
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}
</style>
