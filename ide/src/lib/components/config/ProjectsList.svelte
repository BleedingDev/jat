<script lang="ts">
	/**
	 * ProjectsList Component
	 *
	 * Displays all project configurations in a grid layout with:
	 * - Grid of ProjectCard components
	 * - New Project button
	 * - Loading and error states
	 * - Collapsible hidden projects section
	 *
	 * Follows the RulesList pattern from automation.
	 *
	 * @see ide/src/lib/types/config.ts for ProjectConfig type
	 * @see ide/src/lib/stores/configStore.svelte.ts for store
	 */

	import { fade, slide } from 'svelte/transition';
	import type { ProjectConfig } from '$lib/types/config';
	import {
		getProjects,
		getVisibleProjects,
		getHiddenProjects,
		isProjectsLoading,
		getProjectsError,
		loadProjects,
		toggleProjectVisibility
	} from '$lib/stores/configStore.svelte';
	import ProjectCard from './ProjectCard.svelte';
	import { successToast, errorToast } from '$lib/stores/toasts.svelte';

	interface Props {
		/** Called when edit button is clicked for a project */
		onEditProject?: (project: ProjectConfig) => void;
		/** Called when add project button is clicked */
		onAddProject?: () => void;
		/** Called when delete button is clicked for a project */
		onDeleteProject?: (project: ProjectConfig) => void;
		/** Custom class */
		class?: string;
	}

	let {
		onEditProject = () => {},
		onAddProject = () => {},
		onDeleteProject = () => {},
		class: className = ''
	}: Props = $props();

	// Get reactive state from store
	const visibleProjects = $derived(getVisibleProjects());
	const hiddenProjects = $derived(getHiddenProjects());
	const allProjects = $derived(getProjects());
	const loading = $derived(isProjectsLoading());
	const error = $derived(getProjectsError());

	// Hidden projects section collapsed state
	let hiddenSectionExpanded = $state(false);

	// Handle visibility toggle
	async function handleToggleVisibility(project: ProjectConfig) {
		try {
			const newVisibility = !project.hidden;
			await toggleProjectVisibility(project.name, newVisibility);
			const action = newVisibility ? 'hidden' : 'shown';
			successToast(`Project "${project.name}" ${action}`, `Project is now ${newVisibility ? 'hidden from' : 'visible in'} the IDE`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to toggle visibility';
			errorToast('Failed to update project visibility', message);
		}
	}

	// Handle retry
	function handleRetry() {
		loadProjects();
	}

	// Toggle hidden section
	function toggleHiddenSection() {
		hiddenSectionExpanded = !hiddenSectionExpanded;
	}
</script>

<div class="projects-list {className}">
	<!-- Header -->
	<header class="list-header">
		<div class="header-left">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="header-icon">
				<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
			</svg>
			<span class="header-title">Projects</span>
			<span class="project-count">{allProjects.length} project{allProjects.length !== 1 ? 's' : ''}</span>
		</div>

		<div class="header-right">
			<!-- Refresh button -->
			<button
				class="refresh-btn"
				onclick={handleRetry}
				disabled={loading}
				title="Refresh projects"
				aria-label="Refresh projects"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="w-4 h-4"
					class:spinning={loading}
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
				</svg>
			</button>

			<!-- Add project button -->
			<button
				class="add-btn"
				onclick={() => onAddProject()}
				aria-label="Add new project"
			>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				New Project
			</button>
		</div>
	</header>

	<!-- Content -->
	<div class="list-content">
		{#if loading && allProjects.length === 0}
			<!-- Loading state -->
			<div class="loading-state" transition:fade={{ duration: 150 }}>
				<div class="loading-spinner"></div>
				<p class="loading-text">Loading projects...</p>
			</div>
		{:else if error}
			<!-- Error state -->
			<div class="error-state" transition:fade={{ duration: 150 }}>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="error-icon">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
				</svg>
				<p class="error-title">Failed to load projects</p>
				<p class="error-message">{error}</p>
				<button class="retry-btn" onclick={handleRetry}>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
						<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
					</svg>
					Retry
				</button>
			</div>
		{:else if allProjects.length === 0}
			<!-- Empty state -->
			<div class="empty-state" transition:fade={{ duration: 150 }}>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="empty-icon">
					<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
				</svg>
				<p class="empty-title">No projects configured</p>
				<p class="empty-hint">Add a project to get started with the IDE</p>
				<button class="empty-action" onclick={() => onAddProject()}>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
					Add First Project
				</button>
			</div>
		{:else}
			<!-- Projects grid -->
			<div class="projects-grid">
				{#each visibleProjects as project, index (project.path)}
					<div class="fade-in-left fade-in-delay-{Math.min(index, 12)}">
						<ProjectCard
							{project}
							onEdit={onEditProject}
							onDelete={onDeleteProject}
							onToggleVisibility={handleToggleVisibility}
						/>
					</div>
				{/each}
			</div>

			<!-- Hidden projects section -->
			{#if hiddenProjects.length > 0}
				<div class="hidden-section" transition:slide={{ duration: 200, axis: 'y' }}>
					<button
						class="hidden-section-header"
						onclick={toggleHiddenSection}
						aria-expanded={hiddenSectionExpanded}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
							class="chevron-icon"
							class:expanded={hiddenSectionExpanded}
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
						</svg>
						<span class="hidden-section-title">Hidden Projects</span>
						<span class="hidden-count">{hiddenProjects.length}</span>
					</button>

					{#if hiddenSectionExpanded}
						<div class="hidden-projects-grid" transition:slide={{ duration: 200, axis: 'y' }}>
							{#each hiddenProjects as project, index (project.path)}
								<div class="fade-in-left fade-in-delay-{Math.min(index, 12)}">
									<ProjectCard
										{project}
										onEdit={onEditProject}
										onDelete={onDeleteProject}
										onToggleVisibility={handleToggleVisibility}
									/>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.projects-list {
		display: flex;
		flex-direction: column;
		background: oklch(0.14 0.02 250);
		border: 1px solid oklch(0.28 0.02 250);
		border-radius: 10px;
		overflow: hidden;
	}

	/* Header */
	.list-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: oklch(0.12 0.02 250);
		border-bottom: 1px solid oklch(0.25 0.02 250);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.header-icon {
		width: 18px;
		height: 18px;
		color: oklch(0.65 0.10 200);
	}

	.header-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: oklch(0.85 0.02 250);
		font-family: ui-monospace, monospace;
	}

	.project-count {
		font-size: 0.7rem;
		font-weight: 400;
		color: oklch(0.50 0.02 250);
		background: oklch(0.22 0.02 250);
		padding: 0.125rem 0.5rem;
		border-radius: 10px;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Refresh button */
	.refresh-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: oklch(0.22 0.02 250);
		border: 1px solid oklch(0.30 0.02 250);
		border-radius: 6px;
		color: oklch(0.60 0.02 250);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.refresh-btn:hover:not(:disabled) {
		background: oklch(0.28 0.02 250);
		color: oklch(0.80 0.02 250);
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spinning {
		animation: spin 1s linear infinite;
	}

	/* Add button */
	.add-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		background: oklch(0.35 0.10 200);
		border: 1px solid oklch(0.45 0.12 200);
		border-radius: 6px;
		color: oklch(0.90 0.08 200);
		cursor: pointer;
		transition: all 0.15s ease;
		font-family: ui-monospace, monospace;
	}

	.add-btn:hover {
		background: oklch(0.40 0.12 200);
		border-color: oklch(0.50 0.15 200);
	}

	/* Content */
	.list-content {
		padding: 1rem;
	}

	/* Projects grid */
	.projects-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1rem;
	}

	/* Loading state */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		gap: 1rem;
	}

	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid oklch(0.30 0.02 250);
		border-top-color: oklch(0.65 0.15 200);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.loading-text {
		font-size: 0.85rem;
		color: oklch(0.55 0.02 250);
		margin: 0;
	}

	/* Error state */
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		gap: 0.5rem;
		color: oklch(0.50 0.02 250);
	}

	.error-icon {
		width: 48px;
		height: 48px;
		color: oklch(0.60 0.15 25);
		margin-bottom: 0.5rem;
	}

	.error-title {
		font-size: 0.9rem;
		font-weight: 500;
		color: oklch(0.70 0.12 25);
		margin: 0;
	}

	.error-message {
		font-size: 0.75rem;
		color: oklch(0.55 0.02 250);
		margin: 0;
		text-align: center;
	}

	.retry-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		font-size: 0.8rem;
		font-weight: 500;
		background: oklch(0.30 0.08 200);
		border: 1px solid oklch(0.40 0.10 200);
		border-radius: 6px;
		color: oklch(0.85 0.08 200);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.retry-btn:hover {
		background: oklch(0.35 0.10 200);
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		gap: 0.5rem;
		color: oklch(0.50 0.02 250);
	}

	.empty-icon {
		width: 48px;
		height: 48px;
		color: oklch(0.35 0.02 250);
		margin-bottom: 0.5rem;
	}

	.empty-title {
		font-size: 0.9rem;
		font-weight: 500;
		color: oklch(0.55 0.02 250);
		margin: 0;
	}

	.empty-hint {
		font-size: 0.75rem;
		color: oklch(0.45 0.02 250);
		margin: 0;
	}

	.empty-action {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		font-size: 0.8rem;
		font-weight: 500;
		background: oklch(0.30 0.08 200);
		border: 1px solid oklch(0.40 0.10 200);
		border-radius: 6px;
		color: oklch(0.85 0.08 200);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.empty-action:hover {
		background: oklch(0.35 0.10 200);
	}

	/* Hidden projects section */
	.hidden-section {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid oklch(0.22 0.02 250);
	}

	.hidden-section-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		background: none;
		border: none;
		cursor: pointer;
		color: oklch(0.60 0.02 250);
		font-size: 0.8rem;
		font-weight: 500;
		transition: color 0.15s ease;
	}

	.hidden-section-header:hover {
		color: oklch(0.75 0.02 250);
	}

	.chevron-icon {
		width: 14px;
		height: 14px;
		transition: transform 0.2s ease;
	}

	.chevron-icon.expanded {
		transform: rotate(90deg);
	}

	.hidden-section-title {
		font-family: ui-monospace, monospace;
	}

	.hidden-count {
		font-size: 0.65rem;
		color: oklch(0.50 0.02 250);
		background: oklch(0.22 0.02 250);
		padding: 0.125rem 0.375rem;
		border-radius: 8px;
	}

	.hidden-projects-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1rem;
		margin-top: 0.75rem;
	}
</style>
