<script lang="ts">
	/**
	 * WorkingSignalCard Component
	 *
	 * Renders a rich working signal showing the agent's current task context,
	 * planned approach, expected files to modify, and baseline for rollback.
	 *
	 * @see shared/rich-signals-plan.md for design documentation
	 * @see src/lib/types/richSignals.ts for type definitions
	 */

	import type { WorkingSignal } from '$lib/types/richSignals';

	interface Props {
		/** The rich working signal data */
		signal: WorkingSignal;
		/** Callback when task ID is clicked */
		onTaskClick?: (taskId: string) => void;
		/** Callback when a file path is clicked */
		onFileClick?: (filePath: string) => void;
		/** Callback when baseline commit is clicked (for rollback) */
		onRollbackClick?: (commit: string) => void;
		/** Whether to show in compact mode (for inline/timeline display) */
		compact?: boolean;
		/** Additional CSS class */
		class?: string;
	}

	let {
		signal,
		onTaskClick,
		onFileClick,
		onRollbackClick,
		compact = false,
		class: className = ''
	}: Props = $props();

	// Whether approach section is expanded (default collapsed in compact mode)
	let approachExpanded = $state(!compact);

	// Task type badge styling
	const taskTypeBadge = $derived.by(() => {
		switch (signal.taskType?.toLowerCase()) {
			case 'bug':
				return { label: 'BUG', color: 'oklch(0.55 0.20 25)', icon: '🐛' };
			case 'feature':
				return { label: 'FEATURE', color: 'oklch(0.55 0.18 145)', icon: '✨' };
			case 'task':
				return { label: 'TASK', color: 'oklch(0.55 0.15 250)', icon: '📋' };
			case 'chore':
				return { label: 'CHORE', color: 'oklch(0.50 0.08 250)', icon: '🔧' };
			case 'epic':
				return { label: 'EPIC', color: 'oklch(0.55 0.18 280)', icon: '🎯' };
			default:
				return { label: 'TASK', color: 'oklch(0.55 0.15 250)', icon: '📋' };
		}
	});

	// Priority badge styling
	const priorityBadge = $derived.by(() => {
		const p = signal.taskPriority;
		if (p === 0) return { label: 'P0', color: 'oklch(0.55 0.22 25)', urgent: true };
		if (p === 1) return { label: 'P1', color: 'oklch(0.60 0.18 45)', urgent: true };
		if (p === 2) return { label: 'P2', color: 'oklch(0.55 0.15 85)', urgent: false };
		if (p === 3) return { label: 'P3', color: 'oklch(0.50 0.10 200)', urgent: false };
		return { label: 'P4', color: 'oklch(0.45 0.08 250)', urgent: false };
	});

	// Scope badge styling
	const scopeBadge = $derived.by(() => {
		switch (signal.estimatedScope) {
			case 'small':
				return { label: 'SMALL', color: 'oklch(0.55 0.18 145)', icon: '📏' };
			case 'medium':
				return { label: 'MEDIUM', color: 'oklch(0.55 0.15 85)', icon: '📐' };
			case 'large':
				return { label: 'LARGE', color: 'oklch(0.55 0.18 25)', icon: '📊' };
			default:
				return null;
		}
	});

	// Format commit hash for display
	function formatCommit(sha: string): string {
		return sha.slice(0, 7);
	}

	// Handle file click
	function handleFileClick(filePath: string) {
		if (onFileClick) {
			onFileClick(filePath);
		}
	}

	// Toggle approach section
	function toggleApproach() {
		approachExpanded = !approachExpanded;
	}
</script>

{#if compact}
	<!-- Compact mode: minimal task card for timeline/inline display -->
	<div
		class="rounded-lg px-3 py-2 flex items-center gap-3 {className}"
		style="background: linear-gradient(90deg, oklch(0.25 0.10 85 / 0.3) 0%, oklch(0.22 0.05 85 / 0.1) 100%); border: 1px solid oklch(0.45 0.12 85);"
	>
		<!-- Status indicator -->
		<div class="flex-shrink-0">
			<span class="loading loading-spinner loading-xs text-warning"></span>
		</div>

		<!-- Task info -->
		<div class="flex-1 min-w-0 flex items-center gap-2">
			<button
				type="button"
				class="text-xs font-mono px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity cursor-pointer"
				style="background: oklch(0.30 0.08 85); color: oklch(0.90 0.12 85); border: 1px solid oklch(0.45 0.10 85);"
				onclick={() => onTaskClick?.(signal.taskId)}
				title="View task {signal.taskId}"
			>
				{signal.taskId}
			</button>
			<span class="text-sm truncate" style="color: oklch(0.90 0.05 85);">
				{signal.taskTitle}
			</span>
		</div>

		<!-- Priority badge -->
		<span
			class="text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
			style="background: {priorityBadge.color}; color: oklch(0.98 0.01 250);"
		>
			{priorityBadge.label}
		</span>
	</div>
{:else}
	<!-- Full mode: detailed working signal card -->
	<div
		class="rounded-lg overflow-hidden {className}"
		style="background: linear-gradient(135deg, oklch(0.22 0.06 85) 0%, oklch(0.18 0.04 80) 100%); border: 1px solid oklch(0.45 0.12 85);"
	>
		<!-- Header -->
		<div
			class="px-3 py-2 flex items-center justify-between gap-2"
			style="background: oklch(0.25 0.08 85); border-bottom: 1px solid oklch(0.40 0.10 85);"
		>
			<div class="flex items-center gap-2">
				<!-- Working indicator -->
				<span class="loading loading-spinner loading-xs text-warning"></span>

				<!-- Task type badge -->
				<span
					class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold"
					style="background: {taskTypeBadge.color}; color: oklch(0.98 0.01 250);"
				>
					{taskTypeBadge.icon} {taskTypeBadge.label}
				</span>

				<!-- Task ID -->
				<button
					type="button"
					class="text-[10px] px-1.5 py-0.5 rounded font-mono cursor-pointer hover:opacity-80 transition-opacity"
					style="background: oklch(0.30 0.05 85); color: oklch(0.85 0.08 85); border: 1px solid oklch(0.40 0.08 85);"
					onclick={() => onTaskClick?.(signal.taskId)}
					title="View task {signal.taskId}"
				>
					{signal.taskId}
				</button>
			</div>

			<div class="flex items-center gap-1.5">
				<!-- Priority badge -->
				<span
					class="text-[10px] px-1.5 py-0.5 rounded font-bold"
					class:animate-pulse={priorityBadge.urgent}
					style="background: {priorityBadge.color}; color: oklch(0.98 0.01 250);"
				>
					{priorityBadge.label}
				</span>

				<!-- Scope badge -->
				{#if scopeBadge}
					<span
						class="text-[10px] px-1.5 py-0.5 rounded font-mono"
						style="background: {scopeBadge.color}; color: oklch(0.98 0.01 250);"
					>
						{scopeBadge.icon} {scopeBadge.label}
					</span>
				{/if}
			</div>
		</div>

		<!-- Body -->
		<div class="p-3 flex flex-col gap-3">
			<!-- Task Title & Description -->
			<div class="flex flex-col gap-1">
				<div class="text-sm font-semibold" style="color: oklch(0.95 0.08 85);">
					{signal.taskTitle}
				</div>
				{#if signal.taskDescription}
					<div class="text-[11px] opacity-80 line-clamp-2" style="color: oklch(0.85 0.04 85);">
						{signal.taskDescription}
					</div>
				{/if}
			</div>

			<!-- Approach Section (collapsible) -->
			{#if signal.approach}
				<div
					class="rounded overflow-hidden"
					style="background: oklch(0.20 0.04 85); border: 1px solid oklch(0.35 0.06 85);"
				>
					<button
						type="button"
						onclick={toggleApproach}
						class="w-full px-2 py-1.5 flex items-center justify-between text-left hover:opacity-90 transition-opacity"
						style="background: oklch(0.23 0.05 85);"
					>
						<div class="flex items-center gap-1.5">
							<span class="text-[10px] font-bold" style="color: oklch(0.80 0.08 85);">
								🎯 APPROACH
							</span>
						</div>
						<svg
							class="w-3.5 h-3.5 transition-transform duration-200"
							class:rotate-180={approachExpanded}
							style="color: oklch(0.70 0.05 85);"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
					{#if approachExpanded}
						<div class="px-2 py-2 text-xs" style="color: oklch(0.90 0.03 85);">
							{signal.approach}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Expected Files -->
			{#if signal.expectedFiles && signal.expectedFiles.length > 0}
				<div class="flex flex-col gap-1.5">
					<div class="text-[10px] font-semibold opacity-70" style="color: oklch(0.75 0.05 85);">
						📁 EXPECTED FILES
					</div>
					<div class="flex flex-wrap gap-1">
						{#each signal.expectedFiles as file}
							<button
								type="button"
								onclick={() => handleFileClick(file)}
								class="text-[11px] px-2 py-0.5 rounded hover:opacity-80 transition-opacity cursor-pointer flex items-center gap-1"
								style="background: oklch(0.25 0.06 200); color: oklch(0.88 0.10 200); border: 1px solid oklch(0.38 0.10 200);"
								title="Open {file}"
							>
								<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
									/>
								</svg>
								{file}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Dependencies -->
			{#if signal.dependencies && signal.dependencies.length > 0}
				<div class="flex flex-col gap-1.5">
					<div class="text-[10px] font-semibold opacity-70" style="color: oklch(0.75 0.05 85);">
						🔗 DEPENDS ON
					</div>
					<div class="flex flex-wrap gap-1">
						{#each signal.dependencies as dep}
							<button
								type="button"
								onclick={() => onTaskClick?.(dep)}
								class="text-[11px] px-2 py-0.5 rounded hover:opacity-80 transition-opacity cursor-pointer"
								style="background: oklch(0.28 0.06 280); color: oklch(0.85 0.10 280); border: 1px solid oklch(0.40 0.10 280);"
								title="View dependency {dep}"
							>
								{dep}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Blockers -->
			{#if signal.blockers && signal.blockers.length > 0}
				<div
					class="flex flex-col gap-1.5 p-2 rounded"
					style="background: oklch(0.25 0.10 25 / 0.3); border: 1px solid oklch(0.50 0.15 25);"
				>
					<div class="text-[10px] font-bold" style="color: oklch(0.85 0.15 25);">
						⚠️ BLOCKERS
					</div>
					<ul class="text-[11px] list-disc list-inside" style="color: oklch(0.90 0.08 25);">
						{#each signal.blockers as blocker}
							<li>{blocker}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Baseline (for rollback) -->
			{#if signal.baselineCommit}
				<div
					class="flex items-center justify-between px-2 py-1.5 rounded"
					style="background: oklch(0.18 0.02 250); border: 1px solid oklch(0.30 0.04 250);"
				>
					<div class="flex items-center gap-2">
						<span class="text-[10px] font-semibold opacity-60" style="color: oklch(0.70 0.03 250);">
							⏪ BASELINE
						</span>
						<span class="font-mono text-[11px]" style="color: oklch(0.80 0.05 250);">
							{formatCommit(signal.baselineCommit)}
						</span>
						{#if signal.baselineBranch}
							<span
								class="text-[10px] px-1 py-0.5 rounded"
								style="background: oklch(0.25 0.04 145); color: oklch(0.80 0.08 145);"
							>
								{signal.baselineBranch}
							</span>
						{/if}
					</div>
					{#if onRollbackClick}
						<button
							type="button"
							onclick={() => onRollbackClick?.(signal.baselineCommit)}
							class="text-[10px] px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
							style="background: oklch(0.35 0.08 25); color: oklch(0.90 0.10 25); border: 1px solid oklch(0.45 0.12 25);"
							title="Rollback to {formatCommit(signal.baselineCommit)}"
						>
							Rollback
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
