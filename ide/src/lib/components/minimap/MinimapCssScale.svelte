<script lang="ts">
	/**
	 * CSS Scale Minimap - Uses CSS transform: scale() on a cloned terminal view
	 *
	 * Pros: Real text, preserves ANSI colors, simple implementation
	 * Cons: Can be slow with very long output, may have rendering issues
	 */
	import { ansiToHtml } from '$lib/utils/ansiToHtml';

	let {
		output = '',
		height = 200,
		scale = 0.08,
		onPositionClick = (percent: number) => {}
	}: {
		output: string;
		height?: number;
		scale?: number;
		onPositionClick?: (percent: number) => void;
	} = $props();

	let minimapContainer: HTMLDivElement;
	let contentContainer: HTMLDivElement;
	let viewportIndicator: HTMLDivElement;

	// Track viewport position (0-100%)
	let viewportTop = $state(0);
	let viewportHeight = $state(20); // Percentage of total content visible

	// Derived HTML content
	const htmlContent = $derived(ansiToHtml(output));

	// Calculate content dimensions
	let contentHeight = $state(0);
	let isDragging = $state(false);

	$effect(() => {
		if (contentContainer) {
			// Measure scaled content height
			contentHeight = contentContainer.scrollHeight * scale;
		}
	});

	function handleMinimapClick(e: MouseEvent) {
		if (!minimapContainer) return;

		const rect = minimapContainer.getBoundingClientRect();
		const clickY = e.clientY - rect.top;
		const percent = (clickY / rect.height) * 100;

		onPositionClick(Math.max(0, Math.min(100, percent)));
	}

	function handleDragStart(e: MouseEvent) {
		isDragging = true;
		handleDrag(e);
	}

	function handleDrag(e: MouseEvent) {
		if (!isDragging || !minimapContainer) return;

		const rect = minimapContainer.getBoundingClientRect();
		const dragY = e.clientY - rect.top;
		const percent = (dragY / rect.height) * 100;

		viewportTop = Math.max(0, Math.min(100 - viewportHeight, percent - viewportHeight / 2));
		onPositionClick(viewportTop);
	}

	function handleDragEnd() {
		isDragging = false;
	}

	// Update viewport indicator based on external scroll position
	export function setViewportPosition(scrollPercent: number, visiblePercent: number) {
		viewportTop = scrollPercent;
		viewportHeight = visiblePercent;
	}
</script>

<svelte:window onmousemove={handleDrag} onmouseup={handleDragEnd} />

<div class="minimap-css-scale" style="height: {height}px;">
	<div class="minimap-header">
		<span class="minimap-title">CSS Scale Minimap</span>
		<span class="minimap-scale">Scale: {scale}</span>
	</div>

	<div
		class="minimap-container"
		bind:this={minimapContainer}
		onclick={handleMinimapClick}
		role="slider"
		tabindex="0"
		aria-label="Minimap navigation"
		aria-valuenow={viewportTop}
	>
		<!-- Scaled content clone -->
		<div
			class="minimap-content"
			bind:this={contentContainer}
			style="transform: scale({scale}); transform-origin: top left;"
		>
			<pre class="terminal-output">{@html htmlContent}</pre>
		</div>

		<!-- Viewport indicator -->
		<div
			class="viewport-indicator"
			bind:this={viewportIndicator}
			style="top: {viewportTop}%; height: {viewportHeight}%;"
			onmousedown={handleDragStart}
			role="button"
			tabindex="0"
			aria-label="Drag to scroll"
		></div>
	</div>
</div>

<style>
	.minimap-css-scale {
		display: flex;
		flex-direction: column;
		background: oklch(0.15 0.01 250);
		border: 1px solid oklch(0.25 0.02 250);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.minimap-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: oklch(0.18 0.01 250);
		border-bottom: 1px solid oklch(0.25 0.02 250);
	}

	.minimap-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: oklch(0.85 0.05 200);
	}

	.minimap-scale {
		font-size: 0.65rem;
		color: oklch(0.60 0.02 250);
		font-family: monospace;
	}

	.minimap-container {
		position: relative;
		flex: 1;
		overflow: hidden;
		cursor: pointer;
	}

	.minimap-content {
		position: absolute;
		top: 0;
		left: 0;
		width: 1250%; /* 100% / 0.08 scale = ~1250% to fill width */
		pointer-events: none;
	}

	.terminal-output {
		margin: 0;
		padding: 0.25rem;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 12px;
		line-height: 1.4;
		white-space: pre-wrap;
		word-break: break-all;
		color: oklch(0.85 0.02 250);
	}

	.viewport-indicator {
		position: absolute;
		left: 0;
		right: 0;
		background: oklch(0.60 0.15 220 / 0.3);
		border: 1px solid oklch(0.70 0.18 220 / 0.6);
		border-radius: 2px;
		cursor: grab;
		min-height: 10px;
		transition: background 0.15s ease;
	}

	.viewport-indicator:hover {
		background: oklch(0.65 0.18 220 / 0.4);
	}

	.viewport-indicator:active {
		cursor: grabbing;
		background: oklch(0.70 0.20 220 / 0.5);
	}
</style>
