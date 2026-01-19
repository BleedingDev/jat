<script lang="ts">
	/**
	 * MigrationViewer - SQL content viewer for Supabase migrations
	 *
	 * Shows either:
	 * - Schema diff output (when there are uncommitted schema changes)
	 * - Migration SQL content (when a migration file is selected)
	 */

	interface Props {
		/** Content to display (SQL or diff) */
		content: string;
		/** Title to show in header */
		title: string;
		/** Whether this is a schema diff (vs migration file) */
		isDiff?: boolean;
		/** Filename (for migrations) */
		filename?: string;
		/** Called when close button clicked */
		onClose?: () => void;
	}

	let { content, title, isDiff = false, filename, onClose }: Props = $props();

	/**
	 * Basic SQL syntax highlighting
	 * Returns HTML with highlighted keywords
	 */
	function highlightSql(sql: string): string {
		// SQL keywords to highlight
		const keywords = [
			'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'FUNCTION', 'TRIGGER',
			'INSERT', 'UPDATE', 'DELETE', 'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT',
			'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'TRUE', 'FALSE',
			'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'DEFAULT', 'CONSTRAINT',
			'IF', 'EXISTS', 'CASCADE', 'RESTRICT', 'SET', 'AS', 'BEGIN', 'END', 'RETURNS',
			'LANGUAGE', 'PLPGSQL', 'SQL', 'IMMUTABLE', 'STABLE', 'VOLATILE', 'SECURITY',
			'DEFINER', 'INVOKER', 'GRANT', 'REVOKE', 'TO', 'ROLE', 'PUBLIC', 'SCHEMA',
			'USING', 'WITH', 'CHECK', 'POLICY', 'FOR', 'ALL', 'ENABLE', 'ROW', 'LEVEL'
		];

		// Data types to highlight differently
		const dataTypes = [
			'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL',
			'TEXT', 'VARCHAR', 'CHAR', 'UUID', 'BOOLEAN', 'BOOL',
			'TIMESTAMP', 'TIMESTAMPTZ', 'DATE', 'TIME', 'TIMETZ',
			'JSON', 'JSONB', 'ARRAY', 'NUMERIC', 'DECIMAL', 'REAL', 'FLOAT',
			'BYTEA', 'MONEY', 'INTERVAL', 'VOID'
		];

		let highlighted = sql
			// Escape HTML first
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');

		// Highlight comments
		highlighted = highlighted.replace(/(--[^\n]*)/g, '<span class="sql-comment">$1</span>');

		// Highlight strings
		highlighted = highlighted.replace(/('(?:[^'\\]|\\.)*')/g, '<span class="sql-string">$1</span>');

		// Highlight keywords (case insensitive, whole words only)
		for (const keyword of keywords) {
			const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
			highlighted = highlighted.replace(regex, '<span class="sql-keyword">$1</span>');
		}

		// Highlight data types
		for (const type of dataTypes) {
			const regex = new RegExp(`\\b(${type})\\b`, 'gi');
			highlighted = highlighted.replace(regex, '<span class="sql-type">$1</span>');
		}

		// Highlight numbers
		highlighted = highlighted.replace(/\b(\d+)\b/g, '<span class="sql-number">$1</span>');

		return highlighted;
	}

	// Highlight content
	const highlightedContent = $derived(highlightSql(content));
</script>

<div class="migration-viewer">
	<!-- Header -->
	<div class="viewer-header">
		<div class="header-info">
			{#if isDiff}
				<span class="header-badge badge-diff">DIFF</span>
			{:else}
				<span class="header-badge badge-migration">SQL</span>
			{/if}
			<span class="header-title">{title}</span>
			{#if filename}
				<span class="header-filename">{filename}</span>
			{/if}
		</div>
		{#if onClose}
			<button class="btn btn-ghost btn-sm btn-square" onclick={onClose} title="Close">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>

	<!-- Content -->
	<div class="viewer-content">
		{#if !content}
			<div class="viewer-empty">
				<svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				<p>Select a migration to view its content</p>
			</div>
		{:else}
			<pre class="sql-content">{@html highlightedContent}</pre>
		{/if}
	</div>
</div>

<style>
	.migration-viewer {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: oklch(0.14 0.01 250);
	}

	/* Header */
	.viewer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: oklch(0.16 0.01 250);
		border-bottom: 1px solid oklch(0.22 0.02 250);
		flex-shrink: 0;
	}

	.header-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.header-badge {
		font-size: 0.625rem;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		flex-shrink: 0;
	}

	.badge-diff {
		background: oklch(0.70 0.15 85 / 0.2);
		color: oklch(0.75 0.18 85);
	}

	.badge-migration {
		background: oklch(0.65 0.15 200 / 0.2);
		color: oklch(0.70 0.18 200);
	}

	.header-title {
		font-weight: 600;
		color: oklch(0.85 0.02 250);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.header-filename {
		font-family: monospace;
		font-size: 0.75rem;
		color: oklch(0.55 0.02 250);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Content */
	.viewer-content {
		flex: 1;
		overflow: auto;
		padding: 1rem;
	}

	.viewer-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 1rem;
		color: oklch(0.50 0.02 250);
		text-align: center;
	}

	.empty-icon {
		width: 3rem;
		height: 3rem;
	}

	.sql-content {
		margin: 0;
		font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
		font-size: 0.8125rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
		color: oklch(0.80 0.02 250);
	}

	/* SQL Syntax Highlighting */
	:global(.sql-keyword) {
		color: oklch(0.75 0.15 280);
		font-weight: 500;
	}

	:global(.sql-type) {
		color: oklch(0.70 0.15 200);
	}

	:global(.sql-string) {
		color: oklch(0.70 0.15 145);
	}

	:global(.sql-number) {
		color: oklch(0.75 0.15 85);
	}

	:global(.sql-comment) {
		color: oklch(0.50 0.02 250);
		font-style: italic;
	}
</style>
