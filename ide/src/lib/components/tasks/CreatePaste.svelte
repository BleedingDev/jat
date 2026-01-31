<script lang="ts">
	/**
	 * CreatePaste — Paste tab content for the creation workspace
	 *
	 * Left side: textarea + format selector + defaults
	 * Right side: TaskPreviewTable with live preview
	 */
	import { parseTasks, type ParseResult, type TaskDefaults } from '$lib/utils/taskParser';
	import TaskPreviewTable from './TaskPreviewTable.svelte';
	import { successToast, errorToast } from '$lib/stores/toasts.svelte';
	import { playSuccessChime, playErrorSound } from '$lib/utils/soundEffects';
	import { broadcastTaskEvent } from '$lib/stores/taskEvents';
	import { uploadAttachments, revokeAttachmentPreviews } from '$lib/utils/attachmentUpload';
	import type { PendingAttachment } from '$lib/types/attachment';
	import ProjectSelector from './ProjectSelector.svelte';
	import AttachmentZone from './AttachmentZone.svelte';
	import { onDestroy } from 'svelte';

	interface Props {
		projects: string[];
		initialText?: string;
		initialProject?: string;
		hideProjectSelector?: boolean;
		stacked?: boolean;
		onTasksCreated?: () => void;
	}

	let {
		projects = [],
		initialText = '',
		initialProject = '',
		hideProjectSelector = false,
		stacked = false,
		onTasksCreated = () => {},
	}: Props = $props();

	// State
	let textInput = $state(initialText);
	let selectedFormat = $state<'auto' | 'yaml' | 'json' | 'markdown' | 'plain'>('auto');
	let selectedProject = $state(initialProject || projects[0] || '');

	// Sync selectedProject when initialProject changes (e.g., drawer project badge)
	$effect(() => {
		if (initialProject) {
			selectedProject = initialProject;
		}
	});
	let defaultType = $state('task');
	let defaultPriority = $state(1);
	let defaultLabels = $state('');
	let isCreating = $state(false);
	let createAsEpic = $state(false);
	let attachments = $state<PendingAttachment[]>([]);

	// Debounced parsing
	let parseTimeout: ReturnType<typeof setTimeout> | undefined;
	let parseResult = $state<ParseResult | null>(null);

	$effect(() => {
		if (parseTimeout) clearTimeout(parseTimeout);
		const text = textInput;
		const fmt = selectedFormat;
		const proj = selectedProject;
		const typ = defaultType;
		const prio = defaultPriority;
		const labels = defaultLabels;

		parseTimeout = setTimeout(() => {
			if (!text.trim()) {
				parseResult = null;
				return;
			}
			const defaults: Partial<TaskDefaults> = {
				type: typ,
				priority: prio,
				project: proj,
				labels: labels ? labels.split(',').map(s => s.trim()).filter(Boolean) : [],
			};
			parseResult = parseTasks(text, { format: fmt, defaults });
		}, 300);
	});

	// Initialize with sessionStorage data if available
	$effect(() => {
		if (!textInput && typeof sessionStorage !== 'undefined') {
			const stored = sessionStorage.getItem('quick-add-paste');
			if (stored) {
				textInput = stored;
				sessionStorage.removeItem('quick-add-paste');
			}
		}
	});

	onDestroy(() => {
		revokeAttachmentPreviews(attachments);
	});

	async function handleCreate() {
		if (!parseResult || parseResult.tasks.length === 0) return;

		isCreating = true;
		try {
			const tasks = parseResult.tasks.map(t => ({
				title: t.title,
				type: t.type || defaultType,
				priority: t.priority ?? defaultPriority,
				description: t.description || '',
				labels: t.labels || [],
				depends_on: t.deps || [],
			}));

			const body: Record<string, unknown> = {
				tasks,
				project: selectedProject,
			};

			const response = await fetch('/api/tasks/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			const data = await response.json();

			if (data.created > 0) {
				// Upload attachments to first created task
				if (attachments.length > 0 && data.taskIds?.length > 0) {
					await uploadAttachments(data.taskIds[0], attachments);
				}

				playSuccessChime();
				successToast(data.message);
				broadcastTaskEvent('task-change', '');
				onTasksCreated();
				textInput = '';
				parseResult = null;
				revokeAttachmentPreviews(attachments);
				attachments = [];
			}
			if (data.failed > 0) {
				errorToast(`${data.failed} task(s) failed to create`, data.message);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Failed to create tasks';
			playErrorSound();
			errorToast(msg);
		} finally {
			isCreating = false;
		}
	}
</script>

<div class="paste-container" class:paste-stacked={stacked}>
	<!-- Left: Input -->
	<div class="paste-input">
		<!-- Project selector -->
		{#if !hideProjectSelector}
		<div class="mb-3">
			<label class="label py-1">
				<span class="label-text text-sm font-medium">Project</span>
			</label>
			<ProjectSelector projects={projects} selected={selectedProject} onSelect={(p) => selectedProject = p} />
		</div>
		{/if}

		<!-- Format -->
		<div class="form-control mb-3">
			<label class="label py-1">
				<span class="label-text text-sm font-medium">Format</span>
			</label>
			<select
				class="select select-sm select-bordered"
				bind:value={selectedFormat}
			>
				<option value="auto">Auto-detect</option>
				<option value="yaml">YAML</option>
				<option value="json">JSON</option>
				<option value="markdown">Markdown</option>
				<option value="plain">Plain text</option>
			</select>
		</div>

		<textarea
			class="textarea textarea-bordered w-full font-mono text-sm"
			rows={12}
			bind:value={textInput}
			placeholder={`Paste tasks in any format...\n\nYAML:\n- title: Fix auth timeout\n  type: bug\n  priority: 0\n\nJSON:\n[{"title": "Add rate limiting", "type": "task"}]\n\nMarkdown:\n- Fix auth timeout /bug /p0 #security\n- Add rate limiting /task /p1 #api\n\nPlain text (one task per line):\nFix auth timeout\nAdd rate limiting`}
		></textarea>

		<!-- Attachments -->
		<div class="mt-3">
			<AttachmentZone disabled={isCreating} bind:attachments />
		</div>

		<!-- Defaults section -->
		<div class="defaults-section">
			<h4 class="text-xs font-medium opacity-50 mb-2">Defaults (applied when fields are missing)</h4>
			<div class="grid grid-cols-3 gap-3">
				<div class="form-control">
					<label class="label py-0.5">
						<span class="label-text text-xs">Type</span>
					</label>
					<select class="select select-sm select-bordered" bind:value={defaultType}>
						<option value="task">Task</option>
						<option value="bug">Bug</option>
						<option value="feature">Feature</option>
						<option value="chore">Chore</option>
						<option value="epic">Epic</option>
					</select>
				</div>
				<div class="form-control">
					<label class="label py-0.5">
						<span class="label-text text-xs">Priority</span>
					</label>
					<select class="select select-sm select-bordered" bind:value={defaultPriority}>
						<option value={0}>P0 — Critical</option>
						<option value={1}>P1 — High</option>
						<option value={2}>P2 — Medium</option>
						<option value={3}>P3 — Low</option>
						<option value={4}>P4 — Lowest</option>
					</select>
				</div>
				<div class="form-control">
					<label class="label py-0.5">
						<span class="label-text text-xs">Labels</span>
					</label>
					<input
						class="input input-sm input-bordered"
						placeholder="comma, separated"
						bind:value={defaultLabels}
					/>
				</div>
			</div>
		</div>

		<!-- Action buttons -->
		<div class="flex items-center gap-3 mt-4">
			<button
				class="btn btn-sm btn-primary"
				onclick={handleCreate}
				disabled={isCreating || !parseResult || parseResult.tasks.length === 0 || parseResult.errors.length > 0}
			>
				{#if isCreating}
					<span class="loading loading-spinner loading-xs"></span>
				{/if}
				Create {parseResult?.tasks.length || 0} Task{(parseResult?.tasks.length || 0) !== 1 ? 's' : ''}
			</button>
		</div>
	</div>

	<!-- Right: Preview -->
	<div class="paste-preview">
		<h3 class="text-sm font-medium mb-3 opacity-60">
			Preview
			{#if parseResult}
				<span class="opacity-70">({parseResult.tasks.length} task{parseResult.tasks.length !== 1 ? 's' : ''})</span>
			{/if}
		</h3>

		{#if parseResult}
			<TaskPreviewTable
				tasks={parseResult.tasks}
				warnings={parseResult.warnings}
				errors={parseResult.errors}
			/>

			{#if parseResult.warnings.length > 0}
				<div class="mt-3">
					<h4 class="text-xs font-medium text-warning mb-1">Warnings:</h4>
					{#each parseResult.warnings as warn}
						<div class="text-xs opacity-60">{warn}</div>
					{/each}
				</div>
			{/if}
			{#if parseResult.errors.length > 0}
				<div class="mt-3">
					<h4 class="text-xs font-medium text-error mb-1">Errors:</h4>
					{#each parseResult.errors as err}
						<div class="text-xs text-error">{err}</div>
					{/each}
				</div>
			{/if}
		{:else}
			<div class="text-sm opacity-40 py-8 text-center">
				Paste task data to see a preview
			</div>
		{/if}
	</div>
</div>

<style>
	.paste-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		height: 100%;
	}

	.paste-input {
		display: flex;
		flex-direction: column;
	}

	.paste-preview {
		overflow-y: auto;
		padding: 0.75rem;
		border-radius: 0.5rem;
		background: oklch(0.18 0.01 250 / 0.5);
		border: 1px solid oklch(0.28 0.02 250 / 0.3);
	}

	.defaults-section {
		margin-top: 1rem;
		padding: 0.75rem;
		border-radius: 0.5rem;
		background: oklch(0.18 0.01 250 / 0.3);
		border: 1px solid oklch(0.28 0.02 250 / 0.2);
	}

	.paste-container.paste-stacked {
		grid-template-columns: 1fr;
	}

	@media (max-width: 768px) {
		.paste-container {
			grid-template-columns: 1fr;
		}
	}
</style>
