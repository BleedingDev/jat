<script lang="ts">
	/**
	 * ActivityLog Component
	 *
	 * Shows recent automation rule triggers across all sessions.
	 * Columns: timestamp, session name, rule name, matched pattern, action taken, result.
	 * Features: Clear button, filter by rule or session.
	 * Data stored in memory (not persisted).
	 */

	import { fly, fade, slide } from 'svelte/transition';

	/** Activity log entry */
	export interface ActivityLogEntry {
		id: string;
		timestamp: Date;
		sessionName: string;
		ruleName: string;
		matchedPattern: string;
		actionTaken: string;
		result: 'success' | 'failure' | 'pending';
		details?: string;
	}

	interface Props {
		/** External entries to display (component can also maintain internal state) */
		entries?: ActivityLogEntry[];
		/** Called when clear button is clicked */
		onClear?: () => void;
		/** Maximum entries to display */
		maxEntries?: number;
		/** Custom class */
		class?: string;
	}

	let {
		entries = $bindable([]),
		onClear = () => {},
		maxEntries = 100,
		class: className = ''
	}: Props = $props();

	// Filter state
	let filterSession = $state('');
	let filterRule = $state('');

	// Filtered entries
	const filteredEntries = $derived.by(() => {
		let result = entries;

		if (filterSession) {
			result = result.filter(e => 
				e.sessionName.toLowerCase().includes(filterSession.toLowerCase())
			);
		}

		if (filterRule) {
			result = result.filter(e => 
				e.ruleName.toLowerCase().includes(filterRule.toLowerCase())
			);
		}

		return result.slice(0, maxEntries);
	});

	// Unique sessions and rules for filter dropdowns
	const uniqueSessions = $derived([...new Set(entries.map(e => e.sessionName))].sort());
	const uniqueRules = $derived([...new Set(entries.map(e => e.ruleName))].sort());

	// Result badge styling
	function getResultBadgeClass(result: ActivityLogEntry['result']): string {
		switch (result) {
			case 'success': return 'badge-success';
			case 'failure': return 'badge-error';
			case 'pending': return 'badge-warning';
			default: return 'badge-neutral';
		}
	}

	function formatTimestamp(date: Date): string {
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	}

	function formatTimestampFull(date: Date): string {
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	}

	function handleClear() {
		entries = [];
		onClear();
	}

	function clearFilters() {
		filterSession = '';
		filterRule = '';
	}

	// Add entry method (for external use)
	export function addEntry(entry: Omit<ActivityLogEntry, 'id'>) {
		const newEntry: ActivityLogEntry = {
			...entry,
			id: crypto.randomUUID()
		};
		entries = [newEntry, ...entries].slice(0, maxEntries);
	}
</script>

<div class="activity-log {className}">
	<!-- Header with filters and clear button -->
	<header class="log-header">
		<div class="header-title">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="header-icon">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
			</svg>
			<span>Activity Log</span>
			<span class="entry-count">{filteredEntries.length} / {entries.length}</span>
		</div>

		<div class="header-controls">
			<!-- Session filter -->
			<select
				class="filter-select"
				bind:value={filterSession}
				aria-label="Filter by session"
			>
				<option value="">All Sessions</option>
				{#each uniqueSessions as session}
					<option value={session}>{session}</option>
				{/each}
			</select>

			<!-- Rule filter -->
			<select
				class="filter-select"
				bind:value={filterRule}
				aria-label="Filter by rule"
			>
				<option value="">All Rules</option>
				{#each uniqueRules as rule}
					<option value={rule}>{rule}</option>
				{/each}
			</select>

			{#if filterSession || filterRule}
				<button
					class="clear-filters-btn"
					onclick={clearFilters}
					aria-label="Clear filters"
				>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}

			<button
				class="clear-btn"
				onclick={handleClear}
				disabled={entries.length === 0}
				aria-label="Clear all entries"
			>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
					<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
				</svg>
				Clear
			</button>
		</div>
	</header>

	<!-- Log table -->
	<div class="log-table-wrapper">
		{#if filteredEntries.length === 0}
			<div class="empty-state" transition:fade={{ duration: 150 }}>
				{#if entries.length === 0}
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="empty-icon">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
					</svg>
					<p class="empty-title">No activity yet</p>
					<p class="empty-hint">Rule triggers will appear here</p>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="empty-icon">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
					</svg>
					<p class="empty-title">No matching entries</p>
					<p class="empty-hint">Try adjusting your filters</p>
				{/if}
			</div>
		{:else}
			<table class="log-table">
				<thead>
					<tr>
						<th class="col-time">Time</th>
						<th class="col-session">Session</th>
						<th class="col-rule">Rule</th>
						<th class="col-pattern">Pattern</th>
						<th class="col-action">Action</th>
						<th class="col-result">Result</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredEntries as entry (entry.id)}
						<tr
							class="log-row"
							class:success={entry.result === 'success'}
							class:failure={entry.result === 'failure'}
							transition:slide={{ duration: 150, axis: 'y' }}
						>
							<td class="col-time" title={formatTimestampFull(entry.timestamp)}>
								{formatTimestamp(entry.timestamp)}
							</td>
							<td class="col-session">
								<span class="session-badge">{entry.sessionName}</span>
							</td>
							<td class="col-rule">
								<span class="rule-name">{entry.ruleName}</span>
							</td>
							<td class="col-pattern">
								<code class="pattern-code" title={entry.matchedPattern}>
									{entry.matchedPattern.length > 30 
										? entry.matchedPattern.slice(0, 30) + '...' 
										: entry.matchedPattern}
								</code>
							</td>
							<td class="col-action">
								<span class="action-text">{entry.actionTaken}</span>
							</td>
							<td class="col-result">
								<span class="result-badge {getResultBadgeClass(entry.result)}">
									{entry.result}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>

<style>
	.activity-log {
		display: flex;
		flex-direction: column;
		background: oklch(0.16 0.02 250);
		border: 1px solid oklch(0.28 0.02 250);
		border-radius: 10px;
		overflow: hidden;
	}

	.log-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: oklch(0.14 0.02 250);
		border-bottom: 1px solid oklch(0.25 0.02 250);
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: oklch(0.85 0.02 250);
		font-family: ui-monospace, monospace;
	}

	.header-icon {
		width: 18px;
		height: 18px;
		color: oklch(0.65 0.10 200);
	}

	.entry-count {
		font-size: 0.7rem;
		font-weight: 400;
		color: oklch(0.50 0.02 250);
		background: oklch(0.22 0.02 250);
		padding: 0.125rem 0.5rem;
		border-radius: 10px;
	}

	.header-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.filter-select {
		font-size: 0.75rem;
		padding: 0.375rem 0.625rem;
		background: oklch(0.20 0.02 250);
		border: 1px solid oklch(0.30 0.02 250);
		border-radius: 6px;
		color: oklch(0.80 0.02 250);
		cursor: pointer;
		min-width: 110px;
		font-family: ui-monospace, monospace;
	}

	.filter-select:hover {
		background: oklch(0.24 0.02 250);
		border-color: oklch(0.35 0.02 250);
	}

	.filter-select:focus {
		outline: none;
		border-color: oklch(0.50 0.10 200);
	}

	.clear-filters-btn,
	.clear-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		font-size: 0.75rem;
		background: oklch(0.20 0.02 250);
		border: 1px solid oklch(0.30 0.02 250);
		border-radius: 6px;
		color: oklch(0.70 0.02 250);
		cursor: pointer;
		transition: all 0.15s ease;
		font-family: ui-monospace, monospace;
	}

	.clear-filters-btn:hover,
	.clear-btn:hover:not(:disabled) {
		background: oklch(0.28 0.02 250);
		border-color: oklch(0.40 0.02 250);
		color: oklch(0.85 0.02 250);
	}

	.clear-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.clear-btn:hover:not(:disabled) {
		background: oklch(0.30 0.08 25);
		border-color: oklch(0.45 0.12 25);
		color: oklch(0.85 0.02 250);
	}

	.log-table-wrapper {
		flex: 1;
		overflow: auto;
		min-height: 200px;
		max-height: 400px;
	}

	.log-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
	}

	.log-table thead {
		position: sticky;
		top: 0;
		z-index: 1;
		background: oklch(0.18 0.02 250);
	}

	.log-table th {
		padding: 0.625rem 0.75rem;
		text-align: left;
		font-weight: 600;
		color: oklch(0.55 0.02 250);
		text-transform: uppercase;
		font-size: 0.65rem;
		letter-spacing: 0.05em;
		border-bottom: 1px solid oklch(0.28 0.02 250);
	}

	.log-table td {
		padding: 0.5rem 0.75rem;
		color: oklch(0.75 0.02 250);
		border-bottom: 1px solid oklch(0.22 0.02 250);
		vertical-align: middle;
	}

	.log-row {
		transition: background 0.1s ease;
	}

	.log-row:hover {
		background: oklch(0.20 0.02 250);
	}

	.log-row.success td:first-child {
		box-shadow: inset 3px 0 0 oklch(0.65 0.15 145);
	}

	.log-row.failure td:first-child {
		box-shadow: inset 3px 0 0 oklch(0.65 0.18 25);
	}

	.col-time {
		width: 75px;
		font-family: ui-monospace, monospace;
		color: oklch(0.60 0.02 250);
	}

	.col-session {
		width: 120px;
	}

	.session-badge {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		background: oklch(0.25 0.06 200);
		color: oklch(0.80 0.10 200);
		border-radius: 4px;
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.col-rule {
		width: 130px;
	}

	.rule-name {
		color: oklch(0.75 0.08 280);
		font-weight: 500;
	}

	.col-pattern {
		min-width: 150px;
	}

	.pattern-code {
		display: inline-block;
		padding: 0.125rem 0.375rem;
		background: oklch(0.20 0.02 250);
		border: 1px solid oklch(0.28 0.02 250);
		border-radius: 4px;
		font-family: ui-monospace, monospace;
		font-size: 0.65rem;
		color: oklch(0.70 0.10 55);
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.col-action {
		min-width: 100px;
	}

	.action-text {
		color: oklch(0.70 0.02 250);
	}

	.col-result {
		width: 80px;
		text-align: center;
	}

	.result-badge {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		border-radius: 10px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.badge-success {
		background: oklch(0.30 0.10 145);
		color: oklch(0.80 0.15 145);
	}

	.badge-error {
		background: oklch(0.30 0.10 25);
		color: oklch(0.80 0.18 25);
	}

	.badge-warning {
		background: oklch(0.30 0.10 85);
		color: oklch(0.80 0.15 85);
	}

	.badge-neutral {
		background: oklch(0.25 0.02 250);
		color: oklch(0.65 0.02 250);
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		gap: 0.5rem;
		color: oklch(0.50 0.02 250);
	}

	.empty-icon {
		width: 40px;
		height: 40px;
		color: oklch(0.35 0.02 250);
		margin-bottom: 0.5rem;
	}

	.empty-title {
		font-size: 0.85rem;
		font-weight: 500;
		color: oklch(0.55 0.02 250);
		margin: 0;
	}

	.empty-hint {
		font-size: 0.75rem;
		color: oklch(0.45 0.02 250);
		margin: 0;
	}
</style>
