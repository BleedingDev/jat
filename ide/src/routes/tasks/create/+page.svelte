<script lang="ts">
	/**
	 * Task Creation Workspace
	 *
	 * Full-page workspace with tabs: Form, Paste, Template (soon), Generator (soon).
	 * Accessed via quick-add bar "More" button or direct URL /tasks/create.
	 */
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import CreateForm from '$lib/components/tasks/CreateForm.svelte';
	import CreatePaste from '$lib/components/tasks/CreatePaste.svelte';
	import CreateTemplate from '$lib/components/tasks/CreateTemplate.svelte';
	import CreateGenerator from '$lib/components/tasks/CreateGenerator.svelte';
	import CreatePlan from '$lib/components/tasks/CreatePlan.svelte';

	// Tab state
	type Tab = 'form' | 'paste' | 'template' | 'generator' | 'plan';
	let activeTab = $state<Tab>('form');

	// Projects list
	let projects = $state<string[]>([]);

	// Check for paste data from quick-add bar
	let initialPasteText = $state('');

	// Welcome banner state
	let showWelcome = $state(false);

	onMount(async () => {
		// Check for welcome param from onboarding
		const welcomeParam = $page.url.searchParams.get('welcome');
		if (welcomeParam === 'true') {
			showWelcome = true;
			// Clean URL without reloading
			const url = new URL(window.location.href);
			url.searchParams.delete('welcome');
			window.history.replaceState({}, '', url.pathname + url.search);
		}

		// Load projects
		try {
			const response = await fetch('/api/projects?visible=true');
			const data = await response.json();
			projects = (data.projects || []).map((p: { name: string }) => p.name);
		} catch {
			projects = [];
		}

		// Check for paste data from quick-add bar
		const stored = sessionStorage.getItem('quick-add-paste');
		if (stored) {
			initialPasteText = stored;
			sessionStorage.removeItem('quick-add-paste');
			activeTab = 'paste';
		}
	});

	function handleTasksCreated() {
		goto('/tasks');
	}

	const tabs: { id: Tab; label: string; icon: string; desc: string; available: boolean }[] = [
		{ id: 'form', label: 'Form', icon: '📝', desc: 'Single task', available: true },
		{ id: 'paste', label: 'Paste', icon: '📋', desc: 'Bulk import', available: true },
		{ id: 'template', label: 'Template', icon: '🧩', desc: 'Variable expansion', available: true },
		{ id: 'generator', label: 'Generator', icon: '✨', desc: 'AI breakdown', available: true },
		{ id: 'plan', label: 'Plan', icon: '💬', desc: 'AI planning', available: true },
	];
</script>

<div class="workspace-page">
	<!-- Header -->
	<div class="workspace-header">
		<button
			class="btn btn-sm btn-ghost gap-1.5"
			onclick={() => goto('/tasks')}
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
				<path fill-rule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clip-rule="evenodd" />
			</svg>
			Back to Tasks
		</button>
		<h1 class="text-lg font-bold">Create Tasks</h1>
	</div>

	<!-- Tabs -->
	<div class="workspace-tabs">
		{#each tabs as tab}
			<button
				class="tab-button"
				class:active={activeTab === tab.id}
				class:disabled={!tab.available}
				onclick={() => { if (tab.available) activeTab = tab.id; }}
				disabled={!tab.available}
			>
				<span class="tab-label">{tab.label}</span>
				<span class="tab-desc">{tab.desc}</span>
				{#if !tab.available}
					<span class="badge badge-xs badge-ghost ml-1">Soon</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Welcome Banner -->
	{#if showWelcome}
		<div
			class="rounded-lg px-4 py-3 mb-4 flex items-start gap-3"
			style="
				background: linear-gradient(135deg, oklch(0.22 0.04 240 / 0.5) 0%, oklch(0.18 0.02 250) 100%);
				border: 1px solid oklch(0.40 0.10 240 / 0.3);
			"
		>
			<div class="flex-1 space-y-2">
				<p class="text-sm font-semibold" style="color: oklch(0.80 0.08 240);">
					Welcome! Choose how you'd like to create tasks:
				</p>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs" style="color: oklch(0.60 0.03 250);">
					<div><span style="color: oklch(0.75 0.06 240);" class="font-medium">Form</span> &mdash; Create a single task with all the details</div>
					<div><span style="color: oklch(0.75 0.06 240);" class="font-medium">Paste</span> &mdash; Bulk import from YAML, JSON, markdown, or plain text</div>
					<div><span style="color: oklch(0.75 0.06 240);" class="font-medium">Template</span> &mdash; Expand a template with variables to create many tasks</div>
					<div><span style="color: oklch(0.75 0.06 240);" class="font-medium">Generator</span> &mdash; Describe a feature and let AI break it into tasks</div>
					<div><span style="color: oklch(0.75 0.06 240);" class="font-medium">Plan</span> &mdash; Start an interactive planning session with an AI agent</div>
				</div>
			</div>
			<button
				class="shrink-0 p-1 rounded transition-colors"
				style="color: oklch(0.50 0.03 250);"
				onmouseenter={(e) => { e.currentTarget.style.color = 'oklch(0.75 0.03 250)'; }}
				onmouseleave={(e) => { e.currentTarget.style.color = 'oklch(0.50 0.03 250)'; }}
				onclick={() => { showWelcome = false; }}
				title="Dismiss"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/if}

	<!-- Tab Content -->
	<div class="workspace-content">
		{#if activeTab === 'form'}
			<CreateForm
				{projects}
				onTaskCreated={handleTasksCreated}
			/>
		{:else if activeTab === 'paste'}
			<CreatePaste
				{projects}
				initialText={initialPasteText}
				onTasksCreated={handleTasksCreated}
			/>
		{:else if activeTab === 'template'}
			<CreateTemplate
				{projects}
				onTasksCreated={handleTasksCreated}
			/>
		{:else if activeTab === 'generator'}
			<CreateGenerator
				{projects}
				onTasksCreated={handleTasksCreated}
			/>
		{:else if activeTab === 'plan'}
			<CreatePlan
				{projects}
				onTasksCreated={handleTasksCreated}
			/>
		{/if}
	</div>
</div>

<style>
	.workspace-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 1rem 1.5rem;
	}

	.workspace-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.workspace-tabs {
		display: flex;
		gap: 0.125rem;
		border-bottom: 1px solid oklch(0.30 0.02 250 / 0.3);
		margin-bottom: 1.5rem;
	}

	.tab-button {
		padding: 0.5rem 1rem;
		font-size: 0.8125rem;
		font-weight: 500;
		border: none;
		background: transparent;
		color: inherit;
		opacity: 0.45;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		transition: all 0.15s;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.tab-button:hover:not(.disabled) {
		opacity: 0.75;
		background: oklch(0.25 0.02 250 / 0.3);
	}

	.tab-button.active {
		opacity: 1;
		border-bottom-color: oklch(0.70 0.15 240);
	}

	.tab-button.disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.tab-label {
		font-weight: 600;
	}

	.tab-desc {
		font-size: 0.6875rem;
		opacity: 0.5;
		font-weight: 400;
	}

	.workspace-content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
</style>
