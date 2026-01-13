<script lang="ts">
	/**
	 * ProjectSelector Component
	 * DaisyUI dropdown for filtering by project
	 * Supports showing project colors - pass projectColors prop for immediate colors,
	 * or uses getProjectColor utility as fallback (async, may have delay)
	 */
	import { getProjectColor } from "$lib/utils/projectColors";

	interface Props {
		projects: string[];
		selectedProject: string;
		onProjectChange: (project: string) => void;
		taskCounts?: Map<string, number> | null;
		compact?: boolean;
		showColors?: boolean;
		/** Optional map of project name → color. If provided, used instead of getProjectColor() */
		projectColors?: Map<string, string> | null;
	}

	let {
		projects,
		selectedProject,
		onProjectChange,
		taskCounts = null,
		compact = false,
		showColors = false,
		projectColors = null,
	}: Props = $props();

	// Get color for a project - prefer passed projectColors, fall back to utility
	function getColor(project: string): string {
		if (projectColors && projectColors.has(project)) {
			return projectColors.get(project)!;
		}
		return getProjectColor(project);
	}

	function handleSelect(project: string) {
		console.log("🔵 [ProjectSelector] Project selected");
		console.log("  → Selected value:", project);
		console.log("  → Previous value:", selectedProject);
		console.log("  → Calling onProjectChange...");
		onProjectChange(project);
		console.log("  ✓ onProjectChange called");

		// Close dropdown by removing focus
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	}

	// Format project option with task count if available
	function formatProjectOption(project: string): string {
		if (project === "All Projects") {
			return "All Projects";
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
		class="{compact
			? 'px-2.5 py-1'
			: 'px-3 py-2'} rounded cursor-pointer transition-all industrial-hover flex items-center justify-between w-full font-mono text-xs tracking-wider bg-base-200 border border-base-300 text-base-content/60"
	>
		<span class="flex items-center gap-2">
			{#if showColors && selectedProject && selectedProject !== "All Projects"}
				<span
					class="w-2 h-2 rounded-full flex-shrink-0"
					style="background: {getColor(selectedProject)};"
				></span>
			{/if}
			{formatProjectOption(selectedProject)}
		</span>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="w-4 h-4 text-base-content/50"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M19.5 8.25l-7.5 7.5-7.5-7.5"
			/>
		</svg>
	</div>
	<!-- Dropdown Menu - Industrial -->
	<ul
		tabindex="0"
		class="dropdown-content rounded-box z-[60] w-full p-2 shadow-lg max-h-80 overflow-y-auto overflow-x-hidden bg-base-200 border border-base-300"
	>
		{#each projects as project, index}
			<li class="fade-in-fast fade-in-fast-delay-{Math.min(index, 12)}">
				<button
					type="button"
					class="font-mono text-xs py-2 px-3 rounded transition-all industrial-hover flex items-center gap-2 w-full {selectedProject ===
					project
						? 'project-option-selected'
						: 'project-option-default'}"
					onclick={() => handleSelect(project)}
				>
					{#if showColors && project !== "All Projects"}
						<span
							class="w-2 h-2 rounded-full flex-shrink-0"
							style="background: {getColor(project)};"
						></span>
					{/if}
					{formatProjectOption(project)}
				</button>
			</li>
		{/each}
	</ul>
</div>

<style>
	/* Project option states - themeable */
	.project-option-selected {
		background: color-mix(in oklch, var(--color-primary) 15%, transparent);
		border-left: 2px solid var(--color-primary);
		color: var(--color-primary);
	}

	.project-option-default {
		background: transparent;
		border-left: 2px solid transparent;
		color: var(--color-base-content);
		opacity: 0.7;
	}

	.project-option-default:hover {
		opacity: 1;
	}
</style>
