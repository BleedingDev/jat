<script lang="ts">
	/**
	 * DocsViewer Component
	 *
	 * Renders markdown documentation with:
	 * - Syntax highlighting for code blocks
	 * - Table of contents
	 * - Search highlighting
	 * - Copy code button
	 *
	 * Uses 'marked' library for markdown parsing
	 */

	import { onMount } from 'svelte';
	import { marked, type MarkedOptions } from 'marked';

	interface DocFile {
		name: string;
		filename: string;
		path: string;
		title: string;
		description: string;
		size: number;
		modifiedAt: string;
	}

	interface Props {
		/** The doc file metadata */
		doc: DocFile;
		/** The markdown content */
		content: string;
		/** Whether content is loading */
		isLoading?: boolean;
		/** Called when close button is clicked */
		onClose?: () => void;
	}

	let { doc, content, isLoading = false, onClose = () => {} }: Props = $props();

	// Rendered HTML content
	let renderedHtml = $state('');

	// Table of contents
	interface TocItem {
		level: number;
		text: string;
		slug: string;
	}
	let toc = $state<TocItem[]>([]);

	// Copy feedback
	let copiedSlug = $state<string | null>(null);

	// Configure marked
	const renderer = new marked.Renderer();

	// Custom heading renderer to extract TOC and add IDs
	const headings: TocItem[] = [];
	renderer.heading = function ({ tokens, depth }) {
		const text = tokens.map((t) => ('text' in t ? t.text : '')).join('');
		const slug = text
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.replace(/\s+/g, '-');

		headings.push({ level: depth, text, slug });

		return `<h${depth} id="${slug}" class="doc-heading doc-h${depth}">
			<a href="#${slug}" class="heading-anchor">#</a>
			${text}
		</h${depth}>`;
	};

	// Custom code renderer for syntax highlighting and copy button
	renderer.code = function ({ text, lang }) {
		const language = lang || 'text';
		const escapedCode = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');

		return `<div class="code-block">
			<div class="code-header">
				<span class="code-lang">${language}</span>
				<button class="copy-btn" data-code="${escapedCode}" onclick="window.copyCode(this)" title="Copy code">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="copy-icon">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
					</svg>
				</button>
			</div>
			<pre class="code-content"><code class="language-${language}">${escapedCode}</code></pre>
		</div>`;
	};

	// Custom table renderer
	renderer.table = function ({ header, rows }) {
		const headerHtml = header
			.map((cell) => `<th>${cell.text}</th>`)
			.join('');
		const bodyHtml = rows
			.map(
				(row) =>
					`<tr>${row.map((cell) => `<td>${cell.text}</td>`).join('')}</tr>`
			)
			.join('');

		return `<div class="table-wrapper">
			<table class="doc-table">
				<thead><tr>${headerHtml}</tr></thead>
				<tbody>${bodyHtml}</tbody>
			</table>
		</div>`;
	};

	// Set marked options
	marked.setOptions({
		renderer,
		gfm: true,
		breaks: false
	} as MarkedOptions);

	// Render markdown when content changes
	$effect(() => {
		if (content) {
			headings.length = 0; // Reset headings
			renderedHtml = marked.parse(content) as string;
			toc = [...headings];
		} else {
			renderedHtml = '';
			toc = [];
		}
	});

	// Setup copy function on window
	onMount(() => {
		(window as unknown as { copyCode: (btn: HTMLElement) => void }).copyCode = (
			btn: HTMLElement
		) => {
			const code = btn.getAttribute('data-code') || '';
			// Decode HTML entities
			const decoded = code
				.replace(/&amp;/g, '&')
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>')
				.replace(/&quot;/g, '"')
				.replace(/&#039;/g, "'");

			navigator.clipboard.writeText(decoded);

			// Visual feedback
			btn.classList.add('copied');
			setTimeout(() => btn.classList.remove('copied'), 2000);
		};
	});

	// Scroll to heading
	function scrollToHeading(slug: string) {
		const element = document.getElementById(slug);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	// Format file size
	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

<div class="docs-viewer">
	<!-- Header -->
	<div class="viewer-header">
		<div class="header-info">
			<h2 class="viewer-title">{doc.title}</h2>
			<div class="viewer-meta">
				<span class="meta-item">{doc.filename}</span>
				<span class="meta-sep">•</span>
				<span class="meta-item">{formatSize(doc.size)}</span>
			</div>
		</div>
		<button class="close-btn" onclick={onClose} aria-label="Close viewer">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="close-icon"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	<!-- Content area -->
	<div class="viewer-body">
		{#if isLoading}
			<div class="loading-state">
				<div class="loading-spinner"></div>
				<p class="loading-text">Loading document...</p>
			</div>
		{:else}
			<!-- Table of contents (if multiple headings) -->
			{#if toc.length > 2}
				<nav class="toc">
					<h3 class="toc-title">Contents</h3>
					<ul class="toc-list">
						{#each toc as item}
							<li class="toc-item toc-level-{item.level}">
								<button class="toc-link" onclick={() => scrollToHeading(item.slug)}>
									{item.text}
								</button>
							</li>
						{/each}
					</ul>
				</nav>
			{/if}

			<!-- Rendered markdown -->
			<div class="markdown-content">
				{@html renderedHtml}
			</div>
		{/if}
	</div>
</div>

<style>
	.docs-viewer {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: oklch(0.14 0.01 250);
		border: 1px solid oklch(0.25 0.02 250);
		border-radius: 10px;
		overflow: hidden;
	}

	/* Header */
	.viewer-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.25rem;
		background: oklch(0.16 0.02 250);
		border-bottom: 1px solid oklch(0.22 0.02 250);
	}

	.header-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.viewer-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: oklch(0.90 0.02 250);
		margin: 0;
		font-family: ui-monospace, monospace;
	}

	.viewer-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: oklch(0.50 0.02 250);
		font-family: ui-monospace, monospace;
	}

	.meta-sep {
		color: oklch(0.35 0.02 250);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: oklch(0.22 0.02 250);
		border: 1px solid oklch(0.30 0.02 250);
		border-radius: 6px;
		color: oklch(0.60 0.02 250);
		cursor: pointer;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.close-btn:hover {
		background: oklch(0.28 0.02 250);
		color: oklch(0.85 0.02 250);
	}

	.close-icon {
		width: 18px;
		height: 18px;
	}

	/* Body */
	.viewer-body {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem;
	}

	/* Scrollbar */
	.viewer-body::-webkit-scrollbar {
		width: 8px;
	}

	.viewer-body::-webkit-scrollbar-track {
		background: oklch(0.14 0.01 250);
	}

	.viewer-body::-webkit-scrollbar-thumb {
		background: oklch(0.28 0.02 250);
		border-radius: 4px;
	}

	.viewer-body::-webkit-scrollbar-thumb:hover {
		background: oklch(0.35 0.02 250);
	}

	/* Loading state */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 1rem;
		gap: 1rem;
	}

	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid oklch(0.30 0.02 250);
		border-top-color: oklch(0.65 0.15 200);
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

	.loading-text {
		font-size: 0.85rem;
		color: oklch(0.55 0.02 250);
		margin: 0;
	}

	/* Table of contents */
	.toc {
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: oklch(0.16 0.02 250);
		border: 1px solid oklch(0.25 0.02 250);
		border-radius: 8px;
	}

	.toc-title {
		font-size: 0.8rem;
		font-weight: 600;
		color: oklch(0.70 0.02 250);
		margin: 0 0 0.75rem 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.toc-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.toc-item {
		margin: 0;
	}

	.toc-level-1 {
		padding-left: 0;
	}
	.toc-level-2 {
		padding-left: 1rem;
	}
	.toc-level-3 {
		padding-left: 2rem;
	}
	.toc-level-4 {
		padding-left: 3rem;
	}

	.toc-link {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.25rem 0;
		font-size: 0.8rem;
		color: oklch(0.65 0.08 200);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: color 0.15s ease;
		font-family: ui-monospace, monospace;
	}

	.toc-link:hover {
		color: oklch(0.85 0.12 200);
	}

	/* Markdown content styles */
	.markdown-content {
		color: oklch(0.85 0.02 250);
		font-size: 0.9rem;
		line-height: 1.7;
	}

	/* Headings */
	:global(.markdown-content .doc-heading) {
		font-family: ui-monospace, monospace;
		font-weight: 600;
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		position: relative;
	}

	:global(.markdown-content .doc-h1) {
		font-size: 1.5rem;
		color: oklch(0.95 0.02 250);
		border-bottom: 2px solid oklch(0.25 0.02 250);
		padding-bottom: 0.5rem;
	}

	:global(.markdown-content .doc-h2) {
		font-size: 1.25rem;
		color: oklch(0.90 0.04 200);
	}

	:global(.markdown-content .doc-h3) {
		font-size: 1.1rem;
		color: oklch(0.85 0.02 250);
	}

	:global(.markdown-content .doc-h4) {
		font-size: 1rem;
		color: oklch(0.80 0.02 250);
	}

	:global(.markdown-content .heading-anchor) {
		position: absolute;
		left: -1.25rem;
		color: oklch(0.40 0.02 250);
		text-decoration: none;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	:global(.markdown-content .doc-heading:hover .heading-anchor) {
		opacity: 1;
	}

	/* Paragraphs */
	:global(.markdown-content p) {
		margin: 0 0 1rem 0;
	}

	/* Lists */
	:global(.markdown-content ul),
	:global(.markdown-content ol) {
		margin: 0 0 1rem 0;
		padding-left: 1.5rem;
	}

	:global(.markdown-content li) {
		margin-bottom: 0.375rem;
	}

	/* Links */
	:global(.markdown-content a) {
		color: oklch(0.75 0.15 200);
		text-decoration: none;
	}

	:global(.markdown-content a:hover) {
		text-decoration: underline;
	}

	/* Inline code */
	:global(.markdown-content code:not([class*='language-'])) {
		font-family: ui-monospace, monospace;
		font-size: 0.85em;
		background: oklch(0.20 0.02 250);
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		color: oklch(0.80 0.10 280);
	}

	/* Code blocks */
	:global(.markdown-content .code-block) {
		margin: 1rem 0;
		border-radius: 8px;
		overflow: hidden;
		background: oklch(0.10 0.01 250);
		border: 1px solid oklch(0.22 0.02 250);
	}

	:global(.markdown-content .code-header) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		background: oklch(0.14 0.02 250);
		border-bottom: 1px solid oklch(0.20 0.02 250);
	}

	:global(.markdown-content .code-lang) {
		font-size: 0.7rem;
		font-weight: 500;
		color: oklch(0.60 0.02 250);
		font-family: ui-monospace, monospace;
		text-transform: uppercase;
	}

	:global(.markdown-content .copy-btn) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		background: oklch(0.20 0.02 250);
		border: 1px solid oklch(0.28 0.02 250);
		border-radius: 4px;
		color: oklch(0.55 0.02 250);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	:global(.markdown-content .copy-btn:hover) {
		background: oklch(0.25 0.02 250);
		color: oklch(0.75 0.02 250);
	}

	:global(.markdown-content .copy-btn.copied) {
		background: oklch(0.30 0.10 145);
		border-color: oklch(0.45 0.15 145);
		color: oklch(0.85 0.10 145);
	}

	:global(.markdown-content .copy-icon) {
		width: 14px;
		height: 14px;
	}

	:global(.markdown-content .code-content) {
		margin: 0;
		padding: 1rem;
		overflow-x: auto;
	}

	:global(.markdown-content .code-content code) {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		line-height: 1.5;
		color: oklch(0.85 0.02 250);
	}

	/* Tables */
	:global(.markdown-content .table-wrapper) {
		overflow-x: auto;
		margin: 1rem 0;
	}

	:global(.markdown-content .doc-table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	:global(.markdown-content .doc-table th),
	:global(.markdown-content .doc-table td) {
		padding: 0.625rem 0.75rem;
		text-align: left;
		border: 1px solid oklch(0.25 0.02 250);
	}

	:global(.markdown-content .doc-table th) {
		background: oklch(0.18 0.02 250);
		font-weight: 600;
		color: oklch(0.80 0.02 250);
	}

	:global(.markdown-content .doc-table tr:nth-child(even) td) {
		background: oklch(0.15 0.01 250);
	}

	/* Blockquotes */
	:global(.markdown-content blockquote) {
		margin: 1rem 0;
		padding: 0.75rem 1rem;
		background: oklch(0.16 0.02 250);
		border-left: 3px solid oklch(0.50 0.10 200);
		color: oklch(0.75 0.02 250);
	}

	:global(.markdown-content blockquote p:last-child) {
		margin-bottom: 0;
	}

	/* Horizontal rule */
	:global(.markdown-content hr) {
		border: none;
		border-top: 1px solid oklch(0.25 0.02 250);
		margin: 2rem 0;
	}

	/* Strong and emphasis */
	:global(.markdown-content strong) {
		font-weight: 600;
		color: oklch(0.95 0.02 250);
	}

	:global(.markdown-content em) {
		font-style: italic;
	}
</style>
