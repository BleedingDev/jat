<script lang="ts">
	/**
	 * Block-based Minimap - Samples lines and renders as colored bars
	 *
	 * Pros: Good performance, semantic meaning from colors, clean visualization
	 * Cons: Approximation, not actual text
	 *
	 * Color coding:
	 * - Green: Success messages, completions
	 * - Red: Errors, failures
	 * - Yellow/Amber: Warnings, prompts
	 * - Blue: Info, tool calls
	 * - Purple: Claude responses, agent output
	 * - Gray: Regular text
	 */
	import { stripAnsi } from '$lib/utils/ansiToHtml';

	let {
		output = '',
		height = 200,
		barHeight = 3,
		sampleEvery = 1,
		onPositionClick = (percent: number) => {}
	}: {
		output: string;
		height?: number;
		barHeight?: number;
		sampleEvery?: number;
		onPositionClick?: (percent: number) => void;
	} = $props();

	let container: HTMLDivElement;

	// Track viewport position
	let viewportTop = $state(0);
	let viewportHeight = $state(20);
	let isDragging = $state(false);

	// Line classification patterns
	const patterns = {
		error: /error|fail|exception|fatal|panic|ENOENT|EACCES|EPERM|❌|✗/i,
		success: /success|complete|done|passed|✓|✔|✅|🎉/i,
		warning: /warn|caution|notice|⚠|⚡/i,
		info: /info|note|hint|💡|ℹ/i,
		tool: /Tool:|Read|Write|Edit|Bash|Glob|Grep|WebFetch|Task|→/,
		prompt: /\?|Enter|Select|Choose|Option|\[y\/n\]|⎿/,
		claude: /Claude|Assistant|thinking|reasoning|^>/,
		command: /^\$|^>|npm|git|cd |ls |cat |mkdir/,
		header: /^[═╔╗╚╝║─┌┐└┘│┼├┤┬┴]/,
		empty: /^\s*$/
	};

	interface BlockData {
		color: string;
		intensity: number;
		lineIndex: number;
		category: string;
	}

	// Analyze lines and generate block data
	const blocks = $derived.by(() => {
		const lines = output.split('\n');
		const result: BlockData[] = [];

		for (let i = 0; i < lines.length; i += sampleEvery) {
			const line = stripAnsi(lines[i]);
			const trimmedLine = line.trim();

			// Determine category and color
			let color = 'oklch(0.50 0.02 250)'; // Default gray
			let category = 'text';
			let intensity = Math.min(1, trimmedLine.length / 80); // Based on line length

			if (patterns.empty.test(line)) {
				color = 'oklch(0.20 0.01 250)';
				category = 'empty';
				intensity = 0.1;
			} else if (patterns.error.test(line)) {
				color = 'oklch(0.60 0.20 25)'; // Red
				category = 'error';
				intensity = 1;
			} else if (patterns.success.test(line)) {
				color = 'oklch(0.65 0.20 145)'; // Green
				category = 'success';
				intensity = 1;
			} else if (patterns.warning.test(line)) {
				color = 'oklch(0.70 0.18 85)'; // Amber
				category = 'warning';
				intensity = 0.9;
			} else if (patterns.tool.test(line)) {
				color = 'oklch(0.60 0.15 220)'; // Blue
				category = 'tool';
				intensity = 0.8;
			} else if (patterns.prompt.test(line)) {
				color = 'oklch(0.65 0.18 300)'; // Purple
				category = 'prompt';
				intensity = 0.9;
			} else if (patterns.claude.test(line)) {
				color = 'oklch(0.55 0.12 280)'; // Violet
				category = 'claude';
				intensity = 0.7;
			} else if (patterns.command.test(line)) {
				color = 'oklch(0.60 0.10 200)'; // Cyan
				category = 'command';
				intensity = 0.8;
			} else if (patterns.header.test(line)) {
				color = 'oklch(0.45 0.05 250)'; // Dim gray
				category = 'header';
				intensity = 0.5;
			} else if (patterns.info.test(line)) {
				color = 'oklch(0.55 0.10 220)'; // Light blue
				category = 'info';
				intensity = 0.6;
			}

			result.push({
				color,
				intensity,
				lineIndex: i,
				category
			});
		}

		return result;
	});

	// Calculate how many blocks fit
	const visibleBlockCount = $derived(Math.floor((height - 40) / barHeight)); // Subtract header height
	const totalBlocks = $derived(blocks.length);

	// Calculate visible range based on viewport
	const visibleBlocks = $derived.by(() => {
		if (totalBlocks <= visibleBlockCount) {
			return blocks;
		}

		const startPercent = viewportTop / 100;
		const startIndex = Math.floor(startPercent * totalBlocks);
		const endIndex = Math.min(startIndex + visibleBlockCount, totalBlocks);

		return blocks.slice(startIndex, endIndex);
	});

	function handleClick(e: MouseEvent) {
		if (!container) return;

		const rect = container.getBoundingClientRect();
		const clickY = e.clientY - rect.top;
		const percent = (clickY / rect.height) * 100;

		onPositionClick(Math.max(0, Math.min(100, percent)));
	}

	function handleDragStart(e: MouseEvent) {
		isDragging = true;
		handleDrag(e);
	}

	function handleDrag(e: MouseEvent) {
		if (!isDragging || !container) return;

		const rect = container.getBoundingClientRect();
		const dragY = e.clientY - rect.top;
		const percent = (dragY / rect.height) * 100;

		viewportTop = Math.max(0, Math.min(100 - viewportHeight, percent - viewportHeight / 2));
		onPositionClick(viewportTop);
	}

	function handleDragEnd() {
		isDragging = false;
	}

	export function setViewportPosition(scrollPercent: number, visiblePercent: number) {
		viewportTop = scrollPercent;
		viewportHeight = visiblePercent;
	}

	// Category counts for legend
	const categoryCounts = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const block of blocks) {
			counts[block.category] = (counts[block.category] || 0) + 1;
		}
		return counts;
	});
</script>

<svelte:window onmousemove={handleDrag} onmouseup={handleDragEnd} />

<div class="minimap-blocks" style="height: {height}px;">
	<div class="minimap-header">
		<span class="minimap-title">Block Minimap</span>
		<span class="minimap-stats">{totalBlocks} blocks</span>
	</div>

	<div
		class="minimap-container"
		bind:this={container}
		onclick={handleClick}
		role="slider"
		tabindex="0"
		aria-label="Block minimap navigation"
		aria-valuenow={viewportTop}
	>
		<!-- Block bars -->
		<div class="blocks-container">
			{#each visibleBlocks as block, i (block.lineIndex)}
				<div
					class="block-bar"
					style="
						background-color: {block.color};
						opacity: {0.4 + block.intensity * 0.6};
						height: {barHeight}px;
					"
					title="{block.category} (line {block.lineIndex})"
				></div>
			{/each}
		</div>

		<!-- Viewport indicator -->
		<div
			class="viewport-indicator"
			style="top: {viewportTop}%; height: {viewportHeight}%;"
			onmousedown={handleDragStart}
			role="button"
			tabindex="0"
			aria-label="Drag to scroll"
		></div>
	</div>

	<!-- Legend -->
	<div class="minimap-legend">
		{#if categoryCounts.error}
			<span class="legend-item error">{categoryCounts.error} errors</span>
		{/if}
		{#if categoryCounts.success}
			<span class="legend-item success">{categoryCounts.success} success</span>
		{/if}
		{#if categoryCounts.warning}
			<span class="legend-item warning">{categoryCounts.warning} warnings</span>
		{/if}
		{#if categoryCounts.tool}
			<span class="legend-item tool">{categoryCounts.tool} tools</span>
		{/if}
		{#if categoryCounts.prompt}
			<span class="legend-item prompt">{categoryCounts.prompt} prompts</span>
		{/if}
	</div>
</div>

<style>
	.minimap-blocks {
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
		color: oklch(0.75 0.15 300);
	}

	.minimap-stats {
		font-size: 0.65rem;
		color: oklch(0.60 0.02 250);
		font-family: monospace;
	}

	.minimap-container {
		position: relative;
		flex: 1;
		cursor: pointer;
		overflow: hidden;
	}

	.blocks-container {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 2px;
	}

	.block-bar {
		width: 100%;
		border-radius: 1px;
		transition: opacity 0.1s ease;
	}

	.block-bar:hover {
		opacity: 1 !important;
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

	.minimap-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: oklch(0.14 0.01 250);
		border-top: 1px solid oklch(0.22 0.02 250);
		font-size: 0.6rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-family: monospace;
	}

	.legend-item::before {
		content: '';
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}

	.legend-item.error::before {
		background: oklch(0.60 0.20 25);
	}
	.legend-item.error {
		color: oklch(0.70 0.15 25);
	}

	.legend-item.success::before {
		background: oklch(0.65 0.20 145);
	}
	.legend-item.success {
		color: oklch(0.75 0.15 145);
	}

	.legend-item.warning::before {
		background: oklch(0.70 0.18 85);
	}
	.legend-item.warning {
		color: oklch(0.80 0.12 85);
	}

	.legend-item.tool::before {
		background: oklch(0.60 0.15 220);
	}
	.legend-item.tool {
		color: oklch(0.70 0.12 220);
	}

	.legend-item.prompt::before {
		background: oklch(0.65 0.18 300);
	}
	.legend-item.prompt {
		color: oklch(0.75 0.12 300);
	}
</style>
