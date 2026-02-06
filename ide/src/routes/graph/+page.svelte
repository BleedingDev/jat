<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import DAGGraph from '$lib/components/DAGGraph.svelte';
	import DependencyGraph from '$lib/components/DependencyGraph.svelte';
	import DependencyList from '$lib/components/DependencyList.svelte';
	import TaskDetailDrawer from '$lib/components/TaskDetailDrawer.svelte';
	import { GraphSkeleton } from '$lib/components/skeleton';
	import ProjectSelector from '$lib/components/ProjectSelector.svelte';
	import { getProjectsFromTasks, getTaskCountByProject } from '$lib/utils/projectUtils';

	// Task type compatible with DependencyGraph component
	type GraphView = 'dag' | 'force' | 'list';
	type RangePreset = 'all' | '1d' | '1w' | '1m' | 'custom';

	interface Task {
		id: string;
		title?: string;
		description?: string;
		status?: string;
		priority?: number;
		project?: string;
		assignee?: string;
		created_at?: string;
		updated_at?: string;
		closed_at?: string;
		depends_on?: Array<{
			id?: string;
			depends_on_id?: string;
			type?: string;
			title?: string;
			status?: string;
			priority?: number;
		}>;
		labels?: string[];
	}

	// Task data
	let tasks = $state<Task[]>([]);
	let allTasks = $state<Task[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedTaskId = $state<string | null>(null);
	let drawerOpen = $state(false);

	// Filters
	let graphView = $state<GraphView>('dag'); // DAG-first default
	let selectedPriority = $state('all');
	let selectedStatus = $state('closed');
	let searchQuery = $state('');
	let rangePreset = $state<RangePreset>('1d');
	let customFrom = $state<string>(''); // YYYY-MM-DD
	let customTo = $state<string>(''); // YYYY-MM-DD

	// Read project filter from URL (managed by root layout)
	let selectedProject = $state('All Projects');

	// Sync selectedProject from URL params
	$effect(() => {
		const projectParam = $page.url.searchParams.get('project');
		selectedProject = projectParam || 'All Projects';
	});

	// Sync graphView from URL params (dag is implicit default)
	$effect(() => {
		const viewParam = $page.url.searchParams.get('view');
		graphView = viewParam === 'force' ? 'force' : viewParam === 'list' ? 'list' : 'dag';
	});

	// Sync completion range filters from URL params
	$effect(() => {
		const rangeParam = $page.url.searchParams.get('range');
		rangePreset =
			rangeParam === 'all' ||
			rangeParam === '1d' ||
			rangeParam === '1w' ||
			rangeParam === '1m' ||
			rangeParam === 'custom'
				? rangeParam
				: '1d';

		customFrom = rangePreset === 'custom' ? $page.url.searchParams.get('from') || '' : '';
		customTo = rangePreset === 'custom' ? $page.url.searchParams.get('to') || '' : '';
	});

	// Derive projects list from all tasks
	const projects = $derived(getProjectsFromTasks(allTasks));

	// Derive task counts per project for display in dropdown
	const taskCounts = $derived(getTaskCountByProject(allTasks, selectedStatus));

	// Filter tasks by project (fixed: $derived without function wrapper)
	const filteredTasks = $derived(
		!selectedProject || selectedProject === 'All Projects'
			? allTasks
			: allTasks.filter((task) => task.id.startsWith(selectedProject + '-'))
	);

	const searchLower = $derived(searchQuery.trim().toLowerCase());

	function handleRangeChange(next: RangePreset) {
		rangePreset = next;

		const url = new URL(window.location.href);
		url.searchParams.set('range', next);
		if (next !== 'custom') {
			url.searchParams.delete('from');
			url.searchParams.delete('to');
		}
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}

	function handleCustomRangeChange(nextFrom: string, nextTo: string) {
		customFrom = nextFrom;
		customTo = nextTo;
		if (rangePreset !== 'custom') return;

		const url = new URL(window.location.href);
		url.searchParams.set('range', 'custom');
		if (nextFrom) url.searchParams.set('from', nextFrom);
		else url.searchParams.delete('from');
		if (nextTo) url.searchParams.set('to', nextTo);
		else url.searchParams.delete('to');

		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}

	function parseDateInput(dateStr: string): Date | null {
		const parts = dateStr.split('-');
		if (parts.length !== 3) return null;
		const year = Number(parts[0]);
		const month = Number(parts[1]);
		const day = Number(parts[2]);
		if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
		if (year < 1970 || month < 1 || month > 12 || day < 1 || day > 31) return null;
		return new Date(year, month - 1, day, 0, 0, 0, 0);
	}

	function getCompletionRangeBounds(): { startMs: number | null; endExclusiveMs: number | null } {
		if (rangePreset === 'all') return { startMs: null, endExclusiveMs: null };

		if (rangePreset === '1d') return { startMs: Date.now() - 24 * 60 * 60 * 1000, endExclusiveMs: null };
		if (rangePreset === '1w') return { startMs: Date.now() - 7 * 24 * 60 * 60 * 1000, endExclusiveMs: null };
		if (rangePreset === '1m') return { startMs: Date.now() - 30 * 24 * 60 * 60 * 1000, endExclusiveMs: null };

		// custom
		const fromDate = customFrom ? parseDateInput(customFrom) : null;
		const toDate = customTo ? parseDateInput(customTo) : null;
		const startMs = fromDate ? fromDate.getTime() : null;
		let endExclusiveMs: number | null = null;
		if (toDate) {
			const end = new Date(toDate);
			end.setDate(end.getDate() + 1); // inclusive end date
			endExclusiveMs = end.getTime();
		}
		return { startMs, endExclusiveMs };
	}

	const completionFilteredTasks = $derived.by(() => {
		if (rangePreset === 'all') return filteredTasks;
		if (selectedStatus !== 'closed' && selectedStatus !== 'all') return filteredTasks;

		const { startMs, endExclusiveMs } = getCompletionRangeBounds();

		return filteredTasks.filter((task) => {
			// Completion range only applies to completed tasks
			if (task.status !== 'closed') return false;

			const completionTs = task.closed_at || task.updated_at;
			const completionMs = completionTs ? new Date(completionTs).getTime() : NaN;
			if (!Number.isFinite(completionMs)) return false;

			if (startMs !== null && completionMs < startMs) return false;
			if (endExclusiveMs !== null && completionMs >= endExclusiveMs) return false;

			return true;
		});
	});

	// Filter tasks by search query (client-side to avoid refetch spam)
	const searchedTasks = $derived(
		!searchLower
			? completionFilteredTasks
			: completionFilteredTasks.filter((task) => {
					if (task.id && task.id.toLowerCase().includes(searchLower)) return true;
					if (task.title && task.title.toLowerCase().includes(searchLower)) return true;
					if (task.description && task.description.toLowerCase().includes(searchLower)) return true;
					if (task.labels && Array.isArray(task.labels)) {
						return task.labels.some((l) => l.toLowerCase().includes(searchLower));
					}
					return false;
				})
	);

	// Handle project selection change - update URL
	function handleProjectChange(project: string) {
		selectedProject = project;
		const url = new URL(window.location.href);
		if (project === 'All Projects') {
			url.searchParams.delete('project');
		} else {
			url.searchParams.set('project', project);
		}
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}

	function handleViewChange(view: string) {
		const next: GraphView = view === 'force' ? 'force' : view === 'list' ? 'list' : 'dag';
		graphView = next;

		const url = new URL(window.location.href);
		if (next === 'dag') {
			url.searchParams.delete('view');
		} else {
			url.searchParams.set('view', next);
		}
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}

	function isEditableTarget(target: EventTarget | null): boolean {
		const el = target as HTMLElement | null;
		if (!el) return false;
		const tag = el.tagName?.toLowerCase();
		return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
	}

	// Fetch tasks
	async function fetchTasks() {
		try {
			loading = true;
			error = null;

			const params = new URLSearchParams();
			if (selectedStatus !== 'all') params.append('status', selectedStatus);
			if (selectedPriority !== 'all') params.append('priority', selectedPriority);

			const response = await fetch(`/api/tasks?${params}`);
			if (!response.ok) throw new Error('Failed to fetch tasks');

			const data = await response.json();
			allTasks = data.tasks || [];
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Unknown error';
			console.error('Failed to fetch tasks:', err);
		} finally {
			loading = false;
		}
	}

	// Handle node click in graph
	function handleNodeClick(taskId: string) {
		selectedTaskId = taskId;
		drawerOpen = true;
	}

	// Refetch tasks when filters change
	$effect(() => {
		// Track dependencies for re-fetch
		selectedStatus;
		selectedPriority;
		fetchTasks();
	});

	// Update displayed tasks when project filter or allTasks change
	$effect(() => {
		tasks = searchedTasks;
	});

	onMount(() => {
		const handleKeydown = (e: KeyboardEvent) => {
			if (e.defaultPrevented) return;
			if (isEditableTarget(e.target)) return;
			if (e.key === 'g') {
				e.preventDefault();
				handleViewChange('dag');
				return;
			}
			if (e.key === 'l') {
				e.preventDefault();
				handleViewChange('list');
				return;
			}
		};

		window.addEventListener('keydown', handleKeydown);
		fetchTasks();

		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<svelte:head>
	<title>Graph | JAT IDE</title>
	<meta name="description" content="Task dependency graph visualization. Explore relationships between tasks and epics." />
	<meta property="og:title" content="Graph | JAT IDE" />
	<meta property="og:description" content="Task dependency graph visualization. Explore relationships between tasks and epics." />
	<meta property="og:image" content="/favicons/graph.svg" />
	<link rel="icon" href="/favicons/graph.svg" />
</svelte:head>

<div class="min-h-screen bg-base-200">
	<!-- Filters Bar -->
	<div class="bg-base-100 border-b border-base-300 p-4">
		<div class="flex flex-wrap items-center gap-4">
			<!-- View Filter -->
			<div class="flex flex-col">
				<label class="industrial-label" for="view-filter">View</label>
				<select
					id="view-filter"
					class="industrial-select"
					value={graphView}
					on:change={(e) => handleViewChange((e.target as HTMLSelectElement).value)}
				>
					<option value="dag">DAG (Sequential)</option>
					<option value="list">List (Sequential)</option>
					<option value="force">Force (Exploration)</option>
				</select>
			</div>

			<!-- Project Filter -->
			<div class="flex flex-col">
				<label class="industrial-label" for="project-filter">Project</label>
				<div class="w-40" id="project-filter">
					<ProjectSelector
						{projects}
						{selectedProject}
						onProjectChange={handleProjectChange}
						{taskCounts}
						compact={true}
					/>
				</div>
			</div>

			<!-- Filters -->
			<div class="flex flex-col">
				<label class="industrial-label" for="priority-filter">Priority</label>
				<select
					id="priority-filter"
					class="industrial-select"
					bind:value={selectedPriority}
				>
					<option value="all">All Priorities</option>
					<option value="0">P0 (Critical)</option>
					<option value="1">P1 (High)</option>
					<option value="2">P2 (Medium)</option>
					<option value="3">P3 (Low)</option>
				</select>
			</div>

			<div class="flex flex-col">
				<label class="industrial-label" for="status-filter">Status</label>
				<select
					id="status-filter"
					class="industrial-select"
					bind:value={selectedStatus}
				>
					<option value="all">All Statuses</option>
					<option value="open">Open</option>
					<option value="in_progress">In Progress</option>
					<option value="blocked">Blocked</option>
					<option value="closed">Closed</option>
				</select>
			</div>

			{#if selectedStatus === 'closed' || selectedStatus === 'all'}
				<div class="flex flex-col">
					<label class="industrial-label" for="range-filter">Completed</label>
					<select
						id="range-filter"
						class="industrial-select"
						value={rangePreset}
						on:change={(e) =>
							handleRangeChange((e.target as HTMLSelectElement).value as RangePreset)}
					>
						<option value="1d">Past 1 day</option>
						<option value="1w">Past 1 week</option>
						<option value="1m">Past 1 month</option>
						<option value="all">All time</option>
						<option value="custom">Custom…</option>
					</select>
				</div>

				{#if rangePreset === 'custom'}
					<div class="flex flex-col">
						<label class="industrial-label" for="range-from">From</label>
						<input
							id="range-from"
							type="date"
							class="industrial-input"
							value={customFrom}
							on:change={(e) =>
								handleCustomRangeChange((e.target as HTMLInputElement).value, customTo)}
						/>
					</div>
					<div class="flex flex-col">
						<label class="industrial-label" for="range-to">To</label>
						<input
							id="range-to"
							type="date"
							class="industrial-input"
							value={customTo}
							on:change={(e) =>
								handleCustomRangeChange(customFrom, (e.target as HTMLInputElement).value)}
						/>
					</div>
				{/if}
			{/if}

			<div class="flex flex-col">
				<label class="industrial-label" for="search-filter">Search</label>
				<input
					id="search-filter"
					type="text"
					placeholder="Search tasks..."
					class="industrial-input"
					bind:value={searchQuery}
				/>
			</div>
		</div>
	</div>

	<!-- Loading State -->
	{#if loading}
		<GraphSkeleton nodes={8} />

	<!-- Error State -->
	{:else if error}
		<div class="alert alert-error m-4">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="stroke-current shrink-0 h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>Error: {error}</span>
		</div>

	<!-- Main Content: Dependency Graph -->
		{:else}
			<div class="p-4">
				{#if graphView === 'force'}
					<DependencyGraph {tasks} onNodeClick={handleNodeClick} />
				{:else if graphView === 'list'}
					<DependencyList {tasks} onNodeClick={handleNodeClick} />
				{:else}
					<DAGGraph {tasks} onNodeClick={handleNodeClick} />
				{/if}
			</div>
		{/if}

	<!-- Task Detail Modal -->
	<TaskDetailDrawer bind:taskId={selectedTaskId} bind:isOpen={drawerOpen} />
</div>
