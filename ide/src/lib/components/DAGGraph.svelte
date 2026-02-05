<script lang="ts">
	import { onMount } from 'svelte';
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
				isExternal: false
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
					isExternal: true
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

		const svg = d3.select(svgElement)
			.attr('width', width)
			.attr('height', height)
			.attr('viewBox', `0 0 ${width} ${height}`)
			.attr('class', 'bg-base-100');

		const zoomRoot = svg.append('g');

		const zoom = d3.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 4])
			.on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
				zoomRoot.attr('transform', event.transform.toString());
			});

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

		edgeGroup.selectAll('path')
			.data(edges)
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
			.attr('stroke', (e) => (e.isExternal ? 'oklch(0.60 0.02 250 / 0.35)' : 'oklch(0.60 0.02 250 / 0.55)'))
			.attr('stroke-width', (e) => (e.isExternal ? 1.5 : 2))
			.attr('stroke-dasharray', (e) => (e.isExternal ? '5,4' : null))
			.attr('marker-end', 'url(#dag-arrowhead)');

		// Nodes
		const nodeGroup = zoomRoot.append('g').attr('class', 'nodes');
		const node = nodeGroup.selectAll('g')
			.data(nodes)
			.join('g')
			.attr('transform', (d) => `translate(${d.x - NODE_WIDTH / 2}, ${d.y - NODE_HEIGHT / 2})`)
			.attr('class', (d) => d.isExternal ? 'cursor-pointer opacity-75' : 'cursor-pointer')
			.on('click', (event: MouseEvent, d: GraphNode) => {
				event.stopPropagation();
				onNodeClick?.(d.id);
			});

		node.append('rect')
			.attr('width', NODE_WIDTH)
			.attr('height', NODE_HEIGHT)
			.attr('rx', NODE_RADIUS)
			.attr('ry', NODE_RADIUS)
			.attr('fill', (d) => d.isExternal ? 'oklch(0.22 0.01 250 / 0.50)' : 'oklch(0.22 0.01 250 / 0.70)')
			.attr('stroke', (d) => getProjectColor(d.id))
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
				return `${status} • P${pr}${d.isExternal ? ' • external' : ''}`;
			});

		node.append('title').text((d) => `${d.id}\n${d.title}\nStatus: ${d.status}\nPriority: P${d.priority}${d.isExternal ? '\n(external node)' : ''}`);

		// Fit-to-contents initial transform (center graph)
		// Use the layout bounds, not the SVG size, for consistent centering.
		const boundsWidth = Math.max(1, maxX - minX);
		const boundsHeight = Math.max(1, maxY - minY);
		const scale = Math.min(width / boundsWidth, height / boundsHeight, 1);
		const tx = (width - boundsWidth * scale) / 2 - minX * scale;
		const ty = (height - boundsHeight * scale) / 2 - minY * scale;
		svg.call(zoom.transform as unknown as (selection: Selection<SVGSVGElement, unknown, null, undefined>) => void, d3.zoomIdentity.translate(tx, ty).scale(scale));
	}

	$effect(() => {
		buildGraph();
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

		window.addEventListener('resize', handleResize);
		handleResize();

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<div class="w-full h-full min-h-[600px] relative">
	<svg bind:this={svgElement} class="w-full h-full"></svg>
</div>

