<script lang="ts">
	/**
	 * TerminalActivitySparkline
	 *
	 * A compact sparkline showing terminal output activity over time.
	 * Each bar represents activity in a time bucket (lines of output).
	 *
	 * Usage:
	 * ```svelte
	 * <TerminalActivitySparkline
	 *   activityData={[0, 5, 12, 3, 0, 8, 25, 2]}
	 *   maxBars={12}
	 *   height={16}
	 *   width={48}
	 * />
	 * ```
	 */

	interface Props {
		/** Array of activity values (lines of output per time bucket) */
		activityData?: number[];
		/** Maximum number of bars to show */
		maxBars?: number;
		/** Height in pixels */
		height?: number;
		/** Width in pixels */
		width?: number;
		/** CSS class for activity level (overrides auto-detection) */
		colorClass?: string;
		/** Whether to show tooltip on hover */
		showTooltip?: boolean;
		/** Whether to animate bars on entry (currently unused, kept for compatibility) */
		animateEntry?: boolean;
	}

	let {
		activityData = [],
		maxBars = 12,
		height = 16,
		width = 48,
		colorClass = '',
		showTooltip = true
	}: Props = $props();

	// Get the last N data points - properly memoized
	// Use -1 for "no data yet" padding, 0 for "monitored but idle"
	const displayData = $derived.by(() => {
		const data = activityData.slice(-maxBars);
		// Pad with -1 (no data) if not enough data points yet
		while (data.length < maxBars) {
			data.unshift(-1);
		}
		return data;
	});

	// Calculate max value for scaling (ignore -1 padding values)
	const maxValue = $derived.by(() => {
		const positiveValues = displayData.filter(v => v > 0);
		return positiveValues.length > 0 ? Math.max(...positiveValues) : 1;
	});

	// Calculate bar width with gap - only depends on width and maxBars
	const barWidth = $derived((width - (maxBars - 1)) / maxBars);

	// Calculate total activity
	const totalActivity = $derived(activityData.reduce((sum, v) => sum + v, 0));

	// Recent activity (last 3 buckets)
	const recentActivity = $derived.by(() => {
		return activityData.slice(-3).reduce((sum, v) => sum + v, 0);
	});

	// Determine activity level for color intensity
	const activityLevel = $derived.by<'idle' | 'low' | 'medium' | 'high'>(() => {
		if (recentActivity === 0) return 'idle';
		if (recentActivity < 10) return 'low';
		if (recentActivity < 50) return 'medium';
		return 'high';
	});

	// CSS class lookup by activity level - using Tailwind classes
	const levelClass = $derived.by(() => {
		if (colorClass) return colorClass;
		switch (activityLevel) {
			case 'idle': return 'bg-base-content/25';
			case 'low': return 'bg-info opacity-60';
			case 'medium': return 'bg-info';
			case 'high': return 'bg-success';
			default: return 'bg-base-content/25';
		}
	});
</script>

<div
	class="inline-flex items-end gap-px"
	style="height: {height}px; width: {width}px;"
	title={showTooltip ? `Activity: ${totalActivity} events (recent: ${recentActivity})` : undefined}
>
	{#each displayData as value, i}
		{@const isNoData = value < 0}
		{@const isIdle = value === 0}
		{@const barHeight = isNoData ? 0 : isIdle ? 2 : Math.max((value / maxValue) * height, 3)}
		{@const isRecent = i >= displayData.length - 3}
		<div
			class="sparkline-bar rounded-sm transition-all duration-200 {isIdle ? 'bg-base-content/15' : levelClass}"
			style="
				width: {barWidth}px;
				height: {barHeight}px;
				opacity: {isNoData ? 0 : isRecent ? 1 : 0.5};
			"
		></div>
	{/each}
</div>

