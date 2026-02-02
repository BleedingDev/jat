<script lang="ts">
	/**
	 * ClaudeMdList Component
	 *
	 * Lists discoverable agent instruction files (AGENTS.md and CLAUDE.md) with metadata.
	 * Allows selecting a file for editing.
	 *
	 * @see ide/src/routes/config/+page.svelte for usage
	 */

	import { onMount } from 'svelte';

	interface InstructionFile {
		path: string;
		displayName: string;
		kind: 'agents' | 'claude';
		location: 'project' | 'ide' | 'user' | 'subdirectory';
		lastModified: string;
		size: number;
	}

	interface Props {
		/** Currently selected file path */
		selectedPath?: string | null;
		/** Called when a file is selected */
		onSelect?: (file: InstructionFile) => void;
	}

	let { selectedPath = null, onSelect = () => {} }: Props = $props();

	// State
	let files = $state<InstructionFile[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	const kindConfig: Record<string, { label: string; color: string }> = {
		agents: { label: 'AGENTS', color: 'oklch(0.75 0.12 200)' },
		claude: { label: 'CLAUDE', color: 'oklch(0.75 0.12 280)' }
	};

	// Location display names and icons
	const locationConfig: Record<string, { label: string; color: string }> = {
		project: { label: 'Project', color: 'oklch(0.75 0.15 140)' },
		ide: { label: 'IDE', color: 'oklch(0.75 0.15 200)' },
		user: { label: 'User', color: 'oklch(0.75 0.15 280)' },
		subdirectory: { label: 'Subdir', color: 'oklch(0.75 0.10 50)' }
	};

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function fetchFiles() {
		isLoading = true;
		error = null;

		try {
			const response = await fetch('/api/claude-md');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			const data = await response.json();
			files = data.files || [];

			// Auto-select first file if none selected
			if (!selectedPath && files.length > 0) {
				onSelect(files[0]);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load files';
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchFiles();
	});
</script>

<div class="instructions-list">
	<div class="list-header">
		<h3 class="list-title">Instructions</h3>
		<button class="refresh-btn" onclick={fetchFiles} disabled={isLoading}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="refresh-icon"
				class:spinning={isLoading}
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
				/>
			</svg>
		</button>
	</div>

	{#if isLoading}
		<div class="loading-state">
			<div class="loading-spinner"></div>
			<span>Loading files...</span>
		</div>
	{:else if error}
		<div class="error-state">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="error-icon"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
				/>
			</svg>
			<span>{error}</span>
			<button class="retry-btn" onclick={fetchFiles}>Retry</button>
		</div>
	{:else if files.length === 0}
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
					d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
				/>
			</svg>
			<span>No instruction files found</span>
		</div>
	{:else}
		<div class="file-list">
			{#each files as file (file.path)}
				<button
					class="file-item"
					class:selected={selectedPath === file.path}
					onclick={() => onSelect(file)}
				>
					<div class="file-main">
						<span class="file-name">{file.displayName}</span>
						<div class="badges">
							<span
								class="kind-badge"
								style="background: {kindConfig[file.kind]?.color || 'oklch(0.5 0 0)'}"
							>
								{kindConfig[file.kind]?.label || file.kind}
							</span>
							<span
								class="location-badge"
								style="background: {locationConfig[file.location]?.color || 'oklch(0.5 0 0)'}"
							>
								{locationConfig[file.location]?.label || file.location}
							</span>
						</div>
					</div>
					<div class="file-meta">
						<span class="file-size">{formatSize(file.size)}</span>
						<span class="file-date">{formatDate(file.lastModified)}</span>
					</div>
					<div class="file-path" title={file.path}>{file.path}</div>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.instructions-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 280px;
		max-width: 360px;
		background: oklch(0.14 0.01 250);
		border: 1px solid oklch(0.22 0.02 250);
		border-radius: 12px;
		padding: 1rem;
	}

	.list-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid oklch(0.22 0.02 250);
	}

	.list-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: oklch(0.85 0.02 250);
		margin: 0;
		font-family: ui-monospace, monospace;
	}

	.refresh-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: 1px solid oklch(0.30 0.02 250);
		border-radius: 6px;
		color: oklch(0.60 0.02 250);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.refresh-btn:hover:not(:disabled) {
		background: oklch(0.20 0.02 250);
		color: oklch(0.80 0.02 250);
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.refresh-icon {
		width: 16px;
		height: 16px;
	}

	.refresh-icon.spinning {
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

	.loading-state,
	.error-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem 1rem;
		color: oklch(0.60 0.02 250);
		text-align: center;
	}

	.loading-spinner {
		width: 24px;
		height: 24px;
		border: 2px solid oklch(0.30 0.02 250);
		border-top: 2px solid oklch(0.70 0.12 200);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.error-icon,
	.empty-icon {
		width: 24px;
		height: 24px;
		color: oklch(0.75 0.15 30);
	}

	.retry-btn {
		padding: 0.5rem 1rem;
		background: oklch(0.20 0.02 250);
		border: 1px solid oklch(0.30 0.02 250);
		border-radius: 6px;
		color: oklch(0.80 0.02 250);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.retry-btn:hover {
		background: oklch(0.25 0.02 250);
	}

	.file-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 500px;
		overflow-y: auto;
	}

	.file-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem;
		background: oklch(0.16 0.01 250);
		border: 1px solid oklch(0.22 0.02 250);
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}

	.file-item:hover {
		background: oklch(0.18 0.02 250);
		border-color: oklch(0.30 0.04 250);
	}

	.file-item.selected {
		background: oklch(0.20 0.03 250);
		border-color: oklch(0.70 0.12 200);
	}

	.file-main {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.file-name {
		font-size: 0.85rem;
		font-weight: 500;
		color: oklch(0.85 0.02 250);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.badges {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
	}

	.kind-badge,
	.location-badge {
		font-size: 0.65rem;
		font-weight: 600;
		padding: 0.15rem 0.4rem;
		border-radius: 999px;
		color: oklch(0.12 0.01 250);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.file-meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.7rem;
		color: oklch(0.60 0.02 250);
	}

	.file-path {
		font-size: 0.65rem;
		color: oklch(0.50 0.02 250);
		font-family: ui-monospace, monospace;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		opacity: 0.8;
	}
</style>
