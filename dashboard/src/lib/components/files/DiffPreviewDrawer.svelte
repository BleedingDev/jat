<script lang="ts">
	/**
	 * DiffPreviewDrawer Component
	 * Slide-in drawer for viewing git diffs using Monaco diff editor
	 *
	 * Features:
	 * - Right-side drawer (doesn't block main content)
	 * - Monaco diff editor with side-by-side view
	 * - Stage/Unstage button in header
	 * - Supports both staged and unstaged changes
	 */

	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { slide } from 'svelte/transition';
	import loader from '@monaco-editor/loader';
	import type * as Monaco from 'monaco-editor';
	import { getMonacoTheme } from '$lib/utils/themeManager';

	// Props
	let {
		isOpen = $bindable(false),
		filePath = $bindable(''),
		projectName = $bindable(''),
		isStaged = $bindable(false),
		onClose = () => {},
		onStage = undefined,
		onUnstage = undefined
	}: {
		isOpen?: boolean;
		filePath?: string;
		projectName?: string;
		isStaged?: boolean;
		onClose?: () => void;
		onStage?: (path: string) => Promise<void>;
		onUnstage?: (path: string) => Promise<void>;
	} = $props();

	// State
	let originalContent = $state('');
	let modifiedContent = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let additions = $state(0);
	let deletions = $state(0);
	let isStaging = $state(false);

	// Monaco state
	let containerRef: HTMLDivElement | null = $state(null);
	let diffEditor: Monaco.editor.IStandaloneDiffEditor | null = $state(null);
	let monaco: typeof Monaco | null = $state(null);
	let monacoReady = $state(false);
	let resizeObserver: ResizeObserver | null = null;
	let themeObserver: MutationObserver | null = null;
	let daisyTheme = $state('nord');

	// Derived: File name from path
	const fileName = $derived(filePath.split('/').pop() || filePath);

	// Derived: Monaco theme
	const effectiveTheme = $derived(getMonacoTheme(daisyTheme));

	// Derived: File extension for language
	const language = $derived(() => {
		const ext = filePath.split('.').pop()?.toLowerCase() || '';
		const langMap: Record<string, string> = {
			ts: 'typescript',
			tsx: 'typescript',
			js: 'javascript',
			jsx: 'javascript',
			mjs: 'javascript',
			cjs: 'javascript',
			json: 'json',
			md: 'markdown',
			css: 'css',
			scss: 'scss',
			html: 'html',
			htm: 'html',
			xml: 'xml',
			svg: 'xml',
			yaml: 'yaml',
			yml: 'yaml',
			py: 'python',
			rs: 'rust',
			go: 'go',
			java: 'java',
			c: 'c',
			h: 'c',
			cpp: 'cpp',
			hpp: 'cpp',
			sh: 'shell',
			bash: 'shell',
			zsh: 'shell',
			sql: 'sql',
			svelte: 'html',
			vue: 'html'
		};
		return langMap[ext] || 'plaintext';
	});

	// Fetch diff content when path changes
	$effect(() => {
		if (isOpen && filePath && projectName) {
			fetchDiffContent();
		}
	});

	// Reset state when drawer closes, delay Monaco mount when opening
	$effect(() => {
		if (!isOpen) {
			error = null;
			monacoReady = false;
			// Dispose editor when closing
			if (diffEditor) {
				diffEditor.dispose();
				diffEditor = null;
			}
		} else {
			// Delay Monaco initialization until after slide transition completes
			const timeout = setTimeout(() => {
				monacoReady = true;
			}, 250);
			return () => clearTimeout(timeout);
		}
	});

	// Initialize Monaco diff editor when ready
	$effect(() => {
		if (monacoReady && containerRef && !loading && originalContent !== null && modifiedContent !== null) {
			initMonacoDiffEditor();
		}
	});

	async function initMonacoDiffEditor() {
		if (!containerRef || diffEditor) return;

		try {
			// Initialize DaisyUI theme
			daisyTheme = document.documentElement.getAttribute('data-theme') || 'nord';

			// Watch for theme changes
			themeObserver = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
						const newTheme = document.documentElement.getAttribute('data-theme') || 'nord';
						if (newTheme !== daisyTheme) {
							daisyTheme = newTheme;
						}
					}
				}
			});
			themeObserver.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['data-theme']
			});

			// Load Monaco
			monaco = await loader.init();

			// Create URIs for the models
			const originalUri = monaco.Uri.parse(`original://${filePath}`);
			const modifiedUri = monaco.Uri.parse(`modified://${filePath}`);

			// Dispose existing models if they exist (prevents "already exists" error)
			const existingOriginal = monaco.editor.getModel(originalUri);
			const existingModified = monaco.editor.getModel(modifiedUri);
			if (existingOriginal) existingOriginal.dispose();
			if (existingModified) existingModified.dispose();

			// Create original model
			const originalModel = monaco.editor.createModel(
				originalContent,
				language(),
				originalUri
			);

			// Create modified model
			const modifiedModel = monaco.editor.createModel(
				modifiedContent,
				language(),
				modifiedUri
			);

			// Create diff editor
			diffEditor = monaco.editor.createDiffEditor(containerRef, {
				theme: effectiveTheme,
				readOnly: true,
				renderSideBySide: true,
				enableSplitViewResizing: true,
				ignoreTrimWhitespace: false,
				renderIndicators: true,
				originalEditable: false,
				minimap: { enabled: false },
				scrollBeyondLastLine: false,
				fontSize: 13,
				lineNumbers: 'on',
				lineDecorationsWidth: 8,
				lineNumbersMinChars: 3,
				padding: { top: 8, bottom: 8 },
				scrollbar: {
					useShadows: false,
					verticalScrollbarSize: 10,
					horizontalScrollbarSize: 10
				}
			});

			diffEditor.setModel({
				original: originalModel,
				modified: modifiedModel
			});

			// Set up resize observer
			resizeObserver = new ResizeObserver(() => {
				diffEditor?.layout();
			});
			resizeObserver.observe(containerRef);

		} catch (err) {
			console.error('Failed to initialize Monaco Diff Editor:', err);
			error = 'Failed to load diff editor';
		}
	}

	// Sync theme changes
	$effect(() => {
		if (monaco && diffEditor) {
			monaco.editor.setTheme(effectiveTheme);
		}
	});

	async function fetchDiffContent() {
		loading = true;
		error = null;

		try {
			const params = new URLSearchParams({
				project: projectName,
				path: filePath,
				staged: isStaged.toString()
			});
			const response = await fetch(`/api/files/git/diff?${params}`);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to fetch diff');
			}

			originalContent = data.original ?? '';
			modifiedContent = data.modified ?? '';

			// Extract stats from parsed diff
			if (data.files && data.files.length > 0) {
				additions = data.files[0].additions || 0;
				deletions = data.files[0].deletions || 0;
			} else {
				additions = 0;
				deletions = 0;
			}

			// Update existing diff editor models if editor exists
			if (diffEditor && monaco) {
				const model = diffEditor.getModel();
				if (model) {
					model.original.setValue(originalContent);
					model.modified.setValue(modifiedContent);
				}
			}

		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load diff';
			originalContent = '';
			modifiedContent = '';
		} finally {
			loading = false;
		}
	}

	async function handleStageToggle() {
		if (isStaging) return;

		isStaging = true;
		try {
			if (isStaged && onUnstage) {
				await onUnstage(filePath);
			} else if (!isStaged && onStage) {
				await onStage(filePath);
			}
		} finally {
			isStaging = false;
		}
	}

	function handleClose() {
		isOpen = false;
		onClose();
	}

	// Handle keyboard shortcuts
	function handleKeyDown(e: KeyboardEvent) {
		if (!isOpen) return;

		// Escape to close
		if (e.key === 'Escape') {
			e.preventDefault();
			handleClose();
		}
	}

	onDestroy(() => {
		themeObserver?.disconnect();
		resizeObserver?.disconnect();
		// Dispose models before editor to prevent orphaned models
		if (diffEditor) {
			const model = diffEditor.getModel();
			if (model) {
				model.original?.dispose();
				model.modified?.dispose();
			}
			diffEditor.dispose();
		}
		diffEditor = null;
		monaco = null;
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if isOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 z-40"
		onclick={handleClose}
		role="button"
		tabindex="-1"
		aria-label="Close diff preview"
	></div>

	<!-- Drawer Panel -->
	<div
		class="fixed right-0 top-0 h-screen w-[900px] max-w-[95vw] z-50 flex flex-col shadow-2xl"
		style="background: oklch(0.14 0.01 250); border-left: 1px solid oklch(0.30 0.02 250);"
		transition:slide={{ axis: 'x', duration: 200 }}
	>
		<!-- Header -->
		<div
			class="flex items-center justify-between px-4 py-3 border-b shrink-0"
			style="background: oklch(0.18 0.01 250); border-color: oklch(0.30 0.02 250);"
		>
			<div class="flex items-center gap-3 min-w-0">
				<!-- Diff icon -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-5 h-5 shrink-0"
					style="color: oklch(0.70 0.18 200);"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
				</svg>

				<!-- File name and path -->
				<div class="min-w-0">
					<h2 class="font-mono text-sm font-semibold truncate" style="color: oklch(0.85 0.02 250);">
						{fileName}
					</h2>
					<p class="text-xs truncate" style="color: oklch(0.50 0.02 250);">
						{filePath}
					</p>
				</div>

				<!-- Stats badges -->
				{#if additions > 0 || deletions > 0}
					<div class="flex items-center gap-2 ml-2">
						{#if additions > 0}
							<span class="badge badge-sm" style="background: oklch(0.45 0.12 145 / 0.3); color: oklch(0.75 0.15 145); border: none;">
								+{additions}
							</span>
						{/if}
						{#if deletions > 0}
							<span class="badge badge-sm" style="background: oklch(0.45 0.12 25 / 0.3); color: oklch(0.75 0.15 25); border: none;">
								-{deletions}
							</span>
						{/if}
					</div>
				{/if}

				<!-- Staged indicator -->
				{#if isStaged}
					<span class="badge badge-sm badge-success">Staged</span>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				<!-- Stage/Unstage button -->
				{#if (onStage && !isStaged) || (onUnstage && isStaged)}
					<button
						onclick={handleStageToggle}
						class="btn btn-xs"
						class:btn-success={!isStaged}
						class:btn-warning={isStaged}
						disabled={isStaging}
						title={isStaged ? 'Unstage this file' : 'Stage this file'}
					>
						{#if isStaging}
							<span class="loading loading-spinner loading-xs"></span>
						{:else if isStaged}
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
							<span>Unstage</span>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
							<span>Stage</span>
						{/if}
					</button>
				{/if}

				<!-- Close button -->
				<button
					onclick={handleClose}
					class="btn btn-xs btn-ghost"
					title="Close (Escape)"
					style="color: oklch(0.55 0.02 250);"
				>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Content Area -->
		<div class="flex-1 overflow-hidden">
			{#if loading || !monacoReady}
				<div class="flex items-center justify-center h-full">
					<div class="flex flex-col items-center gap-3">
						<span class="loading loading-spinner loading-lg" style="color: oklch(0.65 0.15 200);"></span>
						<span class="text-sm font-mono" style="color: oklch(0.55 0.02 250);">Loading diff...</span>
					</div>
				</div>
			{:else if error}
				<div class="flex items-center justify-center h-full p-4">
					<div class="alert alert-error max-w-md">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<div>
							<h3 class="font-bold">Failed to load diff</h3>
							<p class="text-sm">{error}</p>
						</div>
						<button onclick={fetchDiffContent} class="btn btn-sm">Retry</button>
					</div>
				</div>
			{:else if originalContent === '' && modifiedContent === ''}
				<div class="flex items-center justify-center h-full p-4">
					<div class="text-center">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 mx-auto mb-3" style="color: oklch(0.45 0.02 250);">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						<p class="text-sm" style="color: oklch(0.55 0.02 250);">No changes to display</p>
					</div>
				</div>
			{:else}
				<div class="monaco-diff-wrapper" bind:this={containerRef}></div>
			{/if}
		</div>

		<!-- Footer -->
		<div
			class="flex items-center justify-between px-4 py-2 border-t text-xs font-mono shrink-0"
			style="background: oklch(0.16 0.01 250); border-color: oklch(0.30 0.02 250); color: oklch(0.45 0.02 250);"
		>
			<div class="flex items-center gap-3">
				<span>{language()}</span>
				<span>|</span>
				<span>{isStaged ? 'Staged changes' : 'Working tree changes'}</span>
			</div>
			<div class="flex items-center gap-2">
				<span>Esc: Close</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.monaco-diff-wrapper {
		width: 100%;
		height: 100%;
		position: relative;
	}

	/* Ensure Monaco fills the container */
	.monaco-diff-wrapper :global(.monaco-editor),
	.monaco-diff-wrapper :global(.monaco-diff-editor) {
		position: absolute !important;
		inset: 0;
	}
</style>
