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
		labels: '',
		dependencies: ''
	});

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
		{ value: 'task', label: 'Task' },
		{ value: 'bug', label: 'Bug' },
		{ value: 'feature', label: 'Feature' },
		{ value: 'epic', label: 'Epic' },
		{ value: 'chore', label: 'Chore' }
	];

	// Projects list (could be fetched from API in future)
	const projectOptions = ['jat', 'chimaro', 'jomarchy'];

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
				// For images, we store the file path
				// For this implementation, we'll use a base64 data URL for simplicity
				// In production, you'd want proper file upload to a storage service
				const reader = new FileReader();

				await new Promise<void>((resolve, reject) => {
					reader.onload = async () => {
						try {
							const response = await fetch(`/api/tasks/${taskId}/image`, {
								method: 'PUT',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									path: reader.result as string,
									id: att.id
								})
							});

							if (!response.ok) {
								console.error('Failed to upload attachment:', att.file.name);
								allSuccess = false;
							}
							resolve();
						} catch (err) {
							console.error('Error uploading attachment:', err);
							allSuccess = false;
							resolve();
						}
					};
					reader.onerror = () => {
						console.error('Error reading file:', att.file.name);
						allSuccess = false;
						resolve();
					};
					reader.readAsDataURL(att.file);
				});
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
			// Parse labels and dependencies
			const labels = formData.labels
				.split(',')
				.map((l) => l.trim())
				.filter((l) => l.length > 0);

			const dependencies = formData.dependencies
				.split(',')
				.map((d) => d.trim())
				.filter((d) => d.length > 0);

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

			// Reset form and close drawer after showing success message
			setTimeout(() => {
				resetForm();
				isTaskDrawerOpen.set(false);
				successMessage = null;
			}, 1500);
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
			labels: '',
			dependencies: ''
		};
		validationErrors = {};
		submitError = null;
		successMessage = null;

		// Cleanup and reset attachments
		pendingAttachments.forEach(att => {
			if (att.preview) URL.revokeObjectURL(att.preview);
		});
		pendingAttachments = [];
		isDragOver = false;
	}

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
					<h2 class="text-xl font-bold font-mono uppercase tracking-wider" style="color: oklch(0.85 0.02 250);">Create New Task</h2>
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
									<option value={option.value}>{option.label}</option>
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
						<label class="label" for="task-dependencies">
							<span class="label-text text-xs font-semibold font-mono uppercase tracking-wider" style="color: oklch(0.55 0.02 250);">Dependencies</span>
						</label>
						<input
							id="task-dependencies"
							type="text"
							placeholder="e.g., jat-abc, jat-xyz"
							class="input w-full font-mono"
							style="background: oklch(0.18 0.01 250); border: 1px solid oklch(0.35 0.02 250); color: oklch(0.80 0.02 250);"
							bind:value={formData.dependencies}
							disabled={isSubmitting}
						/>
						<label class="label">
							<span class="label-text-alt" style="color: oklch(0.50 0.02 250);">
								Comma-separated list of task IDs this task depends on
							</span>
						</label>
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
				<div class="flex justify-end gap-3">
					<button
						type="button"
						class="btn btn-ghost"
						onclick={handleCancel}
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="btn btn-primary font-mono"
						onclick={handleSubmit}
						disabled={isSubmitting}
					>
						{#if isSubmitting}
							<span class="loading loading-spinner loading-sm"></span>
							Creating...
						{:else}
							Create Task
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
