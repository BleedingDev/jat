<script>
	let { agent, tasks = [], reservations = [] } = $props();

	// Compute agent status using $derived
	const agentStatus = $derived(() => {
		// Use agent.active from API (computed based on reservations + in-progress tasks)
		if (agent.active) {
			return agent.in_progress_tasks > 0 ? 'active' : 'idle';
		}
		// Check if agent has been active recently (based on last_activity timestamp)
		const lastActivity = agent.last_activity ? new Date(agent.last_activity) : null;
		if (lastActivity && (Date.now() - lastActivity.getTime()) < 3600000) {
			// Active within last hour
			return 'idle';
		}
		return 'offline';
	});

	// Get status badge class
	function getStatusBadge(status) {
		switch (status) {
			case 'active':
				return 'badge-info'; // Blue
			case 'idle':
				return 'badge-success'; // Green
			case 'blocked':
				return 'badge-warning'; // Yellow
			case 'offline':
				return 'badge-ghost'; // Gray
			default:
				return 'badge-ghost';
		}
	}

	// Get status icon
	function getStatusIcon(status) {
		switch (status) {
			case 'active':
				return '⚡'; // Working
			case 'idle':
				return '✓'; // Ready
			case 'blocked':
				return '⏸'; // Paused
			case 'offline':
				return '○'; // Offline
			default:
				return '?';
		}
	}

	// Compute current task (in-progress tasks assigned to this agent)
	const currentTask = $derived(() => {
		const inProgressTasks = tasks.filter(
			(t) => t.assignee === agent.name && t.status === 'in_progress'
		);
		return inProgressTasks.length > 0 ? inProgressTasks[0] : null;
	});

	// Compute queued tasks (open tasks assigned to this agent)
	const queuedTasks = $derived(() => {
		return tasks.filter((t) => t.assignee === agent.name && t.status === 'open');
	});

	// Compute file locks held by this agent
	const agentLocks = $derived(() => {
		return reservations.filter(
			(r) =>
				(r.agent_name === agent.name || r.agent === agent.name) &&
				(!r.released_ts) &&
				new Date(r.expires_ts) > new Date()
		);
	});

	// Handle drop event (placeholder)
	function handleDrop(event) {
		event.preventDefault();
		console.log('Task dropped on agent:', agent.name);
		// TODO: Implement in P1 task (jomarchy-agent-tools-c37)
	}

	function handleDragOver(event) {
		event.preventDefault();
		// TODO: Add conflict detection in P1 task (jomarchy-agent-tools-0nu)
	}
</script>

<div
	class="card bg-base-100 border-2 border-base-300 hover:border-primary transition-all"
	role="button"
	tabindex="0"
	ondrop={handleDrop}
	ondragover={handleDragOver}
>
	<div class="card-body p-4">
		<!-- Agent Header -->
		<div class="flex items-start justify-between gap-2 mb-3">
			<div class="flex-1 min-w-0">
				<h3 class="font-semibold text-base text-base-content truncate" title={agent.name}>
					{agent.name || 'Unknown Agent'}
				</h3>
				<p class="text-xs text-base-content/50 font-mono truncate">
					{agent.program || 'claude-code'} • {agent.model || 'unknown'}
				</p>
			</div>
			<span class="badge badge-sm {getStatusBadge(agentStatus())}">
				{getStatusIcon(agentStatus())}
				{agentStatus().charAt(0).toUpperCase() + agentStatus().slice(1)}
			</span>
		</div>

		<!-- Current Task -->
		<div class="mb-3">
			<div class="text-xs font-medium text-base-content/70 mb-1">Current Task:</div>
			{#if currentTask()}
				<div class="bg-base-200 rounded p-2">
					<div class="flex items-center gap-2 mb-1">
						<span class="text-xs font-mono text-base-content/50">{currentTask().id}</span>
						<div class="flex-1 w-full bg-base-300 rounded-full h-1.5">
							<div class="bg-primary h-1.5 rounded-full" style="width: 0%"></div>
						</div>
					</div>
					<p class="text-xs text-base-content truncate" title={currentTask().title}>
						{currentTask().title}
					</p>
				</div>
			{:else}
				<div class="bg-base-200 rounded p-2 text-center">
					<p class="text-xs text-base-content/50 italic">No active task</p>
				</div>
			{/if}
		</div>

		<!-- Queued Tasks -->
		<div class="mb-3">
			<div class="text-xs font-medium text-base-content/70 mb-1">
				Queue ({queuedTasks().length}):
			</div>
			{#if queuedTasks().length > 0}
				<div class="space-y-1">
					{#each queuedTasks().slice(0, 3) as task}
						<div class="bg-base-200 rounded px-2 py-1">
							<p class="text-xs text-base-content truncate" title={task.title}>
								• {task.title}
							</p>
						</div>
					{/each}
					{#if queuedTasks().length > 3}
						<div class="text-xs text-base-content/50 text-center">
							+{queuedTasks().length - 3} more
						</div>
					{/if}
				</div>
			{:else}
				<div class="bg-base-200 rounded p-2 text-center">
					<p class="text-xs text-base-content/50 italic">No queued tasks</p>
				</div>
			{/if}
		</div>

		<!-- File Locks -->
		<div>
			<div class="text-xs font-medium text-base-content/70 mb-1">
				File Locks ({agentLocks().length}):
			</div>
			{#if agentLocks().length > 0}
				<div class="space-y-1">
					{#each agentLocks().slice(0, 2) as lock}
						<div class="bg-warning/10 rounded px-2 py-1">
							<p class="text-xs text-warning truncate" title={lock.file_pattern || lock.pattern}>
								🔒 {lock.file_pattern || lock.pattern}
							</p>
						</div>
					{/each}
					{#if agentLocks().length > 2}
						<div class="text-xs text-base-content/50 text-center">
							+{agentLocks().length - 2} more
						</div>
					{/if}
				</div>
			{:else}
				<div class="bg-base-200 rounded p-2 text-center">
					<p class="text-xs text-base-content/50 italic">No file locks</p>
				</div>
			{/if}
		</div>

		<!-- Drop Zone Indicator -->
		<div class="mt-3 pt-3 border-t border-base-300 text-center">
			<p class="text-xs text-base-content/50">Drop task here to assign</p>
		</div>
	</div>
</div>
