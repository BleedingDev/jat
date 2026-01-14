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

	// ANSI color extraction regex - matches all SGR sequences
	const ANSI_REGEX = /\x1b\[([0-9;]*)m/g;

	// Basic 16-color palette
	const ANSI_COLORS: Record<number, string> = {
		30: '#1a1a1a', 31: '#e74c3c', 32: '#2ecc71', 33: '#f39c12',
		34: '#3498db', 35: '#9b59b6', 36: '#00bcd4', 37: '#ecf0f1',
		90: '#636e72', 91: '#ff6b6b', 92: '#55efc4', 93: '#ffeaa7',
		94: '#74b9ff', 95: '#fd79a8', 96: '#81ecec', 97: '#ffffff'
	};

	// 256-color palette (standard xterm colors)
	function get256Color(n: number): string {
		if (n < 16) {
			// Standard colors - map to our palette
			const map: Record<number, string> = {
				0: '#1a1a1a', 1: '#e74c3c', 2: '#2ecc71', 3: '#f39c12',
				4: '#3498db', 5: '#9b59b6', 6: '#00bcd4', 7: '#ecf0f1',
				8: '#636e72', 9: '#ff6b6b', 10: '#55efc4', 11: '#ffeaa7',
				12: '#74b9ff', 13: '#fd79a8', 14: '#81ecec', 15: '#ffffff'
			};
			return map[n] || '#9ca3af';
		} else if (n < 232) {
			// 216 color cube (6x6x6)
			const idx = n - 16;
			const r = Math.floor(idx / 36) * 51;
			const g = Math.floor((idx % 36) / 6) * 51;
			const b = (idx % 6) * 51;
			return `rgb(${r},${g},${b})`;
		} else {
			// Grayscale (24 shades)
			const gray = (n - 232) * 10 + 8;
			return `rgb(${gray},${gray},${gray})`;
		}
	}

	// Parse ANSI codes and return color
	function parseAnsiCodes(codes: number[]): string | null {
		for (let i = 0; i < codes.length; i++) {
			const code = codes[i];
			if (code === 0) return '#9ca3af'; // Reset
			if (code === 38 && codes[i + 1] === 5) {
				// 256-color: \x1b[38;5;Nm
				return get256Color(codes[i + 2] || 0);
			}
			if (code === 38 && codes[i + 1] === 2) {
				// RGB: \x1b[38;2;R;G;Bm
				const r = codes[i + 2] || 0;
				const g = codes[i + 3] || 0;
				const b = codes[i + 4] || 0;
				return `rgb(${r},${g},${b})`;
			}
			if (ANSI_COLORS[code]) return ANSI_COLORS[code];
		}
		return null;
	}

	// Parse output and extract colored segments per line
	function parseOutputLines(text: string): Array<{ text: string; color: string }[]> {
		const lines = text.split('\n');
		const result: Array<{ text: string; color: string }[]> = [];
		let currentColor = '#9ca3af'; // Default gray - persists across lines

		for (const line of lines) {
			const segments: { text: string; color: string }[] = [];
			let lastIndex = 0;
			let match;

			ANSI_REGEX.lastIndex = 0;

			while ((match = ANSI_REGEX.exec(line)) !== null) {
				// Add text before this escape
				if (match.index > lastIndex) {
					const text = line.slice(lastIndex, match.index);
					if (text) segments.push({ text, color: currentColor });
				}

				// Parse color codes
				const codes = match[1].split(';').map(c => parseInt(c, 10));
				const newColor = parseAnsiCodes(codes);
				if (newColor) currentColor = newColor;

				lastIndex = match.index + match[0].length;
			}

			// Add remaining text
			if (lastIndex < line.length) {
				segments.push({ text: line.slice(lastIndex), color: currentColor });
			}

			result.push(segments.length > 0 ? segments : [{ text: ' ', color: currentColor }]);
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

		// Parse lines
		const lines = parseOutputLines(output);
		const totalLines = lines.length;
		if (totalLines === 0) return;

		// Scale all lines to fit the canvas height
		const scaledLineHeight = height / totalLines;

		// Render all lines scaled to fit
		for (let i = 0; i < totalLines; i++) {
			const segments = lines[i];
			const y = i * scaledLineHeight;
			let x = 2;

			for (const segment of segments) {
				ctx.fillStyle = segment.color;
				const strippedText = stripAnsi(segment.text);

				for (const char of strippedText) {
					if (char !== ' ' && char !== '\t') {
						// Draw pixel for each character, at least 1px tall
						ctx.fillRect(x, y, 1, Math.max(1, scaledLineHeight - 0.5));
					}
					x += 1.2;
					if (x > containerWidth - 4) break;
				}
			}
		}

		// Draw viewport indicator - directly maps to canvas coordinates
		const viewportY = (viewportTop / 100) * height;
		const viewportH = Math.max(10, (viewportHeight / 100) * height);

		ctx.fillStyle = 'rgba(96, 165, 250, 0.25)';
		ctx.fillRect(0, viewportY, containerWidth, viewportH);

		ctx.strokeStyle = 'rgba(96, 165, 250, 0.7)';
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
		background: oklch(0.12 0.01 250);
		overflow: hidden;
		height: 100%;
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
