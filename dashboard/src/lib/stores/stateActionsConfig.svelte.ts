/**
 * State Actions Config Store
 *
 * Svelte 5 store for managing user-configurable state actions.
 * Loads config once and caches it, providing reactive access to
 * merged actions for each session state.
 */

import { browser } from '$app/environment';
import {
	type StateActionsUserConfig,
	type UserActionConfig,
	getActionsForState,
	createDefaultUserConfig
} from '$lib/config/stateActionsConfig';
import { type SessionState, type SessionStateAction, SESSION_STATE_ACTIONS } from '$lib/config/statusColors';

// =============================================================================
// STATE
// =============================================================================

let userConfig = $state<StateActionsUserConfig | null>(null);
let isLoading = $state(false);
let isLoaded = $state(false);
let loadError = $state<string | null>(null);

// =============================================================================
// ACTIONS
// =============================================================================

/**
 * Load user config from API
 */
export async function loadUserConfig(): Promise<void> {
	if (!browser) return;
	if (isLoading) return;

	isLoading = true;
	loadError = null;

	try {
		const response = await fetch('/api/config/state-actions?includeDefaults=false');
		if (!response.ok) {
			throw new Error(`Failed to load config: ${response.statusText}`);
		}

		const data = await response.json();
		userConfig = data.config;
		isLoaded = true;
	} catch (err) {
		loadError = err instanceof Error ? err.message : String(err);
		console.error('[stateActionsConfig] Failed to load:', err);
	} finally {
		isLoading = false;
	}
}

/**
 * Save user config to API
 */
export async function saveUserConfig(config: StateActionsUserConfig): Promise<boolean> {
	if (!browser) return false;

	try {
		const response = await fetch('/api/config/state-actions', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(config)
		});

		if (!response.ok) {
			throw new Error(`Failed to save config: ${response.statusText}`);
		}

		userConfig = config;
		return true;
	} catch (err) {
		console.error('[stateActionsConfig] Failed to save:', err);
		return false;
	}
}

/**
 * Update actions for a single state
 */
export async function updateStateActions(
	state: SessionState,
	actions: UserActionConfig[],
	includeDefaults: boolean = true
): Promise<boolean> {
	if (!browser) return false;

	try {
		const response = await fetch('/api/config/state-actions', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ state, actions, includeDefaults })
		});

		if (!response.ok) {
			throw new Error(`Failed to update config: ${response.statusText}`);
		}

		const data = await response.json();
		userConfig = data.config;
		return true;
	} catch (err) {
		console.error('[stateActionsConfig] Failed to update:', err);
		return false;
	}
}

/**
 * Reset config to defaults
 */
export async function resetToDefaults(state?: SessionState): Promise<boolean> {
	if (!browser) return false;

	try {
		const url = state
			? `/api/config/state-actions?state=${state}`
			: '/api/config/state-actions';

		const response = await fetch(url, { method: 'DELETE' });

		if (!response.ok) {
			throw new Error(`Failed to reset config: ${response.statusText}`);
		}

		if (state && userConfig) {
			// Update local state to remove the specific state
			const newConfig = { ...userConfig };
			delete newConfig.states[state];
			userConfig = newConfig;
		} else {
			userConfig = null;
		}

		return true;
	} catch (err) {
		console.error('[stateActionsConfig] Failed to reset:', err);
		return false;
	}
}

// =============================================================================
// GETTERS (reactive)
// =============================================================================

/**
 * Get actions for a specific state, merging user config with defaults
 */
export function getActions(state: SessionState): SessionStateAction[] {
	return getActionsForState(state, userConfig ?? undefined);
}

/**
 * Check if a state has custom config
 */
export function hasCustomConfig(state: SessionState): boolean {
	return !!(userConfig?.states?.[state]);
}

/**
 * Get the raw user config for a state (for editing)
 */
export function getStateConfig(state: SessionState): UserActionConfig[] | null {
	return userConfig?.states?.[state]?.actions ?? null;
}

/**
 * Get whether to include defaults for a state
 */
export function getIncludeDefaults(state: SessionState): boolean {
	return userConfig?.states?.[state]?.includeDefaults !== false;
}

// =============================================================================
// EXPORTED STATE (readonly)
// =============================================================================

export function getIsLoading(): boolean {
	return isLoading;
}

export function getIsLoaded(): boolean {
	return isLoaded;
}

export function getLoadError(): string | null {
	return loadError;
}

export function getUserConfig(): StateActionsUserConfig | null {
	return userConfig;
}
