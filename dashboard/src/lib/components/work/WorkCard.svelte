<script lang="ts">
	/**
	 * WorkCard Component
	 * Task-first view of active Claude Code session work.
	 *
	 * Design Philosophy:
	 * - Task is primary (headline), agent is secondary (metadata badge)
	 * - Focus on what work is being done, not who is doing it
	 * - Inline output with ANSI rendering
	 * - Kill session and control buttons
	 *
	 * Props:
	 * - sessionName: tmux session name (e.g., "jat-WisePrairie")
	 * - agentName: Agent name (e.g., "WisePrairie")
	 * - task: Current task object (id, title, status, priority)
	 * - output: Terminal output string with ANSI codes
	 * - lineCount: Number of output lines
	 * - tokens: Token usage for today
	 * - cost: Cost in USD for today
	 */

	import { ansiToHtml } from '$lib/utils/ansiToHtml';
	import TokenUsageDisplay from '$lib/components/TokenUsageDisplay.svelte';
	import TaskIdBadge from '$lib/components/TaskIdBadge.svelte';
	import AgentAvatar from '$lib/components/AgentAvatar.svelte';

	// Props
	interface Task {
		id: string;
		title: string;
		status: string;
		priority?: number;
		issue_type?: string;
	}

	interface Props {
		sessionName: string;
		agentName: string;
		task?: Task | null;
		output?: string;
		lineCount?: number;
		tokens?: number;
		cost?: number;
		onKillSession?: () => void;
		onInterrupt?: () => void;
		onContinue?: () => void;
		onTaskClick?: (taskId: string) => void;
		class?: string;
	}

	let {
		sessionName,
		agentName,
		task = null,
		output = '',
		lineCount = 0,
		tokens = 0,
		cost = 0,
		onKillSession,
		onInterrupt,
		onContinue,
		onTaskClick,
		class: className = ''
	}: Props = $props();

	// Auto-scroll state
	let autoScroll = $state(true);
	let scrollContainerRef: HTMLDivElement | null = null;

	// Control button loading states
	let killLoading = $state(false);
	let interruptLoading = $state(false);
	let continueLoading = $state(false);

	// Scroll to bottom when output changes (if auto-scroll enabled)
	$effect(() => {
		if (autoScroll && scrollContainerRef && output) {
			requestAnimationFrame(() => {
				if (scrollContainerRef) {
					scrollContainerRef.scrollTop = scrollContainerRef.scrollHeight;
				}
			});
		}
	});

	// Handle kill session
	async function handleKill() {
		if (!onKillSession) return;
		killLoading = true;
		try {
			await onKillSession();
		} finally {
			killLoading = false;
		}
	}

	// Handle interrupt (Ctrl+C)
	async function handleInterrupt() {
		if (!onInterrupt) return;
		interruptLoading = true;
		try {
			await onInterrupt();
		} finally {
			interruptLoading = false;
		}
	}

	// Handle continue
	async function handleContinue() {
		if (!onContinue) return;
		continueLoading = true;
		try {
			await onContinue();
		} finally {
			continueLoading = false;
		}
	}

	// Toggle auto-scroll
	function toggleAutoScroll() {
		autoScroll = !autoScroll;
	}

	// Render output with ANSI codes
	const renderedOutput = $derived(ansiToHtml(output));
</script>

<div
	class="card bg-base-100 shadow-lg border border-base-300 overflow-hidden {className}"
	style="min-height: 300px;"
>
	<!-- Header: Task-first design -->
	<div class="card-body p-4 pb-2">
		<!-- Task Title (Primary) -->
		<div class="flex items-start justify-between gap-3">
			<div class="flex-1 min-w-0">
				{#if task}
					<div class="flex items-center gap-2 mb-1">
						<TaskIdBadge
							task={{ id: task.id, status: task.status, issue_type: task.issue_type, title: task.title }}
							size="sm"
							showType={true}
							showStatus={true}
							onOpenTask={onTaskClick}
						/>
						<span class="badge badge-sm badge-outline" style="opacity: 0.7;">
							P{task.priority ?? 2}
						</span>
					</div>
					<h3 class="font-semibold text-base truncate" title={task.title}>
						{task.title}
					</h3>
				{:else}
					<div class="flex items-center gap-2">
						<span class="badge badge-sm badge-ghost">No task</span>
					</div>
					<h3 class="font-semibold text-base text-base-content/50">
						Idle session
					</h3>
				{/if}
			</div>

			<!-- Control Buttons -->
			<div class="flex items-center gap-1 shrink-0">
				<!-- Interrupt (Ctrl+C) -->
				<button
					class="btn btn-xs btn-ghost hover:btn-warning"
					onclick={handleInterrupt}
					disabled={interruptLoading || !onInterrupt}
					title="Send Ctrl+C (interrupt)"
				>
					{#if interruptLoading}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
						</svg>
					{/if}
				</button>

				<!-- Continue -->
				<button
					class="btn btn-xs btn-ghost hover:btn-success"
					onclick={handleContinue}
					disabled={continueLoading || !onContinue}
					title="Send 'continue'"
				>
					{#if continueLoading}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
						</svg>
					{/if}
				</button>

				<!-- Kill Session -->
				<button
					class="btn btn-xs btn-ghost hover:btn-error"
					onclick={handleKill}
					disabled={killLoading || !onKillSession}
					title="Kill session"
				>
					{#if killLoading}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					{/if}
				</button>
			</div>
		</div>

		<!-- Agent Badge + Token Usage (Secondary Metadata) -->
		<div class="flex items-center justify-between mt-2 pt-2 border-t border-base-200">
			<!-- Agent Info -->
			<div class="flex items-center gap-2">
				<AgentAvatar name={agentName} size={20} />
				<span class="text-sm font-mono text-base-content/70">{agentName}</span>
			</div>

			<!-- Token Usage -->
			<TokenUsageDisplay
				{tokens}
				{cost}
				timeRange="today"
				variant="compact"
				showTokens={true}
				showCost={true}
				colorCoded={true}
			/>
		</div>
	</div>

	<!-- Output Section -->
	<div class="border-t border-base-300">
		<!-- Output Header -->
		<div class="flex items-center justify-between px-4 py-1.5 bg-base-200/50">
			<span class="text-xs font-mono text-base-content/60">
				Output ({lineCount} lines)
			</span>
			<button
				class="btn btn-xs"
				class:btn-primary={autoScroll}
				class:btn-ghost={!autoScroll}
				onclick={toggleAutoScroll}
				title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
			>
				<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
				</svg>
			</button>
		</div>

		<!-- Output Content -->
		<div
			bind:this={scrollContainerRef}
			class="overflow-y-auto p-3 font-mono text-xs leading-relaxed"
			style="max-height: 200px; background: oklch(0.14 0.01 250);"
		>
			{#if output}
				<pre class="whitespace-pre-wrap break-words" style="color: oklch(0.75 0.02 250);">{@html renderedOutput}</pre>
			{:else}
				<p class="text-base-content/40 italic">No output yet...</p>
			{/if}
		</div>
	</div>
</div>
