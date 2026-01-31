<script lang="ts">
	/**
	 * TaskPreviewTable — Shared preview table for parsed tasks
	 *
	 * Shows parsed tasks in a scannable table with type/priority badges,
	 * validation warnings, and error indicators.
	 *
	 * Used by: TaskQuickAdd (compact mode), CreatePaste (full mode)
	 */
	import type { ParsedTask } from '$lib/utils/taskParser';

	interface Props {
		tasks: ParsedTask[];
		warnings?: string[];
		errors?: string[];
		compact?: boolean;
		maxRows?: number;
	}

	let {
		tasks = [],
		warnings = [],
		errors = [],
		compact = false,
		maxRows = 0,
	}: Props = $props();

	const displayTasks = $derived(
		maxRows > 0 ? tasks.slice(0, maxRows) : tasks
	);
	const hiddenCount = $derived(
		maxRows > 0 ? Math.max(0, tasks.length - maxRows) : 0
	);

	function priorityBadge(p: number | undefined): string {
		if (p === undefined) return 'badge-ghost';
		if (p === 0) return 'badge-error';
		if (p === 1) return 'badge-warning';
		if (p === 2) return 'badge-info';
		return 'badge-ghost';
	}

	function typeBadge(t: string | undefined): string {
		if (!t) return 'badge-ghost';
		switch (t) {
			case 'bug': return 'badge-error';
			case 'feature': return 'badge-success';
			case 'epic': return 'badge-secondary';
			case 'chore': return 'badge-ghost';
			default: return 'badge-info';
		}
	}

	function truncate(s: string, len: number): string {
		return s.length > len ? s.slice(0, len) + '…' : s;
	}
</script>

<div class="task-preview-table">
	{#if errors.length > 0}
		<div class="mb-2 text-sm text-error flex items-center gap-1.5">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
				<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
			</svg>
			{errors.length} error{errors.length !== 1 ? 's' : ''}
		</div>
	{/if}

	{#if warnings.length > 0 && !compact}
		<div class="mb-2 text-sm text-warning flex items-center gap-1.5">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
				<path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.345 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
			</svg>
			{warnings.length} warning{warnings.length !== 1 ? 's' : ''}
		</div>
	{/if}

	{#if tasks.length === 0}
		<div class="text-sm opacity-50 py-4 text-center">No tasks parsed</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="table table-xs w-full">
				<thead>
					<tr class="text-xs opacity-60">
						<th class="w-8">#</th>
						<th>Title</th>
						<th class="w-16">Type</th>
						<th class="w-10">P</th>
						{#if !compact}
							<th class="w-28">Labels</th>
							{#if tasks.some(t => t.assignee)}
								<th class="w-20">Assignee</th>
							{/if}
							{#if tasks.some(t => t.deps && t.deps.length > 0)}
								<th class="w-24">Deps</th>
							{/if}
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each displayTasks as task, i (i)}
						<tr class="hover:bg-base-200/50">
							<td class="text-xs opacity-50 font-mono">{i + 1}</td>
							<td class="text-sm font-medium">
								{truncate(task.title, compact ? 40 : 60)}
							</td>
							<td>
								{#if task.type}
									<span class="badge badge-xs {typeBadge(task.type)}">{task.type}</span>
								{:else}
									<span class="text-xs opacity-30">—</span>
								{/if}
							</td>
							<td>
								{#if task.priority !== undefined}
									<span class="badge badge-xs {priorityBadge(task.priority)}">P{task.priority}</span>
								{:else}
									<span class="text-xs opacity-30">—</span>
								{/if}
							</td>
							{#if !compact}
								<td>
									{#if task.labels && task.labels.length > 0}
										<div class="flex flex-wrap gap-0.5">
											{#each task.labels.slice(0, 3) as label}
												<span class="badge badge-xs badge-outline">{label}</span>
											{/each}
											{#if task.labels.length > 3}
												<span class="text-xs opacity-50">+{task.labels.length - 3}</span>
											{/if}
										</div>
									{:else}
										<span class="text-xs opacity-30">—</span>
									{/if}
								</td>
								{#if tasks.some(t => t.assignee)}
									<td class="text-xs">{task.assignee || '—'}</td>
								{/if}
								{#if tasks.some(t => t.deps && t.deps.length > 0)}
									<td class="text-xs font-mono">
										{task.deps ? task.deps.join(', ') : '—'}
									</td>
								{/if}
							{/if}
						</tr>
					{/each}
					{#if hiddenCount > 0}
						<tr>
							<td colspan={compact ? 4 : 6} class="text-xs text-center opacity-50 py-2">
								+{hiddenCount} more task{hiddenCount !== 1 ? 's' : ''}
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>

		<div class="mt-2 text-xs opacity-60 flex items-center gap-3">
			<span>{tasks.length} task{tasks.length !== 1 ? 's' : ''} ready to create</span>
			{#if warnings.length > 0}
				<span class="text-warning">{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
			{/if}
			{#if errors.length > 0}
				<span class="text-error">{errors.length} error{errors.length !== 1 ? 's' : ''}</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.task-preview-table :global(table) {
		border-collapse: collapse;
	}
	.task-preview-table :global(th),
	.task-preview-table :global(td) {
		padding: 0.35rem 0.5rem;
	}
</style>
