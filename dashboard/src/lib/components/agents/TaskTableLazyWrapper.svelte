<script lang="ts">
	/**
	 * TaskTableLazyWrapper - Implements lazy loading for TaskTable
	 *
	 * This component wraps TaskTable and handles:
	 * - Initial limited data loading (first 100 tasks)
	 * - Infinite scroll loading (load more as user scrolls)
	 * - Loading indicator at bottom
	 *
	 * The wrapper uses IntersectionObserver to detect when user scrolls near bottom.
	 */

	import { onMount, onDestroy } from 'svelte';
	import TaskTable from './TaskTable.svelte';

	// Define types locally to match TaskTable's expectations
	interface Task {
		id: string;
		title?: string;
		description?: string;
		status: string;
		priority: number;
		issue_type?: string;
		assignee?: string;
		labels?: string[];
		depends_on?: Array<{ id: string; status?: string; title?: string; priority?: number; issue_type?: string; assignee?: string }>;
		created_at?: string;
		updated_at?: string;
	}

	interface Agent {
		name: string;
		last_active_ts?: string;
		task?: string | null;
	}

	interface Reservation {
		agent_name: string;
		path_pattern: string;
		expires_ts: string;
	}

	// Props - same as TaskTable
	interface Props {
		tasks?: Task[];
		allTasks?: Task[];
		agents?: Agent[];
		reservations?: Reservation[];
		completedTasksFromActiveSessions?: Set<string>;
		ontaskclick?: (taskId: string) => void;
		onagentclick?: (agentName: string) => void;
		initialPageSize?: number;
		pageSize?: number;
	}

	let {
		tasks = [],
		allTasks = [],
		agents = [],
		reservations = [],
		completedTasksFromActiveSessions = new Set<string>(),
		ontaskclick = () => {},
		onagentclick,
		initialPageSize = 100, // Load 100 tasks initially
		pageSize = 50 // Load 50 more on each scroll
	}: Props = $props();

	// Lazy loading state
	let displayedCount = $state(initialPageSize);
	let isLoadingMore = $state(false);
	let loadMoreRef: HTMLDivElement | null = null;
	let intersectionObserver: IntersectionObserver | null = null;

	// Slice tasks based on displayedCount
	const displayedTasks = $derived(tasks.slice(0, displayedCount));
	const hasMore = $derived(displayedCount < tasks.length);
	const totalTasks = $derived(tasks.length);

	// Reset displayedCount when tasks array changes significantly (e.g., filter change)
	let prevTasksLength = tasks.length;
	$effect(() => {
		// If tasks array changed (not just appended)
		if (Math.abs(tasks.length - prevTasksLength) > pageSize || tasks.length < prevTasksLength) {
			displayedCount = initialPageSize;
		}
		prevTasksLength = tasks.length;
	});

	// Load more tasks
	function loadMore() {
		if (isLoadingMore || !hasMore) return;

		isLoadingMore = true;
		// Simulate a small delay for UX (prevent jarring instant loads)
		requestAnimationFrame(() => {
			displayedCount = Math.min(displayedCount + pageSize, tasks.length);
			isLoadingMore = false;
		});
	}

	// Setup IntersectionObserver
	function setupObserver() {
		if (!loadMoreRef) return;

		intersectionObserver = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry?.isIntersecting && hasMore && !isLoadingMore) {
					loadMore();
				}
			},
			{
				root: null, // Use viewport
				rootMargin: '200px', // Load more when within 200px of bottom
				threshold: 0
			}
		);

		intersectionObserver.observe(loadMoreRef);
	}

	function cleanupObserver() {
		if (intersectionObserver) {
			intersectionObserver.disconnect();
			intersectionObserver = null;
		}
	}

	onMount(() => {
		setupObserver();
	});

	onDestroy(() => {
		cleanupObserver();
	});

	// Re-setup observer when ref changes
	$effect(() => {
		if (loadMoreRef) {
			cleanupObserver();
			setupObserver();
		}
	});
</script>

<div class="task-table-lazy-wrapper h-full flex flex-col">
	<!-- TaskTable with limited tasks -->
	<TaskTable
		tasks={displayedTasks}
		{allTasks}
		{agents}
		{reservations}
		{completedTasksFromActiveSessions}
		{ontaskclick}
		{onagentclick}
	/>

	<!-- Load more indicator - only show if there are more tasks AND we've hit the display limit -->
	{#if hasMore && displayedCount >= initialPageSize}
		<div
			bind:this={loadMoreRef}
			class="py-3 flex items-center justify-center gap-2 text-xs"
			style="background: oklch(0.14 0.01 250); border-top: 1px solid oklch(0.25 0.02 250);"
		>
			{#if isLoadingMore}
				<span class="loading loading-spinner loading-xs" style="color: oklch(0.70 0.18 240);"></span>
				<span style="color: oklch(0.60 0.02 250);">Loading...</span>
			{:else}
				<button
					class="btn btn-xs btn-ghost gap-1"
					style="color: oklch(0.60 0.18 240);"
					onclick={loadMore}
				>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
					</svg>
					Load more tasks
				</button>
			{/if}
		</div>
	{/if}
</div>
