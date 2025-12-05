/**
 * Store for tracking the currently hovered session (for keyboard shortcuts)
 * and visual feedback for session actions
 */
import { writable, get } from 'svelte/store';

// Currently hovered session name (null if none)
export const hoveredSessionName = writable<string | null>(null);

export function setHoveredSession(sessionName: string | null) {
	hoveredSessionName.set(sessionName);
}

// Track the session that should be highlighted (from Alt+number jump)
export const highlightedSessionName = writable<string | null>(null);

/**
 * Jump to a session by setting it as hovered, scrolling to it, and highlighting it
 * @param sessionName - The session name to jump to (e.g., "jat-AgentName" for work, "server-project" for servers)
 * @param agentName - The agent name if this is a work session (used for data-agent-name selector)
 */
export function jumpToSession(sessionName: string, agentName?: string) {
	// Set as hovered so other shortcuts (Alt+K, Alt+I, etc.) work on it
	hoveredSessionName.set(sessionName);

	// Set highlighted for visual feedback
	highlightedSessionName.set(sessionName);

	// Clear highlight after animation
	setTimeout(() => {
		highlightedSessionName.update(current => current === sessionName ? null : current);
	}, 2000);

	// Scroll to the session card
	// Try work session selector first (data-agent-name), then server session selector (data-session-name)
	const selectors = [
		agentName ? `[data-agent-name="${agentName}"]` : null,
		`[data-session-name="${sessionName}"]`,
		`[data-agent-name="${sessionName.replace(/^jat-/, '')}"]`  // Fallback: extract agent from session name
	].filter(Boolean);

	for (const selector of selectors) {
		const element = document.querySelector(selector as string);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
			break;
		}
	}
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
