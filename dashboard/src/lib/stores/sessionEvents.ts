/**
 * Cross-page session event broadcasting
 * Uses BroadcastChannel API to notify other tabs/pages of session changes
 */

import { writable } from 'svelte/store';

export type SessionEventType = 'session-killed' | 'session-spawned' | 'session-changed';

export interface SessionEvent {
	type: SessionEventType;
	sessionName: string;
	agentName: string;
	timestamp: number;
}

// Store for reactive updates within the same page
export const lastSessionEvent = writable<SessionEvent | null>(null);

// BroadcastChannel for cross-tab communication
let channel: BroadcastChannel | null = null;

/**
 * Initialize the broadcast channel (call once on app mount)
 */
export function initSessionEvents() {
	if (typeof window === 'undefined') return; // SSR guard

	if (!channel) {
		channel = new BroadcastChannel('jat-session-events');

		// Listen for events from other tabs/pages
		channel.onmessage = (event: MessageEvent<SessionEvent>) => {
			lastSessionEvent.set(event.data);
		};
	}
}

/**
 * Broadcast a session event to all tabs/pages
 */
export function broadcastSessionEvent(
	type: SessionEventType,
	sessionName: string,
	agentName?: string
) {
	const event: SessionEvent = {
		type,
		sessionName,
		agentName: agentName || sessionName.replace('jat-', ''),
		timestamp: Date.now()
	};

	// Update local store
	lastSessionEvent.set(event);

	// Broadcast to other tabs/pages
	if (channel) {
		channel.postMessage(event);
	}
}

/**
 * Cleanup (call on app unmount)
 */
export function closeSessionEvents() {
	if (channel) {
		channel.close();
		channel = null;
	}
}
