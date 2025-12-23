<script lang="ts">
	/**
	 * FilterDropdown Component
	 * Reusable multi-select filter component for filter bars
	 *
	 * Supports two modes:
	 * - dropdown: Click button to show options in dropdown menu (default)
	 * - inline: Options displayed inline without dropdown wrapper
	 *
	 * Supports two styles:
	 * - badge: Clickable badge buttons (default, good for compact filters)
	 * - checkbox: Checkbox list in menu format (good for longer lists)
	 *
	 * @example Badge dropdown (compact)
	 * <FilterDropdown
	 *   label="Priority"
	 *   options={[{ value: '0', label: 'P0', count: 5 }]}
	 *   selected={selectedPriorities}
	 *   onToggle={(v) => selectedPriorities = toggleSetItem(selectedPriorities, v)}
	 * />
	 *
	 * @example Checkbox dropdown (for longer lists)
	 * <FilterDropdown
	 *   label="Labels"
	 *   options={labelOptions}
	 *   selected={selectedLabels}
	 *   onToggle={toggleLabel}
	 *   style="checkbox"
	 * />
	 *
	 * @example Inline badges (no dropdown wrapper)
	 * <FilterDropdown
	 *   label="Status"
	 *   options={statusOptions}
	 *   selected={selectedStatuses}
	 *   onToggle={toggleStatus}
	 *   mode="inline"
	 * />
	 */

	interface FilterOption {
		value: string;
		label: string;
		count: number;
	}

	interface Props {
		/** Label shown on dropdown trigger button */
		label: string;
		/** Available options to select from */
		options: FilterOption[];
		/** Currently selected values */
		selected: Set<string>;
		/** Callback when option is toggled */
		onToggle: (value: string) => void;
		/** Function to get badge color class for a value */
		colorFn?: (value: string, isSelected: boolean) => string;
		/** Text to show when all options are selected */
		allSelectedText?: string;
		/** If true, empty selection means "all" (vs "none") */
		emptyMeansAll?: boolean;
		/** Display mode: 'dropdown' (default) or 'inline' */
		mode?: 'dropdown' | 'inline';
		/** Selection style: 'badge' (default) or 'checkbox' */
		style?: 'badge' | 'checkbox';
		/** Additional CSS class for the container */
		class?: string;
		/** Dropdown menu width class (e.g., 'w-44', 'w-52') */
		menuWidth?: string;
		/** Max height for scrollable content (e.g., 'max-h-60') */
		maxHeight?: string;
		/** Show hover effect on dropdown trigger */
		hoverTrigger?: boolean;
	}

	let {
		label,
		options,
		selected,
		onToggle,
		colorFn = () => 'badge-primary',
		allSelectedText = 'all',
		emptyMeansAll = false,
		mode = 'dropdown',
		style = 'badge',
		class: className = '',
		menuWidth = 'min-w-48',
		maxHeight = '',
		hoverTrigger = true
	}: Props = $props();

	// Compute display text for the trigger button
	const displayText = $derived.by(() => {
		if (emptyMeansAll && selected.size === 0) {
			return allSelectedText;
		}
		if (selected.size === options.length && options.length > 0) {
			return allSelectedText;
		}
		return String(selected.size);
	});

	// Compute badge class for trigger (show primary when filters active)
	const triggerBadgeClass = $derived.by(() => {
		if (emptyMeansAll) {
			return selected.size > 0 ? 'badge-primary' : 'badge-ghost';
		}
		return 'badge-primary';
	});

	// Handle option toggle
	function handleToggle(value: string) {
		onToggle(value);
	}

	// Handle keyboard navigation
	function handleKeydown(e: KeyboardEvent, value: string) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleToggle(value);
		}
	}
</script>

{#if mode === 'inline'}
	<!-- Inline Mode: No dropdown wrapper, just badge/checkbox grid -->
	<div class="flex flex-wrap gap-1.5 {className}">
		{#each options as opt}
			{#if style === 'checkbox'}
				<label class="label cursor-pointer justify-start gap-2">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						checked={selected.has(opt.value)}
						onchange={() => handleToggle(opt.value)}
					/>
					<span>{opt.label}</span>
					<span class="text-xs opacity-60">({opt.count})</span>
				</label>
			{:else}
				<button
					class="badge badge-sm transition-all duration-200 cursor-pointer {selected.has(opt.value)
						? colorFn(opt.value, true) + ' shadow-md'
						: 'badge-ghost hover:badge-primary/20 hover:shadow-sm hover:scale-105'}"
					onclick={() => handleToggle(opt.value)}
					onkeydown={(e) => handleKeydown(e, opt.value)}
				>
					{opt.label}
					<span class="ml-1 opacity-70">({opt.count})</span>
				</button>
			{/if}
		{/each}
	</div>
{:else}
	<!-- Dropdown Mode: Click to show options - Industrial Style -->
	<div class="dropdown {hoverTrigger ? 'dropdown-hover' : ''} {className}">
		<!-- Trigger Button - Industrial -->
		<div
			tabindex="0"
			role="button"
			class="px-2.5 py-1 rounded cursor-pointer transition-all industrial-hover flex items-center gap-1.5 font-mono text-xs tracking-wider bg-base-200 border border-base-300 text-base-content/60"
		>
			<span class="uppercase">{label}</span>
			<span
				class="px-1.5 py-0.5 rounded text-xs font-mono {selected.size > 0 && !(emptyMeansAll && selected.size === 0) ? 'bg-primary/20 text-primary' : 'bg-base-300 text-base-content opacity-60'}"
			>
				{displayText}
			</span>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
				class="w-3.5 h-3.5 text-base-content/50"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
			</svg>
		</div>

		<!-- Dropdown Content - Industrial -->
		{#if style === 'checkbox'}
			<!-- Checkbox style: Menu with checkboxes -->
			<ul
				tabindex="0"
				class="dropdown-content z-40 menu p-2 shadow rounded-box {menuWidth} {maxHeight ? maxHeight + ' overflow-y-auto' : ''} bg-base-200 border border-base-300"
			>
				{#each options as opt}
					<li>
						<label
							class="label cursor-pointer justify-start gap-2 rounded industrial-hover text-base-content/70"
						>
							<input
								type="checkbox"
								class="checkbox checkbox-sm border-base-content/40"
								checked={selected.has(opt.value)}
								onchange={() => handleToggle(opt.value)}
							/>
							<span class="truncate font-mono text-xs">{opt.label}</span>
							<span class="text-xs font-mono text-base-content/50">({opt.count})</span>
						</label>
					</li>
				{/each}
			</ul>
		{:else}
			<!-- Badge style: Grid of clickable badges - Industrial -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				tabindex="0"
				role="menu"
				class="dropdown-content rounded-box shadow-lg p-2 z-40 {menuWidth} mt-1 {maxHeight ? maxHeight + ' overflow-y-auto' : ''} bg-base-200 border border-base-300"
			>
				<div class="flex flex-wrap gap-1.5">
					{#each options as opt}
						<button
							class="px-2 py-0.5 rounded font-mono text-xs transition-all cursor-pointer border {selected.has(opt.value) ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-base-300 border-base-content/20 text-base-content opacity-70 hover:opacity-100'}"
							onclick={() => handleToggle(opt.value)}
							onkeydown={(e) => handleKeydown(e, opt.value)}
						>
							{opt.label}
							<span class="ml-1 text-base-content/50">({opt.count})</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}

