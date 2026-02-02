/**
 * File Watchers for WebSocket Event Broadcasting
 *
 * Watches key files and broadcasts changes to WebSocket subscribers.
 * This replaces/complements the existing SSE implementation for tasks.
 *
 * Watched files:
 * - .beads/issues.jsonl - Task changes (new, removed, updated)
 * - /tmp/jat-signal-tmux-*.json - Agent state changes (agent-agnostic, written by jat-signal and Claude hooks)
 *
 * Usage:
 *   import { startWatchers, stopWatchers } from '$lib/server/websocket/watchers';
 *
 *   // Start watching (typically called after WebSocket server init)
 *   startWatchers();
 *
 *   // Stop watching (typically called on shutdown)
 *   stopWatchers();
 */

import { watch, type FSWatcher } from 'fs';
import { readFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { broadcastTaskChange, broadcastAgentState, broadcastOutput, isInitialized, getChannelSubscriberCount } from './connectionPool.js';

const execAsync = promisify(exec);

// ============================================================================
// Configuration
// ============================================================================

// IDE runs from /home/jw/code/jat/ide
// Beads file is at /home/jw/code/jat/.beads/issues.jsonl (parent directory)
const PROJECT_ROOT = join(process.cwd(), '..');
const BEADS_FILE = join(PROJECT_ROOT, '.beads', 'issues.jsonl');
const BEADS_DIR = dirname(BEADS_FILE);
const BEADS_FILENAME = basename(BEADS_FILE);

const SIGNAL_DIR = '/tmp';
const SIGNAL_PREFIX = 'jat-signal-tmux-';

// ============================================================================
// State
// ============================================================================

let beadsWatcher: FSWatcher | null = null;
let sessionsWatcher: FSWatcher | null = null;
let outputPollingInterval: NodeJS.Timeout | null = null;
let debounceTimers: Map<string, NodeJS.Timeout> = new Map();
let previousTaskIds = new Set<string>();
let previousOutputHashes = new Map<string, string>();
let isWatching = false;

// Output polling configuration
const OUTPUT_POLL_INTERVAL = 2000; // Poll every 2 seconds (was 250ms - caused memory leak)
const OUTPUT_LINES = 100; // Number of lines to capture per session
const EXEC_TIMEOUT_MS = 5000; // Timeout for exec commands

// Guard against overlapping polls
let isPolling = false;

// ============================================================================
// Task (Beads) Watcher
// ============================================================================

/**
 * Parse task IDs from the beads JSONL file
 */
async function getTaskIds(): Promise<Set<string>> {
	try {
		const content = await readFile(BEADS_FILE, 'utf-8');
		const ids = new Set<string>();
		for (const line of content.split('\n')) {
			if (!line.trim()) continue;
			try {
				const task = JSON.parse(line);
				if (task.id) ids.add(task.id);
			} catch {
				// Skip invalid lines
			}
		}
		return ids;
	} catch {
		return new Set();
	}
}

/**
 * Check for task changes and broadcast if any
 */
async function checkTaskChanges(): Promise<void> {
	if (!isInitialized()) return;

	const currentIds = await getTaskIds();

	// Find new tasks
	const newTasks: string[] = [];
	for (const id of currentIds) {
		if (!previousTaskIds.has(id)) {
			newTasks.push(id);
		}
	}

	// Find removed tasks
	const removedTasks: string[] = [];
	for (const id of previousTaskIds) {
		if (!currentIds.has(id)) {
			removedTasks.push(id);
		}
	}

	previousTaskIds = currentIds;

	// Broadcast changes
	if (newTasks.length > 0 || removedTasks.length > 0) {
		console.log(`[WS Watcher] Task changes: +${newTasks.length} -${removedTasks.length}`);
		broadcastTaskChange(newTasks, removedTasks);
	}
}

/**
 * Start watching the beads file
 */
function startBeadsWatcher(): void {
	if (beadsWatcher) {
		console.log('[WS Watcher] Beads watcher already running');
		return;
	}

	console.log(`[WS Watcher] Starting beads watcher: ${BEADS_DIR}`);

	// Initialize previous task IDs
	getTaskIds().then(ids => {
		previousTaskIds = ids;
		console.log(`[WS Watcher] Initialized with ${ids.size} existing tasks`);
	});

	try {
		// Watch the directory (more reliable than watching the file directly)
		beadsWatcher = watch(BEADS_DIR, { persistent: false }, (eventType, filename) => {
			if (filename === BEADS_FILENAME || filename === null) {
				// Debounce rapid changes
				const existingTimer = debounceTimers.get('beads');
				if (existingTimer) clearTimeout(existingTimer);

				debounceTimers.set('beads', setTimeout(() => {
					checkTaskChanges();
					debounceTimers.delete('beads');
				}, 100));
			}
		});

		beadsWatcher.on('error', (err) => {
			console.error('[WS Watcher] Beads watcher error:', err);
		});

		console.log('[WS Watcher] Beads watcher started');
	} catch (err) {
		console.error('[WS Watcher] Failed to start beads watcher:', err);
	}
}

// ============================================================================
// Agent Signal Watcher (agent-agnostic)
// ============================================================================

/**
 * Read and parse a jat-signal tmux signal file
 */
async function readSignalFile(filepath: string): Promise<any | null> {
	try {
		const content = await readFile(filepath, 'utf-8');
		return JSON.parse(content);
	} catch {
		return null;
	}
}

function inferAgentStateFromSignal(signal: any): string {
	if (!signal || typeof signal !== 'object') return 'unknown';
	// jat-signal canonical envelope
	if (signal.type === 'state' && typeof signal.state === 'string') return signal.state;
	if (signal.type === 'complete') return 'completed';
	// IDE-initiated signal shape: { type: 'starting' | 'planning' | ... }
	if (typeof signal.type === 'string') return signal.type;
	return 'unknown';
}

/**
 * Handle jat-signal file change (written to /tmp)
 */
async function handleSignalChange(filename: string): Promise<void> {
	if (!isInitialized()) return;
	if (!filename.startsWith(SIGNAL_PREFIX) || !filename.endsWith('.json')) return;

	const sessionName = filename.replace(SIGNAL_PREFIX, '').replace(/\.json$/, '');
	if (!sessionName) return;

	const agentName = sessionName.startsWith('jat-') ? sessionName.replace(/^jat-/, '') : sessionName;
	const filepath = join(SIGNAL_DIR, filename);
	const signal = await readSignalFile(filepath);
	if (!signal) return;

	const state = inferAgentStateFromSignal(signal);
	console.log(`[WS Watcher] Signal change: ${agentName} (${state})`);

	broadcastAgentState(agentName, state, {
		sessionName,
		tmux_session: signal.tmux_session ?? null,
		session_id: signal.session_id ?? signal.sessionId ?? null,
		task_id: signal.task_id ?? signal.taskId ?? signal.data?.taskId ?? null
	});
}

/**
 * Start watching /tmp for jat-signal-tmux-*.json updates
 */
function startSessionsWatcher(): void {
	if (sessionsWatcher) {
		console.log('[WS Watcher] Signal watcher already running');
		return;
	}

	console.log(`[WS Watcher] Starting signal watcher: ${SIGNAL_DIR}`);

	try {
		sessionsWatcher = watch(SIGNAL_DIR, { persistent: false }, (_eventType, filename) => {
			if (!filename) return;
			if (!filename.startsWith(SIGNAL_PREFIX) || !filename.endsWith('.json')) return;

			// Debounce per-file
			const key = `signal-${filename}`;
			const existingTimer = debounceTimers.get(key);
			if (existingTimer) clearTimeout(existingTimer);

			debounceTimers.set(key, setTimeout(() => {
				handleSignalChange(filename).catch(() => {});
				debounceTimers.delete(key);
			}, 75));
		});

		sessionsWatcher.on('error', (err) => {
			console.error('[WS Watcher] Signal watcher error:', err);
		});

		console.log('[WS Watcher] Signal watcher started');
	} catch (err) {
		console.error('[WS Watcher] Failed to start signal watcher:', err);
	}
}

// ============================================================================
// Output Polling (for WebSocket streaming)
// ============================================================================

/**
 * Simple hash function for change detection
 * We only need to detect if output changed, not cryptographic security
 */
function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash.toString(36);
}

/**
 * Get list of active jat-* tmux sessions
 */
async function getTmuxSessions(): Promise<string[]> {
	try {
		const { stdout } = await execAsync(
			'tmux list-sessions -F "#{session_name}" 2>/dev/null || echo ""',
			{ timeout: EXEC_TIMEOUT_MS }
		);
		return stdout
			.trim()
			.split('\n')
			.filter(name => name.startsWith('jat-') && !name.startsWith('jat-pending-'));
	} catch {
		return [];
	}
}

/**
 * Capture output from a single tmux session
 */
async function captureSessionOutput(sessionName: string): Promise<{ output: string; lineCount: number } | null> {
	try {
		const { stdout } = await execAsync(
			`tmux capture-pane -p -e -t "${sessionName}" -S -${OUTPUT_LINES}`,
			{ maxBuffer: 1024 * 1024, timeout: EXEC_TIMEOUT_MS }
		);
		return {
			output: stdout,
			lineCount: stdout.split('\n').length
		};
	} catch {
		return null;
	}
}

/**
 * Poll all tmux sessions and broadcast output changes
 */
async function pollOutputs(): Promise<void> {
	// Guard against overlapping polls (prevents child process accumulation)
	if (isPolling) {
		return;
	}

	if (!isInitialized()) return;

	// Only poll if there are subscribers to the output channel
	const subscriberCount = getChannelSubscriberCount('output');
	if (subscriberCount === 0) {
		return;
	}

	isPolling = true;

	try {
		const sessions = await getTmuxSessions();

		// Process sessions in parallel with a concurrency limit
		const batchSize = 4;
		for (let i = 0; i < sessions.length; i += batchSize) {
			const batch = sessions.slice(i, i + batchSize);
			await Promise.all(batch.map(async (sessionName) => {
				const result = await captureSessionOutput(sessionName);
				if (!result) return;

				// Check if output changed using hash
				const hash = simpleHash(result.output);
				const previousHash = previousOutputHashes.get(sessionName);

				if (hash !== previousHash) {
					previousOutputHashes.set(sessionName, hash);

					// Broadcast the change
					broadcastOutput(sessionName, result.output, result.lineCount);
				}
			}));
		}

		// Clean up hashes for sessions that no longer exist
		for (const sessionName of previousOutputHashes.keys()) {
			if (!sessions.includes(sessionName)) {
				previousOutputHashes.delete(sessionName);
			}
		}
	} finally {
		isPolling = false;
	}
}

/**
 * Start output polling
 */
function startOutputPolling(): void {
	if (outputPollingInterval) {
		console.log('[WS Watcher] Output polling already running');
		return;
	}

	console.log(`[WS Watcher] Starting output polling (${OUTPUT_POLL_INTERVAL}ms interval)`);

	// Initial poll
	pollOutputs();

	// Set up interval
	outputPollingInterval = setInterval(() => {
		pollOutputs();
	}, OUTPUT_POLL_INTERVAL);

	console.log('[WS Watcher] Output polling started');
}

/**
 * Stop output polling
 */
function stopOutputPolling(): void {
	if (outputPollingInterval) {
		clearInterval(outputPollingInterval);
		outputPollingInterval = null;
		previousOutputHashes.clear();
		isPolling = false;
		console.log('[WS Watcher] Output polling stopped');
	}
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Start all file watchers
 * Call this after WebSocket server is initialized
 */
export function startWatchers(): void {
	if (isWatching) {
		console.log('[WS Watcher] Watchers already running');
		return;
	}

	console.log('[WS Watcher] Starting all watchers...');
	startBeadsWatcher();
	startSessionsWatcher();
	startOutputPolling();
	isWatching = true;
}

/**
 * Stop all file watchers
 * Call this on server shutdown
 */
export function stopWatchers(): void {
	console.log('[WS Watcher] Stopping all watchers...');

	// Clear all debounce timers
	debounceTimers.forEach(timer => clearTimeout(timer));
	debounceTimers.clear();

	// Stop output polling
	stopOutputPolling();

	// Close watchers
	if (beadsWatcher) {
		beadsWatcher.close();
		beadsWatcher = null;
	}

	if (sessionsWatcher) {
		sessionsWatcher.close();
		sessionsWatcher = null;
	}

	isWatching = false;
	console.log('[WS Watcher] All watchers stopped');
}

/**
 * Check if watchers are running
 */
export function isWatchersRunning(): boolean {
	return isWatching;
}
