<script lang="ts">
	/**
	 * TopBar Component - Horizontal utilities bar
	 *
	 * Simplified navigation bar containing only utility components:
	 * - Hamburger toggle (mobile only, for sidebar)
	 * - ProjectSelector
	 * - DateRangePicker
	 * - AgentCountBadge
	 * - TokenUsageBadge (tokens today, cost, sparkline)
	 * - CommandPalette
	 * - UserProfile
	 *
	 * Navigation buttons (List, Graph, Agents) removed - moved to Sidebar
	 *
	 * Props:
	 * - projects: string[] (for project dropdown)
	 * - selectedProject: string (current project selection)
	 * - onProjectChange: (project: string) => void
	 * - taskCounts: Map<string, number> (optional task counts per project)
	 * - selectedDateRange: string (for date range picker)
	 * - customDateFrom: string | null (for custom date range)
	 * - customDateTo: string | null (for custom date range)
	 * - onDateRangeChange: (range, from?, to?) => void
	 * - tokensToday: number (total tokens consumed today)
	 * - costToday: number (total cost today in USD)
	 * - sparklineData: DataPoint[] (24h sparkline data)
	 */

	import ProjectSelector from './ProjectSelector.svelte';
	import DateRangePicker from './DateRangePicker.svelte';
	import AgentCountBadge from './AgentCountBadge.svelte';
	import TokenUsageBadge from './TokenUsageBadge.svelte';
	import UserProfile from './UserProfile.svelte';
	import CommandPalette from './CommandPalette.svelte';
	import { openTaskDrawer } from '$lib/stores/drawerStore';

	interface DataPoint {
		timestamp: string;
		tokens: number;
		cost: number;
	}

	/** Per-project token data from multi-project API */
	interface ProjectTokenData {
		project: string;
		tokens: number;
		cost: number;
		color: string;
	}

	/** Multi-project time-series data point from API */
	interface MultiProjectDataPoint {
		timestamp: string;
		totalTokens: number;
		totalCost: number;
		projects: ProjectTokenData[];
	}

	interface Props {
		projects?: string[];
		selectedProject?: string;
		onProjectChange?: (project: string) => void;
		taskCounts?: Map<string, number> | null;
		selectedDateRange?: string;
		customDateFrom?: string | null;
		customDateTo?: string | null;
		onDateRangeChange?: (range: string, from?: string, to?: string) => void;
		activeAgentCount?: number;
		totalAgentCount?: number;
		activeAgents?: string[];
		tokensToday?: number;
		costToday?: number;
		sparklineData?: DataPoint[];
		/** Multi-project sparkline data (from ?multiProject=true API) */
		multiProjectData?: MultiProjectDataPoint[];
		/** Project colors map (from API response) */
		projectColors?: Record<string, string>;
	}

	let {
		projects = [],
		selectedProject = 'All Projects',
		onProjectChange = () => {},
		taskCounts = null,
		selectedDateRange = 'all',
		customDateFrom = null,
		customDateTo = null,
		onDateRangeChange = () => {},
		activeAgentCount = 0,
		totalAgentCount = 0,
		activeAgents = [],
		tokensToday = 0,
		costToday = 0,
		sparklineData = [],
		multiProjectData,
		projectColors = {}
	}: Props = $props();
</script>

<nav class="navbar w-full bg-base-100 border-b border-base-300">
	<!-- Sidebar toggle icon -->
	<label for="main-drawer" aria-label="open sidebar" class="btn btn-square btn-ghost">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			stroke-linejoin="round"
			stroke-linecap="round"
			stroke-width="2"
			fill="none"
			stroke="currentColor"
			class="my-1.5 inline-block size-4"
		>
			<path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"></path>
			<path d="M9 4v16"></path>
			<path d="M14 10l2 2l-2 2"></path>
		</svg>
	</label>

	<!-- Left side utilities -->
	<div class="flex-1 flex items-center gap-2 px-4">
		{#if projects.length > 0}
			<div class="w-36 sm:w-40 md:w-48">
				<ProjectSelector
					{projects}
					{selectedProject}
					{onProjectChange}
					{taskCounts}
					compact={true}
				/>
			</div>
		{/if}

		<!-- Date Range Picker -->
		<DateRangePicker
			{selectedDateRange}
			{customDateFrom}
			{customDateTo}
			onRangeChange={onDateRangeChange}
			compact={true}
		/>

		<!-- Add Task Button -->
		<button class="btn btn-sm btn-primary gap-1" onclick={openTaskDrawer}>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
			<span class="hidden sm:inline">Task</span>
		</button>
	</div>

	<!-- Middle: Command Palette -->
	<div class="flex-none">
		<CommandPalette />
	</div>

	<!-- Right side: Stats + User Profile -->
	<div class="flex-none flex items-center gap-2 font-mono text-xs">
		<!-- Agent Count Badge -->
		<div class="hidden sm:flex">
			<AgentCountBadge
				activeCount={activeAgentCount}
				totalCount={totalAgentCount}
				{activeAgents}
				compact={true}
			/>
		</div>

		<!-- Separator -->
		<span class="hidden sm:block text-base-content/20">|</span>

		<!-- Token Usage Badge -->
		<div class="hidden sm:flex">
			<TokenUsageBadge
				{tokensToday}
				{costToday}
				{sparklineData}
				{multiProjectData}
				{projectColors}
				compact={true}
			/>
		</div>

		<!-- User Profile -->
		<UserProfile />
	</div>
</nav>
