<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { themeChange } from 'theme-change';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import TaskCreationDrawer from '$lib/components/TaskCreationDrawer.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { getProjectsFromTasks, getTaskCountByProject } from '$lib/utils/projectUtils';

	let { children } = $props();

	// Shared project state for entire app
	let selectedProject = $state('All Projects');
	let allTasks = $state([]);

	// Date range state
	let selectedDateRange = $state('all');
	let customDateFrom = $state<string | null>(null);
	let customDateTo = $state<string | null>(null);

	// Agent count state
	let activeAgentCount = $state(0);
	let totalAgentCount = $state(0);
	let activeAgents = $state<string[]>([]);

	// Token usage state for TopBar
	let tokensToday = $state(0);
	let costToday = $state(0);
	let sparklineData = $state<Array<{ timestamp: string; tokens: number; cost: number }>>([]);

	// Multi-project sparkline state
	interface ProjectTokenData {
		project: string;
		tokens: number;
		cost: number;
		color: string;
	}
	interface MultiProjectDataPoint {
		timestamp: string;
		totalTokens: number;
		totalCost: number;
		projects: ProjectTokenData[];
	}
	let multiProjectData = $state<MultiProjectDataPoint[]>([]);
	let projectColors = $state<Record<string, string>>({});

	// Derived project data
	const projects = $derived(getProjectsFromTasks(allTasks));
	const taskCounts = $derived(getTaskCountByProject(allTasks, 'open'));

	// Sync selected project from URL parameter
	$effect(() => {
		const params = new URLSearchParams($page.url.searchParams);
		const projectParam = params.get('project');
		selectedProject = projectParam || 'All Projects';
	});

	// Sync date range from URL parameter
	$effect(() => {
		const params = new URLSearchParams($page.url.searchParams);
		const rangeParam = params.get('range');
		const fromParam = params.get('from');
		const toParam = params.get('to');

		if (fromParam || toParam) {
			selectedDateRange = 'custom';
			customDateFrom = fromParam;
			customDateTo = toParam;
		} else if (rangeParam) {
			selectedDateRange = rangeParam;
			customDateFrom = null;
			customDateTo = null;
		} else {
			selectedDateRange = 'all';
			customDateFrom = null;
			customDateTo = null;
		}
	});

	// Initialize theme-change and load all tasks
	onMount(() => {
		themeChange(false);
		Promise.all([loadAllTasks(), loadSparklineData()]);

		// Set up polling for token usage and sparkline (every 30 seconds)
		const interval = setInterval(() => {
			loadAllTasks();
			loadSparklineData();
		}, 30_000);

		return () => clearInterval(interval);
	});

	// Fetch all tasks to populate project dropdown and agent counts
	async function loadAllTasks() {
		try {
			const response = await fetch('/api/agents?full=true&usage=true');
			const data = await response.json();
			allTasks = data.tasks || [];

			// Update agent counts
			if (data.agent_counts) {
				activeAgentCount = data.agent_counts.activeCount || 0;
				totalAgentCount = data.agent_counts.totalCount || 0;
				activeAgents = data.agent_counts.activeAgents || [];
			}

			// Calculate token usage from agents
			const agents = data.agents || [];
			let totalTokens = 0;
			let totalCost = 0;

			agents.forEach((agent: any) => {
				if (agent.usage?.today) {
					totalTokens += agent.usage.today.total_tokens || 0;
					totalCost += agent.usage.today.cost || 0;
				}
			});

			tokensToday = totalTokens;
			costToday = totalCost;
		} catch (error) {
			console.error('Failed to load tasks:', error);
			allTasks = [];
		}
	}

	// Fetch sparkline data for TopBar (multi-project mode)
	async function loadSparklineData() {
		try {
			const response = await fetch('/api/agents/sparkline?range=24h&multiProject=true');
			const result = await response.json();

			if (result.error) {
				console.error('Sparkline API error:', result.error);
				sparklineData = [];
				multiProjectData = [];
				projectColors = {};
				return;
			}

			// Multi-project response
			multiProjectData = result.data || [];
			projectColors = result.projectColors || {};

			// Update total tokens/cost from multi-project data
			tokensToday = result.totalTokens || 0;
			costToday = result.totalCost || 0;

			// Also create single-series sparkline for backward compatibility
			// (in case any component needs it)
			sparklineData = (result.data || []).map((point: MultiProjectDataPoint) => ({
				timestamp: point.timestamp,
				tokens: point.totalTokens,
				cost: point.totalCost
			}));
		} catch (error) {
			console.error('Failed to fetch sparkline data:', error);
			sparklineData = [];
			multiProjectData = [];
			projectColors = {};
		}
	}

	// Handle project selection change
	function handleProjectChange(project: string) {
		selectedProject = project;

		// Update URL parameter (use goto to trigger reactivity in child pages)
		const url = new URL(window.location.href);
		if (project === 'All Projects') {
			url.searchParams.delete('project');
		} else {
			url.searchParams.set('project', project);
		}
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}

	// Handle date range selection change
	function handleDateRangeChange(range: string, from?: string, to?: string) {
		selectedDateRange = range;
		customDateFrom = from || null;
		customDateTo = to || null;

		// Update URL parameters
		const url = new URL(window.location.href);

		// Clear existing date params
		url.searchParams.delete('range');
		url.searchParams.delete('from');
		url.searchParams.delete('to');

		// Set new params based on selection
		if (range === 'custom') {
			if (from) url.searchParams.set('from', from);
			if (to) url.searchParams.set('to', to);
		} else if (range !== 'all') {
			url.searchParams.set('range', range);
		}

		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Drawer Structure -->
<div class="drawer lg:drawer-open">
	<!-- Drawer toggle (hidden checkbox for mobile sidebar) -->
	<input id="main-drawer" type="checkbox" class="drawer-toggle" />

	<!-- Main content area -->
	<div class="drawer-content flex flex-col h-screen">
		<!-- Top Bar -->
		<TopBar
			{projects}
			{selectedProject}
			onProjectChange={handleProjectChange}
			{taskCounts}
			{selectedDateRange}
			{customDateFrom}
			{customDateTo}
			onDateRangeChange={handleDateRangeChange}
			{activeAgentCount}
			{totalAgentCount}
			{activeAgents}
			{tokensToday}
			{costToday}
			{sparklineData}
			{multiProjectData}
			{projectColors}
		/>

		<!-- Page content -->
		<main class="flex-1 overflow-y-auto">
			{@render children()}
		</main>

		<!-- Task Creation Drawer (must be inside drawer-content for proper positioning) -->
		<TaskCreationDrawer />
	</div>

	<!-- Sidebar (Sidebar component provides the drawer-side wrapper) -->
	<Sidebar />
</div>
