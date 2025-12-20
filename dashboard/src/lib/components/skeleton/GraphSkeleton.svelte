<script lang="ts">
	/**
	 * GraphSkeleton Component
	 * Shows animated placeholder for the dependency graph visualization
	 */

	interface Props {
		/** Number of node placeholders */
		nodes?: number;
	}

	let { nodes = 8 }: Props = $props();

	// Pre-computed node positions for consistent layout
	const nodePositions = [
		{ x: 20, y: 30, size: 'w-24 h-16' },
		{ x: 50, y: 15, size: 'w-28 h-14' },
		{ x: 75, y: 35, size: 'w-20 h-12' },
		{ x: 30, y: 60, size: 'w-26 h-14' },
		{ x: 60, y: 55, size: 'w-24 h-16' },
		{ x: 85, y: 65, size: 'w-22 h-12' },
		{ x: 15, y: 80, size: 'w-20 h-14' },
		{ x: 45, y: 85, size: 'w-28 h-16' },
	];

	// Edge connections (indices)
	const edges = [
		{ from: 0, to: 1 },
		{ from: 0, to: 3 },
		{ from: 1, to: 2 },
		{ from: 1, to: 4 },
		{ from: 3, to: 4 },
		{ from: 3, to: 6 },
		{ from: 4, to: 5 },
		{ from: 4, to: 7 },
		{ from: 6, to: 7 },
	];
</script>

<!-- Graph Skeleton - Theme-aware -->
<div class="relative w-full h-96 rounded-lg overflow-hidden bg-base-300 border border-base-content/20">
	<!-- Background grid pattern -->
	<div
		class="absolute inset-0 opacity-[0.05]"
		style="
			background-image:
				linear-gradient(currentColor 1px, transparent 1px),
				linear-gradient(90deg, currentColor 1px, transparent 1px);
			background-size: 30px 30px;
		"
	></div>

	<!-- SVG for edges -->
	<svg class="absolute inset-0 w-full h-full opacity-30">
		{#each edges as edge, i}
			{@const from = nodePositions[edge.from]}
			{@const to = nodePositions[edge.to]}
			<line
				x1="{from.x}%"
				y1="{from.y}%"
				x2="{to.x}%"
				y2="{to.y}%"
				class="stroke-primary"
				stroke-width="2"
				stroke-dasharray="5,5"
				style="animation: dashMove 2s linear infinite; animation-delay: {i * 100}ms;"
			/>
		{/each}
	</svg>

	<!-- Node placeholders -->
	{#each nodePositions.slice(0, nodes) as pos, i}
		<div
			class="absolute {pos.size} rounded-lg skeleton bg-base-200 border border-base-content/20"
			style="
				left: {pos.x}%;
				top: {pos.y}%;
				transform: translate(-50%, -50%);
				animation: nodePulse 2s ease-in-out infinite;
				animation-delay: {i * 150}ms;
			"
		>
			<!-- Task ID skeleton -->
			<div class="absolute top-2 left-2">
				<div class="skeleton h-3 w-12 rounded bg-base-content/15"></div>
			</div>
			<!-- Title skeleton -->
			<div class="absolute bottom-2 left-2 right-2">
				<div class="skeleton h-3 w-full rounded bg-base-content/12"></div>
			</div>
		</div>
	{/each}

	<!-- Center loading indicator -->
	<div class="absolute inset-0 flex items-center justify-center">
		<div class="flex flex-col items-center gap-3">
			<div class="w-10 h-10 rounded-full border-2 animate-spin border-primary border-t-transparent"></div>
			<span class="text-xs font-mono text-base-content/50">Loading graph...</span>
		</div>
	</div>
</div>

<style>
	@keyframes nodePulse {
		0%, 100% {
			opacity: 0.6;
			transform: translate(-50%, -50%) scale(1);
		}
		50% {
			opacity: 0.3;
			transform: translate(-50%, -50%) scale(0.98);
		}
	}

	@keyframes dashMove {
		0% {
			stroke-dashoffset: 0;
		}
		100% {
			stroke-dashoffset: 20;
		}
	}
</style>
