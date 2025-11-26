<script lang="ts">
	/**
	 * AnimatedDigits Component
	 *
	 * Displays pre-formatted strings (e.g., '1.1B', '500M', '50K') with DaisyUI
	 * countdown-style rolling digit animation for numeric characters.
	 *
	 * Non-numeric characters (., K, M, B, etc.) are rendered statically.
	 *
	 * @example
	 * ```svelte
	 * <AnimatedDigits value="1.1B" />
	 * <AnimatedDigits value="500M" class="text-primary" />
	 * ```
	 */

	interface Props {
		/** Pre-formatted string to display (e.g., '1.1B', '500M', '50K') */
		value: string;
		/** Additional CSS classes for the container */
		class?: string;
	}

	let { value, class: className = '' }: Props = $props();

	// Split value into individual characters
	const characters = $derived(value.split(''));
</script>

<span class="inline-flex items-baseline font-mono {className}" aria-label={value}>
	{#each characters as char, i (i)}
		{#if /\d/.test(char)}
			<span class="countdown">
				<span style="--value:{parseInt(char)};" aria-hidden="true">{char}</span>
			</span>
		{:else}
			<span aria-hidden="true">{char}</span>
		{/if}
	{/each}
</span>
