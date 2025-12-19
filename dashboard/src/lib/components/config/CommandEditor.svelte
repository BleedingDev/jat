<script lang="ts">
	import type { SlashCommand, CommandFrontmatter } from '$lib/types/config';
	import { onMount, onDestroy } from 'svelte';
	import loader from '@monaco-editor/loader';

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
		} else if (isOpen && !command) {
			// Reset form for create mode
			namespace = 'local';
			name = '';
			description = '';
			author = '';
			version = '';
			tags = '';
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
			}
		}
	});

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
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load command';
		} finally {
			loading = false;
		}
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
					padding: { top: 16, bottom: 16 }
				});

				// Track content changes
				editor.onDidChangeModelContent(() => {
					content = editor.getValue();
				});

				// Keyboard shortcut for save
				editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
					handleSave();
				});
			}
		} catch (e) {
			console.error('Failed to load Monaco:', e);
			error = 'Failed to load editor';
		}
	});

	onDestroy(() => {
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

					<!-- Create mode fields -->
					{#if isCreateMode}
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
							class="h-[400px] overflow-hidden rounded-lg border"
							style="border-color: oklch(0.3 0.02 250);"
						></div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-end gap-3 border-t px-6 py-4"
				style="border-color: oklch(0.3 0.02 250); background: oklch(0.18 0.02 250);"
			>
				<button class="btn btn-ghost" onclick={handleClose} disabled={saving}>Cancel</button>
				<button class="btn btn-primary" onclick={handleSave} disabled={saving || loading}>
					{#if saving}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					{isCreateMode ? 'Create Command' : 'Save Changes'}
				</button>
			</div>
		</div>
	</div>
</div>
