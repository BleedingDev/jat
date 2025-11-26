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

<div class="dropdown dropdown-end">
	<!-- Trigger Button -->
	<div
		tabindex="0"
		role="button"
		class="btn {compact ? 'btn-sm' : 'btn-md'} gap-2"
	>
		<!-- Calendar icon -->
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="w-4 h-4"
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
			class="w-3 h-3 opacity-50"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
		</svg>
	</div>

	<!-- Dropdown Content -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		tabindex="0"
		class="dropdown-content bg-base-100 rounded-box z-50 w-64 p-3 shadow-lg border border-base-300 mt-1"
	>
		<!-- Quick Presets -->
		<div class="flex flex-wrap gap-1.5 mb-3">
			{#each presets as preset}
				<button
					type="button"
					class="badge badge-lg cursor-pointer transition-all duration-200 {selectedRange === preset.value
						? 'badge-primary shadow-md'
						: 'badge-ghost hover:badge-primary/20 hover:shadow-sm hover:scale-105'}"
					onclick={() => handlePresetSelect(preset.value)}
				>
					{preset.label}
				</button>
			{/each}
		</div>

		<!-- Divider -->
		<div class="divider my-1 text-xs opacity-50">or custom range</div>

		<!-- Custom Range Section -->
		<div class="space-y-2">
			<div class="flex gap-2">
				<div class="form-control flex-1">
					<label class="label py-0.5" for="date-range-from">
						<span class="label-text text-xs">From</span>
					</label>
					<input
						id="date-range-from"
						type="date"
						class="input input-sm input-bordered w-full"
						bind:value={localFrom}
						max={localTo || undefined}
					/>
				</div>
				<div class="form-control flex-1">
					<label class="label py-0.5" for="date-range-to">
						<span class="label-text text-xs">To</span>
					</label>
					<input
						id="date-range-to"
						type="date"
						class="input input-sm input-bordered w-full"
						bind:value={localTo}
						min={localFrom || undefined}
					/>
				</div>
			</div>
			<button
				type="button"
				class="btn btn-sm btn-primary w-full"
				onclick={handleCustomApply}
				disabled={!localFrom && !localTo}
			>
				Apply Custom Range
			</button>
		</div>
	</div>
</div>
