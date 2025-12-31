/**
 * Work Session Input API - Send Input to Session
 * POST /api/work/[sessionId]/input
 *
 * Sends input to a work session's tmux pane. Supports:
 * - text: Regular text input (sent with Enter)
 * - enter: Just Enter key (accept highlighted option)
 * - down: Down arrow key
 * - up: Up arrow key
 * - left: Left arrow key
 * - right: Right arrow key
 * - escape: Escape key
 * - ctrl-c: Sends Ctrl+C interrupt signal
 * - ctrl-d: Sends Ctrl+D (EOF)
 * - ctrl-u: Sends Ctrl+U (clear line from cursor to beginning)
 * - ctrl-l: Sends Ctrl+L (clear screen)
 * - tab: Sends Tab key (for autocomplete)
 * - raw: Send exact keys without Enter
 *
 * Body:
 * - type: Input type (default: 'text')
 * - input: Text to send (for text/raw types)
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** @type {import('./$types').RequestHandler} */
export async function POST({ params, request }) {
	try {
		const sessionId = params.sessionId;

		if (!sessionId) {
			return json({
				error: 'Missing session ID',
				message: 'Session ID is required'
			}, { status: 400 });
		}

		const body = await request.json();
		const { type = 'text', input = '' } = body;

		let command;

		switch (type) {
			case 'enter':
				// Send just Enter (accept highlighted option in Claude Code prompts)
				command = `tmux send-keys -t "${sessionId}" Enter`;
				break;

			case 'down':
				// Send Down arrow
				command = `tmux send-keys -t "${sessionId}" Down`;
				break;

			case 'up':
				// Send Up arrow
				command = `tmux send-keys -t "${sessionId}" Up`;
				break;

			case 'escape':
				// Send Escape key
				command = `tmux send-keys -t "${sessionId}" Escape`;
				break;

			case 'ctrl-c':
				// Send Ctrl+C (interrupt signal)
				command = `tmux send-keys -t "${sessionId}" C-c`;
				break;

			case 'ctrl-d':
				// Send Ctrl+D (EOF)
				command = `tmux send-keys -t "${sessionId}" C-d`;
				break;

			case 'ctrl-u':
				// Send Ctrl+U (clear line from cursor to beginning - for live streaming)
				command = `tmux send-keys -t "${sessionId}" C-u`;
				break;

			case 'tab':
				// Send Tab key (for autocomplete in terminal)
				command = `tmux send-keys -t "${sessionId}" Tab`;
				break;

			case 'left':
				// Send Left arrow
				command = `tmux send-keys -t "${sessionId}" Left`;
				break;

			case 'right':
				// Send Right arrow
				command = `tmux send-keys -t "${sessionId}" Right`;
				break;

			case 'ctrl-l':
				// Send Ctrl+L (clear screen)
				command = `tmux send-keys -t "${sessionId}" C-l`;
				break;

			case 'delete':
				// Send Delete key (delete character forward)
				command = `tmux send-keys -t "${sessionId}" DC`;
				break;

			case 'backspace':
				// Send Backspace key (delete character backward)
				command = `tmux send-keys -t "${sessionId}" BSpace`;
				break;

			case 'space':
				// Send Space key (for toggling options in multi-select prompts)
				command = `tmux send-keys -t "${sessionId}" Space`;
				break;

			case 'raw':
				// Send raw keys without Enter
				// Escape special characters for shell
				const escapedRaw = input.replace(/"/g, '\\"').replace(/\$/g, '\\$');
				command = `tmux send-keys -t "${sessionId}" -- "${escapedRaw}"`;
				break;

			case 'text':
			default:
				// Send text followed by Enter
				// Escape special characters for shell
				const escapedText = input.replace(/"/g, '\\"').replace(/\$/g, '\\$');
				command = `tmux send-keys -t "${sessionId}" -- "${escapedText}" Enter`;
				break;
		}

		try {
			await execAsync(command);

			return json({
				success: true,
				sessionId,
				type,
				input: ['ctrl-c', 'ctrl-d', 'ctrl-u', 'ctrl-l', 'tab', 'enter', 'down', 'up', 'left', 'right', 'escape', 'delete', 'backspace', 'space'].includes(type) ? type : input,
				message: `Input sent to session ${sessionId}`,
				timestamp: new Date().toISOString()
			});
		} catch (execError) {
			const execErr = /** @type {{ stderr?: string, message?: string }} */ (execError);
			const errorMessage = execErr.stderr || execErr.message || String(execError);

			// Check if session not found
			if (errorMessage.includes("can't find session") || errorMessage.includes('no server running')) {
				return json({
					error: 'Session not found',
					message: `Session '${sessionId}' does not exist`,
					sessionId
				}, { status: 404 });
			}

			return json({
				error: 'Failed to send input',
				message: errorMessage,
				sessionId
			}, { status: 500 });
		}
	} catch (error) {
		console.error('Error in POST /api/work/[sessionId]/input:', error);
		return json({
			error: 'Internal server error',
			message: error instanceof Error ? error.message : String(error)
		}, { status: 500 });
	}
}
