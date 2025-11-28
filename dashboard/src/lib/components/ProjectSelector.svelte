<script lang="ts">
	/**
	 * ProjectSelector Component
	 * DaisyUI dropdown for filtering by project
	 */

	interface Props {
		projects: string[];
		selectedProject: string;
		onProjectChange: (project: string) => void;
		taskCounts?: Map<string, number> | null;
		compact?: boolean;
	}

	let {
		projects,
		selectedProject,
		onProjectChange,
		taskCounts = null,
		compact = false
	}: Props = $props();

	function handleSelect(project: string) {
		console.log('🔵 [ProjectSelector] Project selected');
		console.log('  → Selected value:', project);
		console.log('  → Previous value:', selectedProject);
		console.log('  → Calling onProjectChange...');
		onProjectChange(project);
		console.log('  ✓ onProjectChange called');

		// Close dropdown by removing focus
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	}

	// Format project option with task count if available
	function formatProjectOption(project: string): string {
		if (project === 'All Projects') {
			return 'All Projects';
		}

		if (taskCounts && taskCounts.has(project)) {
			const count = taskCounts.get(project);
			return `${project} (${count})`;
		}

		return project;
	}
</script>

<!-- Industrial Project Selector -->
<div class="dropdown dropdown-end w-full">
	<!-- Trigger Button - Industrial -->
	<div
		tabindex="0"
		role="button"
		class="{compact ? 'px-2.5 py-1' : 'px-3 py-2'} rounded cursor-pointer transition-all industrial-hover flex items-center justify-between w-full font-mono text-xs tracking-wider"
		style="
			background: oklch(0.18 0.01 250);
			border: 1px solid oklch(0.35 0.02 250);
			color: oklch(0.65 0.02 250);
		"
	>
		<span>{formatProjectOption(selectedProject)}</span>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="w-4 h-4"
			style="color: oklch(0.50 0.02 250);"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
		</svg>
	</div>
	<!-- Dropdown Menu - Industrial -->
	<ul
		tabindex="0"
		class="dropdown-content menu rounded-box z-[1] w-full p-2 shadow-lg max-h-80 overflow-y-auto"
		style="
			background: oklch(0.18 0.01 250);
			border: 1px solid oklch(0.35 0.02 250);
		"
	>
		{#each projects as project}
			<li>
				<button
					type="button"
					class="font-mono text-xs transition-all industrial-hover"
					style="
						background: {selectedProject === project ? 'oklch(0.70 0.18 240 / 0.15)' : 'transparent'};
						border-left: 2px solid {selectedProject === project ? 'oklch(0.70 0.18 240)' : 'transparent'};
						color: {selectedProject === project ? 'oklch(0.85 0.10 240)' : 'oklch(0.70 0.02 250)'};
					"
					onclick={() => handleSelect(project)}
				>
					{formatProjectOption(project)}
				</button>
			</li>
		{/each}
	</ul>
</div>
