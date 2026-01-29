<script lang="ts">
	/**
	 * FilePathPicker Component
	 *
	 * A reusable component for selecting/entering file paths with directory context.
	 * Used by:
	 * - LLMTransformModal (save LLM results to file)
	 * - FileTree (new file/folder creation)
	 * - Other file creation workflows
	 *
	 * Features:
	 * - Shows current directory context ("In: /path/to/dir/")
	 * - Filename input with validation
	 * - Optional directory picker (expand tree to select)
	 * - File type icon preview
	 */

	import { fade } from 'svelte/transition';

	interface Props {
		/** Current directory path (where file will be created) */
		basePath: string;
		/** Project root path for display truncation */
		projectPath?: string;
		/** Initial filename value */
		filename?: string;
		/** Type of item being created */
		type?: 'file' | 'folder';
		/** Placeholder text for input */
		placeholder?: string;
		/** Whether the input should be focused on mount */
		autofocus?: boolean;
		/** Callback when filename changes */
		onFilenameChange?: (filename: string) => void;
		/** Callback when confirmed (Enter or button) */
		onConfirm?: (fullPath: string, filename: string) => void;
		/** Callback when cancelled */
		onCancel?: () => void;
		/** Error message to display */
		error?: string;
		/** Whether to show the confirm/cancel buttons */
		showButtons?: boolean;
		/** Confirm button text */
		confirmText?: string;
		/** Whether confirm is disabled */
		confirmDisabled?: boolean;
	}

	let {
		basePath = '',
		projectPath = '',
		filename = $bindable(''),
		type = 'file',
		placeholder = 'filename.ext',
		autofocus = true,
		onFilenameChange,
		onConfirm,
		onCancel,
		error = '',
		showButtons = true,
		confirmText = 'Create',
		confirmDisabled = false
	}: Props = $props();

	let inputRef = $state<HTMLInputElement | null>(null);

	// Compute display path (truncated from project root)
	const displayPath = $derived(() => {
		if (!basePath) return '/';
		if (projectPath && basePath.startsWith(projectPath)) {
			const relative = basePath.slice(projectPath.length);
			return relative.startsWith('/') ? relative : '/' + relative;
		}
		return basePath;
	});

	// Compute full path
	const fullPath = $derived(() => {
		const base = basePath.endsWith('/') ? basePath : basePath + '/';
		return base + filename;
	});

	// Compute file extension for icon
	const extension = $derived(() => {
		if (type === 'folder') return 'folder';
		const parts = filename.split('.');
		return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
	});

	// Handle keydown
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && filename.trim() && !confirmDisabled) {
			e.preventDefault();
			onConfirm?.(fullPath(), filename);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onCancel?.();
		}
	}

	// Focus input on mount
	$effect(() => {
		if (autofocus && inputRef) {
			inputRef.focus();
			// Select filename without extension for easier renaming
			if (filename && type === 'file') {
				const dotIndex = filename.lastIndexOf('.');
				if (dotIndex > 0) {
					inputRef.setSelectionRange(0, dotIndex);
				} else {
					inputRef.select();
				}
			}
		}
	});

	// Notify parent of filename changes
	$effect(() => {
		onFilenameChange?.(filename);
	});

	// Get icon color based on extension
	function getIconColor(ext: string): string {
		const colors: Record<string, string> = {
			ts: 'oklch(0.65 0.15 230)',      // Blue
			tsx: 'oklch(0.65 0.15 230)',
			js: 'oklch(0.75 0.15 85)',       // Yellow
			jsx: 'oklch(0.75 0.15 85)',
			json: 'oklch(0.70 0.15 145)',    // Green
			md: 'oklch(0.60 0.02 250)',      // Gray
			css: 'oklch(0.65 0.15 320)',     // Pink
			scss: 'oklch(0.65 0.15 320)',
			svelte: 'oklch(0.65 0.18 25)',   // Orange
			vue: 'oklch(0.65 0.15 145)',     // Green
			html: 'oklch(0.65 0.15 25)',     // Orange
			folder: 'oklch(0.75 0.15 85)'    // Yellow
		};
		return colors[ext] || 'oklch(0.55 0.02 250)';
	}
</script>

<div class="file-path-picker" transition:fade={{ duration: 100 }}>
	<!-- Path context -->
	<div class="path-context">
		<span class="path-label">In:</span>
		<span class="path-value" title={basePath}>
			{displayPath() || '/'}
		</span>
	</div>

	<!-- Input row -->
	<div class="input-row">
		<!-- File/folder icon -->
		<div class="icon" style="color: {getIconColor(extension())}">
			{#if type === 'folder'}
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
					<path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
				</svg>
			{:else}
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
			{/if}
		</div>

		<!-- Filename input -->
		<input
			bind:this={inputRef}
			type="text"
			bind:value={filename}
			onkeydown={handleKeydown}
			{placeholder}
			class="filename-input"
			class:has-error={!!error}
		/>
	</div>

	<!-- Error message -->
	{#if error}
		<div class="error-message" transition:fade={{ duration: 100 }}>
			{error}
		</div>
	{/if}

	<!-- Action buttons -->
	{#if showButtons}
		<div class="actions">
			<button type="button" class="btn-cancel" onclick={() => onCancel?.()}>
				Cancel
			</button>
			<button
				type="button"
				class="btn-confirm"
				onclick={() => onConfirm?.(fullPath(), filename)}
				disabled={!filename.trim() || confirmDisabled}
			>
				{confirmText}
			</button>
		</div>
	{/if}
</div>

<style>
	.file-path-picker {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: oklch(0.18 0.02 250);
		border: 1px solid oklch(0.28 0.02 250);
		border-radius: 0.5rem;
	}

	.path-context {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: oklch(0.65 0.02 250);
	}

	.path-label {
		font-weight: 500;
		color: oklch(0.55 0.02 250);
	}

	.path-value {
		font-family: ui-monospace, monospace;
		color: oklch(0.70 0.08 200);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 280px;
	}

	.input-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.filename-input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-family: ui-monospace, monospace;
		background: oklch(0.14 0.01 250);
		border: 1px solid oklch(0.25 0.02 250);
		border-radius: 0.375rem;
		color: oklch(0.90 0.02 250);
		outline: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.filename-input:focus {
		border-color: oklch(0.60 0.15 220);
		box-shadow: 0 0 0 2px oklch(0.60 0.15 220 / 0.2);
	}

	.filename-input.has-error {
		border-color: oklch(0.60 0.18 25);
	}

	.filename-input::placeholder {
		color: oklch(0.45 0.02 250);
	}

	.error-message {
		font-size: 0.75rem;
		color: oklch(0.70 0.15 25);
		padding: 0.25rem 0;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.btn-cancel,
	.btn-confirm {
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 500;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: background-color 0.15s, opacity 0.15s;
	}

	.btn-cancel {
		background: oklch(0.25 0.02 250);
		border: 1px solid oklch(0.32 0.02 250);
		color: oklch(0.75 0.02 250);
	}

	.btn-cancel:hover {
		background: oklch(0.30 0.02 250);
	}

	.btn-confirm {
		background: oklch(0.55 0.15 145);
		border: 1px solid oklch(0.60 0.15 145);
		color: oklch(0.98 0.01 145);
	}

	.btn-confirm:hover:not(:disabled) {
		background: oklch(0.60 0.15 145);
	}

	.btn-confirm:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
