<script lang="ts">
	/**
	 * TaskTableSkeleton Component
	 * Shows animated placeholder rows mimicking the TaskTable structure
	 * Used during initial data loading for a smoother UX
	 */

	interface Props {
		/** Number of skeleton rows to display */
		rows?: number;
		/** Show filter bar skeleton */
		showFilters?: boolean;
	}

	let { rows = 8, showFilters = true }: Props = $props();

	// Deterministic widths to avoid layout shift
	const titleWidths = ['w-64', 'w-48', 'w-56', 'w-72', 'w-52', 'w-60', 'w-44', 'w-68'];
</script>

<!-- Task Table Skeleton - Theme-aware -->
<div class="h-full flex flex-col overflow-hidden bg-base-300">
	{#if showFilters}
		<!-- Filter bar skeleton -->
		<div class="flex items-center gap-2 px-4 py-2 sticky top-0 z-20 bg-base-200 border-b border-base-content/20">
			<!-- Search input skeleton -->
			<div class="skeleton h-8 w-48 rounded bg-base-content/10"></div>

			<!-- Filter dropdowns skeleton -->
			{#each [1, 2, 3, 4] as _}
				<div class="skeleton h-7 w-20 rounded bg-base-content/10"></div>
			{/each}

			<!-- Grouping toggle skeleton -->
			<div class="skeleton h-7 w-24 rounded bg-base-content/10"></div>

			<!-- Right side: task count skeleton -->
			<div class="ml-auto">
				<div class="skeleton h-5 w-16 rounded bg-base-content/10"></div>
			</div>
		</div>
	{/if}

	<!-- Table container -->
	<div class="flex-1 overflow-auto">
		<table class="table table-sm w-full">
			<!-- Table header skeleton -->
			<thead class="sticky top-0 z-10 bg-base-200 border-b border-base-content/20">
				<tr>
					<!-- Checkbox column -->
					<th class="w-8 px-2">
						<div class="skeleton h-4 w-4 rounded bg-base-content/15"></div>
					</th>
					<!-- Status/Priority column -->
					<th class="w-20">
						<div class="skeleton h-4 w-12 rounded bg-base-content/15"></div>
					</th>
					<!-- ID column -->
					<th class="w-24">
						<div class="skeleton h-4 w-16 rounded bg-base-content/15"></div>
					</th>
					<!-- Title column -->
					<th>
						<div class="skeleton h-4 w-12 rounded bg-base-content/15"></div>
					</th>
					<!-- Type column -->
					<th class="w-20">
						<div class="skeleton h-4 w-12 rounded bg-base-content/15"></div>
					</th>
					<!-- Assignee column -->
					<th class="w-32">
						<div class="skeleton h-4 w-16 rounded bg-base-content/15"></div>
					</th>
					<!-- Updated column -->
					<th class="w-28">
						<div class="skeleton h-4 w-16 rounded bg-base-content/15"></div>
					</th>
					<!-- Actions column -->
					<th class="w-16">
						<div class="skeleton h-4 w-10 rounded bg-base-content/15"></div>
					</th>
				</tr>
			</thead>

			<!-- Table body skeleton rows -->
			<tbody>
				{#each Array(rows) as _, i}
					<tr
						class="border-b border-base-content/10 transition-opacity"
						style="animation: pulse 1.5s ease-in-out infinite; animation-delay: {i * 100}ms;"
					>
						<!-- Checkbox -->
						<td class="px-2">
							<div class="skeleton h-4 w-4 rounded bg-base-content/10"></div>
						</td>

						<!-- Status/Priority badges -->
						<td>
							<div class="flex items-center gap-1">
								<div class="skeleton h-5 w-5 rounded-full bg-base-content/15"></div>
								<div class="skeleton h-5 w-8 rounded bg-base-content/15"></div>
							</div>
						</td>

						<!-- Task ID -->
						<td>
							<div class="skeleton h-5 w-20 rounded bg-base-content/10"></div>
						</td>

						<!-- Title - varying widths for natural look -->
						<td>
							<div class="skeleton h-5 {titleWidths[i % titleWidths.length]} rounded bg-base-content/10"></div>
						</td>

						<!-- Type badge -->
						<td>
							<div class="skeleton h-5 w-14 rounded bg-base-content/10"></div>
						</td>

						<!-- Assignee avatar -->
						<td>
							{#if i % 3 !== 0}
								<div class="flex items-center gap-2">
									<div class="skeleton h-6 w-6 rounded-full bg-base-content/15"></div>
									<div class="skeleton h-4 w-16 rounded bg-base-content/10"></div>
								</div>
							{:else}
								<!-- Unassigned placeholder -->
								<div class="skeleton h-4 w-4 rounded opacity-30 bg-base-content/10"></div>
							{/if}
						</td>

						<!-- Updated time -->
						<td>
							<div class="skeleton h-4 w-16 rounded bg-base-content/10"></div>
						</td>

						<!-- Actions -->
						<td>
							<div class="skeleton h-6 w-6 rounded bg-base-content/10"></div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
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
