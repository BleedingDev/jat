/**
 * Filter utility helpers for managing Set-based filter state.
 * Consolidates duplicate toggle/URL sync patterns from TaskTable and TaskQueue.
 */

/**
 * Toggle an item in a Set (add if not present, remove if present).
 * Returns a NEW Set to trigger Svelte reactivity.
 *
 * @param set - The current Set
 * @param item - Item to toggle
 * @returns A new Set with the item toggled
 *
 * @example
 * // In Svelte component:
 * selectedPriorities = toggleSetItem(selectedPriorities, 'P0');
 */
export function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
	const newSet = new Set(set);
	if (newSet.has(item)) {
		newSet.delete(item);
	} else {
		newSet.add(item);
	}
	return newSet;
}

/**
 * Create a toggle function bound to a specific Set state setter.
 * Useful for creating multiple toggle handlers with less boilerplate.
 *
 * @param getSetter - Function that returns [currentSet, setter] tuple
 * @returns A toggle function for that Set
 *
 * @example
 * // In Svelte component with $state:
 * let selectedPriorities = $state(new Set<string>());
 * const togglePriority = (p: string) => {
 *   selectedPriorities = toggleSetItem(selectedPriorities, p);
 * };
 */

/**
 * Filter configuration for URL serialization.
 * Maps filter names to their URL parameter keys.
 */
export interface FilterConfig {
	[filterName: string]: {
		urlKey: string;
		serialize?: (value: any) => string;
		deserialize?: (value: string) => any;
	};
}

/**
 * Default filter configuration for task filters.
 */
export const DEFAULT_FILTER_CONFIG: FilterConfig = {
	priorities: { urlKey: 'priority' },
	statuses: { urlKey: 'status' },
	types: { urlKey: 'type' },
	labels: { urlKey: 'label' },
	projects: { urlKey: 'project' }
};

/**
 * Build URL search params from filter Sets.
 * Each Set value becomes a comma-separated list in the URL.
 *
 * @param filters - Record of filter name to Set of values
 * @param config - Filter configuration (defaults to task filters)
 * @returns URLSearchParams object
 *
 * @example
 * const filters = {
 *   priorities: new Set(['P0', 'P1']),
 *   statuses: new Set(['open'])
 * };
 * const params = buildFilterParams(filters);
 * // → URLSearchParams { priority: 'P0,P1', status: 'open' }
 */
export function buildFilterParams(
	filters: Record<string, Set<any>>,
	config: FilterConfig = DEFAULT_FILTER_CONFIG
): URLSearchParams {
	const params = new URLSearchParams();

	for (const [filterName, filterSet] of Object.entries(filters)) {
		if (filterSet.size > 0 && config[filterName]) {
			const { urlKey, serialize } = config[filterName];
			const values = Array.from(filterSet);
			const serialized = serialize
				? values.map(serialize).join(',')
				: values.join(',');
			params.set(urlKey, serialized);
		}
	}

	return params;
}

/**
 * Parse URL search params into filter Sets.
 *
 * @param params - URLSearchParams to parse
 * @param config - Filter configuration (defaults to task filters)
 * @returns Record of filter name to Set of values
 *
 * @example
 * const params = new URLSearchParams('priority=P0,P1&status=open');
 * const filters = parseFilterParams(params);
 * // → { priorities: Set(['P0', 'P1']), statuses: Set(['open']), ... }
 */
export function parseFilterParams(
	params: URLSearchParams,
	config: FilterConfig = DEFAULT_FILTER_CONFIG
): Record<string, Set<any>> {
	const filters: Record<string, Set<any>> = {};

	for (const [filterName, { urlKey, deserialize }] of Object.entries(config)) {
		const value = params.get(urlKey);
		if (value) {
			const values = value.split(',').filter(Boolean);
			filters[filterName] = new Set(
				deserialize ? values.map(deserialize) : values
			);
		} else {
			filters[filterName] = new Set();
		}
	}

	return filters;
}

/**
 * Update URL with current filter state without triggering navigation.
 * Uses replaceState to update URL in place.
 *
 * @param filters - Current filter state
 * @param config - Filter configuration
 * @param baseUrl - Base URL to update (defaults to current location)
 */
export function syncFiltersToURL(
	filters: Record<string, Set<any>>,
	config: FilterConfig = DEFAULT_FILTER_CONFIG,
	baseUrl?: URL
): void {
	const url = baseUrl || new URL(window.location.href);

	// Clear existing filter params
	for (const { urlKey } of Object.values(config)) {
		url.searchParams.delete(urlKey);
	}

	// Add current filter params
	const newParams = buildFilterParams(filters, config);
	newParams.forEach((value, key) => {
		url.searchParams.set(key, value);
	});

	// Update URL without navigation
	window.history.replaceState({}, '', url.toString());
}

/**
 * Check if any filters are active (non-empty).
 *
 * @param filters - Record of filter Sets
 * @returns true if at least one filter has values
 *
 * @example
 * hasActiveFilters({ priorities: new Set(['P0']), statuses: new Set() })
 * // → true
 */
export function hasActiveFilters(filters: Record<string, Set<any>>): boolean {
	return Object.values(filters).some(set => set.size > 0);
}

/**
 * Clear all filters (return empty Sets).
 *
 * @param config - Filter configuration to determine which filters to clear
 * @returns Record with empty Sets for each filter
 */
export function clearAllFilters(
	config: FilterConfig = DEFAULT_FILTER_CONFIG
): Record<string, Set<any>> {
	const cleared: Record<string, Set<any>> = {};
	for (const filterName of Object.keys(config)) {
		cleared[filterName] = new Set();
	}
	return cleared;
}

/**
 * Count total number of active filter values.
 *
 * @param filters - Record of filter Sets
 * @returns Total count of filter values across all filters
 */
export function countActiveFilters(filters: Record<string, Set<any>>): number {
	return Object.values(filters).reduce((sum, set) => sum + set.size, 0);
}
