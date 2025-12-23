<script lang="ts">
	/**
	 * DateRangePicker Component
	 * DaisyUI dropdown for filtering by date range with quick presets
	 */

	import { formatShortDate } from '$lib/utils/dateFormatters';

	interface Props {
		selectedRange: string; // 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'
		customFrom?: string | null; // ISO date for custom range
		customTo?: string | null; // ISO date for custom range
		onRangeChange: (range: string, from?: string, to?: string) => void;
		compact?: boolean;
	}

	let {
		selectedRange = 'all',
		customFrom = null,
		customTo = null,
		onRangeChange,
		compact = false
	}: Props = $props();

	// Local state for custom date inputs
	let localFrom = $state(customFrom || '');
	let localTo = $state(customTo || '');
	let showCustom = $state(false);

	// Preset options
	const presets = [
		{ value: 'today', label: 'Today', icon: '1' },
		{ value: 'yesterday', label: 'Yesterday', icon: '-1' },
		{ value: 'week', label: 'Last 7 days', icon: '7' },
		{ value: 'month', label: 'Last 30 days', icon: '30' },
		{ value: 'all', label: 'All time', icon: '*' }
	];

	// Get display label for current selection
	const displayLabel = $derived.by(() => {
		if (selectedRange === 'custom' && customFrom && customTo) {
			return `${formatShortDate(customFrom)} - ${formatShortDate(customTo)}`;
		}
		if (selectedRange === 'custom' && customFrom) {
			return `From ${formatShortDate(customFrom)}`;
		}
		if (selectedRange === 'custom' && customTo) {
			return `Until ${formatShortDate(customTo)}`;
		}
		return presets.find(p => p.value === selectedRange)?.label || 'All time';
	});

	function handlePresetSelect(preset: string) {
		showCustom = false;
		localFrom = '';
		localTo = '';
		onRangeChange(preset);

		// Close dropdown
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	}

	function handleCustomApply() {
		if (localFrom || localTo) {
			onRangeChange('custom', localFrom || undefined, localTo || undefined);

			// Close dropdown
			if (document.activeElement instanceof HTMLElement) {
				document.activeElement.blur();
			}
		}
	}

	function toggleCustom() {
		showCustom = !showCustom;
	}
</script>

<!-- Industrial Date Range Picker -->
<div class="dropdown dropdown-end">
	<!-- Trigger Button - Industrial -->
	<div
		tabindex="0"
		role="button"
		class="{compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'} rounded cursor-pointer transition-all industrial-hover flex items-center gap-1.5 font-mono tracking-wider whitespace-nowrap bg-base-200 border border-base-300 text-base-content/60"
	>
		<!-- Calendar icon -->
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="w-4 h-4 text-primary"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
		</svg>
		<span class="hidden sm:inline">{displayLabel}</span>
		<span class="sm:hidden">
			{#if selectedRange === 'today'}
				1d
			{:else if selectedRange === 'yesterday'}
				-1d
			{:else if selectedRange === 'week'}
				7d
			{:else if selectedRange === 'month'}
				30d
			{:else if selectedRange === 'all'}
				All
			{:else}
				Custom
			{/if}
		</span>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="w-3 h-3 text-base-content/50"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
		</svg>
	</div>

	<!-- Dropdown Content - Industrial -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		tabindex="0"
		class="dropdown-content rounded-box z-40 w-72 p-3 shadow-lg mt-1 bg-base-200 border border-base-300"
	>
		<!-- Quick Presets - Industrial -->
		<div class="flex flex-wrap gap-1.5 mb-3">
			{#each presets as preset}
				<button
					type="button"
					class="px-2 py-1 rounded cursor-pointer transition-all duration-200 font-mono text-xs border {selectedRange === preset.value ? 'bg-primary/20 border-primary text-primary' : 'bg-base-300 border-base-content/20 text-base-content opacity-60 hover:opacity-100'}"
					onclick={() => handlePresetSelect(preset.value)}
				>
					{preset.label}
				</button>
			{/each}
		</div>

		<!-- Divider - Industrial -->
		<div class="my-2 flex items-center gap-2">
			<div class="flex-1 h-px bg-base-300"></div>
			<span class="text-xs font-mono uppercase tracking-wider text-base-content/40">or custom</span>
			<div class="flex-1 h-px bg-base-300"></div>
		</div>

		<!-- Custom Range Section - Industrial -->
		<div class="space-y-2">
			<div class="flex gap-2">
				<div class="form-control flex-1">
					<label class="label py-0.5" for="date-range-from">
						<span class="label-text text-xs font-mono uppercase tracking-wider text-base-content/50">From</span>
					</label>
					<input
						id="date-range-from"
						type="date"
						class="input input-sm w-full font-mono bg-base-300 border border-base-300 text-base-content"
						bind:value={localFrom}
						max={localTo || undefined}
					/>
				</div>
				<div class="form-control flex-1">
					<label class="label py-0.5" for="date-range-to">
						<span class="label-text text-xs font-mono uppercase tracking-wider text-base-content/50">To</span>
					</label>
					<input
						id="date-range-to"
						type="date"
						class="input input-sm w-full font-mono bg-base-300 border border-base-300 text-base-content"
						bind:value={localTo}
						min={localFrom || undefined}
					/>
				</div>
			</div>
			<button
				type="button"
				class="btn btn-sm btn-primary w-full font-mono"
				onclick={handleCustomApply}
				disabled={!localFrom && !localTo}
			>
				Apply Custom Range
			</button>
		</div>
	</div>
</div>

