/**
 * Store for tracking the currently hovered session (for keyboard shortcuts)
 * and visual feedback for session actions
 */
import { writable } from 'svelte/store';

// Currently hovered session name (null if none)
export const hoveredSessionName = writable<string | null>(null);

export function setHoveredSession(sessionName: string | null) {
	hoveredSessionName.set(sessionName);
}

// Track sessions that just received a "complete" action (for visual feedback)
// Maps session name to timestamp when action was triggered
export const completingSessionFlash = writable<string | null>(null);

/**
 * Trigger a visual flash on a session card when Alt+C complete action is sent
 * The flash automatically clears after 1.5 seconds
 */
export function triggerCompleteFlash(sessionName: string) {
	completingSessionFlash.set(sessionName);
	setTimeout(() => {
		completingSessionFlash.update(current => current === sessionName ? null : current);
	}, 1500);
}
