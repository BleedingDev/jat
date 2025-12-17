<script lang="ts">
	/**
	 * CreateProjectDrawer Component
	 * DaisyUI drawer for adding new projects to the dashboard
	 *
	 * Features:
	 * - Text input for path or browse button
	 * - Directory browser via /api/directories
	 * - Validation that path is a git repo
	 * - Call bd init on selected path via /api/projects/init
	 * - Success/error feedback
	 * - Refresh project list on success
	 */

	import { tick } from 'svelte';
	import { isProjectDrawerOpen, closeProjectDrawer } from '$lib/stores/drawerStore';
	import { playSuccessChime, playErrorSound } from '$lib/utils/soundEffects';
	import { invalidateAll } from '$app/navigation';

	// Props
	interface Props {
		onProjectCreated?: () => void;
	}
	let { onProjectCreated }: Props = $props();

	// Directory listing types
	interface DirectoryInfo {
		path: string;
		name: string;
		isGitRepo: boolean;
		hasBeads: boolean;
	}

	// Reactive state from store
	let isOpen = $state(false);

	// Subscribe to store
	$effect(() => {
		const unsubscribe = isProjectDrawerOpen.subscribe(value => {
			isOpen = value;
		});
		return unsubscribe;
	});

	// Form state
	let pathInput = $state('');
	let pathInputRef: HTMLInputElement;

	// Directory browser state
	let directories = $state<DirectoryInfo[]>([]);
	let basePath = $state('');
	let isLoadingDirectories = $state(false);
	let directoryError = $state<string | null>(null);
	let showBrowser = $state(false);

	// Submission state
	let isSubmitting = $state(false);
	let submitError = $state<string | null>(null);
	let successMessage = $state<string | null>(null);

	// Validation state
	let validationStatus = $state<'idle' | 'checking' | 'valid' | 'invalid' | 'already-initialized'>('idle');
	let validationMessage = $state<string | null>(null);
	let selectedDirectory = $state<DirectoryInfo | null>(null);

	// Auto-focus when drawer opens
	$effect(() => {
		if (isOpen && pathInputRef) {
			requestAnimationFrame(() => {
				setTimeout(() => {
					if (pathInputRef && isOpen) {
						pathInputRef.focus();
					}
				}, 200);
			});
		}
	});

	// Load directories when browser is opened
	$effect(() => {
		if (showBrowser && directories.length === 0) {
			loadDirectories();
		}
	});

	// Fetch directories from API
	async function loadDirectories(path?: string) {
		isLoadingDirectories = true;
		directoryError = null;

		try {
			const url = path ? `/api/directories?path=${encodeURIComponent(path)}` : '/api/directories';
			const response = await fetch(url);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to load directories');
			}

			directories = data.directories || [];
			basePath = data.basePath || '~/code';
		} catch (error) {
			directoryError = error instanceof Error ? error.message : 'Failed to load directories';
			directories = [];
		} finally {
			isLoadingDirectories = false;
		}
	}

	// Select a directory from the browser
	function selectDirectory(dir: DirectoryInfo) {
		pathInput = dir.path;
		selectedDirectory = dir;
		showBrowser = false;

		// Update validation based on directory state
		if (dir.hasBeads) {
			validationStatus = 'already-initialized';
			validationMessage = 'Beads already initialized in this project';
		} else if (!dir.isGitRepo) {
			validationStatus = 'invalid';
			validationMessage = 'Not a git repository. Run "git init" first.';
		} else {
			validationStatus = 'valid';
			validationMessage = 'Ready to initialize';
		}
	}

	// Validate path input when it changes
	async function validatePath() {
		if (!pathInput.trim()) {
			validationStatus = 'idle';
			validationMessage = null;
			selectedDirectory = null;
			return;
		}

		validationStatus = 'checking';
		validationMessage = 'Checking path...';

		try {
			// Check if path exists and get its status
			const response = await fetch(`/api/directories?path=${encodeURIComponent(pathInput.trim())}`);
			const data = await response.json();

			if (!response.ok || data.error) {
				validationStatus = 'invalid';
				validationMessage = data.error || data.message || 'Path not found';
				selectedDirectory = null;
				return;
			}

			// Check if the path itself is a valid project directory
			// by looking for it in the parent directory listing
			const pathParts = pathInput.trim().split('/');
			const dirName = pathParts[pathParts.length - 1];
			const parentPath = pathParts.slice(0, -1).join('/') || '/';

			const parentResponse = await fetch(`/api/directories?path=${encodeURIComponent(parentPath)}`);
			const parentData = await parentResponse.json();

			const dirInfo = parentData.directories?.find((d: DirectoryInfo) => d.name === dirName || d.path === pathInput.trim());

			if (dirInfo) {
				selectedDirectory = dirInfo;
				if (dirInfo.hasBeads) {
					validationStatus = 'already-initialized';
					validationMessage = 'Beads already initialized in this project';
				} else if (!dirInfo.isGitRepo) {
					validationStatus = 'invalid';
					validationMessage = 'Not a git repository. Run "git init" first.';
				} else {
					validationStatus = 'valid';
					validationMessage = 'Ready to initialize';
				}
			} else {
				// Path exists (as a directory) but we couldn't find details
				// Let the API validate on submit
				validationStatus = 'valid';
				validationMessage = 'Path exists, click Add to initialize';
				selectedDirectory = null;
			}
		} catch {
			validationStatus = 'invalid';
			validationMessage = 'Failed to validate path';
			selectedDirectory = null;
		}
	}

	// Debounce validation
	let validationTimeout: ReturnType<typeof setTimeout>;
	function handlePathInput() {
		clearTimeout(validationTimeout);
		validationTimeout = setTimeout(validatePath, 500);
	}

	// Handle form submission
	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!pathInput.trim()) {
			submitError = 'Please enter a path or select a directory';
			return;
		}

		if (validationStatus === 'already-initialized') {
			submitError = 'This project is already initialized with Beads';
			return;
		}

		submitError = null;
		successMessage = null;
		isSubmitting = true;

		try {
			const response = await fetch('/api/projects/init', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: pathInput.trim() })
			});

			const data = await response.json();

			if (!response.ok || data.error) {
				throw new Error(data.message || 'Failed to initialize project');
			}

			// Success!
			successMessage = data.message || `Successfully added ${data.project?.name}`;
			playSuccessChime();

			// Invalidate all data to refresh project lists across the app
			await invalidateAll();

			// Call callback to refresh project list
			if (onProjectCreated) {
				onProjectCreated();
			}

			// Close drawer after short delay
			setTimeout(() => {
				resetForm();
				closeProjectDrawer();
			}, 1500);
		} catch (error) {
			submitError = error instanceof Error ? error.message : 'Failed to add project';
			playErrorSound();
		} finally {
			isSubmitting = false;
		}
	}

	// Reset form
	function resetForm() {
		pathInput = '';
		directories = [];
		basePath = '';
		showBrowser = false;
		validationStatus = 'idle';
		validationMessage = null;
		selectedDirectory = null;
		submitError = null;
		successMessage = null;
		directoryError = null;
	}

	// Handle close
	function handleClose() {
		if (!isSubmitting) {
			resetForm();
			closeProjectDrawer();
		}
	}

	// Get status badge color
	function getStatusColor(status: typeof validationStatus): string {
		switch (status) {
			case 'valid':
				return 'oklch(0.70 0.18 145)'; // Green
			case 'invalid':
			case 'already-initialized':
				return 'oklch(0.65 0.20 25)'; // Red/orange
			case 'checking':
				return 'oklch(0.70 0.18 240)'; // Blue
			default:
				return 'oklch(0.55 0.02 250)'; // Gray
		}
	}
</script>

<!-- DaisyUI Drawer -->
<div class="drawer drawer-end z-50">
	<input id="create-project-drawer" type="checkbox" class="drawer-toggle" bind:checked={isOpen} />

	<!-- Drawer side -->
	<div class="drawer-side">
		<label aria-label="close sidebar" class="drawer-overlay" onclick={handleClose}></label>

		<!-- Drawer Panel - Industrial style matching TaskCreationDrawer -->
		<div
			class="h-full w-full max-w-xl flex flex-col shadow-2xl"
			style="
				background: linear-gradient(180deg, oklch(0.18 0.01 250) 0%, oklch(0.16 0.01 250) 100%);
				border-left: 1px solid oklch(0.35 0.02 250);
			"
			role="dialog"
			aria-labelledby="drawer-title"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between p-6 relative"
				style="
					background: linear-gradient(180deg, oklch(0.22 0.01 250) 0%, oklch(0.20 0.01 250) 100%);
					border-bottom: 1px solid oklch(0.35 0.02 250);
				"
			>
				<!-- Left accent bar -->
				<div
					class="absolute left-0 top-0 bottom-0 w-1"
					style="background: linear-gradient(180deg, oklch(0.70 0.18 145) 0%, oklch(0.70 0.18 145 / 0.3) 100%);"
				></div>
				<div>
					<h2 id="drawer-title" class="text-xl font-bold font-mono uppercase tracking-wider" style="color: oklch(0.85 0.02 250);">
						Add Project
					</h2>
					<p class="text-sm mt-1" style="color: oklch(0.55 0.02 250);">
						Initialize a git repository with Beads
					</p>
				</div>
				<button
					class="btn btn-sm btn-circle btn-ghost"
					onclick={handleClose}
					disabled={isSubmitting}
					aria-label="Close drawer"
				>
					✕
				</button>
			</div>

			<!-- Content -->
			<form onsubmit={handleSubmit} class="flex-1 overflow-y-auto p-6 flex flex-col min-h-0" style="background: oklch(0.16 0.01 250);">
				<div class="space-y-6">
					<!-- Path Input -->
					<div class="form-control">
						<label class="label" for="project-path">
							<span class="label-text text-xs font-semibold font-mono uppercase tracking-wider" style="color: oklch(0.55 0.02 250);">
								Project Path
								<span class="text-error">*</span>
							</span>
						</label>
						<div class="flex items-center gap-2">
							<input
								id="project-path"
								type="text"
								placeholder="/path/to/my-project"
								class="input flex-1 font-mono"
								style="background: oklch(0.18 0.01 250); border: 1px solid oklch(0.35 0.02 250); color: oklch(0.80 0.02 250);"
								bind:this={pathInputRef}
								bind:value={pathInput}
								oninput={handlePathInput}
								disabled={isSubmitting}
								required
							/>
							<button
								type="button"
								class="btn btn-sm"
								style="background: oklch(0.25 0.02 250); border: 1px solid oklch(0.40 0.02 250); color: oklch(0.75 0.02 250);"
								onclick={() => { showBrowser = !showBrowser; if (showBrowser && directories.length === 0) loadDirectories(); }}
								disabled={isSubmitting}
							>
								{showBrowser ? 'Hide' : 'Browse'}
							</button>
						</div>

						<!-- Validation status -->
						{#if validationStatus !== 'idle'}
							<div class="flex items-center gap-2 mt-2">
								{#if validationStatus === 'checking'}
									<span class="loading loading-spinner loading-xs" style="color: oklch(0.70 0.18 240);"></span>
								{:else}
									<span
										class="w-2 h-2 rounded-full"
										style="background: {getStatusColor(validationStatus)};"
									></span>
								{/if}
								<span class="text-xs font-mono" style="color: {getStatusColor(validationStatus)};">
									{validationMessage}
								</span>
							</div>
						{/if}
					</div>

					<!-- Directory Browser -->
					{#if showBrowser}
						<div
							class="rounded-lg p-4"
							style="background: oklch(0.18 0.01 250); border: 1px solid oklch(0.30 0.02 250);"
						>
							<div class="flex items-center justify-between mb-3">
								<span class="text-xs font-mono" style="color: oklch(0.55 0.02 250);">
									{basePath}
								</span>
								<button
									type="button"
									class="btn btn-xs btn-ghost"
									onclick={() => loadDirectories()}
									disabled={isLoadingDirectories}
								>
									{#if isLoadingDirectories}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										Refresh
									{/if}
								</button>
							</div>

							{#if directoryError}
								<div class="text-sm text-error">{directoryError}</div>
							{:else if directories.length === 0 && !isLoadingDirectories}
								<div class="text-sm" style="color: oklch(0.55 0.02 250);">
									No directories found
								</div>
							{:else}
								<div class="max-h-64 overflow-y-auto space-y-1">
									{#each directories as dir}
										<button
											type="button"
											class="w-full text-left px-3 py-2 rounded transition-colors flex items-center gap-2"
											style="
												background: {pathInput === dir.path ? 'oklch(0.30 0.08 240 / 0.3)' : 'transparent'};
												border: 1px solid {pathInput === dir.path ? 'oklch(0.50 0.15 240 / 0.5)' : 'transparent'};
											"
											onclick={() => selectDirectory(dir)}
											disabled={isSubmitting}
										>
											<!-- Folder icon -->
											<svg class="w-4 h-4 flex-shrink-0" style="color: oklch(0.60 0.10 85);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
											</svg>

											<span class="flex-1 font-mono text-sm truncate" style="color: oklch(0.80 0.02 250);">
												{dir.name}
											</span>

											<!-- Status badges -->
											<div class="flex items-center gap-1">
												{#if dir.hasBeads}
													<span
														class="badge badge-xs"
														style="background: oklch(0.35 0.15 145); color: oklch(0.90 0.02 250);"
													>
														Beads
													</span>
												{/if}
												{#if dir.isGitRepo}
													<span
														class="badge badge-xs"
														style="background: oklch(0.35 0.10 250); color: oklch(0.90 0.02 250);"
													>
														Git
													</span>
												{:else}
													<span
														class="badge badge-xs"
														style="background: oklch(0.35 0.15 25); color: oklch(0.90 0.02 250);"
													>
														No Git
													</span>
												{/if}
											</div>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Info about requirements -->
					<div
						class="rounded-lg p-4"
						style="background: oklch(0.20 0.05 240 / 0.15); border: 1px solid oklch(0.40 0.10 240 / 0.3);"
					>
						<h4 class="text-xs font-semibold font-mono uppercase tracking-wider mb-2" style="color: oklch(0.70 0.15 240);">
							Requirements
						</h4>
						<ul class="space-y-1 text-sm" style="color: oklch(0.65 0.02 250);">
							<li class="flex items-center gap-2">
								<svg class="w-4 h-4 flex-shrink-0" style="color: oklch(0.70 0.18 145);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								<span>Must be a git repository</span>
							</li>
							<li class="flex items-center gap-2">
								<svg class="w-4 h-4 flex-shrink-0" style="color: oklch(0.70 0.18 145);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								<span>Not already initialized with Beads</span>
							</li>
						</ul>
					</div>

					<!-- Error Message -->
					{#if submitError}
						<div
							class="alert font-mono text-sm"
							style="background: oklch(0.35 0.15 25); border: 1px solid oklch(0.50 0.18 25); color: oklch(0.95 0.02 250);"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="stroke-current shrink-0 h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span>{submitError}</span>
						</div>
					{/if}

					<!-- Success Message -->
					{#if successMessage}
						<div
							class="alert font-mono text-sm"
							style="background: oklch(0.35 0.15 150); border: 1px solid oklch(0.50 0.18 150); color: oklch(0.95 0.02 250);"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="stroke-current shrink-0 h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span>{successMessage}</span>
						</div>
					{/if}
				</div>
			</form>

			<!-- Footer -->
			<div
				class="p-6"
				style="
					background: linear-gradient(180deg, oklch(0.20 0.01 250) 0%, oklch(0.18 0.01 250) 100%);
					border-top: 1px solid oklch(0.35 0.02 250);
				"
			>
				<div class="flex items-center justify-end gap-3">
					<button
						type="button"
						class="btn btn-ghost"
						onclick={handleClose}
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="btn btn-primary font-mono"
						onclick={handleSubmit}
						disabled={isSubmitting || validationStatus === 'checking' || validationStatus === 'invalid' || validationStatus === 'already-initialized'}
					>
						{#if isSubmitting}
							<span class="loading loading-spinner loading-sm"></span>
							Adding...
						{:else}
							Add Project
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
