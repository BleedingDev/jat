/**
 * SSE endpoint for real-time session events
 *
 * Watches tmux sessions and pushes events to connected clients.
 *
 * Events emitted:
 * - connected: Initial connection acknowledgment
 * - session-output: { sessionName, output, lineCount, timestamp }
 * - session-state: { sessionName, state, timestamp }
 * - session-question: { sessionName, question, timestamp }
 * - session-created: { sessionName, agentName, task, timestamp }
 * - session-destroyed: { sessionName, timestamp }
 *
 * The watcher only runs when at least one client is connected.
 * Output changes are debounced (configurable via query param, default 250ms).
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { getTasks } from '$lib/server/beads.js';

const execAsync = promisify(exec);

// ============================================================================
// Configuration
// ============================================================================

const PROJECT_ROOT = process.cwd().replace('/dashboard', '');
const DEFAULT_DEBOUNCE_MS = 250;
const DEFAULT_OUTPUT_LINES = 100;
// INCREASED from 250ms to 1000ms - polling 4x/second was parsing 802 tasks
// from JSONL on each poll, causing server CPU spikes and browser freezes
const POLL_INTERVAL_MS = 1000;
const QUESTION_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// Cache for tasks - getTasks() is expensive (parses JSONL)
let cachedTasks: Task[] = [];
let taskCacheTimestamp = 0;
const TASK_CACHE_TTL_MS = 5000; // 5 second cache for tasks

// ============================================================================
// Types
// ============================================================================

interface SessionInfo {
	name: string;
	created: string;
	attached: boolean;
}

interface SessionState {
	output: string;
	outputHash: string;
	lineCount: number;
	state: string;
	hasQuestion: boolean;
	questionData?: unknown;
	task?: {
		id: string;
		title?: string;
		status?: string;
	} | null;
	agentName: string;
}

interface Task {
	id: string;
	title?: string;
	status?: string;
	assignee?: string;
}

// ============================================================================
// State Management
// ============================================================================

// Track connected clients
const clients = new Set<ReadableStreamDefaultController>();

// Track session state for change detection
const sessionStates = new Map<string, SessionState>();

// Track known sessions for create/destroy detection
let knownSessions = new Set<string>();

// Polling interval handle
let pollInterval: ReturnType<typeof setInterval> | null = null;

// Debounce timers for output changes
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simple hash for change detection
 */
function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return hash.toString(36);
}

/**
 * Signal file TTL - signals older than this are stale
 */
const SIGNAL_TTL_MS = 60 * 1000; // 1 minute

/**
 * Map jat-signal states to SessionCard states
 * Signal uses short names, SessionCard expects hyphenated names
 */
const SIGNAL_STATE_MAP: Record<string, string> = {
	'working': 'working',
	'review': 'ready-for-review',
	'needs_input': 'needs-input',
	'idle': 'idle',
	'completed': 'completed',
	'auto_proceed': 'completed',  // auto_proceed means task is done
	'starting': 'starting',
	'compacting': 'compacting',
	'completing': 'completing',
};

/**
 * Read signal state from /tmp/jat-signal-tmux-{sessionName}.json
 * Returns null if no valid signal file exists or signal is stale
 */
function readSignalState(sessionName: string): string | null {
	const signalFile = `/tmp/jat-signal-tmux-${sessionName}.json`;

	try {
		if (!existsSync(signalFile)) {
			return null;
		}

		// Check file age - signals older than TTL are stale
		const stats = statSync(signalFile);
		const ageMs = Date.now() - stats.mtimeMs;
		if (ageMs > SIGNAL_TTL_MS) {
			return null;
		}

		const content = readFileSync(signalFile, 'utf-8');
		const signal = JSON.parse(content);

		// Only use state signals
		if (signal.type === 'state' && signal.state) {
			// Map signal state to SessionCard state
			return SIGNAL_STATE_MAP[signal.state] || signal.state;
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Detect session state - prefers signal file over marker parsing
 *
 * State priority:
 * 1. Signal file (authoritative - written by jat-signal hook)
 * 2. Marker parsing (fallback - legacy support)
 */
function detectSessionState(output: string, task: Task | null, sessionName?: string): string {
	// First, try to read state from signal file (authoritative source)
	if (sessionName) {
		const signalState = readSignalState(sessionName);
		if (signalState) {
			return signalState;
		}
	}

	// Fall back to marker parsing for legacy support
	return detectSessionStateFromOutput(output, task);
}

/**
 * Detect session state from terminal output (legacy fallback)
 * Uses the same logic as /api/work for consistency
 */
function detectSessionStateFromOutput(output: string, task: Task | null): string {
	const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');
	const recentOutput = output ? stripAnsi(output.slice(-3000)) : '';

	// Find positions of state markers
	const completedPos = recentOutput.lastIndexOf('[JAT:COMPLETED]');
	const idlePos = recentOutput.lastIndexOf('[JAT:IDLE]');

	// Question UI patterns
	const questionUIPatterns = [
		'Enter to select',
		'Tab/Arrow keys to navigate',
		'Type something',
		'[ ]'
	];
	let needsInputPos = recentOutput.lastIndexOf('[JAT:NEEDS_INPUT]');
	for (const pattern of questionUIPatterns) {
		const pos = recentOutput.lastIndexOf(pattern);
		if (pos > needsInputPos) needsInputPos = pos;
	}

	const reviewPos = Math.max(
		recentOutput.lastIndexOf('[JAT:NEEDS_REVIEW]'),
		recentOutput.lastIndexOf('[JAT:READY]'),
		recentOutput.lastIndexOf('ready to mark complete'),
		recentOutput.lastIndexOf('Ready to mark complete'),
		recentOutput.lastIndexOf('shall I mark'),
		recentOutput.lastIndexOf('Shall I mark'),
		recentOutput.lastIndexOf('ready for review'),
		recentOutput.lastIndexOf('Ready for Review')
	);

	const completingPos = Math.max(
		recentOutput.lastIndexOf('jat:complete is running'),
		recentOutput.lastIndexOf('Marking task complete')
	);

	const workingPos = recentOutput.lastIndexOf('[JAT:WORKING');
	const compactingPos = recentOutput.lastIndexOf('[JAT:COMPACTING]');

	if (task) {
		// Build list of detected states with positions
		const positions = [
			{ state: 'needs-input', pos: needsInputPos },
			{ state: 'ready-for-review', pos: reviewPos },
			{ state: 'completing', pos: completingPos },
			{ state: 'compacting', pos: compactingPos },
			{ state: 'working', pos: workingPos }
		];

		// Most recent marker wins
		const sorted = positions.filter(p => p.pos >= 0).sort((a, b) => b.pos - a.pos);
		if (sorted.length > 0) {
			return sorted[0].state;
		}

		return 'working';
	}

	// No task - check for completion markers
	const hasCompletionMarker = completedPos >= 0 || idlePos >= 0 ||
		/✅\s*TASK COMPLETE/.test(recentOutput);

	if (hasCompletionMarker) {
		return 'completed';
	}

	if (recentOutput.length < 500) {
		return 'starting';
	}

	return 'idle';
}

/**
 * Read question data for a session
 */
function readQuestionData(sessionName: string): { hasQuestion: boolean; questionData?: unknown } {
	const questionFile = `/tmp/claude-question-tmux-${sessionName}.json`;

	try {
		if (!existsSync(questionFile)) {
			return { hasQuestion: false };
		}

		const stats = statSync(questionFile);
		const ageMs = Date.now() - stats.mtimeMs;

		if (ageMs > QUESTION_MAX_AGE_MS) {
			return { hasQuestion: false };
		}

		const content = readFileSync(questionFile, 'utf-8');
		const questionData = JSON.parse(content);

		return { hasQuestion: true, questionData };
	} catch {
		return { hasQuestion: false };
	}
}

/**
 * Get list of jat-* tmux sessions
 */
async function getTmuxSessions(): Promise<SessionInfo[]> {
	try {
		const { stdout } = await execAsync(
			'tmux list-sessions -F "#{session_name}:#{session_created}:#{session_attached}" 2>/dev/null || echo ""'
		);

		return stdout
			.trim()
			.split('\n')
			.filter(line => line.length > 0 && line.startsWith('jat-') && !line.startsWith('jat-pending-'))
			.map(line => {
				const [name, created, attached] = line.split(':');
				return {
					name,
					created: new Date(parseInt(created, 10) * 1000).toISOString(),
					attached: attached === '1'
				};
			});
	} catch {
		return [];
	}
}

/**
 * Capture output from a tmux session
 */
async function captureOutput(sessionName: string, lines: number): Promise<string> {
	try {
		const { stdout } = await execAsync(
			`tmux capture-pane -p -e -t "${sessionName}" -S -${lines}`,
			{ maxBuffer: 1024 * 1024 * 5 }
		);
		return stdout;
	} catch {
		return '';
	}
}

/**
 * Broadcast an SSE event to all connected clients
 */
function broadcast(eventType: string, data: unknown): void {
	const message = `data: ${JSON.stringify({ type: eventType, ...data as object, timestamp: Date.now() })}\n\n`;
	const encoded = new TextEncoder().encode(message);

	for (const controller of clients) {
		try {
			controller.enqueue(encoded);
		} catch (err) {
			console.error('[SSE Sessions] Failed to send to client:', err);
		}
	}
}

// ============================================================================
// Session Polling
// ============================================================================

/**
 * Poll sessions and emit events for changes
 */
/**
 * Get tasks with caching to avoid expensive JSONL parsing on every poll
 */
function getCachedTasks(): Task[] {
	const now = Date.now();
	if (now - taskCacheTimestamp > TASK_CACHE_TTL_MS || cachedTasks.length === 0) {
		try {
			cachedTasks = getTasks({});
			taskCacheTimestamp = now;
		} catch {
			// Continue with stale cache on error
		}
	}
	return cachedTasks;
}

async function pollSessions(outputLines: number, debounceMs: number): Promise<void> {
	if (clients.size === 0) return;

	// Get current sessions
	const sessions = await getTmuxSessions();
	const currentSessionNames = new Set(sessions.map(s => s.name));

	// Get all tasks for agent lookup (cached to avoid expensive JSONL parsing)
	const allTasks = getCachedTasks();

	// Create agent -> task map
	const agentTaskMap = new Map<string, Task>();
	allTasks
		.filter((t: Task) => t.status === 'in_progress' && t.assignee)
		.forEach((t: Task) => {
			agentTaskMap.set(t.assignee!, t);
		});

	// Detect new sessions
	for (const sessionName of currentSessionNames) {
		if (!knownSessions.has(sessionName)) {
			const agentName = sessionName.replace(/^jat-/, '');
			const task = agentTaskMap.get(agentName) || null;

			broadcast('session-created', {
				sessionName,
				agentName,
				task: task ? { id: task.id, title: task.title, status: task.status } : null
			});
		}
	}

	// Detect destroyed sessions
	for (const sessionName of knownSessions) {
		if (!currentSessionNames.has(sessionName)) {
			broadcast('session-destroyed', { sessionName });
			sessionStates.delete(sessionName);
		}
	}

	knownSessions = currentSessionNames;

	// Process each session
	for (const session of sessions) {
		const agentName = session.name.replace(/^jat-/, '');
		const task = agentTaskMap.get(agentName) || null;

		// Capture output
		const output = await captureOutput(session.name, outputLines);
		const outputHash = simpleHash(output);
		const lineCount = output.split('\n').length;

		// Detect state - prefers signal file over marker parsing
		const state = detectSessionState(output, task, session.name);

		// Read question data
		const { hasQuestion, questionData } = readQuestionData(session.name);

		// Get previous state
		const prevState = sessionStates.get(session.name);

		// Update stored state
		sessionStates.set(session.name, {
			output,
			outputHash,
			lineCount,
			state,
			hasQuestion,
			questionData,
			task,
			agentName
		});

		// Check for output changes (debounced)
		if (!prevState || prevState.outputHash !== outputHash) {
			// Clear existing debounce timer
			const existingTimer = debounceTimers.get(session.name);
			if (existingTimer) clearTimeout(existingTimer);

			// Set new debounce timer
			debounceTimers.set(session.name, setTimeout(() => {
				broadcast('session-output', {
					sessionName: session.name,
					output,
					lineCount
				});
				debounceTimers.delete(session.name);
			}, debounceMs));
		}

		// Check for state changes (immediate, not debounced)
		if (!prevState || prevState.state !== state) {
			broadcast('session-state', {
				sessionName: session.name,
				state,
				previousState: prevState?.state || null
			});
		}

		// Check for question changes (immediate)
		if (hasQuestion && (!prevState || !prevState.hasQuestion)) {
			broadcast('session-question', {
				sessionName: session.name,
				question: questionData
			});
		}
	}
}

/**
 * Start polling when first client connects
 */
function startPolling(outputLines: number, debounceMs: number): void {
	if (pollInterval) return;

	console.log(`[SSE Sessions] Starting polling (${POLL_INTERVAL_MS}ms interval, ${debounceMs}ms debounce)`);

	// Initialize known sessions
	getTmuxSessions().then(sessions => {
		knownSessions = new Set(sessions.map(s => s.name));
		console.log(`[SSE Sessions] Initialized with ${sessions.length} sessions`);
	});

	pollInterval = setInterval(() => {
		pollSessions(outputLines, debounceMs).catch(err => {
			console.error('[SSE Sessions] Poll error:', err);
		});
	}, POLL_INTERVAL_MS);
}

/**
 * Stop polling when no clients connected
 */
function stopPolling(): void {
	if (!pollInterval) return;

	clearInterval(pollInterval);
	pollInterval = null;

	// Clear all debounce timers
	debounceTimers.forEach(timer => clearTimeout(timer));
	debounceTimers.clear();

	// Clear state
	sessionStates.clear();
	knownSessions.clear();

	console.log('[SSE Sessions] Stopped polling');
}

// ============================================================================
// SSE Endpoint
// ============================================================================

export function GET({ url }: { url: URL }) {
	// Parse query parameters
	const debounceMs = parseInt(url.searchParams.get('debounce') || String(DEFAULT_DEBOUNCE_MS), 10);
	const outputLines = parseInt(url.searchParams.get('lines') || String(DEFAULT_OUTPUT_LINES), 10);

	console.log(`[SSE Sessions] New client connecting (debounce: ${debounceMs}ms, lines: ${outputLines})`);

	let thisController: ReadableStreamDefaultController | null = null;

	const stream = new ReadableStream({
		start(controller) {
			thisController = controller;
			clients.add(controller);
			console.log(`[SSE Sessions] Client connected. Total clients: ${clients.size}`);

			// Start polling if this is the first client
			if (clients.size === 1) {
				startPolling(outputLines, debounceMs);
			}

			// Send initial connection message
			const connectMsg = `data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`;
			controller.enqueue(new TextEncoder().encode(connectMsg));
		},
		cancel() {
			console.log('[SSE Sessions] Client disconnected');
			if (thisController) {
				clients.delete(thisController);
			}
			console.log(`[SSE Sessions] Remaining clients: ${clients.size}`);

			// Stop polling if no clients left
			if (clients.size === 0) {
				stopPolling();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	});
}
