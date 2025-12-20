<script lang="ts">
	/**
	 * TimelineSkeleton Component
	 * Shows animated placeholder for the timeline/gantt visualization
	 */

	interface Props {
		/** Number of task bars */
		tasks?: number;
	}

	let { tasks = 8 }: Props = $props();

	// Varying task bar widths for visual variety
	const taskWidths = [60, 40, 75, 55, 45, 70, 35, 65];
	const taskOffsets = [5, 25, 10, 40, 20, 15, 50, 30];
</script>

<!-- Timeline Skeleton - Theme-aware -->
<div class="min-h-screen bg-base-300">
	<!-- Filter Bar Skeleton -->
	<div class="p-4 bg-base-200 border-b border-base-content/20">
		<div class="flex flex-wrap items-center gap-4">
			<!-- Priority filter -->
			<div class="form-control">
				<div class="skeleton h-4 w-14 rounded mb-1 bg-base-content/10"></div>
				<div class="skeleton h-8 w-32 rounded bg-base-content/8"></div>
			</div>
			<!-- Status filter -->
			<div class="form-control">
				<div class="skeleton h-4 w-12 rounded mb-1 bg-base-content/10"></div>
				<div class="skeleton h-8 w-28 rounded bg-base-content/8"></div>
			</div>
			<!-- Search -->
			<div class="form-control">
				<div class="skeleton h-4 w-12 rounded mb-1 bg-base-content/10"></div>
				<div class="skeleton h-8 w-40 rounded bg-base-content/8"></div>
			</div>
		</div>
	</div>

	<!-- Gantt Chart Skeleton -->
	<div class="p-4">
		<div class="rounded-lg overflow-hidden bg-base-200 border border-base-content/20">
			<!-- Header row (time columns) -->
			<div class="flex items-center gap-2 px-4 py-3 bg-base-100 border-b border-base-content/20">
				<div class="w-48 flex-shrink-0">
					<div class="skeleton h-4 w-20 rounded bg-base-content/15"></div>
				</div>
				<div class="flex-1 flex justify-between">
					{#each Array(6) as _, i}
						<div class="skeleton h-4 w-12 rounded bg-base-content/12"></div>
					{/each}
				</div>
			</div>

			<!-- Task rows -->
			<div class="divide-y divide-base-content/10">
				{#each Array(tasks) as _, i}
					<div
						class="flex items-center gap-2 px-4 py-3"
						style="animation: pulse 1.5s ease-in-out infinite; animation-delay: {i * 100}ms;"
					>
						<!-- Task name column -->
						<div class="w-48 flex-shrink-0 flex items-center gap-2">
							<!-- Priority dot -->
							<div class="skeleton w-2 h-2 rounded-full bg-primary/40"></div>
							<!-- Task ID -->
							<div
								class="skeleton h-4 rounded bg-base-content/12"
								style="width: {[60, 72, 56, 68, 64, 76, 52, 70][i % 8]}px;"
							></div>
						</div>

						<!-- Gantt bar area -->
						<div class="flex-1 relative h-6">
							<!-- Grid lines (subtle) -->
							<div class="absolute inset-0 flex justify-between opacity-20">
								{#each Array(6) as _}
									<div class="w-px h-full bg-base-content/25"></div>
								{/each}
							</div>

							<!-- Task bar -->
							<div
								class="absolute top-1 h-4 rounded skeleton bg-primary/20"
								style="left: {taskOffsets[i % taskOffsets.length]}%; width: {taskWidths[i % taskWidths.length]}%;"
							></div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Center loading indicator -->
		<div class="flex items-center justify-center mt-8">
			<div class="flex flex-col items-center gap-3">
				<div class="w-10 h-10 rounded-full border-2 animate-spin border-primary border-t-transparent"></div>
				<span class="text-xs font-mono text-base-content/50">Loading timeline...</span>
			</div>
		</div>
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
