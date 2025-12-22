<script lang="ts">
	/**
	 * ServerStatusBadge Component
	 *
	 * A clickable status badge for server sessions that shows current state
	 * and opens a dropdown with server-specific actions (start, stop, restart).
	 *
	 * Configuration is imported from statusColors.ts for consistency.
	 */

	import { fly } from 'svelte/transition';
	import {
		getServerStateVisual,
		getServerStateActions,
		type ServerStateVisual,
		type ServerStateAction,
		type ServerState
	} from '$lib/config/statusColors';

	interface Props {
		serverStatus: ServerState;
		sessionName: string;
		port?: number | null;
		portRunning?: boolean;
		disabled?: boolean;
		dropUp?: boolean;
		alignRight?: boolean;
		/** 'badge' = standalone badge with bg/border, 'integrated' = minimal style for embedding in tabs */
		variant?: 'badge' | 'integrated';
		onAction?: (actionId: string) => Promise<void> | void;
		class?: string;
	}

	let {
		serverStatus,
		sessionName,
		port = null,
		portRunning = false,
		disabled = false,
		dropUp = false,
		alignRight = false,
		variant = 'badge',
		onAction,
		class: className = ''
	}: Props = $props();

	// Dropdown state
	let isOpen = $state(false);
	let isExecuting = $state(false);
	let dropdownRef: HTMLDivElement | null = null;

	// Get config from centralized statusColors.ts
	const config = $derived(getServerStateVisual(serverStatus));
	const actions = $derived(getServerStateActions(serverStatus));

	// Handle click outside to close dropdown
	function handleClickOutside(event: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			isOpen = false;
		}
	}

	// Setup and cleanup click outside listener
	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});

	// Handle action execution
	async function executeAction(action: ServerStateAction) {
		if (disabled || isExecuting) return;

		// Handle "open" action client-side - open localhost URL in new tab
		if (action.id === 'open') {
			console.log('[ServerStatusBadge] Open action triggered, port:', port);
			if (port) {
				const url = `http://localhost:${port}`;
				console.log('[ServerStatusBadge] Opening URL:', url);
				window.open(url, '_blank');
			} else {
				console.warn('[ServerStatusBadge] Cannot open - no port configured');
			}
			isOpen = false;
			return;
		}

		isExecuting = true;
		try {
			await onAction?.(action.id);
		} finally {
			isExecuting = false;
			isOpen = false;
		}
	}

	// Get variant colors for dropdown items
	function getVariantClasses(variant: ServerStateAction['variant']): string {
		switch (variant) {
			case 'success':
				return 'hover:bg-success/20 text-success';
			case 'warning':
				return 'hover:bg-warning/20 text-warning';
			case 'error':
				return 'hover:bg-error/20 text-error';
			case 'info':
				return 'hover:bg-info/20 text-info';
			default:
				return 'hover:bg-base-300 text-base-content';
		}
	}

	// Build display label with port info
	const displayLabel = $derived(() => {
		const baseLabel = variant === 'integrated' ? config.shortLabel : config.label;
		if (port && serverStatus === 'running') {
			return `${baseLabel} :${port}`;
		}
		return baseLabel;
	});
</script>

<div class="relative inline-block {className}" bind:this={dropdownRef}>
	<!-- Status Badge Button -->
	<button
		type="button"
		onclick={() => !disabled && (isOpen = !isOpen)}
		class="font-mono tracking-wider flex-shrink-0 font-bold cursor-pointer transition-all focus:outline-none {variant === 'integrated' ? 'text-[11px] px-2 py-0.5 hover:bg-white/5 rounded' : 'text-[10px] px-1.5 pt-0.5 rounded hover:scale-105 hover:brightness-110 focus:ring-2 focus:ring-offset-1 focus:ring-offset-base-100'}"
		class:animate-pulse={config.pulse && variant === 'badge'}
		class:cursor-not-allowed={disabled}
		class:opacity-50={disabled}
		style={variant === 'integrated'
			? `color: ${config.textColor};`
			: `background: ${config.bgColor}; color: ${config.textColor}; border: 1px solid ${config.borderColor};`
		}
		disabled={disabled}
		title="Click for server actions"
	>
		<!-- Server icon -->
		<svg class="inline-block w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d={config.icon} />
		</svg>
		{displayLabel()}
		<!-- Port status indicator -->
		{#if port && serverStatus === 'running'}
			<span
				class="inline-block w-1.5 h-1.5 rounded-full ml-1 {portRunning ? 'port-active' : 'port-inactive'}"
				title={portRunning ? 'Port is listening' : 'Port not responding'}
			></span>
		{/if}
		<!-- Dropdown indicator -->
		<svg
			class="inline-block w-2.5 h-2.5 ml-0.5 transition-transform"
			class:rotate-180={dropUp ? !isOpen : isOpen}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2.5"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
		</svg>
	</button>

	<!-- Dropdown Menu -->
	{#if isOpen}
		<div
			class="server-dropdown absolute z-40 min-w-[180px] rounded-lg shadow-xl overflow-hidden {dropUp ? 'bottom-full mb-1' : 'top-full mt-1'} {alignRight ? 'right-0' : 'left-0'}"
			transition:fly={{ y: dropUp ? 5 : -5, duration: 150 }}
		>
			<!-- Server info header -->
			{#if port}
				<div
					class="px-3 py-2 flex items-center justify-between text-xs server-header"
				>
					<span class="opacity-70">Port</span>
					<span class="font-mono font-bold" style="color: {config.textColor};">
						:{port}
						{#if portRunning}
							<span class="text-success ml-1">active</span>
						{:else}
							<span class="text-base-content/40 ml-1">inactive</span>
						{/if}
					</span>
				</div>
			{/if}

			<!-- Actions list -->
			<ul class="py-1">
				{#each actions as action (action.id)}
					<li>
						<button
							type="button"
							onclick={() => executeAction(action)}
							class="w-full px-3 py-2 flex items-center gap-2 text-left text-xs transition-colors {getVariantClasses(action.variant)}"
							disabled={isExecuting}
						>
							{#if isExecuting}
								<span class="loading loading-spinner loading-xs"></span>
							{:else}
								<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d={action.icon} />
								</svg>
							{/if}
							<div class="flex flex-col min-w-0">
								<span class="font-semibold">{action.label}</span>
								{#if action.description}
									<span class="text-[10px] opacity-60 truncate">{action.description}</span>
								{/if}
							</div>
						</button>
					</li>
				{/each}
			</ul>

			<!-- Session info footer -->
			<div
				class="px-3 py-1.5 text-[9px] font-mono opacity-50 truncate server-footer"
			>
				{sessionName}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Port status indicators */
	.port-active {
		background: var(--color-success);
	}

	.port-inactive {
		background: var(--color-base-content);
		opacity: 0.3;
	}

	/* Dropdown container */
	.server-dropdown {
		background: var(--color-base-300);
		border: 1px solid color-mix(in oklch, var(--color-base-content) 20%, transparent);
	}

	/* Server info header */
	.server-header {
		background: var(--color-base-200);
		border-bottom: 1px solid color-mix(in oklch, var(--color-base-content) 15%, transparent);
	}

	/* Footer */
	.server-footer {
		background: var(--color-base-200);
		border-top: 1px solid color-mix(in oklch, var(--color-base-content) 15%, transparent);
	}
</style>
