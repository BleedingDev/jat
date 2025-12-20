<script lang="ts">
	/**
	 * TaskDetailSkeleton Component
	 * Shows animated placeholder for task detail drawer content
	 */
</script>

<!-- Task Detail Skeleton - Theme-aware -->
<div class="flex flex-col gap-6">
	<!-- Labels section -->
	<div>
		<div class="skeleton h-3 w-12 rounded mb-2 bg-base-content/10"></div>
		<div class="flex gap-2">
			<div class="skeleton h-5 w-16 rounded-full bg-base-content/8"></div>
			<div class="skeleton h-5 w-20 rounded-full bg-base-content/8"></div>
			<div class="skeleton h-5 w-14 rounded-full bg-base-content/8"></div>
		</div>
	</div>

	<!-- Description section -->
	<div>
		<div class="skeleton h-3 w-20 rounded mb-2 bg-base-content/10"></div>
		<div class="p-4 rounded-lg space-y-2 bg-base-200 border border-base-content/15">
			<div class="skeleton h-4 w-full rounded bg-base-content/10"></div>
			<div class="skeleton h-4 w-4/5 rounded bg-base-content/10"></div>
			<div class="skeleton h-4 w-3/5 rounded bg-base-content/10"></div>
		</div>
	</div>

	<!-- Metadata grid -->
	<div class="grid grid-cols-2 gap-4">
		<!-- Status -->
		<div>
			<div class="skeleton h-3 w-12 rounded mb-2 bg-base-content/10"></div>
			<div class="skeleton h-8 w-24 rounded bg-base-content/8"></div>
		</div>
		<!-- Priority -->
		<div>
			<div class="skeleton h-3 w-14 rounded mb-2 bg-base-content/10"></div>
			<div class="skeleton h-8 w-20 rounded bg-base-content/8"></div>
		</div>
		<!-- Type -->
		<div>
			<div class="skeleton h-3 w-10 rounded mb-2 bg-base-content/10"></div>
			<div class="skeleton h-8 w-16 rounded bg-base-content/8"></div>
		</div>
		<!-- Assignee -->
		<div>
			<div class="skeleton h-3 w-16 rounded mb-2 bg-base-content/10"></div>
			<div class="skeleton h-8 w-28 rounded bg-base-content/8"></div>
		</div>
	</div>

	<!-- Dependencies section -->
	<div>
		<div class="skeleton h-3 w-24 rounded mb-2 bg-base-content/10"></div>
		<div class="p-3 rounded-lg bg-base-200 border border-base-content/15">
			<div class="flex items-center gap-2 mb-2">
				<div class="skeleton w-3 h-3 rounded-full bg-info/30"></div>
				<div class="skeleton h-4 w-20 rounded bg-base-content/10"></div>
				<div class="skeleton h-5 w-14 rounded-full ml-auto bg-base-content/8"></div>
			</div>
			<div class="flex items-center gap-2">
				<div class="skeleton w-3 h-3 rounded-full bg-primary/30"></div>
				<div class="skeleton h-4 w-24 rounded bg-base-content/10"></div>
				<div class="skeleton h-5 w-16 rounded-full ml-auto bg-base-content/8"></div>
			</div>
		</div>
	</div>

	<!-- History section -->
	<div>
		<div class="skeleton h-3 w-16 rounded mb-2 bg-base-content/10"></div>
		<div class="p-3 rounded-lg space-y-3 bg-base-200 border border-base-content/15">
			{#each Array(3) as _, i}
				<div
					class="flex items-start gap-3"
					style="animation: pulse 1.5s ease-in-out infinite; animation-delay: {i * 100}ms;"
				>
					<div class="skeleton w-2 h-2 rounded-full mt-1.5 bg-primary/25"></div>
					<div class="flex-1">
						<div class="skeleton h-3 w-32 rounded mb-1 bg-base-content/10"></div>
						<div class="skeleton h-3 w-20 rounded bg-base-content/6"></div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Timestamps -->
	<div class="flex justify-between pt-4 border-t border-base-content/10">
		<div>
			<div class="skeleton h-2 w-14 rounded mb-1 bg-base-content/8"></div>
			<div class="skeleton h-3 w-24 rounded bg-base-content/12"></div>
		</div>
		<div>
			<div class="skeleton h-2 w-14 rounded mb-1 bg-base-content/8"></div>
			<div class="skeleton h-3 w-20 rounded bg-base-content/12"></div>
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
