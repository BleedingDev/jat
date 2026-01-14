<script lang="ts">
	/**
	 * Canvas Minimap - Renders text to canvas at tiny scale (VS Code style)
	 *
	 * Pros: Fast, handles huge outputs, smooth rendering
	 * Cons: More complex, loses text fidelity at small scales
	 */
	import { stripAnsi } from '$lib/utils/ansiToHtml';

	let {
		output = '',
		height = 200,
		lineHeight = 2,
		onPositionClick = (percent: number) => {}
	}: {
		output: string;
		height?: number;
		lineHeight?: number;
		onPositionClick?: (percent: number) => void;
	} = $props();

	let canvas: HTMLCanvasElement;
	let container: HTMLDivElement;

	// Track viewport position
	let viewportTop = $state(0);
	let viewportHeight = $state(20);
	let isDragging = $state(false);

	// ANSI color extraction regex
	const ANSI_COLOR_REGEX = /\x1b\[([0-9;]*)m/g;

	// Color palette for ANSI codes
	const ANSI_COLORS: Record<number, string> = {
		30: '#1a1a1a', 31: '#e74c3c', 32: '#2ecc71', 33: '#f39c12',
		34: '#3498db', 35: '#9b59b6', 36: '#00bcd4', 37: '#ecf0f1',
		90: '#636e72', 91: '#ff6b6b', 92: '#55efc4', 93: '#ffeaa7',
		94: '#74b9ff', 95: '#fd79a8', 96: '#81ecec', 97: '#ffffff'
	};

	// Parse output and extract colored segments per line
	function parseOutputLines(text: string): Array<{ text: string; color: string }[]> {
		const lines = text.split('\n');
		const result: Array<{ text: string; color: string }[]> = [];

		for (const line of lines) {
			const segments: { text: string; color: string }[] = [];
			let currentColor = '#9ca3af'; // Default gray
			let lastIndex = 0;
			let match;

			ANSI_COLOR_REGEX.lastIndex = 0;

			while ((match = ANSI_COLOR_REGEX.exec(line)) !== null) {
				// Add text before this escape
				if (match.index > lastIndex) {
					const text = line.slice(lastIndex, match.index);
					if (text) segments.push({ text, color: currentColor });
				}

				// Parse color code
				const codes = match[1].split(';').map(c => parseInt(c, 10));
				for (const code of codes) {
					if (code === 0) currentColor = '#9ca3af';
					else if (ANSI_COLORS[code]) currentColor = ANSI_COLORS[code];
				}

				lastIndex = match.index + match[0].length;
			}

			// Add remaining text
			if (lastIndex < line.length) {
				segments.push({ text: line.slice(lastIndex), color: currentColor });
			}

			result.push(segments.length > 0 ? segments : [{ text: ' ', color: '#9ca3af' }]);
		}

		return result;
	}

	// Render to canvas
	function renderCanvas() {
		if (!canvas || !container) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const containerWidth = container.clientWidth;
		const dpr = window.devicePixelRatio || 1;

		// Set canvas size
		canvas.width = containerWidth * dpr;
		canvas.height = height * dpr;
		canvas.style.width = `${containerWidth}px`;
		canvas.style.height = `${height}px`;

		ctx.scale(dpr, dpr);

		// Clear canvas
		ctx.fillStyle = 'oklch(0.12 0.01 250)';
		ctx.fillRect(0, 0, containerWidth, height);

		// Parse and render lines
		const lines = parseOutputLines(output);
		const totalLines = lines.length;
		const visibleLines = Math.floor(height / lineHeight);

		// Calculate which lines to show (centered around viewport)
		const startLine = Math.max(0, Math.floor((viewportTop / 100) * totalLines) - visibleLines / 2);

		let y = 0;
		for (let i = startLine; i < lines.length && y < height; i++) {
			const segments = lines[i];
			let x = 2;

			for (const segment of segments) {
				// Render each character as a small rectangle
				ctx.fillStyle = segment.color;
				const strippedText = stripAnsi(segment.text);

				for (const char of strippedText) {
					if (char !== ' ' && char !== '\t') {
						// Draw a tiny pixel for each character
						ctx.fillRect(x, y, 1, lineHeight - 1);
					}
					x += 1.2; // Character width
					if (x > containerWidth - 4) break;
				}
			}

			y += lineHeight;
		}

		// Draw viewport indicator
		const viewportY = (viewportTop / 100) * height;
		const viewportH = Math.max(10, (viewportHeight / 100) * height);

		ctx.fillStyle = 'rgba(96, 165, 250, 0.2)';
		ctx.fillRect(0, viewportY, containerWidth, viewportH);

		ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
		ctx.lineWidth = 1;
		ctx.strokeRect(0.5, viewportY + 0.5, containerWidth - 1, viewportH - 1);
	}

	// Re-render when output or dimensions change
	$effect(() => {
		if (output && canvas) {
			renderCanvas();
		}
	});

	// Handle window resize
	$effect(() => {
		const handleResize = () => renderCanvas();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
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
		renderCanvas();
	}

	function handleDragEnd() {
		isDragging = false;
	}

	export function setViewportPosition(scrollPercent: number, visiblePercent: number) {
		viewportTop = scrollPercent;
		viewportHeight = visiblePercent;
		renderCanvas();
	}
</script>

<svelte:window onmousemove={handleDrag} onmouseup={handleDragEnd} />

<div class="minimap-canvas" style="height: {height}px;">
	<div class="minimap-header">
		<span class="minimap-title">Canvas Minimap</span>
		<span class="minimap-info">Line height: {lineHeight}px</span>
	</div>

	<div
		class="minimap-container"
		bind:this={container}
		onclick={handleClick}
		onmousedown={handleDragStart}
		role="slider"
		tabindex="0"
		aria-label="Canvas minimap navigation"
		aria-valuenow={viewportTop}
	>
		<canvas bind:this={canvas}></canvas>
	</div>
</div>

<style>
	.minimap-canvas {
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
		color: oklch(0.75 0.12 145);
	}

	.minimap-info {
		font-size: 0.65rem;
		color: oklch(0.60 0.02 250);
		font-family: monospace;
	}

	.minimap-container {
		position: relative;
		flex: 1;
		cursor: pointer;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
