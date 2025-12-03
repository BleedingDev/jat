<script lang="ts">
	/**
	 * WorkDropZone Component
	 * Drag-drop zone for spawning work sessions from tasks.
	 *
	 * Features:
	 * - Accept drops from TaskQueue (dragged task items)
	 * - Visual feedback on dragover (highlight border)
	 * - Call onSpawnForTask(taskId) on drop
	 * - Helpful guidance message
	 *
	 * Props:
	 * - onSpawnForTask: Callback when task is dropped
	 * - disabled: Disable dropping (e.g., during spawn)
	 * - class: Additional CSS classes
	 */

	import { playPickupSound, playDropSound } from '$lib/utils/soundEffects';

	interface Props {
		onSpawnForTask?: (taskId: string) => Promise<void>;
		disabled?: boolean;
		class?: string;
	}

	let {
		onSpawnForTask,
		disabled = false,
		class: className = ''
	}: Props = $props();

	// Drag state
	let isDragOver = $state(false);
	let isSpawning = $state(false);

	// Handle drag over
	function handleDragOver(event: DragEvent) {
		if (disabled || isSpawning) return;

		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		isDragOver = true;
	}

	// Handle drag enter
	function handleDragEnter(event: DragEvent) {
		if (disabled || isSpawning) return;

		event.preventDefault();
		if (!isDragOver) {
			playPickupSound();
		}
		isDragOver = true;
	}

	// Handle drag leave
	function handleDragLeave(event: DragEvent) {
		// Only set isDragOver to false if we're leaving the drop zone entirely
		const relatedTarget = event.relatedTarget as HTMLElement | null;
		const currentTarget = event.currentTarget as HTMLElement;

		if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
			isDragOver = false;
		}
	}

	// Handle drop
	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;

		if (disabled || isSpawning || !onSpawnForTask) return;

		const taskId = event.dataTransfer?.getData('text/plain');
		if (!taskId) return;

		playDropSound();
		isSpawning = true;
		try {
			await onSpawnForTask(taskId);
		} catch (error) {
			console.error('Failed to spawn session for task:', error);
		} finally {
			isSpawning = false;
		}
	}
</script>

<div
	class="rounded-lg border-2 border-dashed transition-all duration-200 {className} {isDragOver && !disabled ? 'bg-primary/10' : ''}"
	class:border-primary={isDragOver && !disabled}
	class:border-base-300={!isDragOver || disabled}
	class:opacity-50={disabled || isSpawning}
	class:cursor-not-allowed={disabled || isSpawning}
	ondragover={handleDragOver}
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="region"
	aria-label="Drop zone for spawning work sessions"
>
	<div class="flex flex-col items-center justify-center p-8 text-center">
		{#if isSpawning}
			<!-- Spawning state -->
			<span class="loading loading-spinner loading-lg text-primary mb-3"></span>
			<p class="text-sm font-medium text-base-content">
				Spawning agent...
			</p>
			<p class="text-xs text-base-content/60 mt-1">
				Starting new Claude Code session
			</p>
		{:else if isDragOver && !disabled}
			<!-- Drag over state -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="w-12 h-12 text-primary mb-3"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
			<p class="text-sm font-medium text-primary">
				Release to start work
			</p>
			<p class="text-xs text-base-content/60 mt-1">
				A new agent will be spawned for this task
			</p>
		{:else}
			<!-- Default state -->
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1"
				stroke="currentColor"
				class="w-12 h-12 text-base-content/30 mb-3"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
			</svg>
			<p class="text-sm font-medium text-base-content/70">
				Drop a task here to start work
			</p>
			<p class="text-xs text-base-content/50 mt-1">
				Auto-spawns a new agent to work on the task
			</p>
		{/if}
	</div>
</div>
