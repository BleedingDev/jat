<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	let {
		readyTaskCount = 0,
		idleSlots = 0,
		onNewTask = () => {},
		onStart = () => {},
		onSwarm = (count: number) => {}
	}: {
		readyTaskCount?: number;
		idleSlots?: number;
		onNewTask?: () => void;
		onStart?: () => void;
		onSwarm?: (count: number) => void;
	} = $props();

	let startHovered = $state(false);
	let swarmHovered = $state(false);
	let startDropdownOpen = $state(false);
	let swarmDropdownOpen = $state(false);

	// Close dropdowns when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.action-pill')) {
			startDropdownOpen = false;
			swarmDropdownOpen = false;
		}
	}

	// Swarm options
	const swarmCounts = [2, 4, 6, 8];

	function handleSwarmSelect(count: number) {
		swarmDropdownOpen = false;
		onSwarm(count);
	}

	function handleStartClick() {
		if (readyTaskCount > 1) {
			startDropdownOpen = !startDropdownOpen;
			swarmDropdownOpen = false;
		} else {
			onStart();
		}
	}

	function handleSwarmClick() {
		swarmDropdownOpen = !swarmDropdownOpen;
		startDropdownOpen = false;
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="action-pill">
	<!-- + New (Primary) -->
	<button
		class="segment segment-new"
		onclick={onNewTask}
		title="Create new task (Alt+N)"
	>
		<svg class="icon" viewBox="0 0 20 20" fill="currentColor">
			<path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
		</svg>
		<span class="label">New</span>
	</button>

	<!-- ▶ Start -->
	<div class="segment-wrapper">
		<button
			class="segment segment-start"
			class:expanded={startHovered || startDropdownOpen}
			onmouseenter={() => startHovered = true}
			onmouseleave={() => startHovered = false}
			onclick={handleStartClick}
			disabled={readyTaskCount === 0}
			title={readyTaskCount > 0 ? `Start task (${readyTaskCount} ready)` : 'No tasks ready'}
		>
			<svg class="icon" viewBox="0 0 20 20" fill="currentColor">
				<path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" />
			</svg>
			{#if startHovered || startDropdownOpen}
				<span class="label">Start</span>
			{/if}
			{#if readyTaskCount > 0}
				<span class="badge">{readyTaskCount}</span>
			{/if}
			{#if readyTaskCount > 1}
				<svg class="chevron" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
				</svg>
			{/if}
		</button>

		{#if startDropdownOpen && readyTaskCount > 1}
			<div class="dropdown">
				<button class="dropdown-item" onclick={() => { startDropdownOpen = false; onStart(); }}>
					<span class="dropdown-icon">🎯</span>
					<span>Top Priority</span>
				</button>
				<button class="dropdown-item" onclick={() => { startDropdownOpen = false; }}>
					<span class="dropdown-icon">📋</span>
					<span>Pick from list...</span>
				</button>
				<button class="dropdown-item" onclick={() => { startDropdownOpen = false; }}>
					<span class="dropdown-icon">🔄</span>
					<span>Resume last session</span>
				</button>
			</div>
		{/if}
	</div>

	<!-- ⚡ Swarm -->
	<div class="segment-wrapper">
		<button
			class="segment segment-swarm"
			class:expanded={swarmHovered || swarmDropdownOpen}
			onmouseenter={() => swarmHovered = true}
			onmouseleave={() => swarmHovered = false}
			onclick={handleSwarmClick}
			disabled={readyTaskCount === 0 || idleSlots === 0}
			title={idleSlots > 0 ? `Launch swarm (${idleSlots} slots)` : 'No idle slots'}
		>
			<svg class="icon" viewBox="0 0 20 20" fill="currentColor">
				<path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" />
			</svg>
			{#if swarmHovered || swarmDropdownOpen}
				<span class="label">Swarm</span>
			{/if}
			{#if idleSlots > 0}
				<span class="badge">{idleSlots}</span>
			{/if}
			<svg class="chevron" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
			</svg>
		</button>

		{#if swarmDropdownOpen}
			<div class="dropdown">
				{#each swarmCounts as count}
					<button
						class="dropdown-item"
						onclick={() => handleSwarmSelect(count)}
						disabled={count > idleSlots}
					>
						<span class="dropdown-icon">⚡</span>
						<span>{count} agents</span>
						{#if count > idleSlots}
							<span class="dropdown-hint">({idleSlots} available)</span>
						{/if}
					</button>
				{/each}
				<div class="dropdown-divider"></div>
				<button class="dropdown-item" onclick={() => { swarmDropdownOpen = false; }}>
					<span class="dropdown-icon">🎯</span>
					<span>Attack epic...</span>
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.action-pill {
		display: inline-flex;
		align-items: stretch;
		background: oklch(0.22 0.02 250);
		border-radius: 0.5rem;
		border: 1px solid oklch(0.30 0.02 250);
		overflow: visible;
		height: 2.25rem;
	}

	.segment-wrapper {
		position: relative;
		display: flex;
	}

	.segment {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0 0.6rem;
		border: none;
		background: transparent;
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: 0.8125rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.segment:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.segment:not(:last-child) {
		border-right: 1px solid oklch(0.30 0.02 250);
	}

	/* + New - Primary (always green) */
	.segment-new {
		color: oklch(0.85 0.18 145);
		background: oklch(0.30 0.08 145 / 0.3);
		border-radius: 0.4rem 0 0 0.4rem;
		padding-right: 0.75rem;
	}

	.segment-new:hover {
		background: oklch(0.35 0.12 145 / 0.4);
		color: oklch(0.92 0.18 145);
	}

	.segment-new .label {
		display: inline;
	}

	/* ▶ Start - Muted until hover */
	.segment-start {
		color: oklch(0.65 0.02 250);
	}

	.segment-start:not(:disabled):hover,
	.segment-start.expanded {
		color: oklch(0.85 0.15 200);
		background: oklch(0.30 0.08 200 / 0.25);
	}

	.segment-start .label {
		display: none;
	}

	.segment-start.expanded .label {
		display: inline;
	}

	/* ⚡ Swarm - Muted until hover */
	.segment-swarm {
		color: oklch(0.65 0.02 250);
		border-radius: 0 0.4rem 0.4rem 0;
	}

	.segment-swarm:not(:disabled):hover,
	.segment-swarm.expanded {
		color: oklch(0.90 0.15 85);
		background: oklch(0.35 0.10 85 / 0.25);
	}

	.segment-swarm .label {
		display: none;
	}

	.segment-swarm.expanded .label {
		display: inline;
	}

	/* Icons */
	.icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.chevron {
		width: 0.875rem;
		height: 0.875rem;
		opacity: 0.6;
		margin-left: -0.15rem;
	}

	/* Badge (count) */
	.badge {
		font-size: 0.6875rem;
		font-weight: 600;
		background: oklch(0.35 0.02 250);
		color: oklch(0.75 0.02 250);
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		min-width: 1.1rem;
		text-align: center;
	}

	.segment-start:not(:disabled):hover .badge,
	.segment-start.expanded .badge {
		background: oklch(0.40 0.10 200 / 0.4);
		color: oklch(0.90 0.12 200);
	}

	.segment-swarm:not(:disabled):hover .badge,
	.segment-swarm.expanded .badge {
		background: oklch(0.40 0.10 85 / 0.4);
		color: oklch(0.92 0.12 85);
	}

	/* Dropdown */
	.dropdown {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 50%;
		transform: translateX(-50%);
		background: oklch(0.20 0.02 250);
		border: 1px solid oklch(0.32 0.02 250);
		border-radius: 0.5rem;
		padding: 0.35rem;
		min-width: 10rem;
		box-shadow: 0 8px 24px oklch(0 0 0 / 0.4);
		z-index: 50;
		animation: dropdown-in 0.12s ease-out;
	}

	@keyframes dropdown-in {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(-0.25rem);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.65rem;
		border: none;
		background: transparent;
		color: oklch(0.80 0.02 250);
		font-size: 0.8125rem;
		border-radius: 0.35rem;
		cursor: pointer;
		text-align: left;
		transition: background 0.1s;
	}

	.dropdown-item:hover:not(:disabled) {
		background: oklch(0.28 0.02 250);
		color: oklch(0.92 0.02 250);
	}

	.dropdown-item:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.dropdown-icon {
		font-size: 0.875rem;
	}

	.dropdown-hint {
		margin-left: auto;
		font-size: 0.75rem;
		color: oklch(0.55 0.02 250);
	}

	.dropdown-divider {
		height: 1px;
		background: oklch(0.30 0.02 250);
		margin: 0.35rem 0;
	}
</style>
