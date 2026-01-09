<script lang="ts">
	/**
	 * CommitDetailModal - Display full commit details when clicking a commit in timeline
	 *
	 * Shows:
	 * - Full commit hash (with copy button)
	 * - Complete commit message (multi-line)
	 * - Formatted date and time
	 * - Author details (name and email)
	 * - List of changed files with change types and stats (clickable to view diff)
	 */

	import { openCommitDiffDrawer } from '$lib/stores/drawerStore';

	interface Props {
		project: string;
		commitHash: string | null;
		isOpen: boolean;
		onClose: () => void;
	}

	interface FileChange {
		path: string;
		type: 'A' | 'M' | 'D' | 'R' | 'C' | 'U';
		additions: number;
		deletions: number;
		binary: boolean;
	}

	interface CommitDetail {
		hash: string;
		hashShort: string;
		author: {
			name: string;
			email: string;
			date: string;
		};
		committer: {
			name: string;
			email: string;
			date: string;
		};
		message: string;
		parents: string[];
		files: FileChange[];
		stats: {
			totalFiles: number;
			additions: number;
			deletions: number;
		};
	}

	let { project, commitHash, isOpen = $bindable(false), onClose }: Props = $props();

	// State
	let commit = $state<CommitDetail | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let copiedHash = $state(false);

	/**
	 * Format a date string to a human-readable format
	 */
	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	/**
	 * Format relative time (e.g., "2 days ago")
	 */
	function formatTimeAgo(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (seconds < 60) return 'just now';
		if (seconds < 3600) {
			const mins = Math.floor(seconds / 60);
			return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
		}
		if (seconds < 86400) {
			const hours = Math.floor(seconds / 3600);
			return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
		}
		if (seconds < 604800) {
			const days = Math.floor(seconds / 86400);
			return `${days} day${days !== 1 ? 's' : ''} ago`;
		}
		if (seconds < 2592000) {
			const weeks = Math.floor(seconds / 604800);
			return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
		}
		if (seconds < 31536000) {
			const months = Math.floor(seconds / 2592000);
			return `${months} month${months !== 1 ? 's' : ''} ago`;
		}
		const years = Math.floor(seconds / 31536000);
		return `${years} year${years !== 1 ? 's' : ''} ago`;
	}

	/**
	 * Get file type indicator
	 */
	function getFileTypeInfo(type: string): { label: string; color: string; bgColor: string } {
		switch (type) {
			case 'A':
				return { label: 'Added', color: 'oklch(0.70 0.15 145)', bgColor: 'oklch(0.70 0.15 145 / 0.15)' };
			case 'M':
				return { label: 'Modified', color: 'oklch(0.70 0.15 85)', bgColor: 'oklch(0.70 0.15 85 / 0.15)' };
			case 'D':
				return { label: 'Deleted', color: 'oklch(0.70 0.15 25)', bgColor: 'oklch(0.70 0.15 25 / 0.15)' };
			case 'R':
				return { label: 'Renamed', color: 'oklch(0.70 0.15 280)', bgColor: 'oklch(0.70 0.15 280 / 0.15)' };
			case 'C':
				return { label: 'Copied', color: 'oklch(0.70 0.15 200)', bgColor: 'oklch(0.70 0.15 200 / 0.15)' };
			default:
				return { label: 'Unknown', color: 'oklch(0.60 0.02 250)', bgColor: 'oklch(0.60 0.02 250 / 0.15)' };
		}
	}

	/**
	 * Get filename from path
	 */
	function getFileName(path: string): string {
		return path.split('/').pop() || path;
	}

	/**
	 * Get directory from path
	 */
	function getDirectory(path: string): string {
		const parts = path.split('/');
		if (parts.length <= 1) return '';
		return parts.slice(0, -1).join('/');
	}

	/**
	 * Copy hash to clipboard
	 */
	async function copyHash() {
		if (!commit) return;
		try {
			await navigator.clipboard.writeText(commit.hash);
			copiedHash = true;
			setTimeout(() => {
				copiedHash = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy hash:', err);
		}
	}

	/**
	 * Fetch commit details from API
	 */
	async function fetchCommit() {
		if (!project || !commitHash) return;

		isLoading = true;
		error = null;
		commit = null;

		try {
			const response = await fetch(
				`/api/files/git/show?project=${encodeURIComponent(project)}&hash=${encodeURIComponent(commitHash)}`
			);

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to fetch commit details');
			}

			const data = await response.json();
			commit = data.commit;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to fetch commit details';
			console.error('[CommitDetailModal] Error fetching commit:', err);
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Handle keyboard events
	 */
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	/**
	 * Handle click on a file to view its diff
	 */
	function handleFileClick(filePath: string) {
		if (!commit) return;
		openCommitDiffDrawer(filePath, project, commit.hash);
	}

	// Fetch commit when modal opens
	$effect(() => {
		if (isOpen && commitHash) {
			fetchCommit();
			copiedHash = false;
		}
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isOpen}
	<!-- Modal backdrop -->
	<div class="modal-backdrop" onclick={onClose} role="button" tabindex="-1">
		<!-- Modal content -->
		<div
			class="modal-content"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="commit-modal-title"
		>
			<!-- Header -->
			<div class="modal-header">
				<h3 id="commit-modal-title" class="modal-title">
					<svg class="commit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="4" />
						<line x1="1.05" y1="12" x2="7" y2="12" />
						<line x1="17.01" y1="12" x2="22.96" y2="12" />
					</svg>
					Commit Details
				</h3>
				<button class="close-btn" onclick={onClose} title="Close (Esc)">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="modal-body">
				{#if isLoading}
					<div class="loading-container">
						<span class="loading loading-spinner loading-sm"></span>
						<span>Loading commit details...</span>
					</div>
				{:else if error}
					<div class="error-container">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
						<p class="error-text">{error}</p>
						<button class="btn btn-sm btn-ghost" onclick={fetchCommit}>Retry</button>
					</div>
				{:else if commit}
					<!-- Commit Hash Section -->
					<div class="section hash-section">
						<div class="hash-row">
							<span class="hash-label">Commit</span>
							<code class="hash-value">{commit.hash}</code>
							<button
								class="copy-btn"
								onclick={copyHash}
								title={copiedHash ? 'Copied!' : 'Copy full hash'}
							>
								{#if copiedHash}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<polyline points="20 6 9 17 4 12" />
									</svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
										<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
									</svg>
								{/if}
							</button>
						</div>
						{#if commit.parents.length > 0}
							<div class="parents-row">
								<span class="parents-label">Parent{commit.parents.length > 1 ? 's' : ''}</span>
								<span class="parents-value">
									{commit.parents.map(p => p.slice(0, 7)).join(', ')}
								</span>
							</div>
						{/if}
					</div>

					<!-- Author Section -->
					<div class="section author-section">
						<div class="author-row">
							<div class="author-avatar">
								{commit.author.name.charAt(0).toUpperCase()}
							</div>
							<div class="author-info">
								<span class="author-name">{commit.author.name}</span>
								<span class="author-email">&lt;{commit.author.email}&gt;</span>
							</div>
						</div>
						<div class="date-row">
							<span class="date-relative">{formatTimeAgo(commit.author.date)}</span>
							<span class="date-full">{formatDate(commit.author.date)}</span>
						</div>
					</div>

					<!-- Message Section -->
					<div class="section message-section">
						<h4 class="section-title">Commit Message</h4>
						<pre class="commit-message">{commit.message}</pre>
					</div>

					<!-- File Changes Section -->
					<div class="section files-section">
						<div class="files-header">
							<h4 class="section-title">Changed Files</h4>
							<div class="stats-summary">
								<span class="stat-item files">
									{commit.stats.totalFiles} file{commit.stats.totalFiles !== 1 ? 's' : ''}
								</span>
								{#if commit.stats.additions > 0}
									<span class="stat-item additions">+{commit.stats.additions}</span>
								{/if}
								{#if commit.stats.deletions > 0}
									<span class="stat-item deletions">-{commit.stats.deletions}</span>
								{/if}
							</div>
						</div>

						{#if commit.files.length === 0}
							<div class="empty-files">No file changes</div>
						{:else}
							<ul class="file-list">
								{#each commit.files as file}
									{@const typeInfo = getFileTypeInfo(file.type)}
									{@const fileName = getFileName(file.path)}
									{@const directory = getDirectory(file.path)}
									<li class="file-item file-item-clickable" onclick={() => handleFileClick(file.path)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && handleFileClick(file.path)}>
										<span
											class="file-type"
											style="color: {typeInfo.color}; background: {typeInfo.bgColor}"
											title={typeInfo.label}
										>
											{file.type}
										</span>
										<div class="file-path">
											<span class="file-name">{fileName}</span>
											{#if directory}
												<span class="file-dir">{directory}</span>
											{/if}
										</div>
										{#if !file.binary}
											<div class="file-stats">
												{#if file.additions > 0}
													<span class="stat additions">+{file.additions}</span>
												{/if}
												{#if file.deletions > 0}
													<span class="stat deletions">-{file.deletions}</span>
												{/if}
											</div>
										{:else}
											<span class="binary-badge">binary</span>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="modal-footer">
				<button class="btn btn-sm btn-ghost" onclick={onClose}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: oklch(0 0 0 / 0.6);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 8vh;
		z-index: 50;
		animation: fade-in 0.15s ease;
	}

	.modal-content {
		width: 100%;
		max-width: 600px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		background: oklch(0.16 0.01 250);
		border: 1px solid oklch(0.26 0.02 250);
		border-radius: 0.75rem;
		box-shadow:
			0 20px 60px oklch(0 0 0 / 0.4),
			0 0 0 1px oklch(0.30 0.02 250);
		animation: slide-down 0.2s ease;
	}

	/* Header */
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid oklch(0.24 0.02 250);
	}

	.modal-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		color: oklch(0.90 0.02 250);
		margin: 0;
	}

	.commit-icon {
		width: 20px;
		height: 20px;
		color: oklch(0.65 0.15 200);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 0.375rem;
		color: oklch(0.55 0.02 250);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.close-btn:hover {
		background: oklch(0.22 0.02 250);
		color: oklch(0.80 0.02 250);
	}

	.close-btn svg {
		width: 16px;
		height: 16px;
	}

	/* Body */
	.modal-body {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}

	/* Loading & Error */
	.loading-container,
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 3rem 1rem;
		color: oklch(0.55 0.02 250);
		font-size: 0.875rem;
	}

	.error-container svg {
		width: 32px;
		height: 32px;
		color: oklch(0.60 0.15 25);
	}

	.error-text {
		color: oklch(0.65 0.15 25);
		margin: 0;
		text-align: center;
	}

	/* Sections */
	.section {
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid oklch(0.22 0.02 250);
	}

	.section:last-child {
		margin-bottom: 0;
		padding-bottom: 0;
		border-bottom: none;
	}

	.section-title {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: oklch(0.50 0.02 250);
		margin: 0 0 0.5rem 0;
	}

	/* Hash Section */
	.hash-section {
		background: oklch(0.14 0.01 250);
		border-radius: 0.5rem;
		padding: 0.75rem !important;
		border: 1px solid oklch(0.24 0.02 250);
		margin-bottom: 1rem !important;
		border-bottom: 1px solid oklch(0.24 0.02 250) !important;
	}

	.hash-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.hash-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: oklch(0.55 0.02 250);
	}

	.hash-value {
		flex: 1;
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		color: oklch(0.75 0.12 200);
		background: oklch(0.75 0.12 200 / 0.1);
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		word-break: break-all;
	}

	.copy-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		background: transparent;
		border: 1px solid oklch(0.30 0.02 250);
		border-radius: 0.375rem;
		color: oklch(0.55 0.02 250);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.copy-btn:hover {
		background: oklch(0.22 0.02 250);
		color: oklch(0.75 0.15 145);
		border-color: oklch(0.45 0.12 145);
	}

	.copy-btn svg {
		width: 14px;
		height: 14px;
	}

	.parents-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		font-size: 0.75rem;
	}

	.parents-label {
		color: oklch(0.50 0.02 250);
	}

	.parents-value {
		font-family: ui-monospace, monospace;
		color: oklch(0.65 0.02 250);
	}

	/* Author Section */
	.author-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.author-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.author-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: oklch(0.55 0.15 200 / 0.2);
		border-radius: 50%;
		color: oklch(0.75 0.15 200);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.author-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.author-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: oklch(0.85 0.02 250);
	}

	.author-email {
		font-size: 0.75rem;
		color: oklch(0.55 0.02 250);
	}

	.date-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-left: 42px; /* Align with author name */
	}

	.date-relative {
		font-size: 0.8125rem;
		font-weight: 500;
		color: oklch(0.70 0.02 250);
	}

	.date-full {
		font-size: 0.75rem;
		color: oklch(0.50 0.02 250);
	}

	/* Message Section */
	.commit-message {
		margin: 0;
		padding: 0.75rem;
		background: oklch(0.14 0.01 250);
		border: 1px solid oklch(0.24 0.02 250);
		border-radius: 0.5rem;
		font-family: inherit;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: oklch(0.85 0.02 250);
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* Files Section */
	.files-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.stats-summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.stat-item {
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	.stat-item.files {
		color: oklch(0.65 0.02 250);
		background: oklch(0.25 0.02 250);
	}

	.stat-item.additions {
		color: oklch(0.70 0.15 145);
		background: oklch(0.70 0.15 145 / 0.15);
	}

	.stat-item.deletions {
		color: oklch(0.70 0.15 25);
		background: oklch(0.70 0.15 25 / 0.15);
	}

	.empty-files {
		padding: 1rem;
		text-align: center;
		color: oklch(0.50 0.02 250);
		font-size: 0.8125rem;
		font-style: italic;
	}

	.file-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 250px;
		overflow-y: auto;
	}

	.file-list::-webkit-scrollbar {
		width: 4px;
	}

	.file-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.file-list::-webkit-scrollbar-thumb {
		background: oklch(0.30 0.02 250);
		border-radius: 2px;
	}

	.file-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		background: oklch(0.14 0.01 250);
		border-radius: 0.375rem;
		transition: all 0.15s ease;
	}

	.file-item:hover {
		background: oklch(0.18 0.02 250);
	}

	.file-item-clickable {
		cursor: pointer;
		border: 1px solid transparent;
	}

	.file-item-clickable:hover {
		background: oklch(0.20 0.03 200);
		border-color: oklch(0.40 0.10 200 / 0.3);
	}

	.file-item-clickable:focus {
		outline: none;
		border-color: oklch(0.55 0.15 200);
		box-shadow: 0 0 0 2px oklch(0.55 0.15 200 / 0.2);
	}

	.file-item-clickable:active {
		background: oklch(0.22 0.04 200);
	}

	.file-type {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		font-family: ui-monospace, monospace;
		font-size: 0.6875rem;
		font-weight: 600;
		border-radius: 0.25rem;
		flex-shrink: 0;
	}

	.file-path {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
	}

	.file-name {
		font-size: 0.8125rem;
		color: oklch(0.85 0.02 250);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.file-dir {
		font-size: 0.75rem;
		color: oklch(0.50 0.02 250);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.file-stats {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.file-stats .stat {
		font-family: ui-monospace, monospace;
		font-size: 0.6875rem;
		font-weight: 500;
	}

	.file-stats .stat.additions {
		color: oklch(0.65 0.15 145);
	}

	.file-stats .stat.deletions {
		color: oklch(0.65 0.15 25);
	}

	.binary-badge {
		font-size: 0.625rem;
		padding: 0.125rem 0.375rem;
		background: oklch(0.25 0.02 250);
		border-radius: 0.25rem;
		color: oklch(0.55 0.02 250);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Footer */
	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: 0.75rem 1rem;
		border-top: 1px solid oklch(0.24 0.02 250);
	}

	/* Animations */
	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slide-down {
		from {
			opacity: 0;
			transform: translateY(-16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
