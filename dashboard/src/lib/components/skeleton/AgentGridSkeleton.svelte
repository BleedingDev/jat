<script lang="ts">
	/**
	 * AgentGridSkeleton Component
	 * Shows animated placeholder cards matching the AgentGrid horizontal scroll layout
	 * Used during initial agent data loading
	 */

	interface Props {
		/** Number of skeleton cards to show */
		cards?: number;
	}

	let { cards = 4 }: Props = $props();
</script>

<!-- Agent Grid Skeleton - Horizontal Scrolling Row - Theme-aware -->
<div class="flex flex-col h-full">
	<div class="p-4 h-full bg-base-300">
		<!-- Horizontal Scrolling Row -->
		<div class="flex gap-4 overflow-x-auto pb-2 h-full">
			{#each Array(cards) as _, i}
				<!-- Compact Agent Card Skeleton (matching SessionCard compact mode) -->
				<div
					class="flex-shrink-0 w-72 rounded-lg overflow-hidden bg-base-200 border border-base-content/20"
					style="animation: fadeIn 0.3s ease-out; animation-delay: {i * 80}ms; animation-fill-mode: both;"
				>
					<!-- Card Header -->
					<div class="flex items-center gap-3 px-3 py-2 bg-base-100 border-b border-base-content/20">
						<!-- Left accent bar -->
						<div class="w-1 h-8 rounded-full skeleton bg-base-content/15"></div>

						<!-- Agent avatar skeleton -->
						<div class="skeleton h-8 w-8 rounded-full bg-base-content/15"></div>

						<!-- Agent name + task info -->
						<div class="flex-1 min-w-0 space-y-1.5">
							<div
								class="skeleton h-4 rounded bg-base-content/15"
								style="width: {[65, 80, 55, 75][i % 4]}%; animation: pulse 1.5s ease-in-out infinite; animation-delay: {i * 100}ms;"
							></div>
							<div
								class="skeleton h-3 rounded bg-base-content/10"
								style="width: {[45, 60, 50, 40][i % 4]}%; animation: pulse 1.5s ease-in-out infinite; animation-delay: {i * 100 + 50}ms;"
							></div>
						</div>

						<!-- Status badge skeleton -->
						<div class="skeleton h-6 w-16 rounded-full bg-base-content/15"></div>
					</div>

					<!-- Card Body - Compact info rows -->
					<div class="px-3 py-2 space-y-2">
						<!-- Task row skeleton -->
						<div class="flex items-center justify-between">
							<div class="skeleton h-3 w-12 rounded bg-base-content/10"></div>
							<div class="skeleton h-4 w-24 rounded bg-base-content/12"></div>
						</div>

						<!-- Tokens/cost row skeleton -->
						<div class="flex items-center justify-between">
							<div class="skeleton h-3 w-16 rounded bg-base-content/10"></div>
							<div class="skeleton h-4 w-14 rounded bg-base-content/12"></div>
						</div>
					</div>

					<!-- Card Footer -->
					<div class="flex items-center justify-between px-3 py-2 bg-base-100 border-t border-base-content/20">
						<!-- Activity indicator -->
						<div class="flex items-center gap-2">
							<div class="skeleton h-3 w-3 rounded-full bg-base-content/15"></div>
							<div class="skeleton h-3 w-20 rounded bg-base-content/10"></div>
						</div>

						<!-- Action button -->
						<div class="skeleton h-6 w-6 rounded bg-base-content/15"></div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateX(-20px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}
</style>
