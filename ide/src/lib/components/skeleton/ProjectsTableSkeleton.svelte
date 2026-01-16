<script lang="ts">
	/**
	 * ProjectsTableSkeleton Component
	 * Shows animated placeholder rows for the projects table on /servers page.
	 *
	 * Columns match actual table: Project, Color, Port, Server, Last, Tasks, Agents, Desc, Show
	 */

	interface Props {
		/** Number of skeleton rows */
		rows?: number;
	}

	let { rows = 6 }: Props = $props();

	// Varying name widths for natural look
	const nameWidths = ['w-24', 'w-32', 'w-28', 'w-20', 'w-36', 'w-26'];
	// Varying description widths
	const descWidths = [60, 80, 45, 70, 55, 75];
</script>

<!-- Projects Table Skeleton - Theme-aware -->
<div class="h-full bg-base-300">
	<table class="w-full">
		<!-- Table Header - matches /servers page exactly -->
		<thead>
			<tr class="bg-base-200 border-b border-base-content/20">
				<!-- Project -->
				<th class="px-4 py-3 text-left">
					<div class="skeleton h-3 w-14 rounded bg-base-content/15"></div>
				</th>
				<!-- Color -->
				<th class="px-2 py-3 text-center">
					<div class="skeleton h-3 w-10 rounded bg-base-content/15 mx-auto"></div>
				</th>
				<!-- Port -->
				<th class="px-3 py-3 text-left">
					<div class="skeleton h-3 w-8 rounded bg-base-content/15"></div>
				</th>
				<!-- Server -->
				<th class="px-3 py-3 text-left">
					<div class="skeleton h-3 w-12 rounded bg-base-content/15"></div>
				</th>
				<!-- Last -->
				<th class="px-3 py-3 text-left">
					<div class="skeleton h-3 w-8 rounded bg-base-content/15"></div>
				</th>
				<!-- Tasks -->
				<th class="px-3 py-3 text-left">
					<div class="skeleton h-3 w-10 rounded bg-base-content/15"></div>
				</th>
				<!-- Agents -->
				<th class="px-3 py-3 text-left">
					<div class="skeleton h-3 w-12 rounded bg-base-content/15"></div>
				</th>
				<!-- Desc -->
				<th class="px-4 py-3 text-left min-w-[180px]">
					<div class="skeleton h-3 w-8 rounded bg-base-content/15"></div>
				</th>
				<!-- Show -->
				<th class="px-2 py-3 text-center">
					<div class="skeleton h-3 w-10 rounded bg-base-content/15 mx-auto"></div>
				</th>
			</tr>
		</thead>

		<!-- Table Body -->
		<tbody>
			{#each Array(rows) as _, i}
				<tr
					class="border-b border-base-content/15"
					style="animation: pulse 1.5s ease-in-out infinite; animation-delay: {i * 100}ms;"
				>
					<!-- Project name + path -->
					<td class="px-4 py-2">
						<div class="flex flex-col gap-1">
							<div class="skeleton h-4 {nameWidths[i % nameWidths.length]} rounded bg-base-content/12"></div>
							<div class="skeleton h-2.5 w-28 rounded bg-base-content/8"></div>
						</div>
					</td>

					<!-- Color dot -->
					<td class="px-2 py-2">
						<div class="flex justify-center">
							<div class="skeleton h-5 w-5 rounded-full bg-base-content/15"></div>
						</div>
					</td>

					<!-- Port -->
					<td class="px-3 py-3">
						{#if i % 3 !== 0}
							<div class="skeleton h-4 w-10 rounded bg-base-content/12"></div>
						{:else}
							<div class="skeleton h-3 w-4 rounded opacity-40 bg-base-content/8"></div>
						{/if}
					</td>

					<!-- Server status badge -->
					<td class="px-3 py-3">
						<div class="skeleton h-6 w-16 rounded-full bg-base-content/12"></div>
					</td>

					<!-- Last activity -->
					<td class="px-3 py-3">
						<div class="skeleton h-4 w-8 rounded bg-base-content/10"></div>
					</td>

					<!-- Tasks -->
					<td class="px-3 py-3">
						<div class="skeleton h-4 w-10 rounded bg-base-content/10"></div>
					</td>

					<!-- Agents -->
					<td class="px-3 py-3">
						<div class="skeleton h-4 w-8 rounded bg-base-content/10"></div>
					</td>

					<!-- Description -->
					<td class="px-4 py-3">
						<div
							class="skeleton h-4 rounded bg-base-content/10"
							style="width: {descWidths[i % descWidths.length]}%;"
						></div>
					</td>

					<!-- Show toggle -->
					<td class="px-2 py-3 text-center">
						<div class="flex justify-center">
							<div class="skeleton h-3.5 w-7 rounded-full bg-base-content/12"></div>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	/* Uses global @keyframes pulse from app.css */
</style>
