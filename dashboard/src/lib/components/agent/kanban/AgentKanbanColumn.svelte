<script lang="ts">
	/**
	 * AgentKanbanColumn Component
	 *
	 * A single column in the agent kanban board, containing agents
	 * in a specific activity state.
	 */

	import type { Snippet } from 'svelte';
	import type { ActivityState } from '$lib/types/agent';
	import { SESSION_STATE_VISUALS } from '$lib/config/statusColors';

	interface Props {
		state: ActivityState;
		count: number;
		collapsed?: boolean;
		onToggleCollapse?: () => void;
		class?: string;
		children?: Snippet;
	}

	let {
		state,
		count,
		collapsed = false,
		onToggleCollapse,
		class: className = '',
		children
	}: Props = $props();

	const visual = $derived(SESSION_STATE_VISUALS[state] || SESSION_STATE_VISUALS.idle);
</script>

<div
	class="flex flex-col h-full min-w-[280px] {collapsed ? 'max-w-[60px]' : 'max-w-[320px]'} transition-all duration-300 {className}"
>
	<!-- Column Header -->
	<button
		class="flex items-center gap-2 p-3 rounded-t-lg transition-colors"
		style="
			background: {visual.bgColor};
			border-top: 3px solid {visual.accent};
		"
		onclick={onToggleCollapse}
	>
		<!-- State icon -->
		<svg
			class="w-4 h-4 shrink-0"
			class:animate-pulse={visual.pulse}
			style="color: {visual.textColor};"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d={visual.icon} />
		</svg>

		{#if !collapsed}
			<!-- State label -->
			<span
				class="font-semibold text-sm truncate"
				style="color: {visual.textColor};"
			>
				{visual.shortLabel}
			</span>

			<!-- Count badge -->
			<span
				class="kanban-count-badge ml-auto px-2 py-0.5 text-xs font-bold rounded-full"
				style="background: {visual.accent};"
			>
				{count}
			</span>
		{:else}
			<!-- Collapsed count only -->
			<span
				class="text-xs font-bold"
				style="color: {visual.textColor};"
			>
				{count}
			</span>
		{/if}

		<!-- Collapse/Expand indicator -->
		<svg
			class="w-3 h-3 shrink-0 transition-transform {collapsed ? 'rotate-180' : ''}"
			style="color: {visual.textColor}; opacity: 0.6;"
			viewBox="0 0 20 20"
			fill="currentColor"
		>
			<path
				fill-rule="evenodd"
				d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
				clip-rule="evenodd"
			/>
		</svg>
	</button>

	<!-- Column Content -->
	{#if !collapsed}
		<div class="kanban-column-content flex-1 overflow-y-auto p-2 space-y-2 rounded-b-lg">
			{@render children?.()}

			<!-- Empty state -->
			{#if count === 0}
				<div class="text-center py-8 text-base-content/30">
					<p class="text-xs font-mono">No agents</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Count badge - dark text on accent background */
	.kanban-count-badge {
		color: var(--color-base-100);
	}

	/* Column content background - slightly darker than base */
	.kanban-column-content {
		background: var(--color-base-200);
	}
</style>
