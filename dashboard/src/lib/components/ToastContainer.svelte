<script lang="ts">
	/**
	 * ToastContainer Component
	 *
	 * Displays toast notifications in a fixed position (bottom-right).
	 * Include this component once in your root layout.
	 *
	 * Usage in +layout.svelte:
	 *   <ToastContainer />
	 */

	import { fly, fade } from 'svelte/transition';
	import { toasts, removeToast, type Toast, type ToastType } from '$lib/stores/toasts.svelte';

	// Visual config for each toast type
	const typeConfig: Record<
		ToastType,
		{ bg: string; border: string; text: string; icon: string }
	> = {
		success: {
			bg: 'oklch(0.25 0.12 145)',
			border: 'oklch(0.45 0.18 145)',
			text: 'oklch(0.90 0.08 145)',
			icon: 'M5 13l4 4L19 7', // Checkmark
		},
		error: {
			bg: 'oklch(0.25 0.12 25)',
			border: 'oklch(0.45 0.18 25)',
			text: 'oklch(0.90 0.08 25)',
			icon: 'M6 18L18 6M6 6l12 12', // X mark
		},
		warning: {
			bg: 'oklch(0.28 0.12 85)',
			border: 'oklch(0.50 0.18 85)',
			text: 'oklch(0.90 0.08 85)',
			icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', // Warning triangle
		},
		info: {
			bg: 'oklch(0.25 0.10 220)',
			border: 'oklch(0.45 0.15 220)',
			text: 'oklch(0.90 0.06 220)',
			icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', // Info circle
		},
	};

	function handleDismiss(id: string) {
		removeToast(id);
	}
</script>

<!-- Toast Container - Fixed bottom-right -->
<div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm">
	{#each toasts.value as toast (toast.id)}
		<div
			class="pointer-events-auto rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 min-w-[280px]"
			style="
				background: {typeConfig[toast.type].bg};
				border: 1px solid {typeConfig[toast.type].border};
			"
			in:fly={{ x: 100, duration: 200 }}
			out:fade={{ duration: 150 }}
			role="alert"
		>
			<!-- Icon -->
			<svg
				class="w-5 h-5 flex-shrink-0 mt-0.5"
				style="color: {typeConfig[toast.type].text};"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d={typeConfig[toast.type].icon} />
			</svg>

			<!-- Content -->
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium" style="color: {typeConfig[toast.type].text};">
					{toast.message}
				</p>
				{#if toast.details}
					<p class="text-xs mt-1 opacity-70" style="color: {typeConfig[toast.type].text};">
						{toast.details}
					</p>
				{/if}
				{#if toast.action}
					<button
						onclick={toast.action.onClick}
						class="text-xs mt-2 underline hover:no-underline"
						style="color: {typeConfig[toast.type].text};"
					>
						{toast.action.label}
					</button>
				{/if}
			</div>

			<!-- Dismiss button -->
			<button
				onclick={() => handleDismiss(toast.id)}
				class="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
				style="color: {typeConfig[toast.type].text};"
				title="Dismiss"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}
</div>
