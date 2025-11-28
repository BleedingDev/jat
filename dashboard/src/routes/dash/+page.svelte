<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import TaskTable from '$lib/components/agents/TaskTable.svelte';
	import AgentGrid from '$lib/components/agents/AgentGrid.svelte';
	import TaskDetailDrawer from '$lib/components/TaskDetailDrawer.svelte';
	import ResizableDivider from '$lib/components/ResizableDivider.svelte';
	import { lastSessionEvent } from '$lib/stores/sessionEvents';

	let tasks = $state([]);
	let allTasks = $state([]);  // Unfiltered tasks for project list calculation
	let agents = $state([]);
	let reservations = $state([]);
	let selectedProject = $state('All Projects');
	let sparklineData = $state([]);
	let isInitialLoad = $state(true);

	// Drawer state for TaskDetailDrawer
	let drawerOpen = $state(false);
	let selectedTaskId = $state<string | null>(null);

	// Highlighted agent for scroll-to-agent feature
	let highlightedAgent = $state<string | null>(null);

	// Resizable panel state
	const STORAGE_KEY = 'dash-panel-split';
	const DEFAULT_SPLIT = 40; // 40% for AgentGrid, 60% for TaskTable
	const MIN_SPLIT = 20;
	const MAX_SPLIT = 80;

	let splitPercent = $state(DEFAULT_SPLIT);
	let containerHeight = $state(0);
	let containerRef: HTMLDivElement | null = null;

	// Load saved split from localStorage
	$effect(() => {
		if (browser) {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const parsed = parseFloat(saved);
				if (!isNaN(parsed) && parsed >= MIN_SPLIT && parsed <= MAX_SPLIT) {
					splitPercent = parsed;
				}
			}
		}
	});

	// Save split to localStorage when it changes
	function saveSplit() {
		if (browser) {
			localStorage.setItem(STORAGE_KEY, splitPercent.toString());
		}
	}

	// Handle resize from divider
	function handleResize(deltaY: number) {
		if (!containerHeight) return;

		const deltaPercent = (deltaY / containerHeight) * 100;
		const newSplit = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, splitPercent + deltaPercent));
		splitPercent = newSplit;
		saveSplit();
	}

	// Update container height on mount and resize
	function updateContainerHeight() {
		if (containerRef) {
			containerHeight = containerRef.clientHeight;
		}
	}

	// Sync selectedProject from URL params (REACTIVE using $page store)
	$effect(() => {
		const projectParam = $page.url.searchParams.get('project');
		if (projectParam && projectParam !== 'All Projects') {
			selectedProject = projectParam;
		} else {
			selectedProject = 'All Projects';
		}
	});

	// Refetch data whenever selectedProject changes (triggered by URL or dropdown)
	$effect(() => {
		// This effect depends on selectedProject, so it re-runs when it changes
		selectedProject; // Read selectedProject to create dependency
		fetchData();
	});

	// Fetch agent data from unified API
	async function fetchData() {
		try {
			// Build URL with project filter, token usage, and activities
			let url = '/api/agents?full=true&usage=true&activities=true';
			if (selectedProject && selectedProject !== 'All Projects') {
				url += `&project=${encodeURIComponent(selectedProject)}`;
			}

			const response = await fetch(url);
			const data = await response.json();

			if (data.error) {
				console.error('API error:', data.error);
				return;
			}

			// Update state with real data
			agents = data.agents || [];
			reservations = data.reservations || [];
			tasks = data.tasks || [];

			// Update allTasks when viewing all projects (for dropdown options)
			if (selectedProject === 'All Projects') {
				allTasks = data.tasks || [];
			}
		} catch (error) {
			console.error('Failed to fetch agent data:', error);
		} finally {
			// Only set to false after first load completes
			isInitialLoad = false;
		}
	}

	// Fetch sparkline data (system-wide, no agent filter)
	async function fetchSparklineData() {
		try {
			const response = await fetch('/api/agents/sparkline?range=24h');
			const result = await response.json();

			if (result.error) {
				console.error('Sparkline API error:', result.error);
				return;
			}

			// Update sparkline data
			sparklineData = result.data || [];
		} catch (error) {
			console.error('Failed to fetch sparkline data:', error);
		}
	}

	// Handle task assignment via drag-and-drop
	async function handleTaskAssign(taskId: string, agentName: string) {
		try {
			const response = await fetch('/api/agents', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ taskId, agentName })
			});

			const result = await response.json();

			if (!response.ok || result.error) {
				console.error('Failed to assign task:', result.error || result.message);
				throw new Error(result.message || 'Failed to assign task');
			}

			// Immediately refresh data to show updated assignment
			await fetchData();
		} catch (error) {
			console.error('Error assigning task:', error);
			throw error;
		}
	}

	// Handle task click from TaskQueue - open drawer
	function handleTaskClick(taskId: string) {
		selectedTaskId = taskId;
		drawerOpen = true;
	}

	// Handle agent click - scroll to agent card and highlight it
	function handleAgentClick(agentName: string) {
		// Find the agent card element using data-agent-name attribute
		const agentCard = document.querySelector(`[data-agent-name="${agentName}"]`);
		if (agentCard) {
			// Scroll the agent card into view smoothly
			agentCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

			// Set highlighted state to trigger animation
			highlightedAgent = agentName;

			// Clear highlight after animation completes (1.5s matches CSS animation duration)
			setTimeout(() => {
				highlightedAgent = null;
			}, 1500);
		}
	}

	// Auto-refresh data every 15 seconds (layout also polls at 30s)
	$effect(() => {
		const interval = setInterval(fetchData, 15000);
		return () => clearInterval(interval);
	});

	// React to session events from other pages (e.g., session killed on /work)
	$effect(() => {
		const event = $lastSessionEvent;
		if (event) {
			// Immediately refresh data when a session is killed or spawned
			fetchData();
		}
	});

	// Auto-refresh sparkline every 30 seconds
	$effect(() => {
		const interval = setInterval(fetchSparklineData, 30000);
		return () => clearInterval(interval);
	});

	// Track previous drawer state to detect close transition
	let wasDrawerOpen = false;

	// Refetch data when drawer closes (to update any changes made in drawer)
	$effect(() => {
		if (wasDrawerOpen && !drawerOpen) {
			fetchData();
		}
		wasDrawerOpen = drawerOpen;
	});

	onMount(() => {
		fetchData();
		fetchSparklineData();
		updateContainerHeight();
	});
</script>

<svelte:window onresize={updateContainerHeight} />

<div
	bind:this={containerRef}
	class="h-screen bg-base-200 flex flex-col overflow-hidden"
>
	<!-- Agent Grid -->
	<div
		class="overflow-hidden bg-base-100 flex flex-col"
		style="height: {splitPercent}%;"
	>
		{#if isInitialLoad}
			<!-- Loading State for Agent Grid -->
			<div class="flex items-center justify-center flex-1">
				<div class="text-center">
					<span class="loading loading-bars loading-lg mb-4"></span>
					<p class="text-sm text-base-content/60">Loading agents...</p>
				</div>
			</div>
		{:else}
			<AgentGrid {agents} {tasks} {allTasks} {reservations} {sparklineData} onTaskAssign={handleTaskAssign} ontaskclick={handleTaskClick} {highlightedAgent} />
		{/if}
	</div>

	<!-- Resizable Divider -->
	<ResizableDivider
		onResize={handleResize}
		class="h-2 bg-base-300 hover:bg-primary/20 border-y border-base-300 flex-shrink-0"
	/>

	<!-- Task Section -->
	<div
		class="overflow-auto bg-base-100 flex-1"
		style="height: {100 - splitPercent}%;"
	>
		{#if isInitialLoad}
			<!-- Loading State -->
			<div class="flex items-center justify-center h-48">
				<div class="text-center">
					<span class="loading loading-bars loading-lg mb-4"></span>
					<p class="text-sm text-base-content/60">Loading tasks...</p>
				</div>
			</div>
		{:else}
			<TaskTable
				{tasks}
				{allTasks}
				{agents}
				{reservations}
				ontaskclick={handleTaskClick}
				onagentclick={handleAgentClick}
			/>
		{/if}
	</div>

	<!-- Task Detail Drawer -->
	<TaskDetailDrawer
		bind:taskId={selectedTaskId}
		bind:isOpen={drawerOpen}
	/>
</div>
