<script lang="ts">
	/**
	 * TaskQuickAdd — Smart command bar for quick task creation
	 *
	 * Always-visible bar on the tasks page. Sits below project tabs.
	 * - Single-line: parse shorthand, POST to /api/tasks, show toast
	 * - Multi-line paste: detect format, show inline preview, bulk create
	 * - Cmd+K global shortcut focuses the input
	 */
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { parseShorthand, parseTasks, detectFormat, type ParsedTask, type ParseResult } from '$lib/utils/taskParser';
	import TaskPreviewTable from './TaskPreviewTable.svelte';
	import { successToast, errorToast } from '$lib/stores/toasts.svelte';
	import { playSuccessChime, playErrorSound } from '$lib/utils/soundEffects';
	import { broadcastTaskEvent } from '$lib/stores/taskEvents';
	import { getActiveProject } from '$lib/stores/preferences.svelte';

	interface Props {
		selectedProject?: string;
		onTaskCreated?: () => void;
		onOpenWorkspace?: () => void;
	}

	let {
		selectedProject = '',
		onTaskCreated = () => {},
		onOpenWorkspace = () => {},
	}: Props = $props();

	let inputValue = $state('');
	let isExpanded = $state(false);
	let previewResult = $state<ParseResult | null>(null);
	let isCreating = $state(false);
	let inputRef: HTMLInputElement | undefined = $state();

	// Effective project: use selected if not "All Projects", else active
	const effectiveProject = $derived(
		selectedProject && selectedProject !== 'All Projects'
			? selectedProject
			: getActiveProject() || ''
	);

	// Handle Cmd+K / Ctrl+K global focus
	function handleGlobalFocus(e: CustomEvent) {
		inputRef?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		// Cmd+K or Ctrl+K from anywhere on the page
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			inputRef?.focus();
			return;
		}
	}

	// Listen for custom event from layout
	onMount(() => {
		document.addEventListener('focus-quick-add', handleGlobalFocus as EventListener);
		return () => {
			document.removeEventListener('focus-quick-add', handleGlobalFocus as EventListener);
		};
	});

	// Handle Enter key for single-line creation
	async function handleInputKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !isExpanded) {
			e.preventDefault();
			const val = inputValue.trim();
			if (!val) return;
			await createSingleTask(val);
		}
		if (e.key === 'Escape') {
			if (isExpanded) {
				dismiss();
			} else {
				inputRef?.blur();
			}
		}
	}

	// Handle paste event — detect multi-line structured data
	function handlePaste(e: ClipboardEvent) {
		const text = e.clipboardData?.getData('text/plain') || '';
		const lines = text.split('\n').filter(l => l.trim());

		if (lines.length > 1) {
			// Multi-line paste detected — show preview
			e.preventDefault();
			inputValue = text;
			const result = parseTasks(text, {
				defaults: {
					type: 'task',
					priority: 1,
					project: effectiveProject,
					labels: [],
				},
			});
			previewResult = result;
			isExpanded = true;
		}
	}

	// Create a single task from shorthand
	async function createSingleTask(line: string) {
		const parsed = parseShorthand(line);
		if (!parsed.title) return;

		isCreating = true;
		try {
			const body: Record<string, unknown> = {
				title: parsed.title,
				type: parsed.type || 'task',
				priority: parsed.priority ?? 1,
				project: effectiveProject,
			};
			if (parsed.labels && parsed.labels.length > 0) {
				body.labels = parsed.labels.join(',');
			}
			if (parsed.description) body.description = parsed.description;
			if (parsed.assignee) body.assignee = parsed.assignee;
			if (parsed.deps) body.depends_on = parsed.deps;

			const response = await fetch('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.error || `Failed to create task (${response.status})`);
			}

			const data = await response.json();
			inputValue = '';
			playSuccessChime();
			successToast(`Created: ${parsed.title}`, data.taskId ? `ID: ${data.taskId}` : undefined);
			broadcastTaskEvent('task-change', data.taskId || '');
			onTaskCreated();
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to create task';
			playErrorSound();
			errorToast(msg);
		} finally {
			isCreating = false;
		}
	}

	// Bulk create from expanded preview
	async function createBulkTasks() {
		if (!previewResult || previewResult.tasks.length === 0) return;

		isCreating = true;
		try {
			const tasks = previewResult.tasks.map(t => ({
				title: t.title,
				type: t.type || 'task',
				priority: t.priority ?? 1,
				description: t.description || '',
				labels: t.labels || [],
				depends_on: t.deps || [],
			}));

			const response = await fetch('/api/tasks/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tasks,
					project: effectiveProject,
				}),
			});

			const data = await response.json();

			if (data.created > 0) {
				playSuccessChime();
				successToast(data.message);
				broadcastTaskEvent('task-change', '');
				onTaskCreated();
				dismiss();
			}
			if (data.failed > 0) {
				errorToast(`${data.failed} task(s) failed to create`);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to create tasks';
			playErrorSound();
			errorToast(msg);
		} finally {
			isCreating = false;
		}
	}

	function dismiss() {
		isExpanded = false;
		previewResult = null;
		inputValue = '';
	}

	function openWorkspace() {
		// If we have pasted content, pass it via URL params
		if (isExpanded && inputValue) {
			// Store in sessionStorage for the workspace page to pick up
			sessionStorage.setItem('quick-add-paste', inputValue);
		}
		onOpenWorkspace();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="quick-add-bar" class:expanded={isExpanded}>
	<!-- Input row -->
	<div class="input-row">
		<div class="flex-1 relative">
			<input
				bind:this={inputRef}
				bind:value={inputValue}
				onkeydown={handleInputKeydown}
				onpaste={handlePaste}
				type="text"
				class="input input-sm input-bordered w-full bg-base-200/50 focus:bg-base-100 pr-20"
				placeholder="Quick add: type a task and hit Enter... (Cmd+K)"
				disabled={isCreating}
			/>
			<div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
				{#if isCreating}
					<span class="loading loading-spinner loading-xs"></span>
				{/if}
				<kbd class="kbd kbd-xs opacity-40">Cmd+K</kbd>
			</div>
		</div>
		<button
			class="btn btn-sm btn-ghost gap-1 text-xs opacity-60 hover:opacity-100"
			onclick={() => goto('/tasks/create')}
			title="Open creation workspace"
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
				<path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
			</svg>
			More
		</button>
	</div>

	<!-- Expanded preview panel (shown after multi-line paste) -->
	{#if isExpanded && previewResult}
		<div class="preview-panel">
			<div class="preview-header">
				<span class="badge badge-sm badge-outline">{previewResult.format.toUpperCase()}</span>
				<span class="text-sm">
					{previewResult.tasks.length} task{previewResult.tasks.length !== 1 ? 's' : ''} detected
				</span>
				{#if previewResult.errors.length > 0}
					<span class="text-sm text-error">
						{previewResult.errors.length} error{previewResult.errors.length !== 1 ? 's' : ''}
					</span>
				{/if}
			</div>

			<TaskPreviewTable
				tasks={previewResult.tasks}
				warnings={previewResult.warnings}
				errors={previewResult.errors}
				compact={true}
				maxRows={5}
			/>

			<div class="preview-actions">
				<button
					class="btn btn-sm btn-primary"
					onclick={createBulkTasks}
					disabled={isCreating || previewResult.tasks.length === 0 || previewResult.errors.length > 0}
				>
					{#if isCreating}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Create {previewResult.tasks.length} Task{previewResult.tasks.length !== 1 ? 's' : ''}
				</button>
				<button
					class="btn btn-sm btn-ghost"
					onclick={openWorkspace}
				>
					Edit in Workspace
				</button>
				<button
					class="btn btn-sm btn-ghost text-xs opacity-60"
					onclick={dismiss}
				>
					Dismiss
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.quick-add-bar {
		padding: 0.5rem 1rem;
		border-bottom: 1px solid oklch(0.30 0.02 250 / 0.3);
		background: oklch(0.18 0.01 250 / 0.5);
	}

	.quick-add-bar.expanded {
		background: oklch(0.16 0.015 250 / 0.8);
	}

	.input-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.preview-panel {
		margin-top: 0.75rem;
		padding: 0.75rem;
		border-radius: 0.5rem;
		background: oklch(0.20 0.01 250 / 0.6);
		border: 1px solid oklch(0.30 0.02 250 / 0.3);
	}

	.preview-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.preview-actions {
		margin-top: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
