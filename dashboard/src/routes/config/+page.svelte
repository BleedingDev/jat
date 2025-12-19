<script lang="ts">
	/**
	 * Config Page
	 *
	 * Configuration management page with tab-based navigation:
	 * - Commands tab: View and manage slash commands
	 * - Projects tab: View and manage project configurations
	 *
	 * Tab state syncs with URL query parameter (?tab=commands|projects).
	 *
	 * @see dashboard/src/lib/stores/configStore.svelte.ts for state management
	 * @see dashboard/src/lib/components/config/ for sub-components
	 */

	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';

	// Store imports
	import {
		loadCommands,
		loadProjects,
		getCommands,
		getProjects,
		isCommandsLoading,
		isProjectsLoading,
		getCommandsError,
		getProjectsError,
		deleteCommand
	} from '$lib/stores/configStore.svelte';

	// Components
	import ConfigTabs from '$lib/components/config/ConfigTabs.svelte';
	import CommandCard from '$lib/components/config/CommandCard.svelte';
	import ProjectsList from '$lib/components/config/ProjectsList.svelte';
	import type { SlashCommand, ProjectConfig } from '$lib/types/config';

	// Page state
	let isLoading = $state(true);
	let activeTab = $state('commands');

	// Derived store values
	const commands = $derived(getCommands());
	const projects = $derived(getProjects());
	const commandsLoading = $derived(isCommandsLoading());
	const projectsLoading = $derived(isProjectsLoading());
	const commandsError = $derived(getCommandsError());
	const projectsError = $derived(getProjectsError());

	// Sync activeTab from URL query parameter
	$effect(() => {
		const tabParam = $page.url.searchParams.get('tab');
		if (tabParam && (tabParam === 'commands' || tabParam === 'projects')) {
			activeTab = tabParam;
		}
	});

	// Handle tab change - update URL
	function handleTabChange(tabId: string) {
		activeTab = tabId;
		const url = new URL(window.location.href);
		url.searchParams.set('tab', tabId);
		goto(url.pathname + url.search, { replaceState: true, noScroll: true });
	}

	// Handle edit command
	function handleEditCommand(command: SlashCommand) {
		// Navigate to command editor (TODO: implement editor route)
		console.log('[Config] Edit command:', command.invocation);
		// For now, we could open Monaco editor modal or navigate to dedicated route
	}

	// Handle delete command
	async function handleDeleteCommand(command: SlashCommand) {
		const success = await deleteCommand(command);
		if (!success) {
			console.error('[Config] Failed to delete command:', command.invocation);
		}
	}

	// Handle edit project
	function handleEditProject(project: ProjectConfig) {
		console.log('[Config] Edit project:', project.name);
		// TODO: Open project editor modal
	}

	// Handle add project
	function handleAddProject() {
		console.log('[Config] Add new project');
		// TODO: Open project creation modal
	}

	// Handle delete project
	function handleDeleteProject(project: ProjectConfig) {
		console.log('[Config] Delete project:', project.name);
		// TODO: Implement delete
	}

	// Load data on mount
	onMount(async () => {
		await Promise.all([loadCommands(), loadProjects()]);
		isLoading = false;
	});

	// Group commands by namespace
	const commandGroups = $derived.by(() => {
		const groups = new Map<string, SlashCommand[]>();

		for (const command of commands) {
			const existing = groups.get(command.namespace) || [];
			groups.set(command.namespace, [...existing, command]);
		}

		// Sort namespaces: 'jat' first, then 'local', then alphabetically
		const sortedNamespaces = Array.from(groups.keys()).sort((a, b) => {
			if (a === 'jat') return -1;
			if (b === 'jat') return 1;
			if (a === 'local') return -1;
			if (b === 'local') return 1;
			return a.localeCompare(b);
		});

		return sortedNamespaces.map((namespace) => ({
			namespace,
			commands: (groups.get(namespace) || []).sort((a, b) => a.name.localeCompare(b.name))
		}));
	});
</script>

<svelte:head>
	<title>Config | JAT Dashboard</title>
</svelte:head>

<div class="config-page" style="background: oklch(0.14 0.01 250);">
	{#if isLoading}
		<!-- Skeleton Loading State -->
		<div class="config-content" transition:fade={{ duration: 150 }}>
			<div class="config-header">
				<div class="skeleton h-8 w-32 rounded-lg" style="background: oklch(0.18 0.02 250);"></div>
				<div class="skeleton h-10 w-64 rounded-lg" style="background: oklch(0.18 0.02 250);"></div>
			</div>
			<div class="config-body">
				<div class="skeleton h-96 w-full rounded-lg" style="background: oklch(0.18 0.02 250);"></div>
			</div>
		</div>
	{:else}
		<!-- Main Content -->
		<div class="config-content" transition:fade={{ duration: 150 }}>
			<!-- Header with tabs -->
			<div class="config-header">
				<h1 class="page-title">Configuration</h1>
				<ConfigTabs {activeTab} onTabChange={handleTabChange} />
			</div>

			<!-- Tab content -->
			<div class="config-body">
				{#if activeTab === 'commands'}
					<!-- Commands Tab -->
					<div
						role="tabpanel"
						id="commands-panel"
						aria-labelledby="commands-tab"
						transition:fade={{ duration: 150 }}
					>
						{#if commandsLoading}
							<div class="loading-state">
								<div class="loading-spinner"></div>
								<p class="loading-text">Loading commands...</p>
							</div>
						{:else if commandsError}
							<div class="error-state">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
									class="error-icon"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
									/>
								</svg>
								<p class="error-title">Failed to load commands</p>
								<p class="error-message">{commandsError}</p>
								<button class="retry-btn" onclick={() => loadCommands()}>
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
									Retry
								</button>
							</div>
						{:else if commands.length === 0}
							<div class="empty-state">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
									class="empty-icon"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
									/>
								</svg>
								<p class="empty-title">No commands found</p>
								<p class="empty-hint">Add slash commands to your .claude/commands directory</p>
							</div>
						{:else}
							<!-- Command groups -->
							<div class="commands-content">
								<div class="commands-header">
									<span class="commands-count"
										>{commands.length} command{commands.length !== 1 ? 's' : ''}</span
									>
								</div>
								{#each commandGroups as group (group.namespace)}
									<div class="command-group">
										<div class="group-header">
											<span class="group-name">{group.namespace}</span>
											<span class="group-count">{group.commands.length}</span>
										</div>
										<div class="commands-grid">
											{#each group.commands as command (command.path)}
												<CommandCard
													{command}
													onEdit={handleEditCommand}
													onDelete={handleDeleteCommand}
												/>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{:else if activeTab === 'projects'}
					<!-- Projects Tab -->
					<div
						role="tabpanel"
						id="projects-panel"
						aria-labelledby="projects-tab"
						transition:fade={{ duration: 150 }}
					>
						<ProjectsList
							onEditProject={handleEditProject}
							onAddProject={handleAddProject}
							onDeleteProject={handleDeleteProject}
						/>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.config-page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.config-content {
		flex: 1;
		padding: 1.5rem;
		max-width: 1400px;
		margin: 0 auto;
		width: 100%;
	}

	/* Header */
	.config-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: oklch(0.90 0.02 250);
		margin: 0;
		font-family: ui-monospace, monospace;
	}

	/* Body */
	.config-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Commands content */
	.commands-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.commands-header {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.commands-count {
		font-size: 0.85rem;
		color: oklch(0.55 0.02 250);
		font-family: ui-monospace, monospace;
	}

	/* Command groups */
	.command-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid oklch(0.22 0.02 250);
	}

	.group-name {
		font-size: 0.9rem;
		font-weight: 600;
		color: oklch(0.75 0.08 200);
		font-family: ui-monospace, monospace;
	}

	.group-count {
		font-size: 0.7rem;
		color: oklch(0.50 0.02 250);
		background: oklch(0.22 0.02 250);
		padding: 0.125rem 0.5rem;
		border-radius: 10px;
	}

	.commands-grid {
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
		padding: 4rem 1rem;
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

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
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
		padding: 4rem 1rem;
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
		padding: 4rem 1rem;
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

	/* Responsive */
	@media (max-width: 640px) {
		.config-content {
			padding: 1rem;
		}

		.config-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.page-title {
			font-size: 1.25rem;
		}

		.commands-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
