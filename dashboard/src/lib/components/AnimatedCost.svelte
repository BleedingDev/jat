<script lang="ts">
	/**
	 * AnimatedCost Component
	 *
	 * Displays numeric values with smooth tween animation on value changes.
	 * Uses Svelte 5 Tween from svelte/motion with cubicOut easing.
	 *
	 * @example
	 * ```svelte
	 * <AnimatedCost value={695.50} />
	 * <AnimatedCost value={1234} format={(n) => `${n.toFixed(0)} tokens`} />
	 * <AnimatedCost value={99.99} class="text-success" duration={600} />
	 * ```
	 */

	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	interface Props {
		/** Raw numeric value to display */
		value: number;
		/** Format function for display (default: dollar format) */
		format?: (n: number) => string;
		/** Additional CSS classes for the container */
		class?: string;
		/** Animation duration in milliseconds (default: 400) */
		duration?: number;
	}

	let {
		value,
		format = (n: number) => `$${n.toFixed(2)}`,
		class: className = '',
		duration = 400
	}: Props = $props();

	// Initialize tween with the current value to avoid animating from 0 on mount
	const animatedValue = new Tween(value, {
		duration,
		easing: cubicOut
	});

	// Update tween target when value changes
	$effect(() => {
		animatedValue.set(value, { duration, easing: cubicOut });
	});

	// Format the current animated value for display
	const displayValue = $derived(format(animatedValue.current));
</script>

<span class="font-mono {className}" aria-label={format(value)}>
	{displayValue}
</span>
