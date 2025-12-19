<script lang="ts">
	import { COMMAND_TEMPLATES, type CommandTemplate } from '$lib/config/commandTemplates';

	// Props
	let {
		selectedTemplate = $bindable(null as CommandTemplate | null),
		onSelect = (_template: CommandTemplate) => {}
	}: {
		selectedTemplate?: CommandTemplate | null;
		onSelect?: (template: CommandTemplate) => void;
	} = $props();

	// State
	let hoveredTemplate = $state<string | null>(null);

	function handleSelect(template: CommandTemplate) {
		selectedTemplate = template;
		onSelect(template);
	}

	function handleKeydown(e: KeyboardEvent, template: CommandTemplate) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleSelect(template);
		}
	}
</script>

<div class="command-templates">
	<div class="mb-3">
		<h4 class="text-sm font-semibold text-base-content">Choose a Template</h4>
		<p class="text-xs text-base-content/60 mt-1">
			Start with a template that matches your command type
		</p>
	</div>

	<div class="grid grid-cols-2 gap-3">
		{#each COMMAND_TEMPLATES as template}
			{@const isSelected = selectedTemplate?.id === template.id}
			{@const isHovered = hoveredTemplate === template.id}
			<button
				type="button"
				class="template-card"
				class:selected={isSelected}
				class:hovered={isHovered}
				onclick={() => handleSelect(template)}
				onkeydown={(e) => handleKeydown(e, template)}
				onmouseenter={() => (hoveredTemplate = template.id)}
				onmouseleave={() => (hoveredTemplate = null)}
			>
				<div class="flex items-start gap-3">
					<span class="template-icon">{template.icon}</span>
					<div class="flex-1 text-left">
						<div class="template-name">{template.name}</div>
						<div class="template-desc">{template.description}</div>
					</div>
					{#if isSelected}
						<div class="check-mark">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fill-rule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
					{/if}
				</div>
				{#if isHovered || isSelected}
					<div class="template-use-case">
						<span class="text-xs opacity-70">Best for:</span>
						<span class="text-xs">{template.useCase}</span>
					</div>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Preview Section -->
	{#if selectedTemplate}
		<div class="preview-section">
			<div class="flex items-center justify-between mb-2">
				<h4 class="text-sm font-semibold text-base-content">Template Preview</h4>
				<span class="badge badge-sm badge-ghost">
					{selectedTemplate.icon}
					{selectedTemplate.name}
				</span>
			</div>
			<div class="preview-content">
				<pre class="text-xs"><code>{selectedTemplate.content.slice(0, 500)}...</code></pre>
			</div>
		</div>
	{/if}
</div>

<style>
	.command-templates {
		padding: 0.5rem 0;
	}

	.template-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid oklch(0.35 0.02 250);
		background: oklch(0.2 0.02 250);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.template-card:hover,
	.template-card.hovered {
		border-color: oklch(0.5 0.1 240);
		background: oklch(0.22 0.02 250);
	}

	.template-card.selected {
		border-color: oklch(0.65 0.15 145);
		background: oklch(0.55 0.18 145 / 0.1);
	}

	.template-icon {
		font-size: 1.25rem;
		line-height: 1;
	}

	.template-name {
		font-weight: 600;
		font-size: 0.875rem;
		color: oklch(0.9 0.02 250);
	}

	.template-desc {
		font-size: 0.75rem;
		color: oklch(0.7 0.02 250);
		margin-top: 0.125rem;
	}

	.template-use-case {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding-top: 0.5rem;
		border-top: 1px solid oklch(0.35 0.02 250);
		margin-top: 0.25rem;
	}

	.check-mark {
		color: oklch(0.75 0.18 145);
		flex-shrink: 0;
	}

	.preview-section {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid oklch(0.35 0.02 250);
	}

	.preview-content {
		padding: 0.75rem;
		border-radius: 0.375rem;
		background: oklch(0.15 0.02 250);
		max-height: 200px;
		overflow: auto;
	}

	.preview-content pre {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.preview-content code {
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas,
			'DejaVu Sans Mono', monospace;
		color: oklch(0.8 0.02 250);
	}
</style>
