/**
 * Session Output API - Get terminal output for a session
 * GET /api/work/[sessionId]/output - Capture current terminal output
 *
 * Path params:
 * - sessionId: tmux session name (e.g., "jat-WisePrairie")
 *
 * Query params:
 * - lines: Number of lines to capture (default: 200)
 * - includePreCompact: Include pre-compaction scrollback if available (default: true)
 *
 * When compaction clears the terminal, this endpoint will also check for
 * saved pre-compaction scrollback and include it in the response, allowing
 * the minimap to show the complete session history.
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Find the most recent pre-compaction scrollback file for a session
 * @param {string} sessionId - tmux session name (e.g., "jat-WisePrairie")
 * @returns {Promise<{content: string, filename: string, capturedAt: string} | null>}
 */
async function findPreCompactScrollback(sessionId) {
	const projectPath = process.cwd().replace('/ide', '');
	const logsDir = path.join(projectPath, '.beads', 'logs');

	if (!existsSync(logsDir)) {
		return null;
	}

	try {
		const files = await readdir(logsDir);
		// Find files matching scrollback-pre-compact-{sessionId}-*.log
		const prefix = `scrollback-pre-compact-${sessionId}-`;
		const matchingFiles = files
			.filter(f => f.startsWith(prefix) && f.endsWith('.log'))
			.sort()
			.reverse(); // Most recent first (filenames include timestamp)

		if (matchingFiles.length === 0) {
			return null;
		}

		// Get the most recent one
		const filename = matchingFiles[0];
		const filepath = path.join(logsDir, filename);
		const content = await readFile(filepath, 'utf-8');
		const fileStat = await stat(filepath);

		return {
			content,
			filename,
			capturedAt: fileStat.mtime.toISOString()
		};
	} catch (err) {
		console.error('Error finding pre-compact scrollback:', err);
		return null;
	}
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, url }) {
	try {
		const { sessionId } = params;
		const lines = parseInt(url.searchParams.get('lines') || '200', 10);
		const includePreCompact = url.searchParams.get('includePreCompact') !== 'false';

		if (!sessionId) {
			return json({
				error: 'Missing session ID',
				message: 'Session ID is required in path'
			}, { status: 400 });
		}

		// Check if session exists
		try {
			await execAsync(`tmux has-session -t "${sessionId}" 2>/dev/null`);
		} catch {
			return json({
				error: 'Session not found',
				message: `Session '${sessionId}' does not exist`,
				sessionId
			}, { status: 404 });
		}

		// Capture output
		let output = '';
		let lineCount = 0;
		try {
			// -p: print to stdout
			// -e: include escape sequences (ANSI colors)
			// -S -N: capture last N lines of scrollback
			const captureCommand = `tmux capture-pane -p -e -t "${sessionId}" -S -${lines}`;
			const { stdout } = await execAsync(captureCommand, { maxBuffer: 5 * 1024 * 1024 });
			output = stdout;
			lineCount = stdout.split('\n').length;
		} catch (err) {
			console.error('Failed to capture session output:', err);
			// Return empty output instead of error
		}

		// Check for pre-compaction scrollback if enabled
		// This preserves terminal history that would otherwise be lost after compaction
		let preCompactScrollback = null;
		if (includePreCompact) {
			preCompactScrollback = await findPreCompactScrollback(sessionId);
		}

		// If current output is minimal (likely just cleared) and we have pre-compact history,
		// prepend it to give the user context of what happened before compaction
		let combinedOutput = output;
		let hasPreCompactHistory = false;

		if (preCompactScrollback && lineCount < 50) {
			// Terminal was likely cleared by compaction - prepend the saved history
			// Add a visual separator so users know where compaction happened
			const separator = '\n\n' + '─'.repeat(80) + '\n' +
				'📦 CONTEXT COMPACTED - History above was saved before compaction\n' +
				'─'.repeat(80) + '\n\n';

			combinedOutput = preCompactScrollback.content + separator + output;
			hasPreCompactHistory = true;
		}

		return json({
			success: true,
			sessionId,
			output: combinedOutput,
			lineCount: combinedOutput.split('\n').length,
			lines,
			hasPreCompactHistory,
			preCompactInfo: preCompactScrollback ? {
				filename: preCompactScrollback.filename,
				capturedAt: preCompactScrollback.capturedAt
			} : null,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error in GET /api/work/[sessionId]/output:', error);
		return json({
			error: 'Internal server error',
			message: error instanceof Error ? error.message : String(error)
		}, { status: 500 });
	}
}
