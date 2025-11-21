<script>
	import { onMount } from 'svelte';
	import TaskList from '$lib/components/TaskList.svelte';
	import DependencyGraph from '$lib/components/DependencyGraph.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import TaskDetailModal from '$lib/components/TaskDetailModal.svelte';

	let selectedProject = $state('all');
	let selectedPriority = $state('all');
	let selectedStatus = $state('all');
	let searchQuery = $state('');
	let viewMode = $state('list'); // 'list' or 'graph'
	let tasks = $state([]);
	let selectedTaskId = $state(null);

	// Fetch tasks based on filters
	async function fetchTasks() {
		const params = new URLSearchParams();
		if (selectedProject !== 'all') params.append('project', selectedProject);
		if (selectedStatus !== 'all') params.append('status', selectedStatus);
		if (selectedPriority !== 'all') params.append('priority', selectedPriority);

		const response = await fetch(`/api/tasks?${params}`);
		const data = await response.json();
		tasks = data.tasks || [];
	}

	// Handle node click in graph
	function handleNodeClick(taskId) {
		selectedTaskId = taskId;
	}

	// Handle modal close
	function handleModalClose() {
		selectedTaskId = null;
	}

	// Fetch tasks when filters change
	$effect(() => {
		fetchTasks();
	});

	onMount(() => {
		fetchTasks();
	});
</script>

<div class="min-h-screen bg-base-200">
	<Nav />

	<div class="bg-base-100 border-b border-base-300 p-4">
		<div class="flex flex-wrap gap-4">
			<div class="form-control">
				<label class="label" for="project-filter">
					<span class="label-text">Project</span>
				</label>
				<select id="project-filter" class="select select-bordered select-sm" bind:value={selectedProject}>
					<option value="all">All Projects</option>
					<option value="chimaro">Chimaro</option>
					<option value="jomarchy">Jomarchy</option>
					<option value="jomarchy-agent-tools">JAT</option>
				</select>
			</div>

			<div class="form-control">
				<label class="label" for="priority-filter">
					<span class="label-text">Priority</span>
				</label>
				<select id="priority-filter" class="select select-bordered select-sm" bind:value={selectedPriority}>
					<option value="all">All Priorities</option>
					<option value="0">P0 (Critical)</option>
					<option value="1">P1 (High)</option>
					<option value="2">P2 (Medium)</option>
					<option value="3">P3 (Low)</option>
				</select>
			</div>

			<div class="form-control">
				<label class="label" for="status-filter">
					<span class="label-text">Status</span>
				</label>
				<select id="status-filter" class="select select-bordered select-sm" bind:value={selectedStatus}>
					<option value="all">All Statuses</option>
					<option value="open">Open</option>
					<option value="closed">Closed</option>
				</select>
			</div>

			<div class="form-control">
				<label class="label" for="search-filter">
					<span class="label-text">Search</span>
				</label>
				<input
					id="search-filter"
					type="text"
					placeholder="Search tasks..."
					class="input input-bordered input-sm"
					bind:value={searchQuery}
				/>
			</div>
		</div>
	</div>

	{#if viewMode === 'list'}
		<TaskList
			bind:selectedProject
			bind:selectedPriority
			bind:selectedStatus
			bind:searchQuery
		/>
	{:else}
		<div class="p-4">
			<DependencyGraph {tasks} onNodeClick={handleNodeClick} />
		</div>
	{/if}

	<!-- Task Detail Modal -->
	<TaskDetailModal taskId={selectedTaskId} onClose={handleModalClose} />
</div>
