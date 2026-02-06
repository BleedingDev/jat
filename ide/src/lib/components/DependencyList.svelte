<script lang="ts">
	import { getProjectColor } from '$lib/utils/projectColors';

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

	interface Props {
		tasks?: Task[];
		onNodeClick?: ((taskId: string) => void) | null;
	}

	let { tasks = [], onNodeClick = null }: Props = $props();

	const statusColors: Record<string, string> = {
		open: 'oklch(0.70 0.18 220)', // blue
		in_progress: 'oklch(0.75 0.18 60)', // amber
		closed: 'oklch(0.70 0.18 145)', // green
		blocked: 'oklch(0.65 0.20 30)' // red
	};

	type NodeMeta = {
		id: string;
		title: string;
		status: string;
		priority: number;
		project: string;
		isExternal: boolean;
	};

	type GraphEdge = {
		source: string;
		target: string;
		type: string;
		isExternal: boolean;
	};

	type UnresolvedDep = { id: string; status: string; isExternal: boolean };

	type ListItem = {
		id: string;
		title: string;
		status: string;
		priority: number;
		project: string;
		stage: number;
		isReady: boolean;
		isNextUp: boolean;
		depsTotal: number;
		unresolvedDeps: UnresolvedDep[];
	};

	type StageGroup = {
		stage: number;
		total: number;
		ready: number;
		items: ListItem[];
	};

	function isEditableTarget(target: EventTarget | null): boolean {
		const el = target as HTMLElement | null;
		if (!el) return false;
		const tag = el.tagName?.toLowerCase();
		return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
	}

	function compareNode(a: NodeMeta, b: NodeMeta): number {
		if (a.isExternal !== b.isExternal) return a.isExternal ? -1 : 1;
		if (a.priority !== b.priority) return a.priority - b.priority;
		return a.id.localeCompare(b.id);
	}

	function buildListModel(input: Task[]): { groups: StageGroup[]; warning: string | null } {
		const nodeMap = new Map<string, NodeMeta>();
		const internalIds = new Set<string>();

		for (const task of input) {
			internalIds.add(task.id);
			nodeMap.set(task.id, {
				id: task.id,
				title: task.title || task.id,
				status: task.status || 'open',
				priority: task.priority ?? 99,
				project: task.project || 'unknown',
				isExternal: false
			});
		}

		for (const task of input) {
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

		const edges: GraphEdge[] = [];
		for (const task of input) {
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

		edges.sort((a, b) => {
			const bySource = a.source.localeCompare(b.source);
			if (bySource !== 0) return bySource;
			const byTarget = a.target.localeCompare(b.target);
			if (byTarget !== 0) return byTarget;
			return a.type.localeCompare(b.type);
		});

		const outgoing = new Map<string, string[]>();
		const indegree = new Map<string, number>();
		for (const id of nodeMap.keys()) indegree.set(id, 0);

		for (const edge of edges) {
			const list = outgoing.get(edge.source) ?? [];
			list.push(edge.target);
			outgoing.set(edge.source, list);
			indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
		}

		const stageMap = new Map<string, number>();
		for (const id of nodeMap.keys()) stageMap.set(id, 0);

		const indegreeMutable = new Map(indegree);
		const queue = [...nodeMap.values()].filter((n) => (indegreeMutable.get(n.id) ?? 0) === 0);
		queue.sort(compareNode);

		let processed = 0;
		while (queue.length > 0) {
			const node = queue.shift();
			if (!node) break;
			processed += 1;

			const nextTargets = outgoing.get(node.id) ?? [];
			for (const targetId of nextTargets) {
				const nextStage = (stageMap.get(node.id) ?? 0) + 1;
				if (nextStage > (stageMap.get(targetId) ?? 0)) stageMap.set(targetId, nextStage);

				const nextIndeg = (indegreeMutable.get(targetId) ?? 0) - 1;
				indegreeMutable.set(targetId, nextIndeg);
				if (nextIndeg === 0) {
					queue.push(nodeMap.get(targetId) as NodeMeta);
				}
			}

			if (nextTargets.length > 0) queue.sort(compareNode);
		}

		const hasCycle = processed !== nodeMap.size;

		const minInternalStage = Math.min(
			...input.map((t) => stageMap.get(t.id) ?? 0),
			0
		);

		const items: ListItem[] = input.map((task) => {
			const meta = nodeMap.get(task.id);
			const status = meta?.status || task.status || 'open';
			const deps = task.depends_on || [];
			const unresolvedDeps: UnresolvedDep[] = [];

			for (const dep of deps) {
				const depId = dep.id || dep.depends_on_id;
				if (!depId) continue;
				const depNode = nodeMap.get(depId);
				const depStatus = depNode?.status || dep.status || 'open';
				if (depStatus !== 'closed') {
					unresolvedDeps.push({
						id: depId,
						status: depStatus,
						isExternal: depNode?.isExternal === true
					});
				}
			}

			const isReady = status !== 'closed' && unresolvedDeps.length === 0;

			return {
				id: task.id,
				title: meta?.title || task.title || task.id,
				status,
				priority: meta?.priority ?? task.priority ?? 99,
				project: meta?.project || task.project || 'unknown',
				stage: (stageMap.get(task.id) ?? 0) - minInternalStage,
				isReady,
				isNextUp: false,
				depsTotal: deps.length,
				unresolvedDeps: unresolvedDeps.sort((a, b) => a.id.localeCompare(b.id))
			};
		});

		const nextUp = [...items]
			.filter((i) => i.isReady)
			.sort((a, b) => {
				if (a.priority !== b.priority) return a.priority - b.priority;
				return a.id.localeCompare(b.id);
			})[0];

		if (nextUp) {
			const idx = items.findIndex((i) => i.id === nextUp.id);
			if (idx >= 0) items[idx] = { ...items[idx], isNextUp: true };
		}

		const stageBuckets = new Map<number, ListItem[]>();
		for (const item of items) {
			const list = stageBuckets.get(item.stage) ?? [];
			list.push(item);
			stageBuckets.set(item.stage, list);
		}

		const stages = [...stageBuckets.keys()].sort((a, b) => a - b);
		const groups: StageGroup[] = stages.map((stage) => {
			const stageItems = (stageBuckets.get(stage) ?? []).sort((a, b) => {
				if (a.isNextUp !== b.isNextUp) return a.isNextUp ? -1 : 1;
				if (a.isReady !== b.isReady) return a.isReady ? -1 : 1;
				if (a.priority !== b.priority) return a.priority - b.priority;
				return a.id.localeCompare(b.id);
			});

			return {
				stage,
				total: stageItems.length,
				ready: stageItems.filter((i) => i.isReady).length,
				items: stageItems
			};
		});

		const warning = hasCycle
			? 'Cycle detected in dependencies. Ordering is best-effort.'
			: null;

		return { groups, warning };
	}

	const model = $derived(buildListModel(tasks));

	function handleKeyDown(event: KeyboardEvent, taskId: string): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onNodeClick?.(taskId);
		}
	}

	function renderBlockers(unresolved: UnresolvedDep[]): string {
		if (unresolved.length === 0) return '';
		const head = unresolved.slice(0, 3).map((d) => d.id);
		const more = unresolved.length - head.length;
		return more > 0 ? `${head.join(', ')} +${more}` : head.join(', ');
	}
</script>

<div class="w-full h-full min-h-[600px] relative">
	<div class="absolute top-4 right-4 z-10 bg-base-100 p-4 rounded-lg border border-base-300 shadow max-w-[300px]">
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
			<p class="font-semibold">Highlights</p>
			<div class="flex items-center gap-2">
				<span class="badge badge-success badge-xs">READY</span>
				<span>All deps closed</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="badge badge-warning badge-xs">NEXT UP</span>
				<span>Highest-priority ready task</span>
			</div>
		</div>

		<div class="mt-3 pt-3 border-t border-base-300 space-y-1 text-xs">
			<p class="font-semibold">Keyboard</p>
			<p><span class="font-mono">Enter</span>: open task</p>
			<p><span class="font-mono">g</span>: DAG view • <span class="font-mono">l</span>: List view</p>
		</div>
	</div>

	{#if model.warning}
		<div class="alert alert-warning mb-4">
			<span>{model.warning}</span>
		</div>
	{/if}

	{#if model.groups.length === 0}
		<div class="flex items-center justify-center min-h-[600px] text-base-content/60">
			No tasks to display.
		</div>
	{:else}
		<div class="space-y-3">
			{#each model.groups as group (group.stage)}
				<details open={group.stage <= 1} class="bg-base-100 rounded-lg border border-base-300">
					<summary class="cursor-pointer select-none px-4 py-3 text-sm font-semibold flex items-center gap-3">
						<span class="font-mono">Stage {group.stage}</span>
						<span class="text-xs text-base-content/60">
							{group.total} task{group.total === 1 ? '' : 's'} • {group.ready} ready
						</span>
					</summary>

					<div class="px-4 pb-4 pt-2 space-y-2">
						{#each group.items as item (item.id)}
							<div
								class="card bg-base-100 border border-base-300 hover:shadow-lg transition-shadow cursor-pointer"
								style="border-left: 4px solid {getProjectColor(item.id)};"
								role="button"
								tabindex="0"
								onclick={() => onNodeClick?.(item.id)}
								onkeydown={(e) => !isEditableTarget(e.target) && handleKeyDown(e, item.id)}
							>
								<div class="card-body p-3">
									<div class="flex items-center gap-2 mb-1 flex-wrap">
										<div
											class="w-2.5 h-2.5 rounded-full"
											style="background-color: {statusColors[item.status] || 'oklch(0.60 0.05 250)'}"
										></div>
										<span class="text-xs font-mono text-base-content/70">{item.id}</span>
										<span class="badge badge-outline badge-xs font-mono">
											{item.priority === 99 ? 'P?' : `P${item.priority}`}
										</span>

										{#if item.isNextUp}
											<span class="badge badge-warning badge-xs ml-auto">NEXT UP</span>
										{:else if item.isReady}
											<span class="badge badge-success badge-xs ml-auto">READY</span>
										{:else if item.status === 'blocked'}
											<span class="badge badge-error badge-xs ml-auto">BLOCKED</span>
										{/if}
									</div>

									<div class="text-sm font-semibold line-clamp-1">
										{item.title}
									</div>

									<div class="text-xs text-base-content/60 mt-1 font-mono">
										{item.status} • deps {item.depsTotal}
										{#if item.unresolvedDeps.length > 0}
											• waiting on {renderBlockers(item.unresolvedDeps)}
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</details>
			{/each}
		</div>
	{/if}
</div>
