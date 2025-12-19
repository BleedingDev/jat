<script lang="ts">
	/**
	 * ConfigTabs Component
	 *
	 * Tab-based navigation for the config page.
	 * Syncs active tab state with URL query parameter (?tab=commands|projects).
	 *
	 * @see dashboard/src/routes/config/+page.svelte for usage
	 */

	interface Tab {
		id: string;
		label: string;
		icon: string; // SVG path
	}

	interface Props {
		/** Currently active tab ID */
		activeTab: string;
		/** Called when tab changes */
		onTabChange?: (tabId: string) => void;
		/** Custom class */
		class?: string;
	}

	let {
		activeTab,
		onTabChange = () => {},
		class: className = ''
	}: Props = $props();

	// Tab definitions
	const tabs: Tab[] = [
		{
			id: 'commands',
			label: 'Commands',
			// Terminal/code icon
			icon: 'M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z'
		},
		{
			id: 'projects',
			label: 'Projects',
			// Folder icon
			icon: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
		}
	];

	function handleTabClick(tabId: string) {
		if (tabId !== activeTab) {
			onTabChange(tabId);
		}
	}
</script>

<div class="config-tabs {className}" role="tablist" aria-label="Configuration sections">
	{#each tabs as tab}
		<button
			role="tab"
			aria-selected={activeTab === tab.id}
			aria-controls="{tab.id}-panel"
			class="tab-btn"
			class:active={activeTab === tab.id}
			onclick={() => handleTabClick(tab.id)}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="tab-icon"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d={tab.icon} />
			</svg>
			<span class="tab-label">{tab.label}</span>
		</button>
	{/each}
</div>

<style>
	.config-tabs {
		display: flex;
		gap: 0.25rem;
		padding: 0.25rem;
		background: oklch(0.12 0.02 250);
		border: 1px solid oklch(0.25 0.02 250);
		border-radius: 10px;
		width: fit-content;
	}

	.tab-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.85rem;
		font-weight: 500;
		color: oklch(0.60 0.02 250);
		background: transparent;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
		font-family: ui-monospace, monospace;
	}

	.tab-btn:hover:not(.active) {
		color: oklch(0.75 0.02 250);
		background: oklch(0.18 0.02 250);
	}

	.tab-btn.active {
		color: oklch(0.90 0.10 200);
		background: oklch(0.22 0.06 200);
	}

	.tab-icon {
		width: 18px;
		height: 18px;
	}

	.tab-label {
		white-space: nowrap;
	}

	/* Responsive: hide labels on small screens */
	@media (max-width: 480px) {
		.tab-label {
			display: none;
		}

		.tab-btn {
			padding: 0.5rem 0.75rem;
		}
	}
</style>
