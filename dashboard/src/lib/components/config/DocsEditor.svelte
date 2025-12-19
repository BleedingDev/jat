<script lang="ts">
	/**
	 * DocsEditor Component
	 *
	 * Monaco editor for editing shared documentation files.
	 * Shows file path, last modified, and save button.
	 *
	 * Pattern matches ClaudeMdEditor for consistency.
	 *
	 * @see dashboard/src/routes/config/+page.svelte for usage
	 * @see dashboard/src/lib/components/config/ClaudeMdEditor.svelte for pattern
	 */

	import MonacoWrapper from './MonacoWrapper.svelte';

	interface Props {
		/** Filename of the doc being edited */
		filename?: string | null;
		/** Display name for the file */
		displayName?: string;
		/** Called after successful save */
		onSave?: () => void;
	}

	let { filename = null, displayName = '', onSave = () => {} }: Props = $props();

	// State
	let content = $state('');
	let originalContent = $state('');
	let lastModified = $state<string | null>(null);
	let filePath = $state<string | null>(null);
	let isLoading = $state(false);
	let isSaving = $state(false);
	let error = $state<string | null>(null);
	let saveSuccess = $state(false);

	// Derived state
	const hasChanges = $derived(content !== originalContent);
	const canSave = $derived(hasChanges && !isSaving && filename);

	// Load file content
	async function loadFile() {
		if (!filename) {
			content = '';
			originalContent = '';
			lastModified = null;
			filePath = null;
			return;
		}

		isLoading = true;
		error = null;

		try {
			const response = await fetch(`/api/docs/${encodeURIComponent(filename)}`);
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || `HTTP ${response.status}`);
			}
			const data = await response.json();
			content = data.content;
			originalContent = data.content;
			lastModified = data.modifiedAt;
			filePath = data.path;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load file';
			content = '';
			originalContent = '';
		} finally {
			isLoading = false;
		}
	}

	// Save file content
	async function saveFile() {
		if (!canSave) return;

		isSaving = true;
		error = null;
		saveSuccess = false;

		try {
			const response = await fetch(`/api/docs/${encodeURIComponent(filename!)}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ content })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || `HTTP ${response.status}`);
			}

			const data = await response.json();
			originalContent = content;
			lastModified = data.modifiedAt;
			saveSuccess = true;
			onSave();

			// Clear success message after 3 seconds
			setTimeout(() => {
				saveSuccess = false;
			}, 3000);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save file';
		} finally {
			isSaving = false;
		}
	}

	// Format date
	function formatDate(isoString: string | null): string {
		if (!isoString) return '';
		const date = new Date(isoString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Handle content change from Monaco
	function handleContentChange(newContent: string) {
		content = newContent;
	}

	// Keyboard shortcut for save (Cmd/Ctrl+S)
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			saveFile();
		}
	}

	// Load file when filename changes
	$effect(() => {
		if (filename) {
			loadFile();
		} else {
			content = '';
			originalContent = '';
			lastModified = null;
			filePath = null;
		}
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="docs-editor">
	{#if !filename}
		<div class="empty-state">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="empty-icon"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
				/>
			</svg>
			<span>Select a document to edit</span>
		</div>
	{:else}
		<!-- Header -->
		<div class="editor-header">
			<div class="file-info">
				<h3 class="file-name">{displayName || filename}</h3>
				{#if filePath}
					<span class="file-path" title={filePath}>{filePath}</span>
				{/if}
				{#if lastModified}
					<span class="last-modified">Last modified: {formatDate(lastModified)}</span>
				{/if}
			</div>
			<div class="header-actions">
				{#if error}
					<span class="error-badge">{error}</span>
				{/if}
				{#if saveSuccess}
					<span class="success-badge">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="2"
							stroke="currentColor"
							class="success-icon"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
						</svg>
						Saved
					</span>
				{/if}
				{#if hasChanges}
					<span class="unsaved-badge">Unsaved changes</span>
				{/if}
				<button class="save-btn" onclick={saveFile} disabled={!canSave}>
					{#if isSaving}
						<div class="save-spinner"></div>
						Saving...
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="save-icon"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
							/>
						</svg>
						Save
					{/if}
				</button>
			</div>
		</div>

		<!-- Editor -->
		<div class="editor-container">
			{#if isLoading}
				<div class="loading-state">
					<div class="loading-spinner"></div>
					<span>Loading document...</span>
				</div>
			{:else}
				<MonacoWrapper bind:value={content} language="markdown" onchange={handleContentChange} />
			{/if}
		</div>
	{/if}
</div>

<style>
	.docs-editor {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 400px;
		background: oklch(0.14 0.01 250);
		border: 1px solid oklch(0.22 0.02 250);
		border-radius: 12px;
		overflow: hidden;
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		flex: 1;
		color: oklch(0.50 0.02 250);
		font-size: 0.85rem;
	}

	.empty-icon {
		width: 48px;
		height: 48px;
		color: oklch(0.35 0.02 250);
	}

	/* Header */
	.editor-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem;
		background: oklch(0.16 0.01 250);
		border-bottom: 1px solid oklch(0.22 0.02 250);
	}

	.file-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		flex: 1;
	}

	.file-name {
		font-size: 1rem;
		font-weight: 600;
		color: oklch(0.90 0.02 250);
		margin: 0;
		font-family: ui-monospace, monospace;
	}

	.file-path {
		font-size: 0.7rem;
		color: oklch(0.50 0.02 250);
		font-family: ui-monospace, monospace;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.last-modified {
		font-size: 0.7rem;
		color: oklch(0.50 0.02 250);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.error-badge {
		font-size: 0.7rem;
		font-weight: 500;
		padding: 0.25rem 0.5rem;
		background: oklch(0.30 0.10 25);
		border: 1px solid oklch(0.45 0.12 25);
		border-radius: 4px;
		color: oklch(0.85 0.10 25);
	}

	.success-badge {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.7rem;
		font-weight: 500;
		padding: 0.25rem 0.5rem;
		background: oklch(0.30 0.10 145);
		border: 1px solid oklch(0.45 0.12 145);
		border-radius: 4px;
		color: oklch(0.85 0.10 145);
	}

	.success-icon {
		width: 14px;
		height: 14px;
	}

	.unsaved-badge {
		font-size: 0.7rem;
		font-weight: 500;
		padding: 0.25rem 0.5rem;
		background: oklch(0.30 0.10 85);
		border: 1px solid oklch(0.45 0.12 85);
		border-radius: 4px;
		color: oklch(0.85 0.10 85);
	}

	.save-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 1rem;
		font-size: 0.8rem;
		font-weight: 500;
		background: oklch(0.35 0.12 200);
		border: 1px solid oklch(0.45 0.14 200);
		border-radius: 6px;
		color: oklch(0.95 0.02 200);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.save-btn:hover:not(:disabled) {
		background: oklch(0.40 0.14 200);
	}

	.save-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.save-icon {
		width: 16px;
		height: 16px;
	}

	.save-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid oklch(0.60 0.02 200);
		border-top-color: oklch(0.95 0.02 200);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* Editor container */
	.editor-container {
		flex: 1;
		display: flex;
		position: relative;
		min-height: 300px;
	}

	.loading-state {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		background: oklch(0.18 0.01 250);
		color: oklch(0.55 0.02 250);
		font-size: 0.85rem;
	}

	.loading-spinner {
		width: 28px;
		height: 28px;
		border: 3px solid oklch(0.30 0.02 250);
		border-top-color: oklch(0.65 0.15 200);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.editor-header {
			flex-direction: column;
		}

		.header-actions {
			width: 100%;
			justify-content: flex-end;
		}
	}
</style>
