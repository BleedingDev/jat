<script lang="ts">
	/**
	 * TasksActive Component
	 *
	 * Displays active agent/server sessions in a table format with expandable rows.
	 * Extracted from /tasks page for reuse in other views.
	 */

	import SessionCard from '$lib/components/work/SessionCard.svelte';
	import HorizontalResizeHandle from '$lib/components/HorizontalResizeHandle.svelte';
	import TaskIdBadge from '$lib/components/TaskIdBadge.svelte';
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';
	import ServerSessionBadge from '$lib/components/ServerSessionBadge.svelte';
	import StatusActionBadge from '$lib/components/work/StatusActionBadge.svelte';

	// Types
	interface TmuxSession {
		name: string;
		created: string;
		attached: boolean;
		type: 'agent' | 'server' | 'ide' | 'other';
		project?: string;
		resumed?: boolean;
		originalSessionId?: string;
		resumedAt?: string;
	}

	interface AgentTask {
		id: string;
		status: string;
		issue_type?: string;
		title?: string;
		priority?: number;
		description?: string;
		notes?: string;
	}

	interface AgentSessionInfo {
		tokens: number;
		cost: number;
		activityState?: string;
		activityStateTimestamp?: number;
	}

	interface TaskAttachment {
		id: string;
		path: string;
		filename: string;
		url: string;
	}

	interface TaskDependency {
		id: string;
		title: string;
		status: string;
		priority: number;
	}

	interface TimelineEvent {
		type: 'beads_event' | 'agent_mail' | 'signal';
		event?: string;
		timestamp: string;
		description?: string;
		metadata?: Record<string, any>;
		data?: Record<string, any>;
	}

	interface ExtendedTaskDetails {
		labels?: string[];
		assignee?: string;
		notes?: string;
		depends_on?: TaskDependency[];
		blocked_by?: TaskDependency[];
		created_at?: string;
		updated_at?: string;
		attachments: TaskAttachment[];
		timeline: TimelineEvent[];
		timelineCounts: { total: number; beads_events: number; agent_mail: number; signals?: number };
	}

	// Props
	let {
		sessions = [],
		agentTasks = new Map(),
		agentSessionInfo = new Map(),
		agentProjects = new Map(),
		projectColors = {},
		onKillSession,
		onAttachSession,
		onViewTask
	}: {
		sessions: TmuxSession[];
		agentTasks: Map<string, AgentTask>;
		agentSessionInfo: Map<string, AgentSessionInfo>;
		agentProjects: Map<string, string>;
		projectColors: Record<string, string>;
		onKillSession?: (sessionName: string) => Promise<void>;
		onAttachSession?: (sessionName: string) => Promise<void>;
		onViewTask?: (taskId: string) => void;
	} = $props();

	// Status and priority colors
	const statusColors: Record<string, string> = {
		open: 'badge-info',
		in_progress: 'badge-warning',
		blocked: 'badge-error',
		closed: 'badge-success'
	};

	// Internal state
	let expandedSession = $state<string | null>(null);
	let collapsingSession = $state<string | null>(null);
	let expandedOutput = $state<string>('');
	let outputPollInterval: ReturnType<typeof setInterval> | null = null;
	let expandedHeight = $state(800);
	let isResizing = $state(false);

	// Tmux pane width tracking
	let tmuxWidth = $state(160);
	const PIXELS_PER_COLUMN = 8.5;
	let isCardResizing = $state(false);

	// Task detail panel state
	let expandedTaskId = $state<string | null>(null);
	let taskDetailOpen = $state(false);
	let expandedTaskDetails = $state<ExtendedTaskDetails | null>(null);
	let taskDetailsLoading = $state(false);
	let timelineFilter = $state<'all' | 'tasks' | 'messages'>('all');

	// Notes editing state
	let notesEditing = $state(false);
	let notesValue = $state('');
	let notesSaving = $state(false);

	// Action loading state
	let actionLoading = $state<string | null>(null);

	// Helper functions
	function getAgentName(sessionName: string): string {
		if (sessionName.startsWith('jat-')) {
			return sessionName.slice(4);
		}
		return sessionName;
	}

	function getProjectColorReactive(taskIdOrProject: string): string | null {
		if (!taskIdOrProject) return null;
		const projectPrefix = taskIdOrProject.split('-')[0].toLowerCase();
		return projectColors[projectPrefix] || null;
	}

	function getTypeBadge(type: TmuxSession['type']) {
		switch (type) {
			case 'agent':
				return { bg: 'oklch(0.65 0.15 200 / 0.2)', text: 'oklch(0.75 0.15 200)', label: 'AGENT' };
			case 'server':
				return { bg: 'oklch(0.65 0.15 145 / 0.2)', text: 'oklch(0.75 0.15 145)', label: 'SERVER' };
			case 'ide':
				return { bg: 'oklch(0.65 0.15 280 / 0.2)', text: 'oklch(0.75 0.15 280)', label: 'IDE' };
			default:
				return { bg: 'oklch(0.50 0.02 250 / 0.2)', text: 'oklch(0.65 0.02 250)', label: 'OTHER' };
		}
	}

	function getElapsedFormatted(createdISO: string): { hours: string; minutes: string; seconds: string; showHours: boolean } | null {
		if (!createdISO) return null;
		const created = new Date(createdISO).getTime();
		const now = Date.now();
		const elapsedMs = now - created;

		if (elapsedMs < 0) return { hours: '00', minutes: '00', seconds: '00', showHours: false };

		const totalSeconds = Math.floor(elapsedMs / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		return {
			hours: hours.toString().padStart(2, '0'),
			minutes: minutes.toString().padStart(2, '0'),
			seconds: seconds.toString().padStart(2, '0'),
			showHours: hours > 0
		};
	}

	// Session expansion
	async function fetchExpandedOutput(sessionName: string) {
		try {
			const response = await fetch(`/api/work/${encodeURIComponent(sessionName)}/output`);
			if (response.ok) {
				const data = await response.json();
				expandedOutput = data.output || '';
			}
		} catch (err) {
			console.error('Failed to fetch session output:', err);
		}
	}

	async function fetchTmuxDimensions(sessionName: string) {
		try {
			const response = await fetch(`/api/work/${encodeURIComponent(sessionName)}/resize`);
			if (response.ok) {
				const data = await response.json();
				tmuxWidth = data.dimensions?.width || 80;
			}
		} catch (err) {
			console.error('Failed to fetch tmux dimensions:', err);
		}
	}

	async function resizeTmuxWidth(sessionName: string, newWidth: number) {
		try {
			await fetch(`/api/work/${encodeURIComponent(sessionName)}/resize`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ width: newWidth })
			});
		} catch (err) {
			console.error('Failed to resize tmux pane:', err);
		}
	}

	function handleHorizontalResize(deltaX: number) {
		if (!expandedSession) return;
		isCardResizing = true;
		const deltaColumns = Math.round(deltaX / PIXELS_PER_COLUMN);
		if (deltaColumns !== 0) {
			tmuxWidth = Math.max(40, tmuxWidth + deltaColumns);
		}
	}

	function handleHorizontalResizeEnd() {
		isCardResizing = false;
		if (expandedSession) {
			resizeTmuxWidth(expandedSession, tmuxWidth);
		}
	}

	function toggleExpanded(sessionName: string) {
		if (expandedSession === sessionName) {
			// Collapse with animation
			collapsingSession = sessionName;
			if (outputPollInterval) {
				clearInterval(outputPollInterval);
				outputPollInterval = null;
			}
			setTimeout(() => {
				expandedSession = null;
				expandedOutput = '';
				collapsingSession = null;
			}, 200);
		} else {
			expandInline(sessionName);
		}
	}

	function expandInline(sessionName: string) {
		if (outputPollInterval) {
			clearInterval(outputPollInterval);
			outputPollInterval = null;
		}

		expandedSession = sessionName;
		fetchExpandedOutput(sessionName);
		fetchTmuxDimensions(sessionName);

		const agentName = getAgentName(sessionName);
		const task = agentTasks.get(agentName);
		if (task) {
			expandedTaskId = task.id;
			taskDetailOpen = true;
			fetchExpandedTaskDetails(task.id);
		} else {
			expandedTaskId = null;
			taskDetailOpen = false;
			expandedTaskDetails = null;
		}

		outputPollInterval = setInterval(() => {
			if (expandedSession === sessionName) {
				fetchExpandedOutput(sessionName);
			}
		}, 1000);
	}

	// Resize handling
	function startResize(e: MouseEvent) {
		e.preventDefault();
		isResizing = true;
		const startY = e.clientY;
		const startHeight = expandedHeight;

		function onMouseMove(e: MouseEvent) {
			const delta = e.clientY - startY;
			expandedHeight = Math.max(200, startHeight + delta);
		}

		function onMouseUp() {
			isResizing = false;
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
		}

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}

	// Task details fetching
	async function fetchExpandedTaskDetails(taskId: string) {
		if (!taskId) return;

		taskDetailsLoading = true;
		expandedTaskDetails = null;

		try {
			const [taskRes, attachmentsRes, historyRes, signalsRes] = await Promise.all([
				fetch(`/api/tasks/${taskId}`),
				fetch(`/api/tasks/${taskId}/images`),
				fetch(`/api/tasks/${taskId}/history`),
				fetch(`/api/tasks/${taskId}/signals`)
			]);

			const taskData = taskRes.ok ? await taskRes.json() : null;
			const attachmentsData = attachmentsRes.ok ? await attachmentsRes.json() : { images: [] };
			const historyData = historyRes.ok ? await historyRes.json() : { timeline: [], count: { total: 0, beads_events: 0, agent_mail: 0 } };
			const signalsData = signalsRes.ok ? await signalsRes.json() : { signals: [] };

			const signalEvents = (signalsData.signals || []).map((signal: any) => ({
				type: 'signal' as const,
				timestamp: signal.timestamp,
				data: {
					state: signal.state,
					agentName: signal.agent_name,
					...signal.data
				}
			}));

			const mergedTimeline = [...(historyData.timeline || []), ...signalEvents]
				.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

			expandedTaskDetails = {
				labels: taskData?.task?.labels || [],
				assignee: taskData?.task?.assignee,
				notes: taskData?.task?.notes || '',
				depends_on: taskData?.task?.depends_on || [],
				blocked_by: taskData?.task?.blocked_by || [],
				created_at: taskData?.task?.created_at,
				updated_at: taskData?.task?.updated_at,
				attachments: (attachmentsData.images || []).map((img: any) => ({
					id: img.id || img.path,
					path: img.path,
					filename: img.filename || img.path.split('/').pop(),
					url: `/api/tasks/${taskId}/images/${encodeURIComponent(img.path.split('/').pop())}`
				})),
				timeline: mergedTimeline,
				timelineCounts: {
					total: mergedTimeline.length,
					beads_events: historyData.count?.beads_events || 0,
					agent_mail: historyData.count?.agent_mail || 0,
					signals: signalEvents.length
				}
			};
			// Initialize notes editing state
			notesValue = taskData?.task?.notes || '';
			notesEditing = false;
		} catch (err) {
			console.error('Failed to fetch task details:', err);
			expandedTaskDetails = {
				labels: [],
				attachments: [],
				timeline: [],
				timelineCounts: { total: 0, beads_events: 0, agent_mail: 0 }
			};
		} finally {
			taskDetailsLoading = false;
		}
	}

	// Save notes on blur
	async function saveNotes(taskId: string) {
		if (!taskId || notesSaving) return;

		// Don't save if value hasn't changed
		const currentNotes = expandedTaskDetails?.notes || '';
		if (notesValue === currentNotes) {
			notesEditing = false;
			return;
		}

		notesSaving = true;
		try {
			const response = await fetch(`/api/tasks/${taskId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ notes: notesValue })
			});

			if (response.ok) {
				// Update local state
				if (expandedTaskDetails) {
					expandedTaskDetails.notes = notesValue;
				}
			} else {
				console.error('Failed to save notes:', await response.text());
				// Revert on error
				notesValue = currentNotes;
			}
		} catch (err) {
			console.error('Error saving notes:', err);
			// Revert on error
			notesValue = currentNotes;
		} finally {
			notesSaving = false;
			notesEditing = false;
		}
	}

	// Input handling for expanded session
	async function sendExpandedInput(text: string, type: 'text' | 'key' | 'raw' = 'text'): Promise<boolean> {
		if (!expandedSession) return false;
		try {
			let apiType: string = type;
			let apiInput: string = text;

			if (type === 'key') {
				const specialKeys = ['ctrl-c', 'ctrl-d', 'ctrl-u', 'ctrl-l', 'enter', 'escape', 'up', 'down', 'left', 'right', 'tab', 'delete', 'backspace', 'space'];
				if (specialKeys.includes(text)) {
					apiType = text;
					apiInput = '';
				} else {
					apiType = 'raw';
					apiInput = text;
				}
			}

			const response = await fetch(`/api/work/${encodeURIComponent(expandedSession)}/input`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ input: apiInput, type: apiType })
			});
			setTimeout(() => fetchExpandedOutput(expandedSession!), 100);
			return response.ok;
		} catch (err) {
			console.error('Failed to send input:', err);
			return false;
		}
	}

	// Action handlers
	async function handleKillSession(sessionName: string) {
		actionLoading = sessionName;
		try {
			await onKillSession?.(sessionName);
		} finally {
			actionLoading = null;
		}
	}

	async function handleAttachSession(sessionName: string) {
		actionLoading = sessionName;
		try {
			await onAttachSession?.(sessionName);
		} finally {
			actionLoading = null;
		}
	}

	// Cleanup on destroy
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		if (outputPollInterval) {
			clearInterval(outputPollInterval);
		}
	});
</script>

{#if sessions.length === 0}
	<div class="empty-state">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="empty-icon">
			<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
		</svg>
		<p class="empty-title">No active sessions</p>
		<p class="empty-hint">Start a new agent or dev server to see sessions here.</p>
	</div>
{:else}
	<div class="sessions-table-wrapper">
		<table class="sessions-table">
			<thead>
				<tr>
					<th class="th-task">Task</th>
					<th class="th-agent">Agent</th>
					<th class="th-status">Status</th>
				</tr>
			</thead>
			<tbody>
				{#each sessions as session (session.name)}
					{@const typeBadge = getTypeBadge(session.type)}
					{@const isExpanded = expandedSession === session.name}
					{@const isCollapsing = collapsingSession === session.name}
					{@const sessionAgentName = getAgentName(session.name)}
					{@const sessionTask = agentTasks.get(sessionAgentName)}
					{@const sessionInfo = agentSessionInfo.get(sessionAgentName)}
					{@const activityState = sessionInfo?.activityState}
					{@const statusDotColor = activityState === 'working'
						? 'oklch(0.70 0.18 250)'
						: activityState === 'compacting'
						? 'oklch(0.65 0.15 280)'
						: activityState === 'needs-input'
						? 'oklch(0.75 0.20 45)'
						: activityState === 'ready-for-review'
						? 'oklch(0.70 0.20 85)'
						: activityState === 'completing'
						? 'oklch(0.65 0.15 175)'
						: activityState === 'completed'
						? 'oklch(0.70 0.20 145)'
						: activityState === 'starting'
						? 'oklch(0.75 0.15 200)'
						: activityState === 'recovering'
						? 'oklch(0.70 0.20 190)'
						: 'oklch(0.55 0.05 250)'
					}
					{@const derivedProject = agentProjects.get(sessionAgentName) || session.project || null}
					{@const rowProjectColor = sessionTask?.id
						? getProjectColorReactive(sessionTask.id)
						: derivedProject
							? getProjectColorReactive(`${derivedProject}-x`)
							: null
					}
					{@const elapsed = getElapsedFormatted(session.created)}
					<tr
						class="session-row"
						class:attached={session.attached}
						class:expanded={isExpanded}
						class:expandable={true}
						style={rowProjectColor ? `border-left: 3px solid ${rowProjectColor};` : ''}
						onclick={() => toggleExpanded(session.name)}
					>
						<!-- Column 1: TaskIdBadge + Agent -->
						<td class="td-task">
							{#if session.type === 'server'}
								<!-- Server session display -->
								<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
								<div class="server-row" onclick={(e) => e.stopPropagation()}>
									<ServerSessionBadge
										sessionName={session.name}
										project={session.project}
										status="running"
										created={session.created}
										size="xs"
										variant="projectPill"
										onAction={async (actionId) => {
											if (actionId === 'stop') {
												await handleKillSession(session.name);
											} else if (actionId === 'restart') {
												await handleKillSession(session.name);
											}
										}}
									/>
									<span class="session-name">{session.name}</span>
								</div>
							{:else}
								<!-- Agent session: TaskIdBadge with avatar and status ring -->
								<div class="task-cell-content">
									{#if sessionTask}
										<div class="agent-badge-row">
											<TaskIdBadge
												task={sessionTask}
												size="sm"
												variant="agentPill"
												agentName={sessionAgentName}
												showType={true}
												{statusDotColor}
											/>
											{#if session.resumed}
												<span class="resumed-badge" title="Resumed from previous session">
													<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="resumed-icon">
														<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
													</svg>
												</span>
											{/if}
											{#if session.attached}
												<span class="attached-indicator" title="Terminal attached">
													<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="attached-icon">
														<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
													</svg>
												</span>
											{/if}
										</div>
									{:else}
										<!-- No task - show project badge if known, otherwise session name -->
										<div class="agent-badge-row">
											{#if derivedProject}
												<span
													class="project-badge"
													style="background: {rowProjectColor ? `color-mix(in oklch, ${rowProjectColor} 25%, transparent)` : 'oklch(0.25 0.02 250)'}; border-color: {rowProjectColor || 'oklch(0.35 0.02 250)'}; color: {rowProjectColor || 'oklch(0.75 0.02 250)'};"
												>
													{derivedProject}
												</span>
											{:else}
												<span class="session-name-pill">{session.name}</span>
											{/if}
											<AgentAvatar name={sessionAgentName} size={20} />
											<span class="agent-name-inline">{sessionAgentName}</span>
										</div>
									{/if}
								</div>
							{/if}
						</td>
						<!-- Column 2: Task Title + Description -->
						<td class="td-agent">
							{#if session.type === 'agent'}
								<div class="agent-cell-content">
									{#if sessionTask}
										<span class="task-title" title={sessionTask.title}>
											{sessionTask.title || sessionTask.id}
										</span>
										{#if sessionTask.description}
											<div class="task-description">
												{sessionTask.description}
											</div>
										{/if}
									{:else}
										<span class="no-task-label">No active task</span>
									{/if}
								</div>
							{:else}
								<span class="no-agent-label">Server</span>
							{/if}
						</td>
						<!-- Column 3: Status (StatusActionBadge) -->
						<td class="td-status" onclick={(e) => e.stopPropagation()}>
							{#if session.type === 'agent'}
								<div class="status-cell-content">
									<StatusActionBadge
										sessionState={activityState || 'idle'}
										{elapsed}
										stacked={true}
										sessionName={session.name}
										alignRight={true}
										onAction={async (actionId) => {
											if (actionId === 'attach') {
												await handleAttachSession(session.name);
											} else if (actionId === 'kill' || actionId === 'cleanup') {
												await handleKillSession(session.name);
											} else if (actionId === 'view-task' && sessionTask) {
												onViewTask?.(sessionTask.id);
											} else if (actionId === 'complete') {
												const sessionId = encodeURIComponent(session.name);
												await fetch(`/api/work/${sessionId}/input`, {
													method: 'POST',
													headers: { 'Content-Type': 'application/json' },
													body: JSON.stringify({ type: 'ctrl-u' })
												});
												await new Promise(r => setTimeout(r, 50));
												await fetch(`/api/work/${sessionId}/input`, {
													method: 'POST',
													headers: { 'Content-Type': 'application/json' },
													body: JSON.stringify({ input: '/jat:complete', type: 'text' })
												});
												await new Promise(r => setTimeout(r, 100));
												await fetch(`/api/work/${sessionId}/input`, {
													method: 'POST',
													headers: { 'Content-Type': 'application/json' },
													body: JSON.stringify({ type: 'enter' })
												});
											} else if (actionId === 'complete-kill') {
												const sessionId = encodeURIComponent(session.name);
												await fetch(`/api/work/${sessionId}/input`, {
													method: 'POST',
													headers: { 'Content-Type': 'application/json' },
													body: JSON.stringify({ type: 'ctrl-u' })
												});
												await new Promise(r => setTimeout(r, 50));
												await fetch(`/api/work/${sessionId}/input`, {
													method: 'POST',
													headers: { 'Content-Type': 'application/json' },
													body: JSON.stringify({ input: '/jat:complete --kill', type: 'text' })
												});
												await new Promise(r => setTimeout(r, 100));
												await fetch(`/api/work/${sessionId}/input`, {
													method: 'POST',
													headers: { 'Content-Type': 'application/json' },
													body: JSON.stringify({ type: 'enter' })
												});
											} else if (actionId === 'interrupt') {
												await fetch(`/api/work/${encodeURIComponent(session.name)}/input`, {
													method: 'POST',
													headers: { 'Content-Type': 'application/json' },
													body: JSON.stringify({ type: 'ctrl-c' })
												});
											} else if (actionId === 'escape') {
												await fetch(`/api/work/${encodeURIComponent(session.name)}/input`, {
													method: 'POST',
													headers: { 'Content-Type': 'application/json' },
													body: JSON.stringify({ type: 'escape' })
												});
											}
										}}
										task={sessionTask ? { id: sessionTask.id, issue_type: sessionTask.issue_type, priority: sessionTask.priority } : null}
										project={session.project || null}
										onViewEpic={(epicId) => {
											onViewTask?.(epicId);
										}}
									/>
								</div>
							{:else}
								<!-- Non-agent sessions: simple buttons -->
								<div class="action-buttons">
									<button
										class="action-btn attach"
										onclick={() => handleAttachSession(session.name)}
										disabled={actionLoading === session.name}
										title="Open in terminal"
									>
										{#if actionLoading === session.name}
											<span class="loading loading-spinner loading-xs"></span>
										{:else}
											<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="action-icon">
												<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
											</svg>
										{/if}
									</button>
									<button
										class="action-btn kill"
										onclick={() => handleKillSession(session.name)}
										disabled={actionLoading === session.name}
										title="Kill session"
									>
										<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="action-icon">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							{/if}
						</td>
					</tr>
					<!-- Expanded SessionCard row -->
					{#if isExpanded}
						{@const expandedAgentName = getAgentName(session.name)}
						{@const expandedTask = agentTasks.get(expandedAgentName)}
						{@const expandedSessionInfo = agentSessionInfo.get(expandedAgentName)}
						<tr class="expanded-row">
							<td colspan="3" class="expanded-content">
								<div class="expanded-session-wrapper" class:with-task-panel={expandedTask && taskDetailOpen && expandedTaskId === expandedTask.id} class:collapsing={isCollapsing}>
									<!-- SessionCard section -->
									<div class="session-card-section">
										<div class="expanded-session-card" style="height: {expandedHeight}px;">
											<SessionCard
												mode={session.type === 'server' ? 'server' : 'agent'}
												sessionName={session.name}
												agentName={expandedAgentName}
												headerless={true}
												task={expandedTask ? {
													id: expandedTask.id,
													title: expandedTask.title,
													status: expandedTask.status,
													priority: expandedTask.priority,
													issue_type: expandedTask.issue_type,
													description: expandedTask.description
												} : null}
												output={expandedOutput}
												tokens={expandedSessionInfo?.tokens ?? 0}
												cost={expandedSessionInfo?.cost ?? 0}
												sseState={expandedSessionInfo?.activityState}
												sseStateTimestamp={expandedSessionInfo?.activityStateTimestamp}
												startTime={session.created ? new Date(session.created) : null}
												created={session.created}
												attached={session.attached}
												onSendInput={(text, type) => sendExpandedInput(text, type)}
												onKillSession={() => {
													expandedSession = null;
													handleKillSession(session.name);
												}}
												onInterrupt={() => {
													fetch(`/api/work/${encodeURIComponent(session.name)}/input`, {
														method: 'POST',
														headers: { 'Content-Type': 'application/json' },
														body: JSON.stringify({ type: 'ctrl-c' })
													});
												}}
												onAttachTerminal={() => handleAttachSession(session.name)}
												onTaskClick={(taskId) => {
													if (expandedTaskId === taskId && taskDetailOpen) {
														taskDetailOpen = false;
														expandedTaskId = null;
														expandedTaskDetails = null;
													} else {
														expandedTaskId = taskId;
														taskDetailOpen = true;
														fetchExpandedTaskDetails(taskId);
													}
												}}
											/>
										</div>
										<!-- Horizontal resize handle for tmux width -->
										<HorizontalResizeHandle
											onResize={handleHorizontalResize}
											onResizeEnd={handleHorizontalResizeEnd}
										/>
										<!-- Width indicator - visible only during resize -->
										<div class="width-indicator" class:visible={isCardResizing}>{tmuxWidth} cols</div>
									</div>

									<!-- Inline Task Detail Panel -->
									{#if expandedTask && taskDetailOpen && expandedTaskId === expandedTask.id}
										<div class="task-detail-panel" style="height: {expandedHeight}px;">
											<div class="task-panel-content">
												<!-- Loading state -->
												{#if taskDetailsLoading}
													<div class="task-panel-loading">
														<span class="loading loading-spinner loading-sm"></span>
														<span>Loading task details...</span>
													</div>
												{:else}
													<!-- Description -->
													{#if expandedTask.description}
														<div class="task-panel-section">
															<span class="task-panel-label">Description</span>
															<p class="task-panel-description">{expandedTask.description}</p>
														</div>
													{/if}

													<!-- Notes -->
													<div class="task-panel-section">
														<span class="task-panel-label">Notes</span>
														{#if notesEditing}
															<textarea
																class="task-panel-notes-input"
																bind:value={notesValue}
																onblur={() => saveNotes(expandedTask.id)}
																placeholder="Add notes..."
																rows="3"
																disabled={notesSaving}
															></textarea>
														{:else}
															<button
																type="button"
																class="task-panel-notes-display"
																onclick={() => { notesEditing = true; }}
															>
																{#if expandedTaskDetails?.notes}
																	{expandedTaskDetails.notes}
																{:else}
																	<span class="text-base-content/40 italic">Click to add notes...</span>
																{/if}
															</button>
														{/if}
														{#if notesSaving}
															<span class="task-panel-notes-saving">Saving...</span>
														{/if}
													</div>

													<!-- Labels -->
													{#if expandedTaskDetails?.labels && expandedTaskDetails.labels.length > 0}
														<div class="task-panel-section">
															<span class="task-panel-label">Labels</span>
															<div class="task-panel-labels">
																{#each expandedTaskDetails.labels as label}
																	<span class="badge badge-outline badge-sm">{label}</span>
																{/each}
															</div>
														</div>
													{/if}

													<!-- Attachments -->
													{#if expandedTaskDetails?.attachments && expandedTaskDetails.attachments.length > 0}
														<div class="task-panel-section">
															<span class="task-panel-label">
																Attachments
																<span class="badge badge-xs ml-1">{expandedTaskDetails.attachments.length}</span>
															</span>
															<div class="task-panel-attachments">
																{#each expandedTaskDetails.attachments as attachment}
																	<a
																		href={attachment.url}
																		target="_blank"
																		rel="noopener noreferrer"
																		class="task-panel-attachment"
																		title={attachment.filename}
																	>
																		<img
																			src={attachment.url}
																			alt={attachment.filename}
																			class="task-panel-attachment-img"
																		/>
																	</a>
																{/each}
															</div>
														</div>
													{/if}

													<!-- Dependencies -->
													{#if (expandedTaskDetails?.depends_on && expandedTaskDetails.depends_on.length > 0) || (expandedTaskDetails?.blocked_by && expandedTaskDetails.blocked_by.length > 0)}
														<div class="task-panel-section">
															<span class="task-panel-label">Dependencies</span>
															<div class="task-panel-dependencies">
																{#if expandedTaskDetails?.depends_on && expandedTaskDetails.depends_on.length > 0}
																	<div class="dep-group">
																		<span class="dep-label">Depends on:</span>
																		{#each expandedTaskDetails.depends_on as dep}
																			<button
																				class="dep-item"
																				onclick={() => onViewTask?.(dep.id)}
																			>
																				<span class="dep-id">{dep.id}</span>
																				<span class="badge badge-xs {statusColors[dep.status] || 'badge-ghost'}">{dep.status}</span>
																			</button>
																		{/each}
																	</div>
																{/if}
																{#if expandedTaskDetails?.blocked_by && expandedTaskDetails.blocked_by.length > 0}
																	<div class="dep-group">
																		<span class="dep-label">Blocks:</span>
																		{#each expandedTaskDetails.blocked_by as dep}
																			<button
																				class="dep-item"
																				onclick={() => onViewTask?.(dep.id)}
																			>
																				<span class="dep-id">{dep.id}</span>
																				<span class="badge badge-xs {statusColors[dep.status] || 'badge-ghost'}">{dep.status}</span>
																			</button>
																		{/each}
																	</div>
																{/if}
															</div>
														</div>
													{/if}

													<!-- Metadata -->
													<div class="task-panel-section">
														<span class="task-panel-label">Metadata</span>
														<div class="task-panel-metadata">
															{#if expandedTaskDetails?.assignee}
																<div class="meta-row">
																	<span class="meta-label">Assignee</span>
																	<span class="meta-value">
																		<AgentAvatar name={expandedTaskDetails.assignee} size={16} />
																		{expandedTaskDetails.assignee}
																	</span>
																</div>
															{/if}
															{#if expandedTaskDetails?.created_at}
																<div class="meta-row">
																	<span class="meta-label">Created</span>
																	<span class="meta-value">{new Date(expandedTaskDetails.created_at).toLocaleDateString()}</span>
																</div>
															{/if}
															{#if expandedTaskDetails?.updated_at}
																<div class="meta-row">
																	<span class="meta-label">Updated</span>
																	<span class="meta-value">{new Date(expandedTaskDetails.updated_at).toLocaleDateString()}</span>
																</div>
															{/if}
														</div>
													</div>

													<!-- Activity Timeline -->
													{#if expandedTaskDetails?.timeline && expandedTaskDetails.timeline.length > 0}
														<div class="task-panel-section task-panel-timeline-section">
															<div class="timeline-header">
																<span class="task-panel-label">Activity Timeline</span>
																<div class="timeline-tabs">
																	<button
																		class="timeline-tab"
																		class:active={timelineFilter === 'all'}
																		onclick={() => timelineFilter = 'all'}
																	>
																		All ({expandedTaskDetails.timelineCounts.total})
																	</button>
																	<button
																		class="timeline-tab"
																		class:active={timelineFilter === 'tasks'}
																		onclick={() => timelineFilter = 'tasks'}
																	>
																		Tasks ({expandedTaskDetails.timelineCounts.beads_events})
																	</button>
																	<button
																		class="timeline-tab"
																		class:active={timelineFilter === 'messages'}
																		onclick={() => timelineFilter = 'messages'}
																	>
																		Messages ({expandedTaskDetails.timelineCounts.agent_mail})
																	</button>
																</div>
															</div>
															<div class="task-panel-timeline">
																{#each expandedTaskDetails.timeline.filter(e =>
																	timelineFilter === 'all' ||
																	(timelineFilter === 'tasks' && (e.type === 'beads_event' || e.type === 'signal')) ||
																	(timelineFilter === 'messages' && e.type === 'agent_mail')
																) as event}
																	<div class="timeline-event" class:task-event={event.type === 'beads_event'} class:message-event={event.type === 'agent_mail'} class:signal-event={event.type === 'signal'}>
																		<div class="timeline-event-header">
																			<span class="timeline-event-type">
																				{#if event.type === 'beads_event'}
																					{event.event}
																				{:else if event.type === 'signal'}
																					{event.data?.state || 'signal'}
																				{:else}
																					{event.event}
																				{/if}
																			</span>
																			<span class="timeline-event-time">
																				{new Date(event.timestamp).toLocaleString()}
																			</span>
																		</div>
																		{#if event.type === 'signal'}
																			<p class="timeline-event-desc">
																				{#if event.data?.state === 'starting'}
																					Agent {event.data?.agentName || ''} started working
																				{:else if event.data?.state === 'working'}
																					Working on: {event.data?.taskTitle || event.data?.taskId || ''}
																				{:else if event.data?.state === 'review'}
																					Ready for review
																				{:else if event.data?.state === 'needs_input'}
																					{event.data?.question || 'Waiting for input'}
																				{:else if event.data?.state === 'completing'}
																					Completing task (step: {event.data?.currentStep || ''})
																				{:else if event.data?.state === 'completed'}
																					Task completed
																				{:else}
																					State: {event.data?.state || 'unknown'}
																				{/if}
																			</p>
																			{#if event.data?.agentName}
																				<div class="timeline-event-meta">
																					<span class="badge badge-xs badge-outline">@{event.data.agentName}</span>
																				</div>
																			{/if}
																		{:else}
																			<p class="timeline-event-desc">{event.description}</p>
																			{#if event.metadata}
																				<div class="timeline-event-meta">
																					{#if event.metadata.status}
																						<span class="badge badge-xs {statusColors[event.metadata.status]}">{event.metadata.status}</span>
																					{/if}
																					{#if event.metadata.assignee}
																						<span class="badge badge-xs badge-outline">@{event.metadata.assignee}</span>
																					{/if}
																					{#if event.metadata.from_agent}
																						<span class="badge badge-xs badge-outline">from: {event.metadata.from_agent}</span>
																					{/if}
																				</div>
																			{/if}
																		{/if}
																	</div>
																{/each}
															</div>
														</div>
													{/if}

													<!-- View full details link -->
													<div class="task-panel-actions">
														<button
															class="task-panel-link"
															onclick={() => onViewTask?.(expandedTask.id)}
														>
															<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
																<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
															</svg>
															View full details
														</button>
													</div>
												{/if}
											</div>
										</div>
									{/if}
								</div>
								<!-- Vertical resize divider for height -->
								<div
									class="resize-divider"
									class:resizing={isResizing}
									onmousedown={startResize}
									role="separator"
									aria-orientation="horizontal"
									tabindex="0"
								>
									<div class="resize-handle-vertical"></div>
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem;
		gap: 0.75rem;
		color: oklch(0.50 0.02 250);
	}

	.empty-icon {
		width: 64px;
		height: 64px;
		color: oklch(0.35 0.02 250);
	}

	.empty-title {
		font-size: 1rem;
		font-weight: 500;
		color: oklch(0.60 0.02 250);
		margin: 0;
	}

	.empty-hint {
		font-size: 0.85rem;
		color: oklch(0.50 0.02 250);
		margin: 0;
	}

	/* Sessions table */
	.sessions-table-wrapper {
		background: oklch(0.16 0.01 250);
		border: 1px solid oklch(0.25 0.02 250);
		border-radius: 8px;
		overflow-x: clip;
	}

	.sessions-table {
		width: 100%;
		border-collapse: collapse;
		font-family: ui-monospace, monospace;
		table-layout: fixed;
	}

	.sessions-table thead {
		background: oklch(0.20 0.01 250);
		border-bottom: 1px solid oklch(0.28 0.02 250);
	}

	.sessions-table th {
		text-align: left;
		padding: 0.75rem 1rem;
		font-size: 0.7rem;
		font-weight: 600;
		color: oklch(0.55 0.02 250);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.sessions-table tbody tr {
		border-bottom: 1px solid oklch(0.22 0.02 250);
		transition: all 0.15s;
		cursor: pointer;
	}

	.sessions-table tbody tr:last-child {
		border-bottom: none;
	}

	.sessions-table tbody tr:hover {
		background: oklch(0.20 0.02 250);
	}

	.sessions-table tbody tr.attached {
		background: oklch(0.65 0.15 145 / 0.08);
	}

	.sessions-table tbody tr.attached:hover {
		background: oklch(0.65 0.15 145 / 0.12);
	}

	.sessions-table td {
		padding: 0.875rem 1rem;
		font-size: 0.85rem;
		color: oklch(0.75 0.02 250);
	}

	/* Three-column layout widths */
	/* Note: table-layout: fixed ignores min-width, so use max() for columns needing minimums */
	/* Task: compact badge ~200px, Agent: title/desc needs most space, Status: badge ~180px */
	.th-task, .td-task { width: 200px; }
	.th-agent, .td-agent { width: auto; }
	.th-status, .td-status { width: 180px; text-align: right; }

	/* Task column */
	.task-cell-content {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.25rem;
		width: 100%;
		min-width: 0;
	}

	/* Agent column */
	.agent-cell-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 100%;
		min-width: 0;
	}

	.no-agent-label {
		font-size: 0.75rem;
		color: oklch(0.50 0.02 250);
		font-style: italic;
	}

	/* Status column */
	.status-cell-content {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.375rem;
		justify-content: center;
	}

	.session-name {
		font-size: 0.75rem;
		font-weight: 500;
		color: oklch(0.65 0.02 250);
	}

	.session-name-pill {
		font-size: 0.75rem;
		font-weight: 600;
		color: oklch(0.75 0.10 250);
		background: oklch(0.25 0.02 250);
		padding: 0.125rem 0.5rem;
		border-radius: 4px;
		font-family: ui-monospace, monospace;
	}

	.project-badge {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0.125rem 0.5rem;
		border-radius: 4px;
		border: 1px solid;
		font-family: ui-monospace, monospace;
	}

	.no-task-label {
		font-size: 0.75rem;
		color: oklch(0.50 0.02 250);
		font-style: italic;
	}

	.server-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-width: 0;
	}

	.task-title {
		font-size: 1rem;
		font-weight: 500;
		color: oklch(0.80 0.02 250);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}

	.task-description {
		font-size: 0.75rem;
		color: oklch(0.65 0.05 200);
		margin-top: 0.125rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		width: 100%;
		max-width: 100%;
	}

	.agent-badge-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.agent-name-inline {
		font-size: 0.8125rem;
		font-weight: 500;
		color: oklch(0.70 0.02 250);
		white-space: nowrap;
	}

	/* Attached indicator */
	.attached-indicator {
		display: flex;
		align-items: center;
		margin-left: 0.25rem;
	}

	.attached-icon {
		width: 12px;
		height: 12px;
		color: oklch(0.70 0.18 145);
		filter: drop-shadow(0 0 3px oklch(0.65 0.18 145 / 0.6));
	}

	/* Resumed session indicator */
	.resumed-badge {
		display: flex;
		align-items: center;
		margin-left: 0.25rem;
	}

	.resumed-icon {
		width: 12px;
		height: 12px;
		color: oklch(0.70 0.15 200);
		filter: drop-shadow(0 0 3px oklch(0.65 0.15 200 / 0.6));
	}

	/* Actions */
	.action-buttons {
		display: flex;
		gap: 0.375rem;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		background: oklch(0.22 0.02 250);
		border: 1px solid oklch(0.30 0.02 250);
		border-radius: 4px;
		color: oklch(0.65 0.02 250);
		cursor: pointer;
		transition: all 0.15s;
	}

	.action-btn:hover:not(:disabled) {
		background: oklch(0.28 0.02 250);
		color: oklch(0.80 0.02 250);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-btn.attach:hover:not(:disabled) {
		background: oklch(0.65 0.15 200 / 0.2);
		border-color: oklch(0.65 0.15 200 / 0.4);
		color: oklch(0.75 0.15 200);
	}

	.action-btn.kill:hover:not(:disabled) {
		background: oklch(0.65 0.15 30 / 0.2);
		border-color: oklch(0.65 0.15 30 / 0.4);
		color: oklch(0.75 0.15 30);
	}

	.action-icon {
		width: 14px;
		height: 14px;
	}

	/* Expandable rows */
	.session-row.expandable {
		cursor: pointer;
	}

	.session-row.expandable:hover {
		background: oklch(0.65 0.15 145 / 0.15);
	}

	.session-row.expanded {
		background: oklch(0.65 0.15 200 / 0.12);
		border-bottom: none;
	}

	.session-row.expanded:hover {
		background: oklch(0.65 0.15 200 / 0.15);
	}

	/* Expanded row with SessionCard */
	.expanded-row {
		background: oklch(0.12 0.01 250);
		border-bottom: 1px solid oklch(0.22 0.02 250);
	}

	.expanded-row:hover {
		background: oklch(0.12 0.01 250);
	}

	.expanded-content {
		padding: 0 !important;
		border-top: 1px solid oklch(0.25 0.02 250);
	}

	.expanded-session-card {
		overflow-y: auto;
		width: 100%;
	}

	@keyframes expand-slide-down {
		from {
			opacity: 0;
			max-height: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			max-height: 600px;
			transform: translateY(0);
		}
	}

	@keyframes expand-slide-up {
		from {
			opacity: 1;
			max-height: 600px;
			transform: translateY(0);
		}
		to {
			opacity: 0;
			max-height: 0;
			transform: translateY(-10px);
		}
	}

	/* Wrapper for expanded session with horizontal resize */
	.expanded-session-wrapper {
		position: relative;
		padding: 1rem;
		display: flex;
		gap: 1rem;
		animation: expand-slide-down 0.2s ease-out;
	}

	.expanded-session-wrapper.collapsing {
		animation: expand-slide-up 0.2s ease-out forwards;
	}

	/* SessionCard takes all space when no task panel */
	.session-card-section {
		position: relative;
		flex: 1;
		min-width: 0;
	}

	/* When task panel is showing, SessionCard gets 60% and panel gets 40% */
	.expanded-session-wrapper.with-task-panel .session-card-section {
		flex: 0 0 60%;
	}

	/* Task detail panel (inline) */
	.task-detail-panel {
		flex: 0 0 40%;
		min-width: 300px;
		max-width: 500px;
		overflow-y: auto;
		border-radius: 8px;
		border: 1px solid oklch(0.28 0.02 250);
		background: oklch(0.16 0.01 250);
		display: flex;
		flex-direction: column;
	}

	.task-panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.task-panel-section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.task-panel-label {
		font-size: 0.7rem;
		font-weight: 600;
		color: oklch(0.55 0.02 250);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.task-panel-description {
		font-size: 0.8rem;
		color: oklch(0.70 0.02 250);
		margin: 0;
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.task-panel-actions {
		margin-top: auto;
		padding-top: 0.75rem;
		border-top: 1px solid oklch(0.22 0.02 250);
	}

	.task-panel-link {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.8rem;
		color: oklch(0.70 0.15 200);
		background: transparent;
		border: none;
		cursor: pointer;
		text-decoration: none;
		transition: color 0.15s;
	}

	.task-panel-link:hover {
		color: oklch(0.80 0.18 200);
	}

	/* Task panel loading state */
	.task-panel-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem;
		color: oklch(0.55 0.02 250);
		font-size: 0.8rem;
	}

	/* Labels section */
	.task-panel-labels {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	/* Attachments section */
	.task-panel-attachments {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.task-panel-attachment {
		display: block;
		width: 64px;
		height: 64px;
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid oklch(0.28 0.02 250);
		transition: all 0.15s;
	}

	.task-panel-attachment:hover {
		border-color: oklch(0.45 0.12 200);
		transform: scale(1.05);
	}

	.task-panel-attachment-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* Dependencies section */
	.task-panel-dependencies {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.dep-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.dep-label {
		font-size: 0.7rem;
		font-weight: 500;
		color: oklch(0.55 0.02 250);
	}

	.dep-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		background: oklch(0.20 0.02 250);
		border-radius: 4px;
		text-decoration: none;
		border: none;
		cursor: pointer;
		transition: all 0.15s;
	}

	.dep-item:hover {
		background: oklch(0.25 0.04 200);
	}

	.dep-id {
		font-size: 0.75rem;
		font-family: ui-monospace, monospace;
		color: oklch(0.70 0.12 200);
	}

	/* Metadata section */
	.task-panel-metadata {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.meta-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.meta-label {
		font-size: 0.7rem;
		color: oklch(0.50 0.02 250);
	}

	.meta-value {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: oklch(0.75 0.02 250);
	}

	/* Activity Timeline section */
	.task-panel-timeline-section {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.timeline-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.timeline-tabs {
		display: flex;
		gap: 0.25rem;
	}

	.timeline-tab {
		padding: 0.25rem 0.5rem;
		font-size: 0.65rem;
		font-weight: 500;
		color: oklch(0.55 0.02 250);
		background: transparent;
		border: 1px solid oklch(0.28 0.02 250);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.timeline-tab:hover {
		background: oklch(0.22 0.02 250);
		color: oklch(0.70 0.02 250);
	}

	.timeline-tab.active {
		background: oklch(0.25 0.04 200);
		border-color: oklch(0.45 0.12 200);
		color: oklch(0.80 0.12 200);
	}

	/* Timeline events list */
	.task-panel-timeline {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-right: 0.25rem;
	}

	.timeline-event {
		padding: 0.5rem;
		background: oklch(0.18 0.01 250);
		border-radius: 6px;
		border-left: 2px solid oklch(0.35 0.02 250);
	}

	.timeline-event.task-event {
		border-left-color: oklch(0.60 0.15 200);
	}

	.timeline-event.message-event {
		border-left-color: oklch(0.65 0.15 280);
	}

	.timeline-event.signal-event {
		border-left-color: oklch(0.70 0.18 85);
	}

	.timeline-event-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.timeline-event-type {
		font-size: 0.7rem;
		font-weight: 600;
		color: oklch(0.70 0.02 250);
	}

	.timeline-event-time {
		font-size: 0.65rem;
		color: oklch(0.50 0.02 250);
	}

	.timeline-event-desc {
		font-size: 0.75rem;
		color: oklch(0.65 0.02 250);
		margin: 0;
		line-height: 1.4;
	}

	.timeline-event-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.375rem;
	}

	/* Override SessionCard styles when embedded in table */
	.expanded-session-card :global(.session-card) {
		border-radius: 8px;
		border: 1px solid oklch(0.28 0.02 250);
		max-width: none;
		width: 100%;
	}

	/* Width indicator */
	.session-card-section .width-indicator {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		font-size: 0.7rem;
		font-family: ui-monospace, monospace;
		color: oklch(0.55 0.02 250);
		background: oklch(0.18 0.01 250);
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		border: 1px solid oklch(0.25 0.02 250);
		pointer-events: none;
		z-index: 5;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.session-card-section .width-indicator.visible {
		opacity: 1;
	}

	/* Vertical resize divider */
	.resize-divider {
		position: relative;
		height: 8px;
		cursor: ns-resize;
		background: oklch(0.18 0.01 250);
		border-top: 1px solid oklch(0.25 0.02 250);
		transition: background 0.15s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.resize-divider:hover {
		background: oklch(0.22 0.02 250);
	}

	.resize-divider.resizing {
		background: oklch(0.25 0.04 200);
	}

	.resize-handle-vertical {
		width: 40px;
		height: 4px;
		background: oklch(0.35 0.02 250);
		border-radius: 2px;
		transition: background 0.15s, width 0.15s;
	}

	.resize-divider:hover .resize-handle-vertical {
		background: oklch(0.50 0.02 250);
		width: 60px;
	}

	.resize-divider.resizing .resize-handle-vertical {
		background: oklch(0.65 0.12 200);
		width: 80px;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.sessions-table th,
		.sessions-table td {
			padding: 0.625rem 0.75rem;
		}
	}
</style>
