<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		AgentRoutingRule,
		RoutingCondition,
		RoutingConditionType,
		RoutingOperator
	} from '$lib/types/agentProgram';

	// Condition types with labels
	const CONDITION_TYPES: { value: RoutingConditionType; label: string; icon: string }[] = [
		{
			value: 'label',
			label: 'Label',
			icon: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z'
		},
		{
			value: 'type',
			label: 'Type',
			icon: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z'
		},
		{
			value: 'priority',
			label: 'Priority',
			icon: 'M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21l3.75-3.75'
		},
		{
			value: 'project',
			label: 'Project',
			icon: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
		},
		{
			value: 'epic',
			label: 'Epic',
			icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z'
		}
	];

	// Operators by condition type
	const OPERATORS_BY_TYPE: Record<RoutingConditionType, { value: RoutingOperator; label: string }[]> =
		{
			label: [
				{ value: 'contains', label: 'contains' },
				{ value: 'equals', label: 'equals' },
				{ value: 'startsWith', label: 'starts with' },
				{ value: 'regex', label: 'regex' }
			],
			type: [
				{ value: 'equals', label: 'equals' },
				{ value: 'contains', label: 'contains' },
				{ value: 'regex', label: 'regex' }
			],
			priority: [
				{ value: 'equals', label: 'equals' },
				{ value: 'lte', label: '<=' },
				{ value: 'lt', label: '<' },
				{ value: 'gte', label: '>=' },
				{ value: 'gt', label: '>' }
			],
			project: [
				{ value: 'equals', label: 'equals' },
				{ value: 'contains', label: 'contains' },
				{ value: 'startsWith', label: 'starts with' },
				{ value: 'regex', label: 'regex' }
			],
			epic: [
				{ value: 'equals', label: 'equals' },
				{ value: 'contains', label: 'contains' },
				{ value: 'startsWith', label: 'starts with' },
				{ value: 'regex', label: 'regex' }
			]
		};

	// Task types for dropdown
	const TASK_TYPES = ['bug', 'feature', 'task', 'chore', 'epic'];

	// Priority options
	const PRIORITIES = [
		{ value: '0', label: 'P0 (Critical)' },
		{ value: '1', label: 'P1 (High)' },
		{ value: '2', label: 'P2 (Medium)' },
		{ value: '3', label: 'P3 (Low)' },
		{ value: '4', label: 'P4 (Lowest)' }
	];

	// Agent info type from API
	interface AgentInfo {
		id: string;
		name: string;
		isDefault?: boolean;
		models: { shortName: string; name: string }[];
	}

	// Component state
	let rules = $state<AgentRoutingRule[]>([]);
	let agents = $state<AgentInfo[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let hasChanges = $state(false);

	// Editing state
	let editingRule = $state<AgentRoutingRule | null>(null);
	let isNewRule = $state(false);

	// Preview state
	let previewTask = $state<{
		type: string;
		labels: string;
		priority: string;
		project: string;
		epic: string;
	}>({
		type: 'task',
		labels: '',
		priority: '2',
		project: '',
		epic: ''
	});
	let previewResult = $state<{
		agentId: string;
		agentName: string;
		modelName: string;
		matchedRule: { id: string; name: string } | null;
		reason: string;
	} | null>(null);
	let previewLoading = $state(false);

	// Drag and drop state
	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	// Load rules on mount
	onMount(async () => {
		await loadRules();
	});

	async function loadRules() {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/config/agents/routing');
			if (!response.ok) {
				throw new Error(`Failed to load rules: ${response.statusText}`);
			}
			const data = await response.json();
			rules = data.rules ?? [];
			agents = data.agents ?? [];
			hasChanges = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load rules';
		} finally {
			loading = false;
		}
	}

	async function saveRules() {
		saving = true;
		error = null;
		try {
			const response = await fetch('/api/config/agents/routing', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rules })
			});
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || `Failed to save rules: ${response.statusText}`);
			}
			const result = await response.json();
			rules = result.rules ?? [];
			hasChanges = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save rules';
		} finally {
			saving = false;
		}
	}

	function generateId(): string {
		return 'rule-' + Math.random().toString(36).substring(2, 9);
	}

	function startNewRule() {
		const defaultAgent = agents.find((a) => a.isDefault) ?? agents[0];
		editingRule = {
			id: generateId(),
			name: '',
			description: '',
			conditions: [],
			agentId: defaultAgent?.id ?? '',
			modelOverride: undefined,
			enabled: true,
			order: rules.length
		};
		isNewRule = true;
	}

	function startEditRule(rule: AgentRoutingRule) {
		editingRule = JSON.parse(JSON.stringify(rule)); // Deep clone
		isNewRule = false;
	}

	function cancelEdit() {
		editingRule = null;
		isNewRule = false;
	}

	function saveRule() {
		if (!editingRule) return;

		if (!editingRule.name.trim()) {
			error = 'Rule name is required';
			return;
		}

		if (!editingRule.agentId) {
			error = 'Agent selection is required';
			return;
		}

		if (isNewRule) {
			rules = [...rules, editingRule];
		} else {
			const index = rules.findIndex((r) => r.id === editingRule!.id);
			if (index >= 0) {
				rules[index] = editingRule;
				rules = [...rules];
			}
		}

		hasChanges = true;
		editingRule = null;
		isNewRule = false;
		error = null;
	}

	function deleteRule(ruleId: string) {
		rules = rules.filter((r) => r.id !== ruleId);
		hasChanges = true;
	}

	function toggleRuleEnabled(ruleId: string) {
		const index = rules.findIndex((r) => r.id === ruleId);
		if (index >= 0) {
			rules[index] = { ...rules[index], enabled: !rules[index].enabled };
			rules = [...rules];
			hasChanges = true;
		}
	}

	function addCondition() {
		if (!editingRule) return;
		const newCondition: RoutingCondition = {
			type: 'label',
			operator: 'contains',
			value: ''
		};
		editingRule.conditions = [...editingRule.conditions, newCondition];
	}

	function removeCondition(index: number) {
		if (!editingRule) return;
		editingRule.conditions = editingRule.conditions.filter((_, i) => i !== index);
	}

	function updateCondition(index: number, field: keyof RoutingCondition, value: string) {
		if (!editingRule) return;
		const condition = { ...editingRule.conditions[index] };

		if (field === 'type') {
			condition.type = value as RoutingConditionType;
			// Reset operator to first valid one for new type
			const validOperators = OPERATORS_BY_TYPE[condition.type];
			condition.operator = validOperators[0].value;
			condition.value = '';
		} else if (field === 'operator') {
			condition.operator = value as RoutingOperator;
		} else {
			condition.value = value;
		}

		editingRule.conditions[index] = condition;
		editingRule.conditions = [...editingRule.conditions];
	}

	// Drag and drop handlers
	function handleDragStart(index: number) {
		draggedIndex = index;
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (draggedIndex !== null && draggedIndex !== index) {
			dragOverIndex = index;
		}
	}

	function handleDragEnd() {
		if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
			const newRules = [...rules];
			const [dragged] = newRules.splice(draggedIndex, 1);
			newRules.splice(dragOverIndex, 0, dragged);
			// Update order
			rules = newRules.map((r, i) => ({ ...r, order: i }));
			hasChanges = true;
		}
		draggedIndex = null;
		dragOverIndex = null;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	// Preview evaluation
	async function evaluatePreview() {
		previewLoading = true;
		previewResult = null;
		try {
			const response = await fetch('/api/config/agents/routing', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					task: {
						type: previewTask.type,
						labels: previewTask.labels
							.split(',')
							.map((l) => l.trim())
							.filter(Boolean),
						priority: parseInt(previewTask.priority, 10),
						project: previewTask.project || undefined,
						epic: previewTask.epic || undefined
					}
				})
			});
			if (response.ok) {
				const data = await response.json();
				previewResult = data.result;
			}
		} catch {
			// Ignore preview errors
		} finally {
			previewLoading = false;
		}
	}

	// Get agent name by ID
	function getAgentName(agentId: string): string {
		const agent = agents.find((a) => a.id === agentId);
		return agent?.name ?? agentId;
	}

	// Get models for selected agent
	function getModelsForAgent(agentId: string): { shortName: string; name: string }[] {
		const agent = agents.find((a) => a.id === agentId);
		return agent?.models ?? [];
	}

	// Format condition for display
	function formatCondition(condition: RoutingCondition): string {
		const typeLabel = CONDITION_TYPES.find((t) => t.value === condition.type)?.label ?? condition.type;
		const operatorLabel =
			OPERATORS_BY_TYPE[condition.type]?.find((o) => o.value === condition.operator)?.label ??
			condition.operator;
		return `${typeLabel} ${operatorLabel} "${condition.value}"`;
	}
</script>

<div class="card bg-base-200 shadow-sm">
	<div class="card-body p-4">
		<div class="flex items-center justify-between mb-4">
			<h3 class="card-title text-base">Routing Rules</h3>
			<div class="flex items-center gap-2">
				{#if hasChanges}
					<span class="badge badge-warning badge-sm">Unsaved changes</span>
				{/if}
				<button class="btn btn-ghost btn-sm" onclick={loadRules} disabled={loading || saving} title="Reload">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="w-4 h-4"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
						/>
					</svg>
				</button>
				{#if hasChanges}
					<button class="btn btn-primary btn-sm" onclick={saveRules} disabled={loading || saving}>
						{#if saving}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							Save
						{/if}
					</button>
				{/if}
			</div>
		</div>

		{#if error}
			<div class="alert alert-error mb-4">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="stroke-current shrink-0 h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span class="text-sm">{error}</span>
				<button class="btn btn-ghost btn-xs" onclick={() => (error = null)}>Dismiss</button>
			</div>
		{/if}

		{#if loading}
			<div class="flex justify-center py-8">
				<span class="loading loading-spinner loading-md"></span>
			</div>
		{:else}
			<!-- Rules List -->
			<div class="space-y-2 mb-4">
				{#if rules.length === 0}
					<div class="text-center py-6 text-base-content/50">
						<p>No routing rules configured.</p>
						<p class="text-xs mt-1">All tasks will use the default agent.</p>
					</div>
				{:else}
					<div class="text-xs opacity-60 mb-2">
						Drag to reorder. First matching rule wins.
					</div>
					{#each rules as rule, index (rule.id)}
						<div
							class="bg-base-100 rounded-lg border border-base-300 transition-all {dragOverIndex === index
								? 'border-primary border-2'
								: ''} {!rule.enabled ? 'opacity-50' : ''}"
							draggable="true"
							ondragstart={() => handleDragStart(index)}
							ondragover={(e) => handleDragOver(e, index)}
							ondragend={handleDragEnd}
							ondragleave={handleDragLeave}
							role="listitem"
						>
							<div class="flex items-center gap-3 p-3">
								<!-- Drag handle -->
								<div class="cursor-grab opacity-40 hover:opacity-100">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="w-4 h-4"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
										/>
									</svg>
								</div>

								<!-- Rule info -->
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<span class="font-medium text-sm truncate">{rule.name}</span>
										<span class="badge badge-ghost badge-xs">{index + 1}</span>
									</div>
									{#if rule.conditions.length > 0}
										<div class="text-xs opacity-60 truncate mt-0.5">
											{rule.conditions.map(formatCondition).join(' AND ')}
										</div>
									{:else}
										<div class="text-xs opacity-40 italic mt-0.5">Matches all tasks</div>
									{/if}
								</div>

								<!-- Agent badge -->
								<div class="flex items-center gap-1.5">
									<span class="badge badge-outline badge-sm">{getAgentName(rule.agentId)}</span>
									{#if rule.modelOverride}
										<span class="badge badge-ghost badge-xs">{rule.modelOverride}</span>
									{/if}
								</div>

								<!-- Actions -->
								<div class="flex items-center gap-1">
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => toggleRuleEnabled(rule.id)}
										title={rule.enabled ? 'Disable' : 'Enable'}
									>
										{#if rule.enabled}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												stroke-width="1.5"
												stroke="currentColor"
												class="w-4 h-4 text-success"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.573-3.007-9.963-7.178z"
												/>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
												/>
											</svg>
										{:else}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												stroke-width="1.5"
												stroke="currentColor"
												class="w-4 h-4 opacity-40"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
												/>
											</svg>
										{/if}
									</button>
									<button
										class="btn btn-ghost btn-xs"
										onclick={() => startEditRule(rule)}
										title="Edit"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.5"
											stroke="currentColor"
											class="w-4 h-4"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
											/>
										</svg>
									</button>
									<button
										class="btn btn-ghost btn-xs text-error"
										onclick={() => deleteRule(rule.id)}
										title="Delete"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.5"
											stroke="currentColor"
											class="w-4 h-4"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
											/>
										</svg>
									</button>
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Add Rule Button -->
			<button class="btn btn-outline btn-sm w-full" onclick={startNewRule} disabled={!agents.length}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-4 h-4"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				Add Rule
			</button>

			<!-- Preview Section -->
			<div class="divider text-xs opacity-60">Preview</div>
			<div class="bg-base-100 rounded-lg p-3">
				<div class="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
					<div class="form-control">
						<label class="label py-0.5">
							<span class="label-text text-xs">Type</span>
						</label>
						<select
							class="select select-bordered select-xs"
							bind:value={previewTask.type}
							onchange={evaluatePreview}
						>
							{#each TASK_TYPES as t}
								<option value={t}>{t}</option>
							{/each}
						</select>
					</div>
					<div class="form-control">
						<label class="label py-0.5">
							<span class="label-text text-xs">Priority</span>
						</label>
						<select
							class="select select-bordered select-xs"
							bind:value={previewTask.priority}
							onchange={evaluatePreview}
						>
							{#each PRIORITIES as p}
								<option value={p.value}>{p.label}</option>
							{/each}
						</select>
					</div>
					<div class="form-control">
						<label class="label py-0.5">
							<span class="label-text text-xs">Labels</span>
						</label>
						<input
							type="text"
							class="input input-bordered input-xs"
							bind:value={previewTask.labels}
							placeholder="comma-separated"
							onchange={evaluatePreview}
						/>
					</div>
					<div class="form-control">
						<label class="label py-0.5">
							<span class="label-text text-xs">Project</span>
						</label>
						<input
							type="text"
							class="input input-bordered input-xs"
							bind:value={previewTask.project}
							placeholder="optional"
							onchange={evaluatePreview}
						/>
					</div>
					<div class="form-control">
						<label class="label py-0.5">
							<span class="label-text text-xs">Epic</span>
						</label>
						<input
							type="text"
							class="input input-bordered input-xs"
							bind:value={previewTask.epic}
							placeholder="optional"
							onchange={evaluatePreview}
						/>
					</div>
				</div>
				<button class="btn btn-sm btn-ghost w-full" onclick={evaluatePreview} disabled={previewLoading}>
					{#if previewLoading}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						Test Routing
					{/if}
				</button>
				{#if previewResult}
					<div class="mt-2 p-2 bg-base-200 rounded text-xs">
						<div class="flex items-center gap-2">
							<span class="font-medium">Result:</span>
							<span class="badge badge-primary badge-sm">{previewResult.agentName}</span>
							<span class="badge badge-ghost badge-xs">{previewResult.modelName}</span>
						</div>
						<div class="opacity-60 mt-1">{previewResult.reason}</div>
					</div>
				{/if}
			</div>

			<!-- Fallback indicator -->
			<div class="mt-3 text-xs opacity-60 flex items-center gap-1">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-3.5 h-3.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
					/>
				</svg>
				Tasks not matching any rule use the default agent.
			</div>
		{/if}
	</div>
</div>

<!-- Edit/Create Rule Modal -->
{#if editingRule}
	<div class="modal modal-open">
		<div class="modal-box max-w-xl">
			<h3 class="font-bold text-lg mb-4">{isNewRule ? 'Add Rule' : 'Edit Rule'}</h3>

			<div class="space-y-4">
				<!-- Rule Name -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-semibold">Rule Name</span>
					</label>
					<input
						type="text"
						class="input input-bordered"
						bind:value={editingRule.name}
						placeholder="e.g., Security tasks to Opus"
					/>
				</div>

				<!-- Description -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Description (optional)</span>
					</label>
					<input
						type="text"
						class="input input-bordered input-sm"
						bind:value={editingRule.description}
						placeholder="When this rule applies..."
					/>
				</div>

				<!-- Conditions -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-semibold">Conditions</span>
						<span class="label-text-alt opacity-60">All must match (AND)</span>
					</label>
					<div class="space-y-2">
						{#if editingRule.conditions.length === 0}
							<div class="text-xs opacity-60 py-2 text-center">
								No conditions = matches all tasks
							</div>
						{/if}
						{#each editingRule.conditions as condition, index}
							<div class="flex items-center gap-2 bg-base-200 rounded-lg p-2">
								<!-- Type selector -->
								<select
									class="select select-bordered select-sm flex-shrink-0"
									value={condition.type}
									onchange={(e) => updateCondition(index, 'type', e.currentTarget.value)}
								>
									{#each CONDITION_TYPES as ct}
										<option value={ct.value}>{ct.label}</option>
									{/each}
								</select>

								<!-- Operator selector -->
								<select
									class="select select-bordered select-sm flex-shrink-0"
									value={condition.operator}
									onchange={(e) => updateCondition(index, 'operator', e.currentTarget.value)}
								>
									{#each OPERATORS_BY_TYPE[condition.type] as op}
										<option value={op.value}>{op.label}</option>
									{/each}
								</select>

								<!-- Value input (varies by type) -->
								{#if condition.type === 'type'}
									<select
										class="select select-bordered select-sm flex-1"
										value={condition.value}
										onchange={(e) => updateCondition(index, 'value', e.currentTarget.value)}
									>
										<option value="">Select type...</option>
										{#each TASK_TYPES as t}
											<option value={t}>{t}</option>
										{/each}
									</select>
								{:else if condition.type === 'priority'}
									<select
										class="select select-bordered select-sm flex-1"
										value={condition.value}
										onchange={(e) => updateCondition(index, 'value', e.currentTarget.value)}
									>
										<option value="">Select priority...</option>
										{#each PRIORITIES as p}
											<option value={p.value}>{p.label}</option>
										{/each}
									</select>
								{:else}
									<input
										type="text"
										class="input input-bordered input-sm flex-1"
										value={condition.value}
										oninput={(e) => updateCondition(index, 'value', e.currentTarget.value)}
										placeholder={condition.type === 'label'
											? 'e.g., security'
											: condition.type === 'project'
												? 'e.g., chimaro'
												: 'value'}
									/>
								{/if}

								<!-- Remove button -->
								<button
									class="btn btn-ghost btn-sm btn-square text-error"
									onclick={() => removeCondition(index)}
									title="Remove condition"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="w-4 h-4"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						{/each}
						<button class="btn btn-ghost btn-sm w-full" onclick={addCondition}>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								class="w-4 h-4"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
							</svg>
							Add Condition
						</button>
					</div>
				</div>

				<!-- Agent Selection -->
				<div class="form-control">
					<label class="label">
						<span class="label-text font-semibold">Route to Agent</span>
					</label>
					<select class="select select-bordered" bind:value={editingRule.agentId}>
						{#each agents as agent}
							<option value={agent.id}>{agent.name}</option>
						{/each}
					</select>
				</div>

				<!-- Model Override -->
				<div class="form-control">
					<label class="label">
						<span class="label-text">Model Override (optional)</span>
						<span class="label-text-alt opacity-60">Leave empty for agent's default</span>
					</label>
					<select class="select select-bordered select-sm" bind:value={editingRule.modelOverride}>
						<option value={undefined}>Use agent default</option>
						{#each getModelsForAgent(editingRule.agentId) as model}
							<option value={model.shortName}>{model.name} ({model.shortName})</option>
						{/each}
					</select>
				</div>

				<!-- Enabled toggle -->
				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3">
						<input type="checkbox" class="toggle toggle-primary" bind:checked={editingRule.enabled} />
						<span class="label-text">Enabled</span>
					</label>
				</div>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={cancelEdit}>Cancel</button>
				<button class="btn btn-primary" onclick={saveRule}>
					{isNewRule ? 'Add Rule' : 'Save Changes'}
				</button>
			</div>
		</div>
		<div class="modal-backdrop" onclick={cancelEdit}></div>
	</div>
{/if}
