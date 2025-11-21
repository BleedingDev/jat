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

<div class="dropdown dropdown-end w-full">
	<div
		tabindex="0"
		role="button"
		class="btn {compact ? 'btn-sm' : 'btn-md'} w-full justify-between"
	>
		<span>{formatProjectOption(selectedProject)}</span>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="w-4 h-4"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
		</svg>
	</div>
	<ul
		tabindex="0"
		class="dropdown-content menu bg-base-100 rounded-box z-[1] w-full p-2 shadow-lg border border-base-300 max-h-80 overflow-y-auto"
	>
		{#each projects as project}
			<li>
				<button
					type="button"
					class:active={selectedProject === project}
					onclick={() => handleSelect(project)}
				>
					{formatProjectOption(project)}
				</button>
			</li>
		{/each}
	</ul>
</div>
