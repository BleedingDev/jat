<script lang="ts">
	/**
	 * Projects Page - Project Configuration & Management
	 *
	 * Manage JAT projects: add, edit, hide, remove projects.
	 * View project status: beads initialized, active agents, task counts, server status.
	 */

	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import CreateProjectDrawer from '$lib/components/CreateProjectDrawer.svelte';

	// Types
	interface Project {
		name: string;
		displayName?: string;
		path: string;
		port?: number;
		server_path?: string;
		description?: string;
		active_color?: string;
		inactive_color?: string;
		visible: boolean;
		source?: string;
		stats?: {
			hasBeads: boolean;
			agentCount: number;
			taskCount: number;
			openTaskCount: number;
			serverRunning: boolean;
		};
	}

	// State
	let projects = $state<Project[]>([]);
	let hiddenProjects = $state<Project[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let showHidden = $state(false);

	// Drawer states
	let createDrawerOpen = $state(false);
	let editDrawerOpen = $state(false);
	let editingProject = $state<Project | null>(null);

	// Edit form state
	let editForm = $state({
		displayName: '',
		path: '',
		port: '',
		server_path: '',
		description: '',
		active_color: '#22c55e',
		inactive_color: '#6b7280'
	});
	let saving = $state(false);
	let saveError = $state<string | null>(null);

	// Confirmation modal
	let confirmAction = $state<{ type: 'hide' | 'remove'; project: Project } | null>(null);

	async function fetchProjects() {
		try {
			loading = true;
			error = null;

			const response = await fetch('/api/projects?stats=true');
			if (!response.ok) throw new Error('Failed to fetch projects');

			const data = await response.json();
			const allProjects: Project[] = data.projects || [];

			// Separate visible and hidden
			projects = allProjects.filter(p => p.visible !== false);
			hiddenProjects = allProjects.filter(p => p.visible === false);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load projects';
			console.error('[Projects] Fetch error:', err);
		} finally {
			loading = false;
		}
	}

	function openEditDrawer(project: Project) {
		editingProject = project;
		editForm = {
			displayName: project.displayName || project.name,
			path: project.path,
			port: project.port?.toString() || '',
			server_path: project.server_path || '',
			description: project.description || '',
			active_color: project.active_color || '#22c55e',
			inactive_color: project.inactive_color || '#6b7280'
		};
		saveError = null;
		editDrawerOpen = true;
	}

	function closeEditDrawer() {
		editDrawerOpen = false;
		editingProject = null;
		saveError = null;
	}

	async function saveProject() {
		if (!editingProject) return;

		try {
			saving = true;
			saveError = null;

			const response = await fetch('/api/projects', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: editingProject.name,
					updates: {
						displayName: editForm.displayName || undefined,
						path: editForm.path,
						port: editForm.port ? parseInt(editForm.port) : undefined,
						server_path: editForm.server_path || undefined,
						description: editForm.description || undefined,
						active_color: editForm.active_color,
						inactive_color: editForm.inactive_color
					}
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to save project');
			}

			closeEditDrawer();
			await fetchProjects();
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Failed to save';
		} finally {
			saving = false;
		}
	}

	async function toggleVisibility(project: Project, visible: boolean) {
		try {
			const response = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'setVisibility',
					projectName: project.name,
					visible
				})
			});

			if (!response.ok) throw new Error('Failed to update visibility');

			await fetchProjects();
		} catch (err) {
			console.error('[Projects] Toggle visibility error:', err);
		}
		confirmAction = null;
	}

	async function removeProject(project: Project) {
		try {
			const response = await fetch('/api/projects', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: project.name })
			});

			if (!response.ok) throw new Error('Failed to remove project');

			await fetchProjects();
		} catch (err) {
			console.error('[Projects] Remove error:', err);
		}
		confirmAction = null;
	}

	async function initBeads(project: Project) {
		try {
			const response = await fetch('/api/projects/init', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: project.path })
			});

			if (!response.ok) throw new Error('Failed to initialize Beads');

			await fetchProjects();
		} catch (err) {
			console.error('[Projects] Init beads error:', err);
		}
	}

	function handleProjectCreated() {
		createDrawerOpen = false;
		fetchProjects();
	}

	onMount(() => {
		fetchProjects();
	});
</script>

<svelte:head>
	<title>Projects | JAT Dashboard</title>
</svelte:head>

<div class="h-full bg-base-200 flex flex-col overflow-auto">
	<!-- Header -->
	<div class="sticky top-0 z-30 bg-base-200 border-b border-base-300 px-6 py-4">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold text-base-content">Projects</h1>
				<p class="text-sm text-base-content/60 mt-1">
					Manage your JAT projects and their configuration
				</p>
			</div>
			<button
				class="btn btn-primary"
				onclick={() => createDrawerOpen = true}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
				</svg>
				Add Project
			</button>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 p-6">
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{:else if error}
			<div class="alert alert-error">
				<span>{error}</span>
				<button class="btn btn-sm" onclick={fetchProjects}>Retry</button>
			</div>
		{:else}
			<!-- Active Projects -->
			<div class="space-y-4">
				{#each projects as project (project.name)}
					<div
						class="card bg-base-100 shadow-md border border-base-300 hover:border-primary/30 transition-colors"
						transition:fade={{ duration: 150 }}
					>
						<div class="card-body p-5">
							<!-- Header Row -->
							<div class="flex items-start justify-between gap-4">
								<div class="flex items-center gap-3">
									<!-- Status indicator -->
									<div
										class="w-3 h-3 rounded-full {project.stats?.hasBeads ? 'bg-success' : 'bg-base-300'}"
										title={project.stats?.hasBeads ? 'Beads initialized' : 'Beads not initialized'}
									></div>
									<div>
										<h2 class="text-lg font-semibold text-base-content">
											{project.displayName || project.name}
										</h2>
										{#if project.displayName && project.displayName !== project.name}
											<span class="text-xs text-base-content/50">{project.name}</span>
										{/if}
									</div>
								</div>

								<!-- Actions -->
								<div class="flex items-center gap-2">
									{#if !project.stats?.hasBeads}
										<button
											class="btn btn-sm btn-outline btn-warning"
											onclick={() => initBeads(project)}
										>
											Init Beads
										</button>
									{/if}
									<button
										class="btn btn-sm btn-ghost"
										onclick={() => openEditDrawer(project)}
									>
										Edit
									</button>
									<button
										class="btn btn-sm btn-ghost text-base-content/60"
										onclick={() => confirmAction = { type: 'hide', project }}
									>
										Hide
									</button>
								</div>
							</div>

							<!-- Details -->
							<div class="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
								<div class="text-base-content/60">
									<span class="font-medium">Path:</span>
									<span class="ml-2 font-mono text-base-content/80">{project.path}</span>
								</div>
								{#if project.port}
									<div class="text-base-content/60">
										<span class="font-medium">Port:</span>
										<span class="ml-2">{project.port}</span>
									</div>
								{/if}
								{#if project.server_path && project.server_path !== project.path}
									<div class="text-base-content/60">
										<span class="font-medium">Server:</span>
										<span class="ml-2 font-mono text-base-content/80">{project.server_path}</span>
									</div>
								{/if}
								{#if project.description}
									<div class="text-base-content/60 col-span-2">
										<span class="font-medium">Description:</span>
										<span class="ml-2">{project.description}</span>
									</div>
								{/if}
							</div>

							<!-- Status Badges -->
							<div class="mt-4 flex flex-wrap gap-2">
								<div class="badge {project.stats?.hasBeads ? 'badge-success' : 'badge-ghost'} gap-1">
									{#if project.stats?.hasBeads}
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
										</svg>
									{:else}
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
										</svg>
									{/if}
									Beads
								</div>

								<div class="badge badge-ghost gap-1">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
										<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
									</svg>
									{project.stats?.agentCount ?? 0} agents
								</div>

								<div class="badge badge-ghost gap-1">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
										<path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
										<path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
									</svg>
									{project.stats?.openTaskCount ?? 0}/{project.stats?.taskCount ?? 0} tasks
								</div>

								<div class="badge {project.stats?.serverRunning ? 'badge-success' : 'badge-ghost'} gap-1">
									{#if project.stats?.serverRunning}
										<span class="w-2 h-2 rounded-full bg-success animate-pulse"></span>
									{:else}
										<span class="w-2 h-2 rounded-full bg-base-300"></span>
									{/if}
									Server
								</div>
							</div>
						</div>
					</div>
				{/each}

				{#if projects.length === 0}
					<div class="text-center py-12">
						<div class="text-base-content/40 text-lg mb-4">No projects configured</div>
						<button
							class="btn btn-primary"
							onclick={() => createDrawerOpen = true}
						>
							Add Your First Project
						</button>
					</div>
				{/if}
			</div>

			<!-- Hidden Projects Section -->
			{#if hiddenProjects.length > 0}
				<div class="mt-8 border-t border-base-300 pt-6">
					<button
						class="flex items-center gap-2 text-base-content/60 hover:text-base-content transition-colors"
						onclick={() => showHidden = !showHidden}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 transition-transform {showHidden ? 'rotate-90' : ''}"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
						</svg>
						<span class="font-medium">Hidden Projects ({hiddenProjects.length})</span>
					</button>

					{#if showHidden}
						<div class="mt-4 space-y-3" transition:slide={{ duration: 200 }}>
							{#each hiddenProjects as project (project.name)}
								<div class="card bg-base-100/50 border border-base-300 p-4">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-3">
											<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-base-content/40" viewBox="0 0 20 20" fill="currentColor">
												<path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
												<path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
											</svg>
											<div>
												<span class="font-medium text-base-content/70">{project.displayName || project.name}</span>
												<span class="text-sm text-base-content/50 ml-2 font-mono">{project.path}</span>
											</div>
										</div>
										<div class="flex items-center gap-2">
											<button
												class="btn btn-sm btn-ghost"
												onclick={() => toggleVisibility(project, true)}
											>
												Unhide
											</button>
											<button
												class="btn btn-sm btn-ghost text-error/70"
												onclick={() => confirmAction = { type: 'remove', project }}
											>
												Remove
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Create Project Drawer -->
<CreateProjectDrawer
	bind:open={createDrawerOpen}
	onProjectCreated={handleProjectCreated}
/>

<!-- Edit Project Drawer -->
{#if editDrawerOpen && editingProject}
	<div class="drawer drawer-end z-50">
		<input type="checkbox" class="drawer-toggle" checked={editDrawerOpen} />
		<div class="drawer-side">
			<label class="drawer-overlay" onclick={closeEditDrawer}></label>
			<div class="bg-base-100 w-96 min-h-full p-6 shadow-2xl">
				<!-- Header -->
				<div class="flex items-center justify-between mb-6">
					<h3 class="text-lg font-bold">Edit Project</h3>
					<button class="btn btn-sm btn-ghost btn-circle" onclick={closeEditDrawer}>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
						</svg>
					</button>
				</div>

				<!-- Form -->
				<div class="space-y-4">
					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Display Name</span>
						</label>
						<input
							type="text"
							class="input input-bordered"
							bind:value={editForm.displayName}
							placeholder={editingProject.name}
						/>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Path</span>
							<span class="label-text-alt text-error">*</span>
						</label>
						<input
							type="text"
							class="input input-bordered font-mono text-sm"
							bind:value={editForm.path}
							required
						/>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Dev Server Port</span>
						</label>
						<input
							type="number"
							class="input input-bordered"
							bind:value={editForm.port}
							placeholder="3000"
						/>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Server Path</span>
							<span class="label-text-alt text-base-content/50">if different from project path</span>
						</label>
						<input
							type="text"
							class="input input-bordered font-mono text-sm"
							bind:value={editForm.server_path}
							placeholder={editForm.path}
						/>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Description</span>
						</label>
						<textarea
							class="textarea textarea-bordered"
							rows="2"
							bind:value={editForm.description}
							placeholder="Project description..."
						></textarea>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text font-medium">Badge Colors</span>
						</label>
						<div class="flex gap-4">
							<div class="flex items-center gap-2">
								<input
									type="color"
									class="w-8 h-8 rounded cursor-pointer"
									bind:value={editForm.active_color}
								/>
								<span class="text-sm text-base-content/60">Active</span>
							</div>
							<div class="flex items-center gap-2">
								<input
									type="color"
									class="w-8 h-8 rounded cursor-pointer"
									bind:value={editForm.inactive_color}
								/>
								<span class="text-sm text-base-content/60">Inactive</span>
							</div>
						</div>
					</div>

					{#if saveError}
						<div class="alert alert-error text-sm py-2">
							{saveError}
						</div>
					{/if}
				</div>

				<!-- Footer -->
				<div class="mt-8 flex justify-end gap-3">
					<button class="btn btn-ghost" onclick={closeEditDrawer}>
						Cancel
					</button>
					<button
						class="btn btn-primary"
						onclick={saveProject}
						disabled={saving || !editForm.path}
					>
						{#if saving}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Save Changes
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Confirmation Modal -->
{#if confirmAction}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg">
				{confirmAction.type === 'hide' ? 'Hide Project?' : 'Remove Project?'}
			</h3>
			<p class="py-4 text-base-content/70">
				{#if confirmAction.type === 'hide'}
					<strong>{confirmAction.project.displayName || confirmAction.project.name}</strong> will be hidden from the dashboard.
					You can unhide it later from the Hidden Projects section.
				{:else}
					<strong>{confirmAction.project.displayName || confirmAction.project.name}</strong> will be removed from JAT.
					This only removes the configuration - your project files will not be deleted.
				{/if}
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => confirmAction = null}>
					Cancel
				</button>
				{#if confirmAction.type === 'hide'}
					<button
						class="btn btn-warning"
						onclick={() => toggleVisibility(confirmAction!.project, false)}
					>
						Hide Project
					</button>
				{:else}
					<button
						class="btn btn-error"
						onclick={() => removeProject(confirmAction!.project)}
					>
						Remove Project
					</button>
				{/if}
			</div>
		</div>
		<div class="modal-backdrop bg-black/50" onclick={() => confirmAction = null}></div>
	</div>
{/if}
