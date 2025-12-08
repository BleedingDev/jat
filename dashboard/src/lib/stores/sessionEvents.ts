/**
 * Session event broadcasting for real-time session updates
 *
 * Two modes of operation:
 * 1. SSE connection to /api/sessions/events for real-time server events
 * 2. BroadcastChannel API for cross-tab communication
 *
 * Events handled from SSE:
 * - connected: Initial connection acknowledgment
 * - session-output: Terminal output changed → update workSessions store
 * - session-state: Session state changed → update state in workSessions store
 * - session-question: Agent asked a question → update question data
 * - session-created: New session appeared → add to workSessions store
 * - session-destroyed: Session ended → remove from workSessions store
 *
 * Integration:
 * - Call connectSessionEvents() in +layout.svelte onMount
 * - Disconnect on unmount with disconnectSessionEvents()
 * - Components can subscribe to lastSessionEvent for reactive updates
 */

import { writable } from 'svelte/store';
import { workSessionsState, type WorkSession } from './workSessions.svelte';

// Event types: original cross-tab events + new SSE events
export type SessionEventType =
	| 'session-killed'
	| 'session-spawned'
	| 'session-changed'
	| 'connected'
	| 'session-output'
	| 'session-state'
	| 'session-question'
	| 'session-created'
	| 'session-destroyed';

export interface SessionEvent {
	type: SessionEventType;
	sessionName?: string;
	agentName?: string;
	timestamp: number;
	// SSE event-specific fields
	output?: string;
	lineCount?: number;
	state?: string;
	previousState?: string | null;
	question?: unknown;
	task?: {
		id: string;
		title?: string;
		status?: string;
	} | null;
}

// Store for reactive updates - components can subscribe to this
export const lastSessionEvent = writable<SessionEvent | null>(null);

// SSE connection state
export const sessionEventsConnected = writable(false);

// ============================================================================
// SSE Connection
// ============================================================================

let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

/**
 * Handle session-output event: update terminal output for a session
 */
function handleSessionOutput(data: SessionEvent): void {
	const { sessionName, output, lineCount } = data;
	if (!sessionName || output === undefined) return;

	const sessionIndex = workSessionsState.sessions.findIndex(s => s.sessionName === sessionName);
	if (sessionIndex === -1) {
		// Session not in state yet - might be new, will be added by session-created
		return;
	}

	// Update the session output reactively
	workSessionsState.sessions = workSessionsState.sessions.map((session, idx) => {
		if (idx === sessionIndex) {
			return {
				...session,
				output: output,
				lineCount: lineCount ?? session.lineCount
			};
		}
		return session;
	});
}

/**
 * Handle session-state event: update session state
 * Updates the workSessions store with the new state for real-time UI updates
 */
function handleSessionState(data: SessionEvent): void {
	const { sessionName, state, previousState } = data;
	if (!sessionName || !state) return;

	// Log state transitions for debugging
	if (previousState && previousState !== state) {
		console.log(`[SessionEvents] State transition: ${sessionName} ${previousState} → ${state}`);
	}

	// Update the session state in workSessions store
	const sessionIndex = workSessionsState.sessions.findIndex(s => s.sessionName === sessionName);
	if (sessionIndex === -1) {
		// Session not in state yet - might be new, will be added by session-created
		return;
	}

	// Store the state in a custom property for components to access
	// This provides real-time state updates without re-parsing output
	workSessionsState.sessions = workSessionsState.sessions.map((session, idx) => {
		if (idx === sessionIndex) {
			return {
				...session,
				_sseState: state,
				_sseStateTimestamp: data.timestamp
			};
		}
		return session;
	});
}

/**
 * Handle session-question event: update question data for a session
 * Note: Question data is polled separately, this just notifies that new data is available
 */
function handleSessionQuestion(_data: SessionEvent): void {
	// Question data is polled separately via /api/work/{sessionId}/question
	// This event notifies components that new question data is available
	// Components subscribed to lastSessionEvent can refetch if needed
}

/**
 * Handle session-created event: add new session to store
 */
function handleSessionCreated(data: SessionEvent): void {
	const { sessionName, agentName, task, timestamp } = data;
	if (!sessionName) return;

	// Check if session already exists
	const exists = workSessionsState.sessions.some(s => s.sessionName === sessionName);
	if (exists) return;

	// Create new session entry
	const newSession: WorkSession = {
		sessionName,
		agentName: agentName || sessionName.replace(/^jat-/, ''),
		task: task || null,
		lastCompletedTask: null,
		output: '',
		lineCount: 0,
		tokens: 0,
		cost: 0,
		created: new Date(timestamp).toISOString(),
		attached: false
	};

	workSessionsState.sessions = [...workSessionsState.sessions, newSession];
}

/**
 * Handle session-destroyed event: remove session from store
 */
function handleSessionDestroyed(data: SessionEvent): void {
	const { sessionName } = data;
	if (!sessionName) return;

	workSessionsState.sessions = workSessionsState.sessions.filter(s => s.sessionName !== sessionName);
}

/**
 * Connect to the session events SSE endpoint for real-time updates
 * Call this once on app mount (in +layout.svelte)
 */
export function connectSessionEvents(): void {
	if (typeof window === 'undefined') return; // SSR guard
	if (eventSource) {
		console.log('[SessionEvents] Already connected, skipping');
		return;
	}

	console.log('[SessionEvents] Connecting to SSE...');

	try {
		eventSource = new EventSource('/api/sessions/events');

		eventSource.onopen = () => {
			console.log('[SessionEvents] SSE connected!');
			sessionEventsConnected.set(true);
			reconnectAttempts = 0;
		};

		eventSource.onmessage = (event) => {
			try {
				const data: SessionEvent = JSON.parse(event.data);
				const eventType = data.type;

				console.log('[SessionEvents] Received event:', eventType, data.sessionName || '');

				// Handle event based on type
				switch (eventType) {
					case 'connected':
						// Initial connection acknowledgment
						break;
					case 'session-output':
						handleSessionOutput(data);
						break;
					case 'session-state':
						handleSessionState(data);
						break;
					case 'session-question':
						handleSessionQuestion(data);
						break;
					case 'session-created':
						handleSessionCreated(data);
						break;
					case 'session-destroyed':
						handleSessionDestroyed(data);
						break;
				}

				// Broadcast event to any listening components
				lastSessionEvent.set(data);
			} catch (err) {
				console.error('[SessionEvents] Failed to parse session event:', err);
			}
		};

		eventSource.onerror = (err) => {
			console.error('[SessionEvents] SSE error:', err);
			sessionEventsConnected.set(false);

			// Close and attempt reconnect
			if (eventSource) {
				eventSource.close();
				eventSource = null;
			}

			if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
				reconnectAttempts++;
				console.log(
					`[SessionEvents] Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
				);
				reconnectTimer = setTimeout(() => {
					connectSessionEvents();
				}, RECONNECT_DELAY);
			} else {
				console.error('[SessionEvents] Max reconnect attempts reached');
			}
		};
	} catch (err) {
		console.error('[SessionEvents] Failed to connect to session events:', err);
	}
}

/**
 * Disconnect from session events SSE
 * Call this on app unmount
 */
export function disconnectSessionEvents(): void {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	if (eventSource) {
		eventSource.close();
		eventSource = null;
	}

	sessionEventsConnected.set(false);
	reconnectAttempts = 0;
	console.log('[SessionEvents] Disconnected');
}

/**
 * Check if SSE connection is active
 */
export function isSessionEventsConnected(): boolean {
	return eventSource !== null && eventSource.readyState === EventSource.OPEN;
}

/**
 * Manually trigger reconnection (e.g., after network recovery)
 */
export function reconnectSessionEvents(): void {
	disconnectSessionEvents();
	reconnectAttempts = 0;
	connectSessionEvents();
}

// ============================================================================
// BroadcastChannel for cross-tab communication (existing functionality)
// ============================================================================

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
 * Cleanup broadcast channel (call on app unmount)
 */
export function closeSessionEvents() {
	if (channel) {
		channel.close();
		channel = null;
	}
}
