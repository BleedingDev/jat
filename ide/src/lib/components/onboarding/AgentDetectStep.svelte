<script lang="ts">
	/**
	 * AgentDetectStep - Auto-detect and configure agent harnesses during onboarding
	 *
	 * On mount, calls POST /api/setup/agents { action: "detect" } to scan all 5 presets.
	 * Shows preset cards with detection status badges (Installed, Needs Auth, dimmed).
	 * User selects installed agents and confirms to add to agents.json.
	 */

	import { onMount } from 'svelte';
	import ProviderLogo from '$lib/components/agents/ProviderLogo.svelte';
	import { AGENT_PRESETS, type AgentProgramPreset } from '$lib/types/agentProgram';

	interface DetectionResult {
		presetId: string;
		name: string;
		commandInstalled: boolean;
		authConfigured: boolean;
		ready: boolean;
	}

	interface DetectedAgent {
		preset: AgentProgramPreset;
		status: DetectionResult | null;
		selected: boolean;
		isDefault: boolean;
	}

	let { onComplete }: { onComplete: () => void } = $props();

	let detecting = $state(true);
	let configuring = $state(false);
	let configured = $state(false);
	let error = $state<string | null>(null);
	let agents = $state<DetectedAgent[]>(
		AGENT_PRESETS.map((preset) => ({
			preset,
			status: null,
			selected: false,
			isDefault: false
		}))
	);

	const anySelected = $derived(agents.some((a) => a.selected));
	const anyInstalled = $derived(agents.some((a) => a.status?.commandInstalled));

	// Codex-first default selection during onboarding
	const DEFAULT_AGENT_PRIORITY = [
		'codex-native',
		'codex-cli',
		'claude-code',
		'gemini-cli',
		'aider',
		'opencode'
	] as const;

	function getPriorityIndex(presetId: string): number {
		const idx = DEFAULT_AGENT_PRIORITY.indexOf(presetId as any);
		return idx === -1 ? 999 : idx;
	}

	function pickDefaultAgentId(list: DetectedAgent[]): string | null {
		const selected = list.filter((a) => a.selected);
		if (selected.length === 0) return null;

		const sortByPriority = (a: DetectedAgent, b: DetectedAgent) =>
			getPriorityIndex(a.preset.id) - getPriorityIndex(b.preset.id);

		const ready = selected.filter((a) => a.status?.ready).sort(sortByPriority);
		if (ready.length > 0) return ready[0].preset.id;

		const installed = selected.filter((a) => a.status?.commandInstalled).sort(sortByPriority);
		if (installed.length > 0) return installed[0].preset.id;

		return selected[0]?.preset.id ?? null;
	}

	function applyDefaultSelection(list: DetectedAgent[]): DetectedAgent[] {
		const defaultId = pickDefaultAgentId(list);
		return list.map((a) => ({ ...a, isDefault: defaultId ? a.preset.id === defaultId : false }));
	}

	onMount(() => {
		detect();
	});

	async function detect() {
		detecting = true;
		error = null;

		try {
			const res = await fetch('/api/setup/agents', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'detect' })
			});

			const data = await res.json();

			if (!res.ok) {
				error = data.error || 'Detection failed';
				return;
			}

			// If already configured, auto-advance
			if (data.alreadyConfigured) {
				configured = true;
				setTimeout(() => onComplete(), 800);
				return;
			}

			const results = data.agents as DetectionResult[];

			const detected = AGENT_PRESETS.map((preset) => {
				const status = results.find((r) => r.presetId === preset.id) || null;
				const isReady = status?.ready ?? false;
				const isInstalled = status?.commandInstalled ?? false;

				// Pre-select ready/installed agents; default is picked by priority below
				const selected = isReady || isInstalled;
				return { preset, status, selected, isDefault: false };
			});

			agents = applyDefaultSelection(detected);
		} catch {
			error = 'Failed to detect agent harnesses';
		} finally {
			detecting = false;
		}
	}

	function toggleAgent(index: number) {
		const agent = agents[index];
		if (!agent.status?.commandInstalled) return; // Can't select uninstalled

		agents[index] = { ...agent, selected: !agent.selected };
		agents = applyDefaultSelection(agents);
	}

	async function handleConfirm() {
		const selectedIds = agents.filter((a) => a.selected).map((a) => a.preset.id);
		if (selectedIds.length === 0) {
			onComplete();
			return;
		}

		configuring = true;
		error = null;

		try {
			const res = await fetch('/api/setup/agents', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'configure', agents: selectedIds })
			});

			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Configuration failed';
				return;
			}

			configured = true;
			setTimeout(() => onComplete(), 400);
		} catch {
			error = 'Failed to configure agents';
		} finally {
			configuring = false;
		}
	}
</script>

{#if configured}
	<div
		class="flex items-center gap-2 px-3 py-2 rounded-lg"
		style="background: oklch(0.20 0.06 145 / 0.1); border: 1px solid oklch(0.40 0.12 145 / 0.3);"
	>
		<svg class="w-4 h-4" style="color: oklch(0.65 0.18 145);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
		</svg>
		<span class="text-xs font-mono" style="color: oklch(0.70 0.12 145);">
			Agent harnesses configured
		</span>
	</div>
{:else}
	<div class="space-y-4">
		{#if detecting}
			<!-- Scanning state -->
			<div class="flex items-center gap-3 py-2">
				<span class="loading loading-spinner loading-sm" style="color: oklch(0.65 0.15 240);"></span>
				<span class="text-sm font-mono" style="color: oklch(0.60 0.02 250);">
					Scanning for installed AI coding tools...
				</span>
			</div>
		{:else}
			<div class="space-y-2">
				<p class="text-sm" style="color: oklch(0.60 0.02 250);">
					{#if anyInstalled}
						We detected the following AI coding tools on your system. Select the ones you want to use as agent harnesses.
					{:else}
						No AI coding tools were detected. Install one to get started.
					{/if}
				</p>
				<p class="text-xs" style="color: oklch(0.48 0.02 250);">
					Agent harnesses are CLI-based AI coding tools that JAT can orchestrate. Each harness runs in its own terminal session, picks up tasks from your backlog, and works autonomously.
					{#if anyInstalled}
						Tools marked <span class="font-semibold" style="color: oklch(0.75 0.18 145);">Ready</span> are installed and authenticated.
						<span class="font-semibold" style="color: oklch(0.80 0.15 60);">Needs Auth</span> means the CLI is installed but requires authentication (e.g. <code class="px-1 py-0.5 rounded text-[11px]" style="background: oklch(0.22 0.01 250);">claude auth</code> or an API key in Settings).
					{/if}
				</p>
			</div>

			<!-- Preset grid -->
			<div class="presets-grid">
				{#each agents as agent, index}
					{@const isInstalled = agent.status?.commandInstalled ?? false}
					{@const isReady = agent.status?.ready ?? false}
					{@const needsAuth = isInstalled && !agent.status?.authConfigured}
					{@const models = agent.preset.config.models || []}

					<button
						class="preset-card"
						class:selected={agent.selected}
						class:dimmed={!isInstalled}
						class:is-default={agent.isDefault}
						disabled={!isInstalled}
						onclick={() => toggleAgent(index)}
					>
						<!-- Status badge (top-right) -->
						{#if isReady}
							<div class="status-badge ready">Ready</div>
						{:else if needsAuth}
							<div class="status-badge needs-auth">Needs Auth</div>
						{/if}

						<!-- Default star -->
						{#if agent.isDefault && agent.selected}
							<div class="default-star">
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
								</svg>
							</div>
						{/if}

						<!-- Header: logo + name -->
						<div class="preset-header">
							<ProviderLogo agentId={agent.preset.id} size={24} />
							<span class="preset-name">{agent.preset.name}</span>
						</div>

						<!-- Description -->
						<p class="preset-description">{agent.preset.description}</p>

						<!-- Model badges -->
						{#if models.length > 0}
							<div class="preset-models">
								{#each models as model}
									<span class="model-badge">{model.shortName}</span>
								{/each}
							</div>
						{/if}

						<!-- Selected checkmark -->
						{#if agent.selected}
							<div class="selected-indicator">
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							</div>
						{/if}
					</button>
				{/each}
			</div>

			{#if error}
				<div class="text-xs font-mono px-3 py-2 rounded-lg" style="background: oklch(0.20 0.06 30 / 0.15); border: 1px solid oklch(0.50 0.12 30 / 0.3); color: oklch(0.70 0.12 30);">
					{error}
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex items-center justify-between gap-3">
				<button
					class="btn font-mono"
					style="
						background: linear-gradient(135deg, oklch(0.35 0.12 145) 0%, oklch(0.28 0.10 145) 100%);
						border: 1px solid oklch(0.50 0.15 145 / 0.5);
						color: oklch(0.95 0.02 250);
					"
					disabled={!anySelected || configuring}
					onclick={handleConfirm}
				>
					{#if configuring}
						<span class="loading loading-spinner loading-xs"></span>
						Configuring...
					{:else}
						Confirm & Continue
					{/if}
				</button>

				<button
					class="text-xs font-mono transition-colors hover:underline"
					style="color: oklch(0.45 0.02 250);"
					onclick={() => onComplete()}
				>
					Configure later in Settings
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.presets-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.75rem;
	}

	.preset-card {
		position: relative;
		background: oklch(0.14 0.01 250);
		border: 1px solid oklch(0.25 0.02 250);
		border-radius: 10px;
		padding: 1rem;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.preset-card:hover:not(.dimmed):not(:disabled) {
		border-color: oklch(0.45 0.12 200);
		background: oklch(0.16 0.02 200);
	}

	.preset-card.selected {
		border: 2px solid oklch(0.55 0.15 250);
		background: oklch(0.15 0.02 250);
		box-shadow: 0 0 12px oklch(0.55 0.15 250 / 0.15);
	}

	.preset-card.dimmed {
		opacity: 0.45;
		cursor: default;
	}

	.preset-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.preset-name {
		font-family: monospace;
		font-size: 0.875rem;
		font-weight: 600;
		color: oklch(0.90 0.02 250);
	}

	.preset-description {
		font-size: 0.8125rem;
		color: oklch(0.60 0.02 250);
		line-height: 1.3;
	}

	.preset-models {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.25rem;
	}

	.model-badge {
		font-family: monospace;
		font-size: 0.6875rem;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		background: oklch(0.20 0.01 250);
		color: oklch(0.65 0.02 250);
		border: 1px solid oklch(0.28 0.02 250);
	}

	/* Status badges */
	.status-badge {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		font-family: monospace;
		font-size: 0.625rem;
		font-weight: 600;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.status-badge.ready {
		background: oklch(0.18 0.04 145);
		color: oklch(0.75 0.18 145);
		border: 1px solid oklch(0.35 0.10 145);
	}

	.status-badge.needs-auth {
		background: oklch(0.20 0.04 60);
		color: oklch(0.80 0.15 60);
		border: 1px solid oklch(0.35 0.08 60);
	}

	/* Default star */
	.default-star {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		color: oklch(0.80 0.15 85);
	}

	/* Selected checkmark */
	.selected-indicator {
		position: absolute;
		bottom: 0.5rem;
		right: 0.5rem;
		color: oklch(0.70 0.15 250);
	}
</style>
