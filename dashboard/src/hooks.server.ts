/**
 * SvelteKit Server Hooks
 *
 * This file runs on server startup and handles background tasks.
 *
 * Features:
 * - Cleans up stale JAT signal files from /tmp on startup
 * - Cleans up orphaned .claude/sessions/agent-*.txt files (where Claude session no longer exists)
 * - Runs token usage aggregation on startup
 * - Schedules periodic aggregation every 5 minutes
 */

import { runAggregation } from '$lib/server/tokenUsageDb';
import { readdirSync, unlinkSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Track aggregation interval
let aggregationInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Clean up stale JAT signal/activity files from /tmp
 *
 * These files are ephemeral state indicators for agent sessions.
 * When the dashboard restarts, old session states are stale and useless.
 * Cleaning on startup prevents accumulation over time.
 *
 * File patterns cleaned:
 * - jat-signal-*.json - Signal files by session UUID
 * - jat-signal-tmux-*.json - Signal files by tmux session name
 * - jat-activity-*.json - Activity files
 * - jat-timeline-*.jsonl - Timeline logs
 * - jat-question-*.json - Question files
 * - jat-monitor-*.pid - Monitor PID files
 * - claude-*-cwd - Claude Code working directory markers (hex IDs)
 */
function cleanupStaleSignalFiles(): { cleaned: number; errors: number } {
	const tmpDir = '/tmp';
	const patterns = [
		/^jat-signal-.*\.json$/,
		/^jat-activity-.*\.json$/,
		/^jat-timeline-.*\.jsonl$/,
		/^jat-question-.*\.json$/,
		/^jat-monitor-.*\.pid$/,
		/^claude-[0-9a-f]+-cwd$/ // Claude Code working directory markers
	];

	let cleaned = 0;
	let errors = 0;

	try {
		const files = readdirSync(tmpDir);

		for (const file of files) {
			// Check if file matches any of our patterns
			const matches = patterns.some((pattern) => pattern.test(file));
			if (!matches) continue;

			try {
				const filePath = join(tmpDir, file);
				// Only delete files, not directories
				const stat = statSync(filePath);
				if (stat.isFile()) {
					unlinkSync(filePath);
					cleaned++;
				}
			} catch {
				// File may have been deleted between readdir and unlink, ignore
				errors++;
			}
		}
	} catch (err) {
		console.error('[Signal Cleanup] Failed to read /tmp directory:', err);
	}

	return { cleaned, errors };
}

/**
 * Clean up orphaned .claude/sessions/agent-*.txt files
 *
 * These files map Claude session IDs to agent names for dashboard tracking.
 * Over time, sessions accumulate but the corresponding Claude project sessions
 * get deleted or expire. This function identifies orphaned files by checking
 * if the session ID still exists in ~/.claude/projects/.
 *
 * IMPORTANT: Only deletes files where the corresponding Claude session no longer
 * exists, preserving the ability to resume any valid session.
 *
 * Session file format: .claude/sessions/agent-{sessionId}.txt
 * Claude session format: ~/.claude/projects/{project-slug}/{sessionId}.jsonl
 *
 * The project-slug is derived from the project path by replacing / with -
 * Example: /home/jw/code/jat -> -home-jw-code-jat
 */
function cleanupOrphanedSessionFiles(): { cleaned: number; errors: number; scanned: number } {
	const home = homedir();
	const codeDir = join(home, 'code');
	const claudeProjectsDir = join(home, '.claude', 'projects');

	let cleaned = 0;
	let errors = 0;
	let scanned = 0;

	// Scan all projects in ~/code/ that have .claude/sessions/ directories
	try {
		if (!existsSync(codeDir)) {
			return { cleaned: 0, errors: 0, scanned: 0 };
		}

		const projects = readdirSync(codeDir);

		for (const projectName of projects) {
			const projectPath = join(codeDir, projectName);
			const sessionsDir = join(projectPath, '.claude', 'sessions');

			// Skip if no sessions directory
			if (!existsSync(sessionsDir)) continue;

			// Determine the Claude project slug for this project
			// Path /home/jw/code/jat -> slug -home-jw-code-jat
			const projectSlug = projectPath.replace(/\//g, '-');
			const claudeProjectDir = join(claudeProjectsDir, projectSlug);

			try {
				const sessionFiles = readdirSync(sessionsDir);

				for (const file of sessionFiles) {
					// Only process agent-*.txt files
					if (!file.startsWith('agent-') || !file.endsWith('.txt')) continue;
					// Skip activity files (agent-*-activity.jsonl)
					if (file.includes('-activity.')) continue;

					scanned++;

					// Extract session ID from filename: agent-{sessionId}.txt
					const sessionId = file.replace(/^agent-/, '').replace(/\.txt$/, '');

					// Check if corresponding Claude session exists
					// Claude stores sessions as {sessionId}.jsonl or {sessionId}/ directory
					const sessionJsonl = join(claudeProjectDir, `${sessionId}.jsonl`);
					const sessionDir = join(claudeProjectDir, sessionId);

					const sessionExists = existsSync(sessionJsonl) || existsSync(sessionDir);

					if (!sessionExists) {
						// Session no longer exists in Claude - safe to delete
						const filePath = join(sessionsDir, file);
						try {
							const stat = statSync(filePath);
							if (stat.isFile()) {
								unlinkSync(filePath);
								cleaned++;
							}
						} catch {
							errors++;
						}
					}
				}
			} catch {
				// Skip projects we can't read
				errors++;
			}
		}
	} catch (err) {
		console.error('[Session Cleanup] Failed to scan code directory:', err);
	}

	return { cleaned, errors, scanned };
}

// Run startup tasks (cleanup + aggregation)
async function initializeStartupTasks() {
	// Run signal file cleanup immediately (non-blocking, fast)
	console.log('[Signal Cleanup] Cleaning stale temp files from /tmp...');
	const cleanupResult = cleanupStaleSignalFiles();
	if (cleanupResult.cleaned > 0) {
		console.log(
			`[Signal Cleanup] Removed ${cleanupResult.cleaned} stale files${cleanupResult.errors > 0 ? ` (${cleanupResult.errors} errors)` : ''}`
		);
	} else {
		console.log('[Signal Cleanup] No stale files to clean');
	}

	// Clean up orphaned session files (files where Claude session no longer exists)
	console.log('[Session Cleanup] Checking for orphaned session files...');
	const sessionCleanupResult = cleanupOrphanedSessionFiles();
	if (sessionCleanupResult.cleaned > 0) {
		console.log(
			`[Session Cleanup] Removed ${sessionCleanupResult.cleaned} orphaned files (scanned ${sessionCleanupResult.scanned})${sessionCleanupResult.errors > 0 ? ` (${sessionCleanupResult.errors} errors)` : ''}`
		);
	} else if (sessionCleanupResult.scanned > 0) {
		console.log(`[Session Cleanup] All ${sessionCleanupResult.scanned} session files are valid`);
	}

	// Defer aggregation by 2 seconds to let server start serving requests first
	setTimeout(async () => {
		console.log('[Token Aggregation] Running initial aggregation...');
		try {
			const result = await runAggregation();
			console.log(
				`[Token Aggregation] Initial aggregation complete: ${result.filesProcessed} files, ${result.entriesProcessed} entries in ${result.durationMs}ms`
			);
		} catch (error) {
			console.error('[Token Aggregation] Initial aggregation failed:', error);
		}

		// Schedule periodic aggregation every 5 minutes
		if (!aggregationInterval) {
			const FIVE_MINUTES = 5 * 60 * 1000;
			aggregationInterval = setInterval(async () => {
				try {
					const result = await runAggregation();
					if (result.entriesProcessed > 0) {
						console.log(
							`[Token Aggregation] Periodic update: ${result.filesProcessed} files, ${result.entriesProcessed} entries in ${result.durationMs}ms`
						);
					}
				} catch (error) {
					console.error('[Token Aggregation] Periodic aggregation failed:', error);
				}
			}, FIVE_MINUTES);

			console.log('[Token Aggregation] Scheduled periodic aggregation every 5 minutes');
		}
	}, 2000);
}

// Initialize startup tasks when the server starts
initializeStartupTasks();

// Export empty handle function (required by SvelteKit)
export const handle = async ({ event, resolve }) => {
	return resolve(event);
};
