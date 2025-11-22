<script lang="ts">
	/**
	 * TopBar Component - Horizontal utilities bar
	 *
	 * Simplified navigation bar containing only utility components:
	 * - Hamburger toggle (mobile only, for sidebar)
	 * - ProjectSelector
	 * - ClaudeUsageBar
	 * - UserProfile
	 *
	 * Navigation buttons (List, Graph, Agents) removed - moved to Sidebar
	 *
	 * Props:
	 * - projects: string[] (for project dropdown)
	 * - selectedProject: string (current project selection)
	 * - onProjectChange: (project: string) => void
	 * - taskCounts: Map<string, number> (optional task counts per project)
	 */

	import ProjectSelector from './ProjectSelector.svelte';
	import ClaudeUsageBar from './ClaudeUsageBar.svelte';
	import UserProfile from './UserProfile.svelte';

	interface Props {
		projects?: string[];
		selectedProject?: string;
		onProjectChange?: (project: string) => void;
		taskCounts?: Map<string, number> | null;
	}

	let {
		projects = [],
		selectedProject = 'All Projects',
		onProjectChange = () => {},
		taskCounts = null
	}: Props = $props();
</script>

<nav class="navbar w-full bg-base-100 border-b border-base-300">
	<!-- Hamburger toggle (mobile only) -->
	<label for="main-drawer" class="btn btn-square btn-ghost lg:hidden">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="w-5 h-5"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
			/>
		</svg>
	</label>

	<!-- Left side utilities -->
	<div class="flex-1 gap-2 px-4">
		{#if projects.length > 0}
			<div class="w-36 sm:w-40 md:w-48">
				<ProjectSelector
					{projects}
					{selectedProject}
					{onProjectChange}
					{taskCounts}
					compact={true}
				/>
			</div>
		{/if}
	</div>

	<!-- Right side utilities -->
	<div class="flex-none flex items-center gap-2">
		<!-- Claude Usage Bar -->
		<ClaudeUsageBar />

		<!-- User Profile -->
		<UserProfile />
	</div>
</nav>
