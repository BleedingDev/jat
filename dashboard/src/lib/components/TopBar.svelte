<script lang="ts">
	/**
	 * TopBar Component - Horizontal utilities bar
	 *
	 * Simplified navigation bar containing only utility components:
	 * - Hamburger toggle (mobile only, for sidebar)
	 * - ProjectSelector
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
	 * - tokensToday: number (total tokens consumed today)
	 * - costToday: number (total cost today in USD)
	 * - sparklineData: DataPoint[] (24h sparkline data)
	 */

	import ProjectSelector from './ProjectSelector.svelte';
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

<!-- Industrial/Terminal TopBar -->
<nav
	class="w-full h-12 flex items-center relative"
	style="
		background: linear-gradient(180deg, oklch(0.25 0.01 250) 0%, oklch(0.20 0.01 250) 100%);
		border-bottom: 1px solid oklch(0.35 0.02 250);
	"
>
	<!-- Sidebar toggle (industrial) -->
	<label
		for="main-drawer"
		aria-label="open sidebar"
		class="flex items-center justify-center w-7 h-7 ml-3 rounded cursor-pointer transition-all hover:scale-105"
		style="background: oklch(0.30 0.02 250); border: 1px solid oklch(0.40 0.02 250);"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			stroke-linejoin="round"
			stroke-linecap="round"
			stroke-width="2"
			fill="none"
			stroke="currentColor"
			class="w-4 h-4"
			style="color: oklch(0.70 0.18 240);"
		>
			<path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"></path>
			<path d="M9 4v16"></path>
			<path d="M14 10l2 2l-2 2"></path>
		</svg>
	</label>

	<!-- Vertical separator -->
	<div class="w-px h-6 mx-2" style="background: linear-gradient(180deg, transparent, oklch(0.45 0.02 250), transparent);"></div>

	<!-- Left side utilities -->
	<div class="flex-1 flex items-center gap-3 px-2">
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

		<!-- Add Task Button (Industrial) -->
		<button
			class="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs tracking-wider uppercase transition-all hover:scale-105"
			style="
				background: linear-gradient(135deg, oklch(0.75 0.20 145 / 0.2) 0%, oklch(0.75 0.20 145 / 0.1) 100%);
				border: 1px solid oklch(0.75 0.20 145 / 0.4);
				color: oklch(0.80 0.18 145);
				text-shadow: 0 0 10px oklch(0.75 0.20 145 / 0.5);
			"
			onclick={openTaskDrawer}
		>
			<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
			<span class="hidden sm:inline">New</span>
		</button>
	</div>

	<!-- Middle: Command Palette -->
	<div class="flex-none">
		<CommandPalette />
	</div>

	<!-- Vertical separator -->
	<div class="w-px h-6 mx-3" style="background: linear-gradient(180deg, transparent, oklch(0.45 0.02 250), transparent);"></div>

	<!-- Right side: Stats + User Profile (Industrial) -->
	<div class="flex-none flex items-center gap-3 pr-3">
		<!-- Agent Count Badge -->
		<div class="hidden sm:flex">
			<AgentCountBadge
				activeCount={activeAgentCount}
				totalCount={totalAgentCount}
				{activeAgents}
				compact={true}
			/>
		</div>

		<!-- Industrial separator dot -->
		<div class="hidden sm:block w-1 h-1 rounded-full" style="background: oklch(0.50 0.02 250);"></div>

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

		<!-- Industrial separator dot -->
		<div class="hidden sm:block w-1 h-1 rounded-full" style="background: oklch(0.50 0.02 250);"></div>

		<!-- User Profile -->
		<UserProfile />
	</div>
</nav>
