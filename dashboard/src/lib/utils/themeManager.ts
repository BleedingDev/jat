// src/lib/utils/themeManager.ts

/**
 * Theme management utility for Beads Dashboard.
 *
 * Theme preference is managed by the unified preferences store.
 * This module provides theme validation and the list of available themes.
 */

import {
	getTheme as getThemeFromStore,
	setTheme as setThemeInStore
} from '$lib/stores/preferences.svelte';

const DEFAULT_THEME = 'nord';

// All available DaisyUI themes
export const AVAILABLE_THEMES = [
	'light',
	'dark',
	'cupcake',
	'bumblebee',
	'emerald',
	'corporate',
	'synthwave',
	'retro',
	'cyberpunk',
	'valentine',
	'halloween',
	'garden',
	'forest',
	'aqua',
	'lofi',
	'pastel',
	'fantasy',
	'wireframe',
	'black',
	'luxury',
	'dracula',
	'cmyk',
	'autumn',
	'business',
	'acid',
	'lemonade',
	'night',
	'coffee',
	'winter',
	'dim',
	'nord',
	'sunset'
] as const;

export type Theme = (typeof AVAILABLE_THEMES)[number];

/**
 * Get the current theme (delegates to preferences store)
 */
export function getTheme(): string {
	return getThemeFromStore();
}

/**
 * Set the theme with validation (delegates to preferences store)
 * @param theme - Theme name from available DaisyUI themes
 */
export function setTheme(theme: string) {
	// Validate theme is available
	if (!AVAILABLE_THEMES.includes(theme as Theme)) {
		console.warn(`Invalid theme "${theme}", falling back to default`);
		theme = DEFAULT_THEME;
	}

	setThemeInStore(theme);
}

/**
 * Initialize theme on app start.
 * Note: Preferences store handles initialization via initPreferences()
 */
export function initializeTheme() {
	if (typeof document === 'undefined') return;

	// Just ensure DOM attribute matches store state
	const theme = getThemeFromStore();
	document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Check if a theme is valid.
 */
export function isValidTheme(theme: string): theme is Theme {
	return AVAILABLE_THEMES.includes(theme as Theme);
}
