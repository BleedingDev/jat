<script lang="ts">
	/**
	 * TaskCreationDrawer Component
	 * DaisyUI drawer for creating new tasks from command palette
	 *
	 * Features:
	 * - Side panel drawer (doesn't block view)
	 * - Form validation for required fields
	 * - POST to /api/tasks endpoint
	 * - Success/error handling with visual feedback
	 * - File attachment dropzone (supports multiple files)
	 */

	import { goto } from '$app/navigation';
	import { tick, onMount, onDestroy } from 'svelte';
	import { isTaskDrawerOpen } from '$lib/stores/drawerStore';
	import { broadcastTaskEvent } from '$lib/stores/taskEvents';

	// Type for pending attachments (before upload)
	interface PendingAttachment {
		id: string;
		file: File;
		preview: string; // Object URL for preview
		type: 'image' | 'file';
	}

	// Reactive state from store
	let isOpen = $state(false);

	// Subscribe to store
	$effect(() => {
		const unsubscribe = isTaskDrawerOpen.subscribe(value => {
			isOpen = value;
		});
		return unsubscribe;
	});

	// Auto-focus when drawer opens
	onMount(() => {
		const drawerToggle = document.getElementById('task-creation-drawer');
		if (drawerToggle) {
			drawerToggle.addEventListener('change', (e) => {
				if (e.target.checked) {
					// 100ms delay for reliable focus (flush pattern)
					setTimeout(() => {
						if (titleInput) {
							titleInput.focus();
							// Force focus if it didn't work
							if (document.activeElement !== titleInput) {
								titleInput.focus();
							}
						}
					}, 100);
				}
			});
		}
	});

	// Reactive auto-focus with 150ms delay (flush pattern)
	$effect(() => {
		if (isOpen && titleInput) {
			setTimeout(() => {
				if (titleInput) {
					titleInput.focus();
				}
			}, 150);
		}
	});

	// Form state
	let formData = $state({
		title: '',
		description: '',
		priority: 1,
		type: 'task',
		project: '',
		labels: ''
	});

	// Selected dependencies state (array of task objects)
	interface SelectedDependency {
		id: string;
		title: string;
		status: string;
		priority: number;
	}
	let selectedDependencies = $state<SelectedDependency[]>([]);

	// Available tasks for dependencies dropdown
	interface AvailableTask {
		id: string;
		title: string;
		status: string;
		priority: number;
	}
	let availableTasks = $state<AvailableTask[]>([]);
	let availableTasksLoading = $state(false);
	let showDependencyDropdown = $state(false);

	// Attachment state
	let pendingAttachments = $state<PendingAttachment[]>([]);
	let isDragOver = $state(false);
	let dropzoneRef: HTMLDivElement | null = null;
	let fileInputRef: HTMLInputElement | null = null;

	// UI state
	let isSubmitting = $state(false);
	let validationErrors = $state({});
	let submitError = $state(null);
	let successMessage = $state(null);
	let titleInput: HTMLInputElement;

	// Available options
	const priorityOptions = [
		{ value: 0, label: 'P0 (Critical)' },
		{ value: 1, label: 'P1 (High)' },
		{ value: 2, label: 'P2 (Medium)' },
		{ value: 3, label: 'P3 (Low)' },
		{ value: 4, label: 'P4 (Lowest)' }
	];

	const typeOptions = [
		{ value: 'task', label: 'Task', icon: '📋' },
		{ value: 'bug', label: 'Bug', icon: '🐛' },
		{ value: 'feature', label: 'Feature', icon: '✨' },
		{ value: 'epic', label: 'Epic', icon: '🏔️' },
		{ value: 'chore', label: 'Chore', icon: '🔧' }
	];

	// Projects list (could be fetched from API in future)
	const projectOptions = ['jat', 'chimaro', 'jomarchy'];

	// Priority badge colors
	const priorityColors: Record<number, string> = {
		0: 'badge-error', // P0 - Critical
		1: 'badge-warning', // P1 - High
		2: 'badge-info', // P2 - Medium
		3: 'badge-ghost', // P3 - Low
		4: 'badge-ghost' // P4 - Lowest
	};

	// Fetch available tasks for dependencies dropdown when project changes
	async function fetchAvailableTasks(project: string) {
		if (!project) {
			availableTasks = [];
			return;
		}

		availableTasksLoading = true;

		try {
			// Fetch open/in_progress tasks from selected project
			const response = await fetch(`/api/agents?full=true&project=${encodeURIComponent(project)}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch tasks: ${response.statusText}`);
			}
			const data = await response.json();

			// Filter to open/in_progress tasks, excluding already selected dependencies
			const selectedIds = selectedDependencies.map(d => d.id);
			availableTasks = (data.tasks || [])
				.filter((t: any) =>
					!selectedIds.includes(t.id) &&
					(t.status === 'open' || t.status === 'in_progress')
				)
				.map((t: any) => ({
					id: t.id,
					title: t.title,
					status: t.status,
					priority: t.priority
				}))
				.sort((a: AvailableTask, b: AvailableTask) => a.priority - b.priority);
		} catch (err: any) {
			console.error('Error fetching available tasks:', err);
			availableTasks = [];
		} finally {
			availableTasksLoading = false;
		}
	}

	// Watch for project changes to refresh available tasks
	$effect(() => {
		if (formData.project) {
			fetchAvailableTasks(formData.project);
		} else {
			availableTasks = [];
		}
	});

	// Add a dependency to the selected list
	function addDependency(task: AvailableTask) {
		selectedDependencies = [...selectedDependencies, task];
		// Remove from available list
		availableTasks = availableTasks.filter(t => t.id !== task.id);
		showDependencyDropdown = false;
	}

	// Remove a dependency from the selected list
	function removeDependency(taskId: string) {
		const removed = selectedDependencies.find(d => d.id === taskId);
		selectedDependencies = selectedDependencies.filter(d => d.id !== taskId);
		// Add back to available list if it exists
		if (removed) {
			availableTasks = [...availableTasks, removed].sort((a, b) => a.priority - b.priority);
		}
	}

	// Cleanup object URLs when component is destroyed
	onDestroy(() => {
		pendingAttachments.forEach(att => URL.revokeObjectURL(att.preview));
	});

	// Handle file selection (from input or drop)
	function handleFiles(files: FileList | File[]) {
		const fileArray = Array.from(files);

		for (const file of fileArray) {
			// Generate unique ID
			const id = `att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

			// Determine type and create preview
			const isImage = file.type.startsWith('image/');
			const preview = isImage ? URL.createObjectURL(file) : '';

			pendingAttachments = [...pendingAttachments, {
				id,
				file,
				preview,
				type: isImage ? 'image' : 'file'
			}];
		}
	}

	// Handle drop event
	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			handleFiles(files);
		}
	}

	// Handle drag over
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
	}

	// Handle drag leave
	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		// Only set to false if leaving the dropzone entirely
		const rect = dropzoneRef?.getBoundingClientRect();
		if (rect) {
			const x = event.clientX;
			const y = event.clientY;
			if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
				isDragOver = false;
			}
		}
	}

	// Remove an attachment
	function removeAttachment(id: string) {
		const att = pendingAttachments.find(a => a.id === id);
		if (att && att.preview) {
			URL.revokeObjectURL(att.preview);
		}
		pendingAttachments = pendingAttachments.filter(a => a.id !== id);
	}

	// Open file picker
	function openFilePicker() {
		fileInputRef?.click();
	}

	// Handle file input change
	function handleFileInputChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			handleFiles(input.files);
			// Reset input so same file can be selected again
			input.value = '';
		}
	}

	// Upload attachments for a task
	async function uploadAttachments(taskId: string): Promise<boolean> {
		let allSuccess = true;

		for (const att of pendingAttachments) {
			try {
				// Step 1: Upload file to server via /api/work/upload-image
				const formData = new FormData();
				formData.append('image', att.file, `task-${taskId}-${Date.now()}-${att.file.name}`);
				formData.append('sessionName', `task-${taskId}`);

				const uploadResponse = await fetch('/api/work/upload-image', {
					method: 'POST',
					body: formData
				});

				if (!uploadResponse.ok) {
					console.error('Failed to upload file:', att.file.name);
					allSuccess = false;
					continue;
				}

				const { filePath } = await uploadResponse.json();

				// Step 2: Store the file path in task-images.json via /api/tasks/{id}/image
				const saveResponse = await fetch(`/api/tasks/${taskId}/image`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						path: filePath,
						id: att.id
					})
				});

				if (!saveResponse.ok) {
					console.error('Failed to save attachment metadata:', att.file.name);
					allSuccess = false;
				}
			} catch (err) {
				console.error('Error processing attachment:', err);
				allSuccess = false;
			}
		}

		return allSuccess;
	}

	// Format file size for display
	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	// Validate form
	function validateForm() {
		const errors = {};

		if (!formData.title.trim()) {
			errors.title = 'Title is required';
		}

		if (!formData.type) {
			errors.type = 'Type is required';
		}

		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	// Handle form submission
	async function handleSubmit(e: Event) {
		e.preventDefault();

		// Reset previous errors
		submitError = null;
		successMessage = null;

		// Validate form
		if (!validateForm()) {
			return;
		}

		isSubmitting = true;

		try {
			// Parse labels
			const labels = formData.labels
				.split(',')
				.map((l) => l.trim())
				.filter((l) => l.length > 0);

			// Get dependencies from selected list
			const dependencies = selectedDependencies.map(d => d.id);

			// Prepare request body
			const requestBody = {
				title: formData.title.trim(),
				description: formData.description.trim() || undefined,
				priority: formData.priority,
				type: formData.type,
				project: formData.project.trim() || undefined,
				labels: labels.length > 0 ? labels : undefined,
				deps: dependencies.length > 0 ? dependencies : undefined
			};

			// POST to API endpoint
			const response = await fetch('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to create task');
			}

			const data = await response.json();
			const taskId = data.task.id;

			// Upload attachments if any
			if (pendingAttachments.length > 0) {
				const uploadSuccess = await uploadAttachments(taskId);
				if (!uploadSuccess) {
					console.warn('Some attachments failed to upload');
				}
			}

			// Success!
			successMessage = `Task ${taskId} created successfully!`;

			// Broadcast task created event so pages can refresh immediately
			broadcastTaskEvent('task-created', taskId);

			// Handle different save actions
			if (pendingSaveAction === 'new') {
				// Save and New: Reset form but keep drawer open
				setTimeout(async () => {
					resetForm();
					successMessage = null;
					// Focus back on title field
					await tick();
					if (titleInput) {
						titleInput.focus();
					}
				}, 800);
			} else if (pendingSaveAction === 'start') {
				// Save and Start: Close drawer and navigate to task (start working)
				// For now, just close - actual "start" would trigger /jat:start
				setTimeout(() => {
					resetForm();
					isTaskDrawerOpen.set(false);
					successMessage = null;
					// TODO: Could trigger task start workflow here
					// For now, broadcast an additional event
					broadcastTaskEvent('task-start-requested', taskId);
				}, 800);
			} else {
				// Save and Close (default): Reset form and close drawer
				setTimeout(() => {
					resetForm();
					isTaskDrawerOpen.set(false);
					successMessage = null;
				}, 1500);
			}
		} catch (error) {
			console.error('Error creating task:', error);
			submitError = error.message || 'Failed to create task. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}

	// Reset form to initial state
	function resetForm() {
		formData = {
			title: '',
			description: '',
			priority: 1,
			type: 'task',
			project: '',
			labels: ''
		};
		validationErrors = {};
		submitError = null;
		successMessage = null;

		// Reset dependencies
		selectedDependencies = [];
		availableTasks = [];
		showDependencyDropdown = false;

		// Cleanup and reset attachments
		pendingAttachments.forEach(att => {
			if (att.preview) URL.revokeObjectURL(att.preview);
		});
		pendingAttachments = [];
		isDragOver = false;
	}

	// Track which save action to perform after submission
	type SaveAction = 'close' | 'new' | 'start';
	let pendingSaveAction = $state<SaveAction>('close');

	// Handle drawer close
	function handleClose() {
		if (!isSubmitting) {
			resetForm();
			isTaskDrawerOpen.set(false);
		}
	}

	// Handle cancel button
	function handleCancel() {
		if (!isSubmitting) {
			resetForm();
			isTaskDrawerOpen.set(false);
		}
	}

	// Unified submit handler for all save actions
	async function submitWithAction(action: SaveAction) {
		pendingSaveAction = action;

		// Create a synthetic event for handleSubmit
		const syntheticEvent = { preventDefault: () => {} } as Event;
		await handleSubmit(syntheticEvent);
	}

	// Handle keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		// Cmd/Ctrl + Shift + Enter = Save and New
		if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'Enter') {
			event.preventDefault();
			if (!isSubmitting) {
				submitWithAction('new');
			}
		}
		// Cmd/Ctrl + Enter = Save and Close (default)
		else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault();
			if (!isSubmitting) {
				submitWithAction('close');
			}
		}
	}
</script>

<!-- DaisyUI Drawer -->
<div class="drawer drawer-end z-50">
	<input id="task-creation-drawer" type="checkbox" class="drawer-toggle" bind:checked={isOpen} />

	<!-- Drawer side -->
	<div class="drawer-side">
		<label aria-label="close sidebar" class="drawer-overlay" onclick={handleClose}></label>

		<!-- Drawer Panel - Industrial -->
		<div
			class="min-h-full w-full max-w-2xl flex flex-col shadow-2xl"
			style="
				background: linear-gradient(180deg, oklch(0.18 0.01 250) 0%, oklch(0.16 0.01 250) 100%);
				border-left: 1px solid oklch(0.35 0.02 250);
			"
			role="dialog"
			aria-labelledby="drawer-title"
			onkeydown={handleKeydown}
		>
			<!-- Header - Industrial -->
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
					style="background: linear-gradient(180deg, oklch(0.70 0.18 240) 0%, oklch(0.70 0.18 240 / 0.3) 100%);"
				></div>
				<div>
					<h2 id="drawer-title" class="text-xl font-bold font-mono uppercase tracking-wider" style="color: oklch(0.85 0.02 250);">Create New Task</h2>
					<p class="text-sm mt-1" style="color: oklch(0.55 0.02 250);">
						Fill in the details below to create a new task
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

			<!-- Form - Industrial -->
			<form onsubmit={handleSubmit} class="flex-1 overflow-y-auto p-6" style="background: oklch(0.16 0.01 250);">
				<div class="space-y-6">
					<!-- Title (Required) - Industrial -->
					<div class="form-control">
						<label class="label" for="task-title">
							<span class="label-text text-xs font-semibold font-mono uppercase tracking-wider" style="color: oklch(0.55 0.02 250);">
								Title
								<span class="text-error">*</span>
							</span>
						</label>
						<input
							id="task-title"
							type="text"
							placeholder="Enter task title..."
							class="input w-full font-mono {validationErrors.title ? 'input-error' : ''}"
							style="background: oklch(0.18 0.01 250); border: 1px solid oklch(0.35 0.02 250); color: oklch(0.80 0.02 250);"
							bind:this={titleInput}
							bind:value={formData.title}
							disabled={isSubmitting}
							required
							autofocus={isOpen}
						/>
						{#if validationErrors.title}
							<label class="label">
								<span class="label-text-alt text-error">{validationErrors.title}</span>
							</label>
						{/if}
					</div>

					<!-- Description (Optional) - Industrial -->
					<div class="form-control">
						<label class="label" for="task-description">
							<span class="label-text text-xs font-semibold font-mono uppercase tracking-wider" style="color: oklch(0.55 0.02 250);">Description</span>
						</label>
						<textarea
							id="task-description"
							placeholder="Enter task description (optional)..."
							class="textarea w-full h-32 font-mono"
							style="background: oklch(0.18 0.01 250); border: 1px solid oklch(0.35 0.02 250); color: oklch(0.80 0.02 250);"
							bind:value={formData.description}
							disabled={isSubmitting}
						></textarea>
						<label class="label">
							<span class="label-text-alt" style="color: oklch(0.50 0.02 250);">
								Supports markdown formatting
							</span>
						</label>
					</div>

					<!-- Priority & Type Row - Industrial -->
					<div class="grid grid-cols-2 gap-4">
						<!-- Priority (Required) - Industrial -->
						<div class="form-control">
							<label class="label" for="task-priority">
								<span class="label-text text-xs font-semibold font-mono uppercase tracking-wider" style="color: oklch(0.55 0.02 250);">
									Priority
									<span class="text-error">*</span>
								</span>
							</label>
							<select
								id="task-priority"
								class="select w-full font-mono"
								style="background: oklch(0.18 0.01 250); border: 1px solid oklch(0.35 0.02 250); color: oklch(0.80 0.02 250);"
								bind:value={formData.priority}
								disabled={isSubmitting}
								required
							>
								{#each priorityOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>

						<!-- Type (Required) - Industrial -->
						<div class="form-control">
							<label class="label" for="task-type">
								<span class="label-text text-xs font-semibold font-mono uppercase tracking-wider" style="color: oklch(0.55 0.02 250);">
									Type
									<span class="text-error">*</span>
								</span>
							</label>
							<select
								id="task-type"
								class="select w-full font-mono {validationErrors.type ? 'select-error' : ''}"
								style="background: oklch(0.18 0.01 250); border: 1px solid oklch(0.35 0.02 250); color: oklch(0.80 0.02 250);"
								bind:value={formData.type}
								disabled={isSubmitting}
								required
							>
								{#each typeOptions as option}
									<option value={option.value}>{option.icon} {option.label}</option>
								{/each}
							</select>
							{#if validationErrors.type}
								<label class="label">
									<span class="label-text-alt text-error">{validationErrors.type}</span>
								</label>
							{/if}
						</div>
					</div>

					<!-- Project (Optional) - Industrial -->
					<div class="form-control">
						<label class="label" for="task-project">
							<span class="label-text text-xs font-semibold font-mono uppercase tracking-wider" style="color: oklch(0.55 0.02 250);">Project</span>
						</label>
						<select
							id="task-project"
							class="select w-full font-mono"
							style="background: oklch(0.18 0.01 250); border: 1px solid oklch(0.35 0.02 250); color: oklch(0.80 0.02 250);"
							bind:value={formData.project}
							disabled={isSubmitting}
						>
							<option value="">Select project (optional)</option>
							{#each projectOptions as project}
								<option value={project}>{project}</option>
							{/each}
						</select>
						<label class="label">
							<span class="label-text-alt" style="color: oklch(0.50 0.02 250);">
								Leave empty for auto-assignment
							</span>
						</label>
					</div>

					<!-- Labels (Optional) - Industrial -->
					<div class="form-control">
						<label class="label" for="task-labels">
							<span class="label-text text-xs font-semibold font-mono uppercase tracking-wider" style="color: oklch(0.55 0.02 250);">Labels</span>
						</label>
						<input
							id="task-labels"
							type="text"
							placeholder="e.g., frontend, urgent, bug-fix"
							class="input w-full font-mono"
							style="background: oklch(0.18 0.01 250); border: 1px solid oklch(0.35 0.02 250); color: oklch(0.80 0.02 250);"
							bind:value={formData.labels}
							disabled={isSubmitting}
						/>
						<label class="label">
							<span class="label-text-alt" style="color: oklch(0.50 0.02 250);">
								Comma-separated list of labels
							</span>
						</label>
					</div>

					<!-- Dependencies (Optional) - Industrial -->
					<div class="form-control">
						<div class="flex items-center justify-between mb-2">
							<span class="label-text text-xs font-semibold font-mono uppercase tracking-wider" style="color: oklch(0.55 0.02 250);">
								Dependencies
								{#if selectedDependencies.length > 0}
									<span class="ml-1 badge badge-xs" style="background: oklch(0.30 0.02 250); color: oklch(0.70 0.02 250);">{selectedDependencies.length}</span>
								{/if}
							</span>
							<!-- Add dependency button -->
							<div class="relative">
								<button
									type="button"
									class="btn btn-xs btn-ghost gap-1"
									onclick={() => showDependencyDropdown = !showDependencyDropdown}
									disabled={isSubmitting || availableTasksLoading || !formData.project}
									title={!formData.project ? 'Select a project first' : 'Add dependency'}
								>
									{#if availableTasksLoading}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
										</svg>
									{/if}
									Add
								</button>

								<!-- Dropdown menu - Industrial -->
								{#if showDependencyDropdown}
									<div
										class="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-xl w-72 max-h-64 overflow-y-auto"
										style="background: oklch(0.18 0.01 250); border: 1px solid oklch(0.35 0.02 250);"
									>
										{#if availableTasks.length === 0}
											<div class="p-3 text-sm text-base-content/50 text-center">
												No available tasks in this project
											</div>
										{:else}
											<div class="py-1">
												{#each availableTasks as availTask}
													<button
														type="button"
														class="w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-base-300/30 transition-colors"
														onclick={() => addDependency(availTask)}
														disabled={isSubmitting}
													>
														<span class="badge badge-xs {priorityColors[availTask.priority] || 'badge-ghost'}">
															P{availTask.priority}
														</span>
														<span class="font-mono text-xs text-base-content/60">{availTask.id}</span>
														<span class="flex-1 truncate">{availTask.title}</span>
													</button>
												{/each}
											</div>
										{/if}
										<!-- Close button - Industrial -->
										<div class="p-2" style="border-top: 1px solid oklch(0.35 0.02 250);">
											<button
												type="button"
												class="btn btn-xs btn-ghost w-full"
												onclick={() => showDependencyDropdown = false}
											>
												Cancel
											</button>
										</div>
									</div>
								{/if}
							</div>
						</div>

						<!-- Selected dependencies list -->
						{#if selectedDependencies.length > 0}
							<div class="space-y-2 p-2 rounded" style="background: oklch(0.18 0.01 250);">
								{#each selectedDependencies as dep (dep.id)}
									<div
										class="flex items-center gap-2 text-sm p-2 rounded group"
										style="background: oklch(0.20 0.01 250); border-left: 2px solid oklch(0.70 0.18 240 / 0.3);"
									>
										<span class="badge badge-xs {priorityColors[dep.priority] || 'badge-ghost'}">
											P{dep.priority}
										</span>
										<span class="font-mono text-xs">{dep.id}</span>
										<span class="flex-1 truncate">{dep.title}</span>
										<!-- Remove button -->
										<button
											type="button"
											class="btn btn-xs btn-ghost btn-circle opacity-0 group-hover:opacity-100 transition-opacity text-error hover:bg-error/10"
											onclick={() => removeDependency(dep.id)}
											disabled={isSubmitting}
											title="Remove dependency"
										>
											<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
												<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
											</svg>
										</button>
									</div>
								{/each}
							</div>
						{:else}
							<div class="p-3 rounded text-center" style="background: oklch(0.18 0.01 250);">
								{#if formData.project}
									<span class="text-sm" style="color: oklch(0.45 0.02 250);">No dependencies selected</span>
									<p class="text-xs mt-1" style="color: oklch(0.40 0.02 250);">Click "Add" to select tasks this depends on</p>
								{:else}
									<span class="text-sm" style="color: oklch(0.45 0.02 250);">Select a project first</span>
									<p class="text-xs mt-1" style="color: oklch(0.40 0.02 250);">Dependencies are loaded based on the selected project</p>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Attachments Dropzone - Industrial -->
					<div class="form-control">
						<label class="label">
							<span class="label-text text-xs font-semibold font-mono uppercase tracking-wider" style="color: oklch(0.55 0.02 250);">
								Attachments
							</span>
							{#if pendingAttachments.length > 0}
								<span class="label-text-alt font-mono" style="color: oklch(0.70 0.18 240);">
									{pendingAttachments.length} file{pendingAttachments.length !== 1 ? 's' : ''}
								</span>
							{/if}
						</label>

						<!-- Hidden file input -->
						<input
							type="file"
							multiple
							accept="image/*,.pdf,.txt,.md,.json,.csv"
							class="hidden"
							bind:this={fileInputRef}
							onchange={handleFileInputChange}
							disabled={isSubmitting}
						/>

						<!-- Dropzone -->
						<div
							bind:this={dropzoneRef}
							class="relative rounded-lg p-6 text-center cursor-pointer transition-all duration-200"
							style="
								background: {isDragOver ? 'oklch(0.25 0.08 240 / 0.3)' : 'oklch(0.18 0.01 250)'};
								border: 2px dashed {isDragOver ? 'oklch(0.70 0.18 240)' : 'oklch(0.35 0.02 250)'};
							"
							ondrop={handleDrop}
							ondragover={handleDragOver}
							ondragleave={handleDragLeave}
							onclick={openFilePicker}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && openFilePicker()}
						>
							{#if isDragOver}
								<div class="pointer-events-none">
									<svg class="w-12 h-12 mx-auto mb-3" style="color: oklch(0.70 0.18 240);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
									</svg>
									<p class="font-mono text-sm" style="color: oklch(0.70 0.18 240);">
										Drop files here
									</p>
								</div>
							{:else}
								<svg class="w-10 h-10 mx-auto mb-2" style="color: oklch(0.50 0.02 250);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								<p class="font-mono text-sm" style="color: oklch(0.55 0.02 250);">
									Drop files here or click to browse
								</p>
								<p class="font-mono text-xs mt-1" style="color: oklch(0.45 0.02 250);">
									Images, PDFs, text files supported
								</p>
							{/if}
						</div>

						<!-- Attached Files List -->
						{#if pendingAttachments.length > 0}
							<div class="mt-3 space-y-2">
								{#each pendingAttachments as att (att.id)}
									<div
										class="flex items-center gap-3 p-2 rounded-lg"
										style="background: oklch(0.20 0.01 250); border: 1px solid oklch(0.30 0.02 250);"
									>
										<!-- Preview/Icon -->
										{#if att.type === 'image' && att.preview}
											<img
												src={att.preview}
												alt={att.file.name}
												class="w-10 h-10 object-cover rounded"
											/>
										{:else}
											<div
												class="w-10 h-10 flex items-center justify-center rounded"
												style="background: oklch(0.25 0.02 250);"
											>
												<svg class="w-5 h-5" style="color: oklch(0.55 0.02 250);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
												</svg>
											</div>
										{/if}

										<!-- File info -->
										<div class="flex-1 min-w-0">
											<p class="font-mono text-sm truncate" style="color: oklch(0.80 0.02 250);">
												{att.file.name}
											</p>
											<p class="font-mono text-xs" style="color: oklch(0.50 0.02 250);">
												{formatFileSize(att.file.size)}
											</p>
										</div>

										<!-- Remove button -->
										<button
											type="button"
											class="btn btn-ghost btn-sm btn-circle"
											onclick={(e) => { e.stopPropagation(); removeAttachment(att.id); }}
											disabled={isSubmitting}
											aria-label="Remove attachment"
										>
											<svg class="w-4 h-4" style="color: oklch(0.60 0.15 25);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Error Message - Industrial -->
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

					<!-- Success Message - Industrial -->
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

			<!-- Footer Actions - Industrial -->
			<div
				class="p-6"
				style="
					background: linear-gradient(180deg, oklch(0.20 0.01 250) 0%, oklch(0.18 0.01 250) 100%);
					border-top: 1px solid oklch(0.35 0.02 250);
				"
			>
				<div class="flex items-center justify-between">
					<!-- Keyboard shortcuts hint (shows on hover) -->
					<div class="text-xs font-mono hidden sm:block" style="color: oklch(0.45 0.02 250);">
						<span class="opacity-0 group-hover:opacity-100 transition-opacity">
							⌘↵ Save · ⌘⇧↵ Save & New
						</span>
					</div>

					<div class="flex gap-3">
						<button
							type="button"
							class="btn btn-ghost"
							onclick={handleCancel}
							disabled={isSubmitting}
						>
							Cancel
						</button>

						<!-- Split button with dropdown -->
						<div class="join">
							<!-- Main action: Create Task (Save and Close) -->
							<button
								type="submit"
								class="btn btn-primary font-mono join-item"
								onclick={() => submitWithAction('close')}
								disabled={isSubmitting}
							>
								{#if isSubmitting}
									<span class="loading loading-spinner loading-sm"></span>
									Creating...
								{:else}
									Create Task
								{/if}
							</button>

							<!-- Dropdown for additional save options -->
							<div class="dropdown dropdown-end dropdown-top">
								<button
									type="button"
									tabindex="0"
									class="btn btn-primary join-item border-l border-primary-content/20"
									disabled={isSubmitting}
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								</button>
								<ul
									tabindex="0"
									class="dropdown-content menu rounded-box z-[1] w-52 p-2 shadow-lg"
									style="background: oklch(0.22 0.01 250); border: 1px solid oklch(0.35 0.02 250);"
								>
									<li>
										<button
											type="button"
											class="font-mono text-sm flex items-center gap-2"
											style="color: oklch(0.80 0.02 250);"
											onclick={() => submitWithAction('close')}
											disabled={isSubmitting}
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
											Save
											<span class="ml-auto text-xs" style="color: oklch(0.50 0.02 250);">⌘↵</span>
										</button>
									</li>
									<li>
										<button
											type="button"
											class="font-mono text-sm flex items-center gap-2"
											style="color: oklch(0.80 0.02 250);"
											onclick={() => submitWithAction('new')}
											disabled={isSubmitting}
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
											</svg>
											Save & New
											<span class="ml-auto text-xs" style="color: oklch(0.50 0.02 250);">⌘⇧↵</span>
										</button>
									</li>
									<li>
										<button
											type="button"
											class="font-mono text-sm flex items-center gap-2"
											style="color: oklch(0.80 0.02 250);"
											onclick={() => submitWithAction('start')}
											disabled={isSubmitting}
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											Save & Start
										</button>
									</li>
								</ul>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
