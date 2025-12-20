<script lang="ts">
	/**
	 * KanbanSkeleton Component
	 * Shows animated placeholder kanban columns during initial load
	 */

	interface Props {
		/** Number of columns to show */
		columns?: number;
		/** Cards per column */
		cardsPerColumn?: number;
	}

	let { columns = 4, cardsPerColumn = 3 }: Props = $props();

	// Column configs for visual variety (semantic state colors)
	const columnLabels = ['STARTING', 'WORKING', 'NEEDS INPUT', 'REVIEW'];
</script>

<!-- Kanban Skeleton - Theme-aware -->
<div class="flex-1 overflow-hidden">
	<div class="flex gap-4 h-full p-4 overflow-x-auto bg-base-300">
		{#each Array(columns) as _, colIndex}
			<!-- Column Skeleton -->
			<div
				class="flex-shrink-0 w-72 flex flex-col rounded-lg overflow-hidden bg-base-200 border border-base-content/20"
				style="animation: fadeIn 0.3s ease-out; animation-delay: {colIndex * 100}ms; animation-fill-mode: both;"
			>
				<!-- Column Header -->
				<div class="flex items-center gap-2 px-3 py-2 bg-base-100 border-b border-base-content/20">
					<!-- Accent dot -->
					<div class="w-2 h-2 rounded-full skeleton bg-primary/50"></div>
					<!-- Label skeleton -->
					<div class="skeleton h-4 w-20 rounded bg-base-content/15"></div>
					<!-- Count badge -->
					<div class="skeleton h-5 w-6 rounded-full ml-auto bg-base-content/10"></div>
				</div>

				<!-- Column Cards -->
				<div class="flex-1 overflow-y-auto p-2 space-y-2">
					{#each Array(cardsPerColumn) as _, cardIndex}
						<!-- Card Skeleton -->
						<div
							class="rounded-lg p-3 bg-base-200 border border-base-content/15"
							style="animation: pulse 1.5s ease-in-out infinite; animation-delay: {(colIndex * cardsPerColumn + cardIndex) * 80}ms;"
						>
							<!-- Card Header -->
							<div class="flex items-center gap-2 mb-2">
								<div class="skeleton h-6 w-6 rounded-full bg-base-content/15"></div>
								<div class="skeleton h-4 w-20 rounded bg-base-content/12"></div>
								<div class="skeleton h-5 w-14 rounded-full ml-auto bg-base-content/10"></div>
							</div>

							<!-- Task info -->
							<div class="space-y-1.5 mb-2">
								<div class="skeleton h-3 w-16 rounded bg-base-content/10"></div>
								<div
									class="skeleton h-4 rounded bg-base-content/12"
									style="width: {[75, 60, 85, 70][cardIndex % 4]}%;"
								></div>
							</div>

							<!-- Footer -->
							<div class="flex items-center justify-between pt-2 border-t border-base-content/10">
								<div class="skeleton h-3 w-12 rounded bg-base-content/10"></div>
								<div class="skeleton h-3 w-8 rounded bg-base-content/10"></div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
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
