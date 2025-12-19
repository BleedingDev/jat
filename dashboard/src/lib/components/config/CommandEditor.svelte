<script lang="ts">
	import type { SlashCommand, CommandFrontmatter } from '$lib/types/config';
	import { onMount, onDestroy } from 'svelte';
	import loader from '@monaco-editor/loader';
	import {
		validateYamlFrontmatter,
		setEditorMarkers,
		clearEditorMarkers,
		type ValidationResult,
		MarkerSeverity
	} from '$lib/utils/editorValidation';
	import CommandTemplates from './CommandTemplates.svelte';
	import {
		COMMAND_TEMPLATES,
		applyTemplate,
		type CommandTemplate
	} from '$lib/config/commandTemplates';

	// Props
	let {
		isOpen = $bindable(false),
		command = null as SlashCommand | null,
		onSave = (_command: SlashCommand) => {},
		onClose = () => {}
	}: {
		isOpen?: boolean;
		command?: SlashCommand | null;
		onSave?: (command: SlashCommand) => void;
		onClose?: () => void;
	} = $props();

	// State
	let isCreateMode = $derived(!command);
	let namespace = $state('local');
	let name = $state('');
	let description = $state('');
	let author = $state('');
	let version = $state('');
	let tags = $state('');
	let content = $state('');
	let loading = $state(false);
	let saving = $state(false);
	let error = $state('');
	let success = $state('');

	// Template selection state (for create mode)
	let showTemplateStep = $state(true);
	let selectedTemplate = $state<CommandTemplate | null>(null);

	// Validation state
	let validation = $state<ValidationResult | null>(null);
	let validationDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Monaco
	let editorContainer: HTMLDivElement;
	let editor: any = null;
	let monaco: any = null;

	// Available namespaces
	const namespaces = [
		{ value: 'local', label: 'Local (project)' },
		{ value: 'jat', label: 'JAT' },
		{ value: 'git', label: 'Git' }
	];

	// Load command content when editing
	$effect(() => {
		if (isOpen && command) {
			loadCommandContent();
			showTemplateStep = false; // Skip template step for edit mode
		} else if (isOpen && !command) {
			// Reset form for create mode
			namespace = 'local';
			name = '';
			description = '';
			author = '';
			version = '';
			tags = '';
			showTemplateStep = true; // Show template picker first
			selectedTemplate = null;
			content = `---
description:
author:
version: 1.0.0
tags:
---

# Command Title

Command content here...
`;
			if (editor) {
				editor.setValue(content);
				validateContent(content);
			}
		}
	});

	// Handle template selection
	function handleTemplateSelect(template: CommandTemplate) {
		selectedTemplate = template;
		// Apply template frontmatter defaults
		description = template.frontmatter.description || '';
		author = template.frontmatter.author || '';
		version = template.frontmatter.version || '1.0.0';
		tags = template.frontmatter.tags || '';
	}

	// Apply selected template and move to editor step
	function applySelectedTemplate() {
		if (selectedTemplate) {
			content = applyTemplate(selectedTemplate, {
				namespace,
				name: name || 'command',
				description
			});
		}
		showTemplateStep = false;

		// Update editor if already initialized
		if (editor) {
			editor.setValue(content);
			validateContent(content);
		}
	}

	// Skip template selection and use default
	function skipTemplate() {
		showTemplateStep = false;
		// Content already has default value
		if (editor) {
			validateContent(content);
		}
	}

	// Go back to template selection
	function backToTemplates() {
		showTemplateStep = true;
	}

	async function loadCommandContent() {
		if (!command) return;
		loading = true;
		error = '';

		try {
			const res = await fetch(`/api/commands/${command.namespace}/${command.name}`);
			if (!res.ok) throw new Error('Failed to load command');
			const data = await res.json();

			content = data.content || '';
			namespace = command.namespace;
			name = command.name;

			// Parse frontmatter
			if (command.frontmatter) {
				description = command.frontmatter.description || '';
				author = command.frontmatter.author || '';
				version = command.frontmatter.version || '';
				tags = Array.isArray(command.frontmatter.tags)
					? command.frontmatter.tags.join(', ')
					: command.frontmatter.tags || '';
			}

			if (editor) {
				editor.setValue(content);
				validateContent(content);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load command';
		} finally {
			loading = false;
		}
	}

	// Validate content and update Monaco markers
	function validateContent(editorContent: string) {
		if (!monaco || !editor) return;

		// Clear previous debounce timer
		if (validationDebounceTimer) {
			clearTimeout(validationDebounceTimer);
		}

		// Debounce validation to avoid excessive processing
		validationDebounceTimer = setTimeout(() => {
			const model = editor.getModel();
			if (!model) return;

			const result = validateYamlFrontmatter(editorContent);
			validation = result;

			// Apply markers to Monaco editor
			setEditorMarkers(monaco, model, result.markers, 'yaml-validation');
		}, 300);
	}

	// Initialize Monaco editor
	onMount(async () => {
		try {
			monaco = await loader.init();
			if (editorContainer) {
				editor = monaco.editor.create(editorContainer, {
					value: content,
					language: 'markdown',
					theme: 'vs-dark',
					minimap: { enabled: false },
					wordWrap: 'on',
					lineNumbers: 'on',
					fontSize: 14,
					tabSize: 2,
					scrollBeyondLastLine: false,
					automaticLayout: true,
					padding: { top: 16, bottom: 16 },
					// Enable error gutter (shows colored squiggles)
					glyphMargin: true
				});

				// Track content changes and validate
				editor.onDidChangeModelContent(() => {
					content = editor.getValue();
					validateContent(content);
				});

				// Keyboard shortcut for save
				editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
					handleSave();
				});

				// Initial validation if content exists
				if (content) {
					validateContent(content);
				}
			}
		} catch (e) {
			console.error('Failed to load Monaco:', e);
			error = 'Failed to load editor';
		}
	});

	onDestroy(() => {
		if (validationDebounceTimer) {
			clearTimeout(validationDebounceTimer);
		}
		if (editor) {
			editor.dispose();
		}
	});

	// Build frontmatter from fields
	function buildFrontmatter(): string {
		const lines = ['---'];
		if (description) lines.push(`description: ${description}`);
		if (author) lines.push(`author: ${author}`);
		if (version) lines.push(`version: ${version}`);
		if (tags) lines.push(`tags: ${tags}`);
		lines.push('---');
		return lines.join('\n');
	}

	// Update content with new frontmatter
	function updateFrontmatter() {
		const currentContent = editor?.getValue() || content;
		// Remove existing frontmatter
		const withoutFrontmatter = currentContent.replace(/^---[\s\S]*?---\n?/, '');
		const newContent = buildFrontmatter() + '\n\n' + withoutFrontmatter.trimStart();
		if (editor) {
			editor.setValue(newContent);
		}
		content = newContent;
	}

	async function handleSave() {
		if (isCreateMode && !name.trim()) {
			error = 'Command name is required';
			return;
		}

		// Check for validation errors (block save on critical errors)
		if (validation?.hasErrors) {
			error = `Cannot save: ${validation.errorCount} syntax error${validation.errorCount > 1 ? 's' : ''} found. Fix errors to continue.`;
			return;
		}

		saving = true;
		error = '';
		success = '';

		try {
			// Update frontmatter before saving
			updateFrontmatter();

			if (isCreateMode) {
				// Create new command
				const res = await fetch('/api/commands', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						namespace,
						name: name.trim(),
						content
					})
				});

				if (!res.ok) {
					const data = await res.json();
					throw new Error(data.error || 'Failed to create command');
				}

				success = 'Command created successfully';
			} else {
				// Update existing command
				const res = await fetch(`/api/commands/${command!.namespace}/${command!.name}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ content })
				});

				if (!res.ok) {
					const data = await res.json();
					throw new Error(data.error || 'Failed to save command');
				}

				success = 'Command saved successfully';
			}

			// Create the saved command object
			const savedCommand: SlashCommand = {
				name: isCreateMode ? name.trim() : command!.name,
				namespace: isCreateMode ? namespace : command!.namespace,
				invocation: `/${isCreateMode ? namespace : command!.namespace}:${isCreateMode ? name.trim() : command!.name}`,
				path: isCreateMode ? '' : command!.path,
				content,
				frontmatter: {
					description: description || undefined,
					author: author || undefined,
					version: version || undefined,
					tags: tags || undefined
				}
			};
			onSave(savedCommand);
			setTimeout(() => {
				handleClose();
			}, 1000);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save';
		} finally {
			saving = false;
		}
	}

	function handleClose() {
		isOpen = false;
		error = '';
		success = '';
		onClose();
	}

	// Keyboard handler for Escape
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen) {
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Drawer -->
<div class="drawer drawer-end z-50">
	<input
		id="command-editor-drawer"
		type="checkbox"
		class="drawer-toggle"
		checked={isOpen}
		onchange={() => {
			if (!isOpen) handleClose();
		}}
	/>

	<div class="drawer-side">
		<!-- Overlay -->
		<label
			class="drawer-overlay"
			onclick={handleClose}
			aria-label="Close editor"
		></label>

		<!-- Drawer content -->
		<div
			class="flex h-full w-[800px] max-w-[90vw] flex-col bg-base-200"
			style="border-left: 1px solid oklch(0.3 0.02 250);"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b px-6 py-4"
				style="border-color: oklch(0.3 0.02 250); background: oklch(0.18 0.02 250);"
			>
				<div class="flex items-center gap-3">
					<span class="text-2xl">📝</span>
					<div>
						<h2 class="text-lg font-semibold text-base-content">
							{isCreateMode ? 'Create Command' : 'Edit Command'}
						</h2>
						{#if command}
							<p class="text-sm opacity-70">{command.invocation}</p>
						{/if}
					</div>
				</div>
				<button class="btn btn-ghost btn-sm" onclick={handleClose}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Body -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if loading}
					<div class="flex h-full items-center justify-center">
						<span class="loading loading-spinner loading-lg"></span>
					</div>
				{:else}
					<!-- Alerts -->
					{#if error}
						<div class="alert alert-error mb-4">
							<span>{error}</span>
						</div>
					{/if}

					{#if success}
						<div class="alert alert-success mb-4">
							<span>{success}</span>
						</div>
					{/if}

					<!-- Template Selection Step (Create Mode Only) -->
					{#if isCreateMode && showTemplateStep}
						<!-- Basic info first -->
						<div class="mb-6 grid grid-cols-2 gap-4">
							<div class="form-control">
								<label class="label" for="namespace-template">
									<span class="label-text font-medium">Namespace</span>
								</label>
								<select
									id="namespace-template"
									class="select select-bordered"
									bind:value={namespace}
								>
									{#each namespaces as ns}
										<option value={ns.value}>{ns.label}</option>
									{/each}
								</select>
							</div>

							<div class="form-control">
								<label class="label" for="name-template">
									<span class="label-text font-medium">Command Name</span>
								</label>
								<input
									id="name-template"
									type="text"
									class="input input-bordered"
									placeholder="my-command"
									bind:value={name}
								/>
							</div>
						</div>

						<!-- Template picker -->
						<CommandTemplates
							bind:selectedTemplate
							onSelect={handleTemplateSelect}
						/>

						<!-- Template step actions -->
						<div class="mt-6 flex justify-between">
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								onclick={skipTemplate}
							>
								Skip, start from scratch
							</button>
							<button
								type="button"
								class="btn btn-primary btn-sm"
								onclick={applySelectedTemplate}
								disabled={!selectedTemplate}
							>
								{selectedTemplate ? `Use ${selectedTemplate.name} Template` : 'Select a template'}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="ml-1 h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 5l7 7-7 7"
									/>
								</svg>
							</button>
						</div>
					{:else}
						<!-- Editor Step -->

						<!-- Create mode fields (when not in template step) -->
						{#if isCreateMode}
							<div class="mb-4 flex items-center gap-2">
								<button
									type="button"
									class="btn btn-ghost btn-xs"
									onclick={backToTemplates}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="mr-1 h-3 w-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 19l-7-7 7-7"
										/>
									</svg>
									Change template
								</button>
								{#if selectedTemplate}
									<span class="badge badge-sm badge-ghost">
										{selectedTemplate.icon} {selectedTemplate.name}
									</span>
								{:else}
									<span class="badge badge-sm badge-ghost">Custom</span>
								{/if}
							</div>
							<div class="mb-6 grid grid-cols-2 gap-4">
								<div class="form-control">
									<label class="label" for="namespace">
										<span class="label-text font-medium">Namespace</span>
									</label>
									<select
										id="namespace"
										class="select select-bordered"
										bind:value={namespace}
									>
										{#each namespaces as ns}
											<option value={ns.value}>{ns.label}</option>
										{/each}
									</select>
								</div>

								<div class="form-control">
									<label class="label" for="name">
										<span class="label-text font-medium">Command Name</span>
									</label>
									<input
										id="name"
										type="text"
										class="input input-bordered"
										placeholder="my-command"
										bind:value={name}
									/>
								</div>
							</div>
						{/if}

						<!-- Frontmatter fields -->
					<div class="mb-6">
						<h3 class="mb-3 font-medium text-base-content">Frontmatter</h3>
						<div class="grid grid-cols-2 gap-4">
							<div class="form-control">
								<label class="label" for="description">
									<span class="label-text">Description</span>
								</label>
								<input
									id="description"
									type="text"
									class="input input-bordered input-sm"
									placeholder="Brief description of the command"
									bind:value={description}
									onblur={updateFrontmatter}
								/>
							</div>

							<div class="form-control">
								<label class="label" for="author">
									<span class="label-text">Author</span>
								</label>
								<input
									id="author"
									type="text"
									class="input input-bordered input-sm"
									placeholder="Your name"
									bind:value={author}
									onblur={updateFrontmatter}
								/>
							</div>

							<div class="form-control">
								<label class="label" for="version">
									<span class="label-text">Version</span>
								</label>
								<input
									id="version"
									type="text"
									class="input input-bordered input-sm"
									placeholder="1.0.0"
									bind:value={version}
									onblur={updateFrontmatter}
								/>
							</div>

							<div class="form-control">
								<label class="label" for="tags">
									<span class="label-text">Tags (comma-separated)</span>
								</label>
								<input
									id="tags"
									type="text"
									class="input input-bordered input-sm"
									placeholder="workflow, agent, git"
									bind:value={tags}
									onblur={updateFrontmatter}
								/>
							</div>
						</div>
					</div>

					<!-- Monaco editor -->
					<div class="form-control flex-1">
						<label class="label">
							<span class="label-text font-medium">Command Content (Markdown)</span>
							<span class="label-text-alt opacity-60">Cmd+S to save</span>
						</label>
						<div
							bind:this={editorContainer}
							class="h-[400px] overflow-hidden rounded-t-lg border border-b-0"
							style="border-color: oklch(0.3 0.02 250);"
						></div>
						<!-- Validation status bar -->
						<div
							class="flex items-center justify-between gap-2 rounded-b-lg border px-3 py-1.5 text-xs"
							style="border-color: oklch(0.3 0.02 250); background: oklch(0.15 0.02 250);"
						>
							<div class="flex items-center gap-3">
								{#if validation?.hasErrors}
									<span class="flex items-center gap-1 text-error">
										<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										{validation.errorCount} error{validation.errorCount > 1 ? 's' : ''}
									</span>
								{/if}
								{#if validation?.hasWarnings}
									<span class="flex items-center gap-1 text-warning">
										<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
										</svg>
										{validation.warningCount} warning{validation.warningCount > 1 ? 's' : ''}
									</span>
								{/if}
								{#if validation && !validation.hasErrors && !validation.hasWarnings}
									<span class="flex items-center gap-1 text-success">
										<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
										</svg>
										No issues
									</span>
								{/if}
								{#if !validation}
									<span class="opacity-50">Validating...</span>
								{/if}
							</div>
							<span class="opacity-50">YAML frontmatter</span>
						</div>
					</div>
					{/if}
				{/if}
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-end gap-3 border-t px-6 py-4"
				style="border-color: oklch(0.3 0.02 250); background: oklch(0.18 0.02 250);"
			>
				{#if isCreateMode && showTemplateStep}
					<!-- Template step footer -->
					<button class="btn btn-ghost" onclick={handleClose}>Cancel</button>
				{:else}
					<!-- Editor step footer -->
					<button class="btn btn-ghost" onclick={handleClose} disabled={saving}>Cancel</button>
					<button
						class="btn btn-primary"
						onclick={handleSave}
						disabled={saving || loading || validation?.hasErrors}
						title={validation?.hasErrors ? 'Fix syntax errors before saving' : ''}
					>
						{#if saving}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						{isCreateMode ? 'Create Command' : 'Save Changes'}
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
