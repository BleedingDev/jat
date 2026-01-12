/**
 * Session Output API - Get terminal output for a session
 * GET /api/work/[sessionId]/output - Capture current terminal output
 *
 * Path params:
 * - sessionId: tmux session name (e.g., "jat-WisePrairie")
 *
 * Query params:
 * - lines: Number of lines to capture (default: 200)
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** @type {import('./$types').RequestHandler} */
export async function GET({ params, url }) {
	try {
		const { sessionId } = params;
		const lines = parseInt(url.searchParams.get('lines') || '200', 10);

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

		return json({
			success: true,
			sessionId,
			output,
			lineCount,
			lines,
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
