<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import loader from '@monaco-editor/loader';
	import type * as Monaco from 'monaco-editor';
	import { getMonacoTheme } from '$lib/utils/themeManager';

	// Props
	let {
		value = $bindable(''),
		language = 'markdown',
		theme = undefined,
		readonly = false,
		onchange = undefined
	}: {
		value?: string;
		language?: string;
		theme?: string;
		readonly?: boolean;
		onchange?: (value: string) => void;
	} = $props();

	// State
	let containerRef: HTMLDivElement | null = $state(null);
	let editor: Monaco.editor.IStandaloneCodeEditor | null = $state(null);
	let monaco: typeof Monaco | null = $state(null);
	let isReady = $state(false);
	let resizeObserver: ResizeObserver | null = null;
	let themeObserver: MutationObserver | null = null;

	// Track the current DaisyUI theme for reactivity
	let daisyTheme = $state('nord');

	// Compute effective theme: use prop if provided, otherwise sync with DaisyUI theme
	const effectiveTheme = $derived(theme ?? getMonacoTheme(daisyTheme));

	// Initialize Monaco Editor
	onMount(async () => {
		// Check container exists AND is attached to DOM (has parentNode)
		if (!containerRef || !containerRef.parentNode) return;

		// Initialize DaisyUI theme from document
		daisyTheme = document.documentElement.getAttribute('data-theme') || 'nord';

		// Watch for DaisyUI theme changes via MutationObserver
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

		try {
			// Load Monaco using the loader
			monaco = await loader.init();

			// Create editor instance
			editor = monaco.editor.create(containerRef, {
				value: value,
				language: language,
				theme: effectiveTheme,
				readOnly: readonly,
				// Editor options per spec
				minimap: { enabled: false },
				wordWrap: 'on',
				lineNumbers: 'on',
				fontSize: 14,
				// Additional helpful options
				scrollBeyondLastLine: false,
				automaticLayout: false, // We handle resize ourselves
				tabSize: 2,
				insertSpaces: false,
				renderWhitespace: 'selection',
				folding: true,
				lineDecorationsWidth: 8,
				lineNumbersMinChars: 3,
				padding: { top: 8, bottom: 8 },
				scrollbar: {
					useShadows: false,
					verticalScrollbarSize: 10,
					horizontalScrollbarSize: 10
				}
			});

			// Listen for content changes
			editor.onDidChangeModelContent(() => {
				const newValue = editor?.getValue() ?? '';
				if (newValue !== value) {
					value = newValue;
					onchange?.(newValue);
				}
			});

			// Set up resize observer for auto-layout
			resizeObserver = new ResizeObserver(() => {
				editor?.layout();
			});
			resizeObserver.observe(containerRef);

			isReady = true;
		} catch (error) {
			console.error('Failed to initialize Monaco Editor:', error);
		}
	});

	// Handle cleanup
	onDestroy(() => {
		themeObserver?.disconnect();
		resizeObserver?.disconnect();
		editor?.dispose();
		editor = null;
		monaco = null;
	});

	// Sync external value changes to editor
	$effect(() => {
		if (editor && isReady) {
			const currentValue = editor.getValue();
			if (value !== currentValue) {
				// Preserve cursor position when syncing external changes
				const position = editor.getPosition();
				editor.setValue(value);
				if (position) {
					editor.setPosition(position);
				}
			}
		}
	});

	// Sync language changes
	$effect(() => {
		if (editor && monaco && isReady) {
			const model = editor.getModel();
			if (model) {
				monaco.editor.setModelLanguage(model, language);
			}
		}
	});

	// Sync theme changes (responds to both prop changes and DaisyUI theme changes)
	$effect(() => {
		if (monaco && isReady) {
			monaco.editor.setTheme(effectiveTheme);
		}
	});

	// Sync readonly changes
	$effect(() => {
		if (editor && isReady) {
			editor.updateOptions({ readOnly: readonly });
		}
	});

	// Expose focus method
	export function focus() {
		editor?.focus();
	}

	// Expose layout method for manual resize triggers
	export function layout() {
		editor?.layout();
	}

	// Track decoration IDs for cleanup
	let highlightDecorations: string[] = [];

	// Expose scroll to line method with highlight animation
	export function scrollToLine(lineNumber: number) {
		if (editor && monaco) {
			// Reveal the line in the center of the editor
			editor.revealLineInCenter(lineNumber);
			// Also set the cursor to that line
			editor.setPosition({ lineNumber, column: 1 });
			// Focus the editor
			editor.focus();

			// Add temporary highlight decoration
			highlightDecorations = editor.deltaDecorations(highlightDecorations, [
				{
					range: new monaco.Range(lineNumber, 1, lineNumber, 1),
					options: {
						isWholeLine: true,
						className: 'search-result-highlight',
						glyphMarginClassName: 'search-result-glyph'
					}
				}
			]);

			// Remove highlight after animation completes (2 seconds)
			setTimeout(() => {
				if (editor) {
					highlightDecorations = editor.deltaDecorations(highlightDecorations, []);
				}
			}, 2000);
		}
	}
</script>

<div class="monaco-wrapper" bind:this={containerRef}>
	{#if !isReady}
		<div class="loading-placeholder">
			<span class="loading loading-spinner loading-md"></span>
			<span class="ml-2 text-base-content/60">Loading editor...</span>
		</div>
	{/if}
</div>

<style>
	.monaco-wrapper {
		width: 100%;
		height: 100%;
		min-height: 200px;
		position: relative;
	}

	.loading-placeholder {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: oklch(0.25 0.02 260);
		border-radius: 0.5rem;
	}

	/* Ensure Monaco fills the container */
	.monaco-wrapper :global(.monaco-editor) {
		position: absolute !important;
		inset: 0;
	}

	/* Search result highlight animation - pulse/flash effect */
	.monaco-wrapper :global(.search-result-highlight) {
		background-color: oklch(0.65 0.18 85 / 0.4) !important;
		animation: search-highlight-pulse 2s ease-out forwards;
	}

	/* Glyph margin indicator */
	.monaco-wrapper :global(.search-result-glyph) {
		background: oklch(0.75 0.18 85);
		width: 4px !important;
		margin-left: 2px;
		border-radius: 2px;
		animation: search-glyph-fade 2s ease-out forwards;
	}

	@keyframes search-highlight-pulse {
		0% {
			background-color: oklch(0.70 0.20 85 / 0.6);
			box-shadow: inset 0 0 20px oklch(0.75 0.18 85 / 0.5);
		}
		15% {
			background-color: oklch(0.65 0.18 85 / 0.5);
			box-shadow: inset 0 0 15px oklch(0.75 0.18 85 / 0.4);
		}
		30% {
			background-color: oklch(0.70 0.20 85 / 0.55);
			box-shadow: inset 0 0 20px oklch(0.75 0.18 85 / 0.45);
		}
		50% {
			background-color: oklch(0.65 0.18 85 / 0.4);
			box-shadow: inset 0 0 12px oklch(0.75 0.18 85 / 0.3);
		}
		100% {
			background-color: oklch(0.65 0.18 85 / 0);
			box-shadow: inset 0 0 0px oklch(0.75 0.18 85 / 0);
		}
	}

	@keyframes search-glyph-fade {
		0% {
			opacity: 1;
			box-shadow: 0 0 8px oklch(0.75 0.18 85 / 0.8);
		}
		50% {
			opacity: 0.8;
			box-shadow: 0 0 4px oklch(0.75 0.18 85 / 0.4);
		}
		100% {
			opacity: 0;
			box-shadow: none;
		}
	}
</style>
