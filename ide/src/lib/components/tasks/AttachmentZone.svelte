<script lang="ts">
	/**
	 * AttachmentZone — Reusable file drop zone + attachment list
	 *
	 * Provides drag-and-drop file upload with preview thumbnails.
	 * Extracted from TaskCreationDrawer's attachment pattern.
	 */
	import { getFileTypeInfo, formatFileSize } from '$lib/utils/fileUtils';
	import type { PendingAttachment } from '$lib/types/attachment';
	import { playAttachmentSound } from '$lib/utils/soundEffects';

	interface Props {
		disabled?: boolean;
		attachments: PendingAttachment[];
	}

	let {
		disabled = false,
		attachments = $bindable([]),
	}: Props = $props();

	let isDragOver = $state(false);
	let dragCounter = $state(0);
	let fileInputRef: HTMLInputElement | null = null;

	function handleFiles(files: FileList | File[]) {
		const fileArray = Array.from(files);
		for (const file of fileArray) {
			const id = `att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
			const typeInfo = getFileTypeInfo(file);
			const preview = typeInfo.previewable ? URL.createObjectURL(file) : '';
			attachments = [...attachments, {
				id,
				file,
				preview,
				category: typeInfo.category,
				icon: typeInfo.icon,
				iconColor: typeInfo.color,
			}];
		}
	}

	function removeAttachment(id: string) {
		const att = attachments.find(a => a.id === id);
		if (att?.preview) {
			URL.revokeObjectURL(att.preview);
		}
		attachments = attachments.filter(a => a.id !== id);
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		isDragOver = false;
		dragCounter = 0;
		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			playAttachmentSound();
			handleFiles(files);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleDragEnter(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		dragCounter++;
		if (dragCounter > 0) isDragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		dragCounter--;
		if (dragCounter <= 0) {
			dragCounter = 0;
			isDragOver = false;
		}
	}

	function handleInputChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			playAttachmentSound();
			handleFiles(input.files);
			input.value = '';
		}
	}
</script>

<!-- Drop zone -->
<div
	class="drop-zone"
	class:drag-over={isDragOver && !disabled}
	class:has-files={attachments.length > 0}
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
>
	{#if attachments.length === 0}
		<!-- Empty state: click or drag prompt -->
		<button
			type="button"
			class="drop-prompt"
			onclick={() => fileInputRef?.click()}
			{disabled}
		>
			<svg class="w-5 h-5 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
			</svg>
			<span class="text-xs opacity-40">Drop files or click to attach</span>
		</button>
	{:else}
		<!-- File list -->
		<div class="file-list">
			{#each attachments as att (att.id)}
				<div class="file-item">
					{#if att.category === 'image' && att.preview}
						<img src={att.preview} alt={att.file.name} class="file-thumb" />
					{:else}
						<div class="file-icon" style="color: {att.iconColor};">
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d={att.icon} />
							</svg>
						</div>
					{/if}
					<div class="file-info">
						<span class="file-name">{att.file.name}</span>
						<span class="file-size">{formatFileSize(att.file.size)}</span>
					</div>
					<button
						type="button"
						class="btn btn-ghost btn-xs opacity-40 hover:opacity-100 hover:text-error"
						onclick={() => removeAttachment(att.id)}
						{disabled}
						aria-label="Remove attachment"
					>
						<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/each}
			<button
				type="button"
				class="add-more"
				onclick={() => fileInputRef?.click()}
				{disabled}
			>
				<svg class="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				<span class="text-xs opacity-50">Add more</span>
			</button>
		</div>
	{/if}

	{#if isDragOver && !disabled}
		<div class="drag-overlay">
			<svg class="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
			</svg>
			<span class="text-xs font-medium text-primary">Drop files here</span>
		</div>
	{/if}
</div>

<input
	type="file"
	class="hidden"
	multiple
	bind:this={fileInputRef}
	onchange={handleInputChange}
/>

<style>
	.drop-zone {
		position: relative;
		border: 1px dashed oklch(0.35 0.02 250 / 0.5);
		border-radius: 0.5rem;
		transition: all 0.15s ease;
	}

	.drop-zone.drag-over {
		border-color: oklch(0.65 0.15 240);
		background: oklch(0.65 0.15 240 / 0.08);
	}

	.drop-prompt {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.625rem;
		cursor: pointer;
		background: none;
		border: none;
		color: inherit;
	}

	.drop-prompt:hover:not(:disabled) {
		background: oklch(0.25 0.02 250 / 0.3);
		border-radius: 0.5rem;
	}

	.file-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		padding: 0.5rem;
	}

	.file-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		background: oklch(0.20 0.01 250 / 0.5);
		border: 1px solid oklch(0.28 0.02 250 / 0.3);
	}

	.file-thumb {
		width: 1.5rem;
		height: 1.5rem;
		object-fit: cover;
		border-radius: 0.25rem;
	}

	.file-icon {
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.file-info {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
		min-width: 0;
	}

	.file-name {
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
		font-size: 0.75rem;
		max-width: 12rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-size {
		font-size: 0.625rem;
		opacity: 0.4;
		white-space: nowrap;
	}

	.add-more {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		border: 1px dashed oklch(0.35 0.02 250 / 0.4);
		background: none;
		color: inherit;
		cursor: pointer;
		transition: all 0.15s;
	}

	.add-more:hover:not(:disabled) {
		border-color: oklch(0.45 0.02 250 / 0.5);
		background: oklch(0.25 0.02 250 / 0.3);
	}

	.drag-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		background: oklch(0.18 0.02 250 / 0.9);
		border-radius: 0.5rem;
		pointer-events: none;
	}
</style>
