<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import * as d3 from 'd3';
	import dagre from '@dagrejs/dagre';
	import { getProjectColor } from '$lib/utils/projectColors';
	import type { Selection } from 'd3';

	interface TaskDep {
		id?: string;
		depends_on_id?: string;
		type?: string;
		title?: string;
		status?: string;
		priority?: number;
	}

	interface Task {
		id: string;
		title?: string;
		status?: string;
		priority?: number;
		project?: string;
		depends_on?: TaskDep[];
	}

	interface GraphNode {
		id: string;
		title: string;
		status: string;
		priority: number;
		project: string;
		isExternal: boolean;
		isReady: boolean;
		isNextUp: boolean;
	}

	interface GraphEdge {
		source: string;
		target: string;
		type: string;
		isExternal: boolean;
	}

	interface Props {
		tasks?: Task[];
		onNodeClick?: ((taskId: string) => void) | null;
	}

	let { tasks = [], onNodeClick = null }: Props = $props();

	let svgElement = $state<SVGSVGElement | null>(null);
	let width = $state(800);
	let height = $state(600);
	let focusedTaskId = $state<string | null>(null);

	const NODE_WIDTH = 280;
	const NODE_HEIGHT = 84;
	const NODE_RADIUS = 10;

	const statusColors: Record<string, string> = {
		open: 'oklch(0.70 0.18 220)', // blue
		in_progress: 'oklch(0.75 0.18 60)', // amber
		closed: 'oklch(0.70 0.18 145)', // green
		blocked: 'oklch(0.65 0.20 30)' // red
	};

	const priorityStroke: Record<number, number> = {
		0: 3.5,
		1: 3,
		2: 2.25,
		3: 1.5,
		4: 1.25,
		99: 1
	};

	const edgeTypeStyle: Record<string, { stroke: string; dash?: string; width?: number }> = {
		depends: { stroke: 'oklch(0.60 0.02 250 / 0.55)', width: 2 },
		blocks: { stroke: 'oklch(0.65 0.20 30 / 0.70)', dash: '6,4', width: 2 }
	};

	function getEdgeStyle(edge: GraphEdge): { stroke: string; strokeWidth: number; dash: string | null } {
		if (edge.isExternal) {
			return {
				stroke: 'oklch(0.60 0.02 250 / 0.35)',
				strokeWidth: 1.5,
				dash: '5,4'
			};
		}

		const base = edgeTypeStyle[edge.type] || edgeTypeStyle.depends;
		const stroke = base.stroke;
		return {
			stroke,
			strokeWidth: base.width ?? 2,
			dash: base.dash ?? null
		};
	}

	function getEdgeLabel(edge: GraphEdge): string {
		// Keep labels minimal (to avoid clutter): only mark external dependencies.
		return edge.isExternal ? 'external' : '';
	}

	function buildGraphModel(): { nodes: GraphNode[]; edges: GraphEdge[] } {
		const nodeMap = new Map<string, GraphNode>();

		// 1) Visible nodes
		for (const task of tasks) {
			nodeMap.set(task.id, {
				id: task.id,
				title: task.title || task.id,
				status: task.status || 'open',
				priority: task.priority ?? 99,
				project: task.project || 'unknown',
				isExternal: false,
				isReady: false,
				isNextUp: false
			});
		}

		// 2) External dependency nodes (pull minimal metadata from depends_on)
		for (const task of tasks) {
			if (!task.depends_on || !Array.isArray(task.depends_on)) continue;
			for (const dep of task.depends_on) {
				const depId = dep.id || dep.depends_on_id;
				if (!depId) continue;
				if (nodeMap.has(depId)) continue;
				nodeMap.set(depId, {
					id: depId,
					title: dep.title || depId,
					status: dep.status || 'open',
					priority: dep.priority ?? 99,
					project: 'unknown',
					isExternal: true,
					isReady: false,
					isNextUp: false
				});
			}
		}

		// Stable ordering helps keep layout deterministic across refreshes
		const nodes = [...nodeMap.values()].sort((a, b) => {
			if (a.priority !== b.priority) return a.priority - b.priority;
			return a.id.localeCompare(b.id);
		});

		const edges: GraphEdge[] = [];
		for (const task of tasks) {
			if (!task.depends_on || !Array.isArray(task.depends_on)) continue;
			for (const dep of task.depends_on) {
				const depId = dep.id || dep.depends_on_id;
				if (!depId) continue;
				if (!nodeMap.has(depId) || !nodeMap.has(task.id)) continue;
				edges.push({
					source: depId,
					target: task.id,
					type: dep.type || 'depends',
					isExternal: nodeMap.get(depId)?.isExternal === true || nodeMap.get(task.id)?.isExternal === true
				});
			}
		}

		// Stable edges ordering keeps layout deterministic
		edges.sort((a, b) => {
			const bySource = a.source.localeCompare(b.source);
			if (bySource !== 0) return bySource;
			const byTarget = a.target.localeCompare(b.target);
			if (byTarget !== 0) return byTarget;
			return a.type.localeCompare(b.type);
		});

		// 3) Derived readiness + next-up (does not affect layout)
		for (const task of tasks) {
			const node = nodeMap.get(task.id);
			if (!node || node.isExternal) continue;
			const deps = task.depends_on || [];
			const allDepsClosed = deps.every((dep) => {
				const depId = dep.id || dep.depends_on_id;
				if (!depId) return true;
				const depNode = nodeMap.get(depId);
				const depStatus = depNode?.status || dep.status || 'open';
				return depStatus === 'closed';
			});
			node.isReady = node.status !== 'closed' && allDepsClosed;
		}

		// Pick one "Next Up" task: highest priority (lowest number) among ready, non-external tasks
		const nextUp = [...nodeMap.values()]
			.filter((n) => !n.isExternal && n.isReady)
			.sort((a, b) => {
				if (a.priority !== b.priority) return a.priority - b.priority;
				return a.id.localeCompare(b.id);
			})[0];

		if (nextUp) {
			const n = nodeMap.get(nextUp.id);
			if (n) n.isNextUp = true;
		}

		return { nodes, edges };
	}

	function layoutGraph(nodes: GraphNode[], edges: GraphEdge[]) {
		const g = new dagre.graphlib.Graph({ multigraph: false })
			.setDefaultEdgeLabel(() => ({}));

		g.setGraph({
			rankdir: 'LR',
			nodesep: 26,
			ranksep: 90,
			marginx: 24,
			marginy: 24
		});

		for (const node of nodes) {
			g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
		}

		// Add edges. Weight slightly higher for non-external edges so the core graph dominates.
		for (const edge of edges) {
			g.setEdge(edge.source, edge.target, {
				weight: edge.isExternal ? 0.5 : 1,
				minlen: edge.isExternal ? 2 : 1
			});
		}

		dagre.layout(g);

		const positionedNodes = nodes.map((n) => {
			const pos = g.node(n.id) as { x: number; y: number } | undefined;
			return {
				...n,
				x: pos?.x ?? 0,
				y: pos?.y ?? 0
			};
		});

		return { nodes: positionedNodes, edges };
	}

	let svgSelection: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
	let zoomRoot: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
	let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
	let nodePositions = new Map<string, { x: number; y: number }>();
	let navOrder: string[] = [];
	let layoutBounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;

	function applyFocusStyles(): void {
		if (!zoomRoot) return;
		const focusId = untrack(() => focusedTaskId);

		const nodesSel = zoomRoot.selectAll<SVGGElement, GraphNode>('g.nodes g.node');
		nodesSel.select<SVGRectElement>('rect.focus-halo')
			.attr('display', (d) => (focusId && d.id === focusId ? null : 'none'));

		// Bring focused node to the top for clearer highlighting
		if (focusId) {
			nodesSel.filter((d) => d.id === focusId).each(function () {
				this.parentNode?.appendChild(this);
			});
		}
	}

	function fitToGraph(): void {
		if (!svgElement || !svgSelection || !zoomBehavior || !layoutBounds) return;
		const { minX, maxX, minY, maxY } = layoutBounds;
		const boundsWidth = Math.max(1, maxX - minX);
		const boundsHeight = Math.max(1, maxY - minY);
		const scale = Math.min(width / boundsWidth, height / boundsHeight, 1);
		const tx = (width - boundsWidth * scale) / 2 - minX * scale;
		const ty = (height - boundsHeight * scale) / 2 - minY * scale;
		svgSelection.call(
			zoomBehavior.transform as unknown as (selection: Selection<SVGSVGElement, unknown, null, undefined>, transform: d3.ZoomTransform) => void,
			d3.zoomIdentity.translate(tx, ty).scale(scale)
		);
	}

	function centerOnNode(id: string): void {
		if (!svgElement || !svgSelection || !zoomBehavior) return;
		const pos = nodePositions.get(id);
		if (!pos) return;

		const current = d3.zoomTransform(svgElement);
		const k = current.k;
		const tx = width / 2 - k * pos.x;
		const ty = height / 2 - k * pos.y;

		svgSelection
			.transition()
			.duration(160)
			.call(
				zoomBehavior.transform as unknown as (selection: Selection<SVGSVGElement, unknown, null, undefined>, transform: d3.ZoomTransform) => void,
				d3.zoomIdentity.translate(tx, ty).scale(k)
			);
	}

	function isEditableTarget(target: EventTarget | null): boolean {
		const el = target as HTMLElement | null;
		if (!el) return false;
		const tag = el.tagName?.toLowerCase();
		return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
	}

	function focusNext(): void {
		if (navOrder.length === 0) return;
		const currentIdx = focusedTaskId ? navOrder.indexOf(focusedTaskId) : -1;
		const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % navOrder.length : 0;
		const nextId = navOrder[nextIdx];
		if (!nextId) return;
		focusedTaskId = nextId;
		centerOnNode(nextId);
	}

	function focusPrev(): void {
		if (navOrder.length === 0) return;
		const currentIdx = focusedTaskId ? navOrder.indexOf(focusedTaskId) : navOrder.length;
		const prevIdx = currentIdx > 0 ? currentIdx - 1 : navOrder.length - 1;
		const prevId = navOrder[prevIdx];
		if (!prevId) return;
		focusedTaskId = prevId;
		centerOnNode(prevId);
	}

	function buildGraph(): void {
		if (!svgElement) return;

		d3.select(svgElement).selectAll('*').remove();
		if (!tasks || tasks.length === 0) return;

		const { nodes: modelNodes, edges: modelEdges } = buildGraphModel();
		const { nodes, edges } = layoutGraph(modelNodes, modelEdges);

		// Compute viewbox bounds from laid-out nodes for a nicer initial fit
		const minX = Math.min(...nodes.map((n) => n.x)) - NODE_WIDTH / 2 - 40;
		const maxX = Math.max(...nodes.map((n) => n.x)) + NODE_WIDTH / 2 + 40;
		const minY = Math.min(...nodes.map((n) => n.y)) - NODE_HEIGHT / 2 - 40;
		const maxY = Math.max(...nodes.map((n) => n.y)) + NODE_HEIGHT / 2 + 40;

		nodePositions = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
		navOrder = [...nodes]
			.sort((a, b) => {
				if (a.x !== b.x) return a.x - b.x;
				if (a.y !== b.y) return a.y - b.y;
				return a.id.localeCompare(b.id);
			})
			.map((n) => n.id);

		layoutBounds = { minX, maxX, minY, maxY };

		// Default focus: next-up task if present, otherwise the first node in navigation order
		// (untracked read so keyboard focus doesn't trigger full graph rebuild)
		const currentFocusId = untrack(() => focusedTaskId);
		if (!currentFocusId || !nodePositions.has(currentFocusId)) {
			const nextUpId = nodes.find((n) => n.isNextUp && !n.isExternal)?.id;
			focusedTaskId = nextUpId || navOrder[0] || null;
		}

		const svg = d3.select(svgElement)
			.attr('width', width)
			.attr('height', height)
			.attr('viewBox', `0 0 ${width} ${height}`)
			.attr('class', 'bg-base-100');

		svgSelection = svg;
		zoomRoot = svg.append('g');

		const zoom = d3.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 4])
			.on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
				zoomRoot?.attr('transform', event.transform.toString());
			});

		zoomBehavior = zoom;
		svg.call(zoom as unknown as (selection: Selection<SVGSVGElement, unknown, null, undefined>) => void);

		// Arrow marker
		svg.append('defs')
			.append('marker')
			.attr('id', 'dag-arrowhead')
			.attr('viewBox', '0 -5 10 10')
			.attr('refX', 12)
			.attr('refY', 0)
			.attr('markerWidth', 6)
			.attr('markerHeight', 6)
			.attr('orient', 'auto')
			.append('path')
			.attr('d', 'M0,-5L10,0L0,5')
			.attr('class', 'fill-base-content/50');

		// Edge paths (simple horizontal link)
		const edgeGroup = zoomRoot.append('g').attr('class', 'edges');
		const nodeById = new Map(nodes.map((n) => [n.id, n]));

		const linkHorizontal = d3.linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>()
			.x((d) => d[0])
			.y((d) => d[1]);

		const edge = edgeGroup.selectAll<SVGGElement, GraphEdge>('g.edge')
			.data(edges)
			.join('g')
			.attr('class', 'edge');

		edge.selectAll('path')
			.data((d) => [d])
			.join('path')
			.attr('d', (e) => {
				const s = nodeById.get(e.source);
				const t = nodeById.get(e.target);
				if (!s || !t) return '';
				const source: [number, number] = [s.x + NODE_WIDTH / 2, s.y];
				const target: [number, number] = [t.x - NODE_WIDTH / 2, t.y];
				return linkHorizontal({ source, target }) || '';
			})
			.attr('fill', 'none')
			.attr('stroke', (e) => getEdgeStyle(e).stroke)
			.attr('stroke-width', (e) => getEdgeStyle(e).strokeWidth)
			.attr('stroke-dasharray', (e) => getEdgeStyle(e).dash)
			.attr('marker-end', 'url(#dag-arrowhead)');

		edge.selectAll('title')
			.data((d) => [d])
			.join('title')
			.text((e) => `${e.source} → ${e.target}\nType: ${e.type}${e.isExternal ? '\n(external dependency)' : ''}`);

		edge.selectAll('text')
			.data((d) => [d])
			.join('text')
			.text((e) => getEdgeLabel(e))
			.attr('display', (e) => (getEdgeLabel(e) ? null : 'none'))
			.attr('class', 'fill-base-content/60 text-[10px] font-mono select-none pointer-events-none')
			.attr('text-anchor', 'middle')
			.attr('x', (e) => {
				const s = nodeById.get(e.source);
				const t = nodeById.get(e.target);
				if (!s || !t) return 0;
				const sx = s.x + NODE_WIDTH / 2;
				const tx2 = t.x - NODE_WIDTH / 2;
				return (sx + tx2) / 2;
			})
			.attr('y', (e) => {
				const s = nodeById.get(e.source);
				const t = nodeById.get(e.target);
				if (!s || !t) return 0;
				return (s.y + t.y) / 2 - 6;
			});

		// Nodes
		const nodeGroup = zoomRoot.append('g').attr('class', 'nodes');
		const node = nodeGroup.selectAll('g')
			.data(nodes)
			.join('g')
			.attr('transform', (d) => `translate(${d.x - NODE_WIDTH / 2}, ${d.y - NODE_HEIGHT / 2})`)
			.attr('class', (d) => `node cursor-pointer${d.isExternal ? ' opacity-75' : ''}`)
			.attr('data-node-id', (d) => d.id)
			.on('click', (event: MouseEvent, d: GraphNode) => {
				event.stopPropagation();
				focusedTaskId = d.id;
				centerOnNode(d.id);
				onNodeClick?.(d.id);
			});

		// Focus halo (toggled via keyboard navigation)
		node.append('rect')
			.attr('class', 'focus-halo')
			.attr('x', -6)
			.attr('y', -6)
			.attr('width', NODE_WIDTH + 12)
			.attr('height', NODE_HEIGHT + 12)
			.attr('rx', NODE_RADIUS + 4)
			.attr('ry', NODE_RADIUS + 4)
			.attr('fill', 'none')
			.attr('stroke', 'oklch(0.70 0.18 220 / 0.70)')
			.attr('stroke-width', 2.25)
			.attr('display', 'none');

		// Readiness halo (drawn behind the card)
		node.append('rect')
			.attr('x', -3)
			.attr('y', -3)
			.attr('width', NODE_WIDTH + 6)
			.attr('height', NODE_HEIGHT + 6)
			.attr('rx', NODE_RADIUS + 2)
			.attr('ry', NODE_RADIUS + 2)
			.attr('fill', 'none')
			.attr('stroke', (d) => (d.isNextUp ? 'oklch(0.75 0.18 60 / 0.85)' : 'oklch(0.70 0.18 145 / 0.65)'))
			.attr('stroke-width', (d) => (d.isNextUp ? 2.75 : 2))
			.attr('display', (d) => (!d.isExternal && d.isReady ? null : 'none'));

		node.append('rect')
			.attr('width', NODE_WIDTH)
			.attr('height', NODE_HEIGHT)
			.attr('rx', NODE_RADIUS)
			.attr('ry', NODE_RADIUS)
			.attr('fill', (d) => {
				if (d.isExternal) return 'oklch(0.22 0.01 250 / 0.50)';
				return d.isReady ? 'oklch(0.24 0.01 250 / 0.80)' : 'oklch(0.22 0.01 250 / 0.70)';
			})
			.attr('stroke', (d) => d.isExternal ? 'oklch(0.60 0.02 250 / 0.55)' : getProjectColor(d.id))
			.attr('stroke-width', (d) => priorityStroke[d.priority] || 1)
			.attr('stroke-dasharray', (d) => (d.isExternal ? '6,4' : null));

		// Status dot
		node.append('circle')
			.attr('cx', 16)
			.attr('cy', 18)
			.attr('r', 6)
			.attr('fill', (d) => statusColors[d.status] || 'oklch(0.60 0.05 250)');

		// Task ID
		node.append('text')
			.attr('x', 28)
			.attr('y', 22)
			.attr('class', 'fill-base-content/70 text-xs font-mono')
			.text((d) => d.id);

		// External badge (header right)
		node.append('text')
			.attr('x', NODE_WIDTH - 16)
			.attr('y', 22)
			.attr('text-anchor', 'end')
			.attr('class', 'fill-base-content/60 text-[10px] font-mono tracking-wider')
			.attr('display', (d) => (d.isExternal ? null : 'none'))
			.text('EXTERNAL');

		// Next-up badge (header right)
		node.append('text')
			.attr('x', NODE_WIDTH - 16)
			.attr('y', 22)
			.attr('text-anchor', 'end')
			.attr('fill', 'oklch(0.75 0.18 60 / 0.85)')
			.attr('class', 'text-[10px] font-mono tracking-wider')
			.attr('display', (d) => (!d.isExternal && d.isNextUp ? null : 'none'))
			.text('NEXT UP');

		// Title (truncate)
		node.append('text')
			.attr('x', 16)
			.attr('y', 46)
			.attr('class', 'fill-base-content text-sm font-semibold')
			.text((d) => {
				const t = d.title || d.id;
				return t.length > 52 ? `${t.slice(0, 49)}...` : t;
			});

		// Footer: status + priority + external badge
		node.append('text')
			.attr('x', 16)
			.attr('y', 68)
			.attr('class', 'fill-base-content/70 text-[11px] font-mono')
			.text((d) => {
				const status = d.status || 'open';
				const pr = d.priority ?? 99;
				const ready = !d.isExternal && d.isReady ? ' • ready' : '';
				const external = d.isExternal ? ' • external' : '';
				return `${status} • P${pr}${ready}${external}`;
			});

		node.append('title').text((d) => `${d.id}\n${d.title}\nStatus: ${d.status}\nPriority: P${d.priority}${d.isExternal ? '\n(external node)' : ''}`);

		// Fit-to-contents initial transform (center graph)
		fitToGraph();
		applyFocusStyles();
	}

	$effect(() => {
		buildGraph();
	});

	$effect(() => {
		focusedTaskId;
		applyFocusStyles();
	});

	onMount(() => {
		const handleResize = () => {
			const container = svgElement?.parentElement;
			if (container) {
				width = container.clientWidth;
				height = Math.max(600, window.innerHeight - 300);
				buildGraph();
			}
		};

		const handleKeydown = (e: KeyboardEvent) => {
			if (e.defaultPrevented) return;
			if (isEditableTarget(e.target)) return;

			if (e.key === 'j' || e.key === 'ArrowDown') {
				e.preventDefault();
				focusNext();
				return;
			}
			if (e.key === 'k' || e.key === 'ArrowUp') {
				e.preventDefault();
				focusPrev();
				return;
			}
			if (e.key === 'f') {
				e.preventDefault();
				fitToGraph();
				return;
			}
			if (e.key === 'c' && focusedTaskId) {
				e.preventDefault();
				centerOnNode(focusedTaskId);
				return;
			}
			if (e.key === 'Enter' && focusedTaskId) {
				e.preventDefault();
				onNodeClick?.(focusedTaskId);
				return;
			}
		};

		window.addEventListener('resize', handleResize);
		window.addEventListener('keydown', handleKeydown);
		handleResize();

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<div class="w-full h-full min-h-[600px] relative">
	<div class="absolute top-4 right-4 z-10 bg-base-100 p-4 rounded-lg border border-base-300 shadow">
		<h3 class="text-sm font-bold mb-2">Legend</h3>
		<div class="space-y-1 text-xs">
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full" style="background-color: {statusColors.open}"></div>
				<span>Open</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full" style="background-color: {statusColors.in_progress}"></div>
				<span>In Progress</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full" style="background-color: {statusColors.closed}"></div>
				<span>Closed</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-4 rounded-full" style="background-color: {statusColors.blocked}"></div>
				<span>Blocked</span>
			</div>
		</div>

		<div class="mt-3 pt-3 border-t border-base-300 space-y-1 text-xs">
			<p class="font-semibold">Border = Priority</p>
			<p>P0: Thick • P3: Thin</p>
		</div>

		<div class="mt-3 pt-3 border-t border-base-300 space-y-1 text-xs">
			<p class="font-semibold">Edges</p>
			<div class="flex items-center gap-2">
				<span class="inline-block w-10 border-t border-base-content/40"></span>
				<span>Depends</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="inline-block w-10 border-t-2 border-error/70 border-dashed"></span>
				<span>Blocks</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="inline-block w-10 border-t border-base-content/30 border-dashed"></span>
				<span>External dep</span>
			</div>
		</div>

		<div class="mt-3 pt-3 border-t border-base-300 space-y-1 text-xs">
			<p class="font-semibold">Nodes</p>
			<div class="flex items-center gap-2">
				<span class="inline-block w-4 h-4 rounded border-2 border-base-content/30 border-dashed"></span>
				<span>External task</span>
			</div>
		</div>

		<div class="mt-3 pt-3 border-t border-base-300 space-y-1 text-xs">
			<p class="font-semibold">Highlights</p>
			<div class="flex items-center gap-2">
				<span class="inline-block w-4 h-4 rounded border-2 border-success/60"></span>
				<span>Ready (deps closed)</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="inline-block w-4 h-4 rounded border-2 border-warning/70"></span>
				<span>Next Up</span>
			</div>
		</div>

		<div class="mt-3 pt-3 border-t border-base-300 space-y-1 text-xs">
			<p class="font-semibold">Keyboard</p>
			<p><span class="font-mono">j/k</span> or <span class="font-mono">↑/↓</span>: move focus</p>
			<p><span class="font-mono">Enter</span>: open task</p>
			<p><span class="font-mono">f</span>: fit graph • <span class="font-mono">c</span>: center</p>
		</div>
	</div>
	<svg bind:this={svgElement} class="w-full h-full"></svg>
</div>
