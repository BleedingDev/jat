<script lang="ts">
	/**
	 * GitPanel - Git operations panel for the Files page
	 *
	 * Shows:
	 * - Current branch with ahead/behind indicators
	 * - Fetch button to refresh remote status
	 * - Commit message input with commit button
	 * - Push/Pull action buttons
	 */
	import { onMount } from 'svelte';

	interface Props {
		project: string;
	}

	let { project }: Props = $props();

	// Git status state
	let currentBranch = $state<string | null>(null);
	let tracking = $state<string | null>(null);
	let ahead = $state(0);
	let behind = $state(0);
	let stagedCount = $state(0);
	let modifiedCount = $state(0);
	let untrackedCount = $state(0);
	let isClean = $state(true);

	// UI state
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let commitMessage = $state('');
	let isCommitting = $state(false);
	let isPushing = $state(false);
	let isPulling = $state(false);
	let isFetching = $state(false);

	// Toast state
	let toastMessage = $state<string | null>(null);
	let toastType = $state<'success' | 'error'>('success');

	function showToast(message: string, type: 'success' | 'error' = 'success') {
		toastMessage = message;
		toastType = type;
		setTimeout(() => {
			toastMessage = null;
		}, 3000);
	}

	// Derived state
	const canCommit = $derived(stagedCount > 0 && commitMessage.trim().length > 0 && !isCommitting);
	const canPush = $derived(ahead > 0 && !isPushing);
	const canPull = $derived(behind > 0 && !isPulling);

	async function fetchStatus() {
		if (!project) return;

		try {
			const response = await fetch(`/api/files/git/status?project=${encodeURIComponent(project)}`);
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to fetch git status');
			}

			const data = await response.json();
			currentBranch = data.current;
			tracking = data.tracking;
			ahead = data.ahead || 0;
			behind = data.behind || 0;
			stagedCount = data.staged?.length || 0;
			modifiedCount = (data.modified?.length || 0) + (data.deleted?.length || 0);
			untrackedCount = data.not_added?.length || 0;
			isClean = data.isClean;
			error = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to fetch git status';
			console.error('[GitPanel] Error fetching status:', err);
		} finally {
			isLoading = false;
		}
	}

	async function handleFetch() {
		if (isFetching) return;

		isFetching = true;
		try {
			const response = await fetch('/api/files/git/fetch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ project })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to fetch');
			}

			const data = await response.json();
			ahead = data.ahead || 0;
			behind = data.behind || 0;
			tracking = data.tracking;
			showToast('Fetched from remote');
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Failed to fetch', 'error');
		} finally {
			isFetching = false;
		}
	}

	async function handleCommit() {
		if (!canCommit) return;

		isCommitting = true;
		try {
			const response = await fetch('/api/files/git/commit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ project, message: commitMessage.trim() })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to commit');
			}

			const data = await response.json();
			showToast(`Committed: ${data.commit?.hash?.slice(0, 7) || 'success'}`);
			commitMessage = '';
			await fetchStatus();
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Failed to commit', 'error');
		} finally {
			isCommitting = false;
		}
	}

	async function handlePush() {
		if (isPushing) return;

		isPushing = true;
		try {
			const response = await fetch('/api/files/git/push', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ project })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to push');
			}

			showToast('Pushed to remote');
			await fetchStatus();
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Failed to push', 'error');
		} finally {
			isPushing = false;
		}
	}

	async function handlePull() {
		if (isPulling) return;

		isPulling = true;
		try {
			const response = await fetch('/api/files/git/pull', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ project })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to pull');
			}

			const data = await response.json();
			const changes = data.summary?.changes || 0;
			showToast(changes > 0 ? `Pulled ${changes} change(s)` : 'Already up to date');
			await fetchStatus();
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Failed to pull', 'error');
		} finally {
			isPulling = false;
		}
	}

	// Handle Ctrl+Enter to commit
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canCommit) {
			e.preventDefault();
			handleCommit();
		}
	}

	onMount(() => {
		fetchStatus();
	});

	// Refetch when project changes
	$effect(() => {
		if (project) {
			isLoading = true;
			fetchStatus();
		}
	});
</script>

<div class="git-panel">
	{#if isLoading}
		<!-- Loading State -->
		<div class="loading-container">
			<span class="loading loading-spinner loading-sm"></span>
			<span class="loading-text">Loading git status...</span>
		</div>
	{:else if error}
		<!-- Error State -->
		<div class="error-container">
			<div class="error-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
			</div>
			<p class="error-text">{error}</p>
			<button class="btn btn-sm btn-ghost" onclick={fetchStatus}>
				Retry
			</button>
		</div>
	{:else}
		<!-- Branch Header -->
		<div class="branch-header">
			<div class="branch-info">
				<span class="branch-icon">⎇</span>
				<span class="branch-name">{currentBranch || 'detached'}</span>
				{#if ahead > 0 || behind > 0}
					<span class="sync-indicators">
						{#if ahead > 0}
							<span class="ahead" title="{ahead} commit(s) ahead of remote">↑{ahead}</span>
						{/if}
						{#if behind > 0}
							<span class="behind" title="{behind} commit(s) behind remote">↓{behind}</span>
						{/if}
					</span>
				{/if}
			</div>
			<button
				class="fetch-btn"
				onclick={handleFetch}
				disabled={isFetching}
				title="Fetch from remote"
			>
				{#if isFetching}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M23 4v6h-6" />
						<path d="M1 20v-6h6" />
						<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
					</svg>
				{/if}
			</button>
		</div>

		<!-- Status Badges -->
		{#if !isClean}
			<div class="status-badges">
				{#if stagedCount > 0}
					<span class="badge badge-success badge-sm" title="Staged changes">
						{stagedCount} staged
					</span>
				{/if}
				{#if modifiedCount > 0}
					<span class="badge badge-warning badge-sm" title="Modified files">
						{modifiedCount} modified
					</span>
				{/if}
				{#if untrackedCount > 0}
					<span class="badge badge-ghost badge-sm" title="Untracked files">
						{untrackedCount} untracked
					</span>
				{/if}
			</div>
		{:else}
			<div class="clean-indicator">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="20 6 9 17 4 12" />
				</svg>
				<span>Working tree clean</span>
			</div>
		{/if}

		<!-- Commit Section -->
		<div class="commit-section">
			<textarea
				class="commit-input"
				placeholder="Commit message..."
				bind:value={commitMessage}
				onkeydown={handleKeyDown}
				rows="2"
			></textarea>
			<div class="commit-actions">
				<button
					class="btn btn-sm btn-success commit-btn"
					onclick={handleCommit}
					disabled={!canCommit}
					title={stagedCount === 0 ? 'No staged changes' : 'Commit staged changes (Ctrl+Enter)'}
				>
					{#if isCommitting}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="20 6 9 17 4 12" />
						</svg>
					{/if}
					Commit
				</button>
			</div>
		</div>

		<!-- Push/Pull Actions -->
		<div class="sync-actions">
			<button
				class="btn btn-sm btn-outline sync-btn"
				onclick={handlePush}
				disabled={!canPush && !isPushing}
				title={ahead === 0 ? 'Nothing to push' : `Push ${ahead} commit(s) to remote`}
			>
				{#if isPushing}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="12" y1="19" x2="12" y2="5" />
						<polyline points="5 12 12 5 19 12" />
					</svg>
				{/if}
				Push
				{#if ahead > 0}
					<span class="count">{ahead}</span>
				{/if}
			</button>
			<button
				class="btn btn-sm btn-outline sync-btn"
				onclick={handlePull}
				disabled={!canPull && !isPulling}
				title={behind === 0 ? 'Nothing to pull' : `Pull ${behind} commit(s) from remote`}
			>
				{#if isPulling}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="12" y1="5" x2="12" y2="19" />
						<polyline points="19 12 12 19 5 12" />
					</svg>
				{/if}
				Pull
				{#if behind > 0}
					<span class="count">{behind}</span>
				{/if}
			</button>
		</div>
	{/if}

	<!-- Toast -->
	{#if toastMessage}
		<div class="toast-container" class:error={toastType === 'error'}>
			{#if toastType === 'success'}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="20 6 9 17 4 12" />
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" />
					<line x1="15" y1="9" x2="9" y2="15" />
					<line x1="9" y1="9" x2="15" y2="15" />
				</svg>
			{/if}
			<span>{toastMessage}</span>
		</div>
	{/if}
</div>

<style>
	.git-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 0.75rem;
		gap: 0.75rem;
		position: relative;
	}

	/* Loading State */
	.loading-container {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem 1rem;
		color: oklch(0.55 0.02 250);
	}

	.loading-text {
		font-size: 0.8125rem;
	}

	/* Error State */
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1.5rem 1rem;
		text-align: center;
	}

	.error-icon {
		width: 32px;
		height: 32px;
		color: oklch(0.60 0.15 25);
	}

	.error-icon svg {
		width: 100%;
		height: 100%;
	}

	.error-text {
		font-size: 0.8125rem;
		color: oklch(0.60 0.15 25);
		margin: 0;
	}

	/* Branch Header */
	.branch-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.625rem;
		background: oklch(0.18 0.02 250);
		border-radius: 0.5rem;
		border: 1px solid oklch(0.24 0.02 250);
	}

	.branch-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.branch-icon {
		font-size: 1rem;
		color: oklch(0.65 0.15 145);
	}

	.branch-name {
		font-family: ui-monospace, monospace;
		font-size: 0.8125rem;
		font-weight: 600;
		color: oklch(0.85 0.02 250);
	}

	.sync-indicators {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		font-family: ui-monospace, monospace;
	}

	.ahead {
		color: oklch(0.65 0.15 145);
	}

	.behind {
		color: oklch(0.65 0.15 200);
	}

	.fetch-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		background: transparent;
		border: 1px solid oklch(0.30 0.02 250);
		border-radius: 0.375rem;
		color: oklch(0.60 0.02 250);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.fetch-btn:hover:not(:disabled) {
		background: oklch(0.22 0.02 250);
		color: oklch(0.80 0.02 250);
		border-color: oklch(0.35 0.02 250);
	}

	.fetch-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.fetch-btn svg {
		width: 14px;
		height: 14px;
	}

	/* Status Badges */
	.status-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	/* Clean Indicator */
	.clean-indicator {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.5rem;
		font-size: 0.75rem;
		color: oklch(0.55 0.12 145);
	}

	.clean-indicator svg {
		width: 14px;
		height: 14px;
	}

	/* Commit Section */
	.commit-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.commit-input {
		width: 100%;
		padding: 0.5rem 0.625rem;
		background: oklch(0.16 0.01 250);
		border: 1px solid oklch(0.26 0.02 250);
		border-radius: 0.5rem;
		color: oklch(0.90 0.02 250);
		font-size: 0.8125rem;
		font-family: inherit;
		resize: vertical;
		min-height: 48px;
		transition: border-color 0.15s ease;
	}

	.commit-input:focus {
		outline: none;
		border-color: oklch(0.55 0.15 145);
	}

	.commit-input::placeholder {
		color: oklch(0.45 0.02 250);
	}

	.commit-actions {
		display: flex;
		justify-content: flex-end;
	}

	.commit-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.commit-btn svg {
		width: 14px;
		height: 14px;
	}

	/* Sync Actions */
	.sync-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: auto;
	}

	.sync-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
	}

	.sync-btn svg {
		width: 14px;
		height: 14px;
	}

	.sync-btn .count {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 0.25rem;
		background: oklch(0.65 0.15 200 / 0.2);
		border-radius: 9px;
		font-size: 0.6875rem;
		font-weight: 600;
	}

	/* Toast */
	.toast-container {
		position: absolute;
		bottom: 0.75rem;
		left: 0.75rem;
		right: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: oklch(0.45 0.12 145 / 0.2);
		border: 1px solid oklch(0.55 0.15 145 / 0.3);
		border-radius: 0.5rem;
		color: oklch(0.75 0.12 145);
		font-size: 0.8125rem;
		animation: slide-up 0.2s ease;
	}

	.toast-container.error {
		background: oklch(0.45 0.12 25 / 0.2);
		border-color: oklch(0.55 0.15 25 / 0.3);
		color: oklch(0.75 0.12 25);
	}

	.toast-container svg {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
