<script lang="ts">
	/**
	 * WebSocket Connection Status Indicator
	 *
	 * Small visual indicator showing WebSocket connection state.
	 * Displays in TopBar to show real-time connection health.
	 *
	 * States:
	 * - connected: Green dot, solid
	 * - connecting: Blue dot, pulsing
	 * - reconnecting: Orange dot, pulsing
	 * - disconnected: Red dot, static
	 */

	import { websocketState, type ConnectionState } from '$lib/stores/websocket.svelte';

	// Visual configuration for each state
	const stateConfig: Record<ConnectionState, { color: string; label: string; pulse: boolean }> = {
		connected: {
			color: 'oklch(0.72 0.19 145)', // Green
			label: 'Connected',
			pulse: false
		},
		connecting: {
			color: 'oklch(0.70 0.18 240)', // Blue
			label: 'Connecting...',
			pulse: true
		},
		reconnecting: {
			color: 'oklch(0.75 0.18 60)', // Orange
			label: 'Reconnecting...',
			pulse: true
		},
		disconnected: {
			color: 'oklch(0.65 0.22 25)', // Red
			label: 'Disconnected',
			pulse: false
		}
	};

	// Get current config based on state
	const currentConfig = $derived(stateConfig[websocketState.connectionState]);

	// Show tooltip with more details
	let showTooltip = $state(false);

	// Format last message time
	const lastMessageAgo = $derived.by(() => {
		if (!websocketState.lastMessageTime) return null;
		const seconds = Math.floor((Date.now() - websocketState.lastMessageTime.getTime()) / 1000);
		if (seconds < 60) return `${seconds}s ago`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		return `${Math.floor(minutes / 60)}h ago`;
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative flex items-center"
	onmouseenter={() => showTooltip = true}
	onmouseleave={() => showTooltip = false}
>
	<!-- Status dot -->
	<div
		class="w-2 h-2 rounded-full transition-colors duration-300"
		class:animate-pulse={currentConfig.pulse}
		style="background: {currentConfig.color}; box-shadow: 0 0 6px {currentConfig.color};"
		title={currentConfig.label}
	></div>

	<!-- Tooltip -->
	{#if showTooltip}
		<div
			class="absolute top-full right-0 mt-2 px-3 py-2 rounded-lg shadow-xl z-50 whitespace-nowrap"
			style="
				background: linear-gradient(180deg, oklch(0.22 0.02 250) 0%, oklch(0.18 0.02 250) 100%);
				border: 1px solid oklch(0.40 0.03 250);
			"
		>
			<!-- Header -->
			<div class="flex items-center gap-2 mb-1.5">
				<div
					class="w-2 h-2 rounded-full"
					class:animate-pulse={currentConfig.pulse}
					style="background: {currentConfig.color};"
				></div>
				<span class="text-xs font-mono font-semibold" style="color: oklch(0.90 0.02 250);">
					WebSocket
				</span>
			</div>

			<!-- Status -->
			<div class="text-[10px] font-mono" style="color: {currentConfig.color};">
				{currentConfig.label}
			</div>

			<!-- Additional info -->
			{#if websocketState.connectionState === 'reconnecting'}
				<div class="text-[10px] font-mono mt-1" style="color: oklch(0.55 0.02 250);">
					Attempt {websocketState.reconnectAttempts}/10
				</div>
			{/if}

			{#if websocketState.lastError}
				<div class="text-[10px] font-mono mt-1" style="color: oklch(0.65 0.22 25);">
					{websocketState.lastError}
				</div>
			{/if}

			{#if websocketState.connectionState === 'connected' && lastMessageAgo}
				<div class="text-[10px] font-mono mt-1" style="color: oklch(0.55 0.02 250);">
					Last msg: {lastMessageAgo}
				</div>
			{/if}

			{#if websocketState.connectionState === 'connected' && websocketState.subscribedChannels.size > 0}
				<div class="text-[10px] font-mono mt-1" style="color: oklch(0.55 0.02 250);">
					Channels: {Array.from(websocketState.subscribedChannels).join(', ')}
				</div>
			{/if}
		</div>
	{/if}
</div>
