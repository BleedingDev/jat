<script lang="ts">
	/**
	 * Work Page
	 * Shows active Claude Code work sessions with TaskQueue sidebar.
	 *
	 * Layout: TaskQueue sidebar (left) + WorkPanel main area (right)
	 * Features:
	 * - Real-time session output polling (500ms)
	 * - Spawn agents for tasks via drag-drop or click
	 * - Kill sessions, send input
	 * - TaskQueue reused from /agents page
	 */

	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { replaceState } from '$app/navigation';
	import TaskQueue from '$lib/components/agents/TaskQueue.svelte';
	import WorkPanel from '$lib/components/work/WorkPanel.svelte';
	import TaskDetailDrawer from '$lib/components/TaskDetailDrawer.svelte';
	import {
		workSessionsState,
		fetch as fetchSessions,
		spawn,
		kill,
		sendInput,
		interrupt,
		sendEnter,
		startPolling,
		stopPolling
	} from '$lib/stores/workSessions.svelte.js';
	import {
		getProjectsFromTasks,
		getTaskCountByProject
	} from '$lib/utils/projectUtils';

	// Task state for sidebar
	let tasks = $state<any[]>([]);
	let allTasks = $state<any[]>([]);
	let agents = $state<any[]>([]);
	let reservations = $state<any[]>([]);
	let unassignedTasks = $state<any[]>([]);
	let selectedProject = $state('All Projects');
	let isInitialLoad = $state(true);

	// Drawer state
	let drawerOpen = $state(false);
	let selectedTaskId = $state<string | null>(null);

	// Extract unique projects from ALL tasks (unfiltered)
	const projects = $derived(getProjectsFromTasks(allTasks));

	// Get task count per project from ALL tasks (only count 'open' tasks)
	const taskCounts = $derived(getTaskCountByProject(allTasks, 'open'));

	// Handle project selection change
	function handleProjectChange(project: string) {
		selectedProject = project;

		// Update URL parameter
		const url = new URL(window.location.href);
		if (project === 'All Projects') {
			url.searchParams.delete('project');
		} else {
			url.searchParams.set('project', project);
		}
		replaceState(url, {});

		// Refetch data with new project filter
		fetchTaskData();
	}

	// Sync selectedProject from URL params
	let previousProject: string | null = null;
	$effect(() => {
		const projectParam = $page.url.searchParams.get('project');
		const newProject = (projectParam && projectParam !== 'All Projects') ? projectParam : 'All Projects';

		selectedProject = newProject;

		if (previousProject !== null && previousProject !== newProject) {
			fetchTaskData();
		}
		previousProject = newProject;
	});

	// Fetch task data for sidebar
	async function fetchTaskData() {
		try {
			let url = '/api/agents?full=true';
			if (selectedProject && selectedProject !== 'All Projects') {
				url += `&project=${encodeURIComponent(selectedProject)}`;
			}

			const response = await fetch(url);
			const data = await response.json();

			if (data.error) {
				console.error('API error:', data.error);
				return;
			}

			agents = data.agents || [];
			reservations = data.reservations || [];
			tasks = data.tasks || [];
			unassignedTasks = data.unassigned_tasks || [];

			if (selectedProject === 'All Projects') {
				allTasks = data.tasks || [];
			}
		} catch (error) {
			console.error('Failed to fetch task data:', error);
		} finally {
			isInitialLoad = false;
		}
	}

	// Event Handlers for WorkPanel

	async function handleSpawnForTask(taskId: string) {
		const session = await spawn(taskId);
		if (session) {
			// Refetch task data to update sidebar (task should now be in_progress)
			await fetchTaskData();
		}
	}

	async function handleKillSession(sessionName: string) {
		const success = await kill(sessionName);
		if (success) {
			await fetchTaskData();
		}
	}

	async function handleInterrupt(sessionName: string) {
		await interrupt(sessionName);
	}

	async function handleContinue(sessionName: string) {
		await sendEnter(sessionName);
	}

	async function handleSendInput(sessionName: string, input: string, type: 'text' | 'key') {
		const inputType = type === 'key' ? 'raw' : 'text';
		await sendInput(sessionName, input, inputType);
	}

	// Handle task click from TaskQueue or WorkCard
	function handleTaskClick(taskId: string) {
		selectedTaskId = taskId;
		drawerOpen = true;
	}

	// Track drawer state for refetch on close
	let wasDrawerOpen = false;
	$effect(() => {
		if (wasDrawerOpen && !drawerOpen) {
			fetchTaskData();
			fetchSessions();
		}
		wasDrawerOpen = drawerOpen;
	});

	// Refresh task data periodically (less frequent than session polling)
	$effect(() => {
		const interval = setInterval(fetchTaskData, 15000);
		return () => clearInterval(interval);
	});

	onMount(() => {
		// Initial data fetch
		fetchTaskData();

		// Start session polling at 500ms for real-time output
		startPolling(500);
	});

	onDestroy(() => {
		stopPolling();
	});
</script>

<div class="min-h-screen bg-base-200">
	<!-- Main Content: Sidebar + Work Panel -->
	<div class="flex h-[calc(100vh-theme(spacing.20))]">
		<!-- Left Sidebar: Task Queue -->
		<div class="w-100 border-r border-base-300 bg-base-100 flex flex-col">
			{#if isInitialLoad}
				<!-- Loading State -->
				<div class="flex-1 flex items-center justify-center">
					<div class="text-center">
						<span class="loading loading-bars loading-lg mb-4"></span>
						<p class="text-sm text-base-content/60">Loading tasks...</p>
					</div>
				</div>
			{:else}
				<TaskQueue
					tasks={unassignedTasks}
					{agents}
					{reservations}
					{selectedProject}
					ontaskclick={handleTaskClick}
				/>
			{/if}
		</div>

		<!-- Right Panel: Work Sessions -->
		<div class="flex-1 overflow-hidden flex flex-col">
			{#if isInitialLoad}
				<!-- Loading State -->
				<div class="flex-1 flex items-center justify-center">
					<div class="text-center">
						<span class="loading loading-bars loading-xl mb-4"></span>
						<p class="text-sm text-base-content/60">Loading work sessions...</p>
					</div>
				</div>
			{:else}
				<WorkPanel
					workSessions={workSessionsState.sessions}
					onSpawnForTask={handleSpawnForTask}
					onKillSession={handleKillSession}
					onInterrupt={handleInterrupt}
					onContinue={handleContinue}
					onSendInput={handleSendInput}
					onTaskClick={handleTaskClick}
					class="h-full"
				/>
			{/if}
		</div>
	</div>

	<!-- Task Detail Drawer -->
	<TaskDetailDrawer
		bind:taskId={selectedTaskId}
		bind:isOpen={drawerOpen}
	/>
</div>
