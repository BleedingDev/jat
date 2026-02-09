<script lang="ts">
	/**
	 * SessionChatView
	 *
	 * Chat-style rendering for agent sessions.
	 * Uses structured timeline events when available and falls back to
	 * a live assistant bubble from the latest terminal output tail.
	 */

	import { onMount, onDestroy } from 'svelte';
	import { stripAnsi } from '$lib/utils/ansiToHtml';
	import { throttledFetch } from '$lib/utils/requestThrottler';

	interface TimelineEvent {
		type: string;
		session_id: string;
		tmux_session: string;
		timestamp: string;
		state?: string;
		task_id?: string;
		data?: Record<string, unknown>;
	}

	interface ChatMessage {
		id: string;
		role: 'user' | 'assistant' | 'system';
		label: string;
		text: string;
		timestamp: string;
		kind: string;
	}

	let {
		sessionName = '',
		output = '',
		maxEvents = 120,
		pollInterval = 4000,
		autoScroll = true,
		onAutoScrollChange = (_value: boolean) => {}
	}: {
		sessionName?: string;
		output?: string;
		maxEvents?: number;
		pollInterval?: number;
		autoScroll?: boolean;
		onAutoScrollChange?: (value: boolean) => void;
	} = $props();

	let loading = $state(true);
	let error = $state<string | null>(null);
	let events = $state<TimelineEvent[]>([]);
	let listRef: HTMLDivElement | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	const STATUS_LABELS: Record<string, string> = {
		starting: 'Started',
		working: 'Working',
		compacting: 'Compacting context',
		review: 'Ready for review',
		needs_input: 'Needs input',
		question: 'Question',
		completing: 'Finalizing',
		completed: 'Completed',
		complete: 'Completed',
		paused: 'Paused',
		idle: 'Idle',
		tasks: 'Suggested tasks',
		action: 'Action required'
	};

	function asText(value: unknown): string {
		return typeof value === 'string' ? value.trim() : '';
	}

	function truncate(text: string, max = 2200): string {
		if (text.length <= max) return text;
		return `${text.slice(0, max)}…`;
	}

	function normalizeSummary(summary: unknown): string {
		if (typeof summary === 'string') return summary.trim();
		if (Array.isArray(summary)) {
			return summary
				.map((s) => (typeof s === 'string' ? s.trim() : ''))
				.filter(Boolean)
				.slice(0, 4)
				.join('\n');
		}
		return '';
	}

	function formatTime(timestamp: string): string {
		try {
			return new Date(timestamp).toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false
			});
		} catch {
			return '';
		}
	}

	function getEventId(event: TimelineEvent, index: number): string {
		return `${event.timestamp}-${event.type}-${event.task_id || 'none'}-${index}`;
	}

	function mapEventToMessage(event: TimelineEvent, index: number): ChatMessage | null {
		const signalType = String(event.state || event.type || '').toLowerCase();
		const id = getEventId(event, index);

		if (event.type === 'ide_input' || event.type === 'user_input') {
			const text = asText(event.data?.input) || asText(event.data?.prompt);
			if (!text) return null;
			return {
				id,
				role: 'user',
				label: 'You',
				text: truncate(text),
				timestamp: event.timestamp,
				kind: event.type
			};
		}

		if (signalType === 'needs_input' || signalType === 'question') {
			const question = asText(event.data?.question) || asText(event.data?.prompt);
			if (!question) return null;
			return {
				id,
				role: 'assistant',
				label: 'Agent',
				text: truncate(question),
				timestamp: event.timestamp,
				kind: signalType
			};
		}

		if (signalType === 'working') {
			const approach = asText(event.data?.approach) || asText(event.data?.taskTitle);
			return {
				id,
				role: 'assistant',
				label: 'Agent',
				text: truncate(approach ? `Working: ${approach}` : 'Working on the task.'),
				timestamp: event.timestamp,
				kind: signalType
			};
		}

		if (signalType === 'review') {
			const summary = normalizeSummary(event.data?.summary);
			const reviewFocus = Array.isArray(event.data?.reviewFocus)
				? (event.data?.reviewFocus as unknown[])
						.map((r) => (typeof r === 'string' ? r.trim() : ''))
						.filter(Boolean)
						.slice(0, 3)
						.join('\n')
				: '';
			const body = summary || reviewFocus || 'Ready for your review.';
			return {
				id,
				role: 'assistant',
				label: 'Agent',
				text: truncate(body),
				timestamp: event.timestamp,
				kind: signalType
			};
		}

		if (signalType === 'complete' || signalType === 'completed') {
			const outcome = asText(event.data?.outcome);
			const summary = normalizeSummary(event.data?.summary);
			const title = asText(event.data?.taskTitle);
			const body = [
				outcome ? `Outcome: ${outcome}` : '',
				title ? `Task: ${title}` : '',
				summary
			]
				.filter(Boolean)
				.join('\n');
			return {
				id,
				role: 'assistant',
				label: 'Agent',
				text: truncate(body || 'Task completed.'),
				timestamp: event.timestamp,
				kind: signalType
			};
		}

		if (STATUS_LABELS[signalType]) {
			const title = asText(event.data?.taskTitle) || (event.task_id ? ` ${event.task_id}` : '');
			return {
				id,
				role: 'system',
				label: 'System',
				text: `${STATUS_LABELS[signalType]}${title ? ` · ${title}` : ''}`,
				timestamp: event.timestamp,
				kind: signalType
			};
		}

		return null;
	}

	const timelineMessages = $derived.by(() => {
		const sorted = [...events].sort(
			(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
		);
		const mapped: ChatMessage[] = [];
		for (let i = 0; i < sorted.length; i++) {
			const message = mapEventToMessage(sorted[i], i);
			if (message) mapped.push(message);
		}
		return mapped;
	});

	const liveOutputMessage = $derived.by(() => {
		const clean = stripAnsi(output || '').trim();
		if (!clean) return null;

		const lines = clean
			.split('\n')
			.map((line) => line.trimEnd())
			.filter((line) => line.length > 0);

		if (lines.length === 0) return null;

		const tail = lines.slice(-80).join('\n').trim();
		if (!tail) return null;

		return {
			id: `live-output-${sessionName}`,
			role: 'assistant' as const,
			label: 'Live Output',
			text: truncate(tail, 2400),
			timestamp: new Date().toISOString(),
			kind: 'live-output'
		};
	});

	const messages = $derived.by(() => {
		const base = [...timelineMessages];
		const live = liveOutputMessage;
		if (!live) return base;

		const last = base[base.length - 1];
		if (!last || last.kind !== 'live-output' || last.text !== live.text) {
			base.push(live);
		}
		return base;
	});

	function scrollToBottom(): void {
		if (!listRef) return;
		listRef.scrollTop = listRef.scrollHeight;
	}

	function handleScroll(event: Event): void {
		const target = event.currentTarget as HTMLDivElement;
		const nearBottom = target.scrollTop >= target.scrollHeight - target.clientHeight - 36;

		if (!nearBottom && autoScroll) {
			onAutoScrollChange(false);
		} else if (nearBottom && !autoScroll) {
			onAutoScrollChange(true);
		}
	}

	function jumpToLatest(): void {
		onAutoScrollChange(true);
		requestAnimationFrame(() => scrollToBottom());
	}

	async function fetchTimeline(): Promise<void> {
		if (!sessionName) {
			events = [];
			loading = false;
			return;
		}

		try {
			const tmuxName = sessionName.startsWith('jat-') ? sessionName : `jat-${sessionName}`;
			const response = await throttledFetch(
				`/api/sessions/${encodeURIComponent(tmuxName)}/timeline?limit=${maxEvents}`
			);
			if (!response.ok) {
				throw new Error(`Timeline request failed (${response.status})`);
			}
			const data = await response.json();
			events = Array.isArray(data.events)
				? data.events.filter((e: TimelineEvent) => e?.type && e?.timestamp)
				: [];
			error = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load chat timeline';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		messages;
		if (!autoScroll) return;
		requestAnimationFrame(() => scrollToBottom());
	});

	$effect(() => {
		sessionName;
		loading = true;
		void fetchTimeline();
	});

	onMount(() => {
		void fetchTimeline();
		if (pollInterval > 0) {
			pollTimer = setInterval(() => {
				void fetchTimeline();
			}, pollInterval);
		}
	});

	onDestroy(() => {
		if (pollTimer) {
			clearInterval(pollTimer);
		}
	});
</script>

<div class="absolute inset-0 flex flex-col" style="background: oklch(0.16 0.01 250);">
	<div
		bind:this={listRef}
		class="flex-1 overflow-y-auto px-3 py-3 space-y-3"
		onscroll={handleScroll}
	>
		{#if error}
			<div class="rounded-lg px-2.5 py-2 text-[11px] font-mono" style="background: oklch(0.26 0.08 25); color: oklch(0.86 0.12 25); border: 1px solid oklch(0.36 0.1 25);">
				Chat timeline unavailable: {error}
			</div>
		{/if}

		{#if loading && messages.length === 0}
			<div class="text-[11px] font-mono opacity-60" style="color: oklch(0.62 0.02 250);">
				Loading conversation...
			</div>
		{:else if messages.length === 0}
			<div class="rounded-xl px-3 py-2 text-[12px]" style="background: oklch(0.19 0.01 250); color: oklch(0.62 0.02 250); border: 1px solid oklch(0.28 0.02 250);">
				No structured messages yet. Start chatting and this view will fill as events arrive.
			</div>
		{:else}
			{#each messages as message (message.id)}
				{#if message.role === 'system'}
					<div class="flex justify-center">
						<div
							class="max-w-[95%] rounded-lg px-2.5 py-1.5 text-[11px] font-mono"
							style="background: oklch(0.20 0.02 250); color: oklch(0.65 0.02 250); border: 1px solid oklch(0.30 0.02 250);"
						>
							{message.text}
						</div>
					</div>
				{:else}
					<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
						<article
							class="max-w-[94%] sm:max-w-[82%] rounded-2xl px-3 py-2"
							style={message.role === 'user'
								? 'background: oklch(0.27 0.09 250); border: 1px solid oklch(0.38 0.13 250); color: oklch(0.93 0.02 250);'
								: 'background: oklch(0.20 0.01 250); border: 1px solid oklch(0.30 0.02 250); color: oklch(0.86 0.02 250);'}
						>
							<div class="flex items-center gap-2 text-[10px] opacity-70">
								<span class="font-medium">{message.label}</span>
								<span>{formatTime(message.timestamp)}</span>
							</div>
							<p class="mt-1 whitespace-pre-wrap break-words leading-relaxed {message.kind === 'live-output' ? 'font-mono text-[11px]' : 'text-[13px]'}">
								{message.text}
							</p>
						</article>
					</div>
				{/if}
			{/each}
		{/if}
	</div>

	{#if !autoScroll && messages.length > 0}
		<div class="absolute bottom-3 right-3">
			<button
				class="btn btn-xs"
				style="background: oklch(0.34 0.12 200); color: oklch(0.96 0.02 250); border: none;"
				onclick={jumpToLatest}
			>
				Jump to latest
			</button>
		</div>
	{/if}
</div>
