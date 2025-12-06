<script lang="ts">
	import { getProjectColor as getProjectColorFromHash } from '$lib/utils/projectColors';
	import { TASK_STATUS_VISUALS } from '$lib/config/statusColors';

	interface DepNode {
		id: string;
		title: string;
		status: string;
		priority: number;
		isBlocking?: boolean;
		isWaiting?: boolean;
	}

	interface Props {
		taskId: string;
		taskTitle?: string;
		taskStatus?: string;
		/** Tasks that block this task (must complete first) */
		blockedBy?: DepNode[];
		/** Tasks this task unblocks (waiting on this) */
		unblocks?: DepNode[];
		/** Callback when clicking a dependency */
		onTaskClick?: (taskId: string) => void;
		/** Position relative to trigger */
		position?: 'left' | 'right' | 'top' | 'bottom';
	}

	let {
		taskId,
		taskTitle = '',
		taskStatus = 'open',
		blockedBy = [],
		unblocks = [],
		onTaskClick,
		position = 'right'
	}: Props = $props();

	// Filter to show only blocking/waiting dependencies
	const activeBlockers = $derived(blockedBy.filter(d => d.isBlocking !== false));
	const activeUnblocks = $derived(unblocks.filter(d => d.isWaiting !== false));

	const hasBlockers = $derived(activeBlockers.length > 0);
	const hasUnblocks = $derived(activeUnblocks.length > 0);
	const hasDependencies = $derived(hasBlockers || hasUnblocks);

	function handleTaskClick(id: string, event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();
		if (onTaskClick) {
			onTaskClick(id);
		}
	}

	function getPriorityBadge(priority: number): string {
		const badges: Record<number, string> = {
			0: 'badge-error',
			1: 'badge-warning',
			2: 'badge-info',
			3: 'badge-ghost'
		};
		return badges[priority] || 'badge-ghost';
	}

	const statusVisual = $derived(TASK_STATUS_VISUALS[taskStatus] || TASK_STATUS_VISUALS.open);
</script>

<div class="p-3 min-w-64 max-w-80">
	{#if !hasDependencies}
		<div class="text-sm text-base-content/60 text-center py-2">
			No dependencies
		</div>
	{:else}
		<!-- Blockers (tasks that must complete first) -->
		{#if hasBlockers}
			<div class="mb-3">
				<div class="flex items-center gap-1.5 mb-2">
					<svg class="w-4 h-4 text-error/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
					</svg>
					<span class="text-xs font-semibold text-error/80 uppercase tracking-wide">Blocked By</span>
					<span class="text-xs text-base-content/50">({activeBlockers.length})</span>
				</div>
				<div class="space-y-1.5">
					{#each activeBlockers as dep}
						{@const depStatusVisual = TASK_STATUS_VISUALS[dep.status] || TASK_STATUS_VISUALS.open}
						{@const projectColor = getProjectColorFromHash(dep.id)}
						<button
							class="w-full flex items-center gap-2 p-1.5 rounded hover:bg-base-200 transition-colors text-left group"
							onclick={(e) => handleTaskClick(dep.id, e)}
						>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-1.5">
									<span class="font-mono text-xs" style="color: {projectColor}">{dep.id}</span>
									<span class="badge badge-xs {getPriorityBadge(dep.priority)}">P{dep.priority}</span>
									<svg
										class="w-3 h-3 {depStatusVisual.text} shrink-0"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<circle cx="12" cy="12" r="10" />
									</svg>
								</div>
								<p class="text-xs text-base-content/70 truncate mt-0.5">{dep.title}</p>
							</div>
							<svg class="w-3.5 h-3.5 text-base-content/30 group-hover:text-base-content/60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
							</svg>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Current task indicator -->
		<div class="flex items-center justify-center py-2 border-y border-base-300">
			<div class="flex items-center gap-2">
				<div class="w-2 h-2 rounded-full {statusVisual.text}"></div>
				<span class="font-mono text-sm font-medium" style="color: {getProjectColorFromHash(taskId)}">{taskId}</span>
			</div>
		</div>

		<!-- Unblocks (tasks waiting on this) -->
		{#if hasUnblocks}
			<div class="mt-3">
				<div class="flex items-center gap-1.5 mb-2">
					<svg class="w-4 h-4 text-success/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
					</svg>
					<span class="text-xs font-semibold text-success/80 uppercase tracking-wide">Unblocks</span>
					<span class="text-xs text-base-content/50">({activeUnblocks.length})</span>
				</div>
				<div class="space-y-1.5">
					{#each activeUnblocks as dep}
						{@const depStatusVisual = TASK_STATUS_VISUALS[dep.status] || TASK_STATUS_VISUALS.open}
						{@const projectColor = getProjectColorFromHash(dep.id)}
						<button
							class="w-full flex items-center gap-2 p-1.5 rounded hover:bg-base-200 transition-colors text-left group"
							onclick={(e) => handleTaskClick(dep.id, e)}
						>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-1.5">
									<span class="font-mono text-xs" style="color: {projectColor}">{dep.id}</span>
									<span class="badge badge-xs {getPriorityBadge(dep.priority)}">P{dep.priority}</span>
									<svg
										class="w-3 h-3 {depStatusVisual.text} shrink-0"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<circle cx="12" cy="12" r="10" />
									</svg>
								</div>
								<p class="text-xs text-base-content/70 truncate mt-0.5">{dep.title}</p>
							</div>
							<svg class="w-3.5 h-3.5 text-base-content/30 group-hover:text-base-content/60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
							</svg>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
