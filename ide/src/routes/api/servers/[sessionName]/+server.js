/**
 * Servers API - Server Session Operations
 * DELETE /api/servers/{sessionName} - Stop and kill a server session
 *
 * Operations:
 * - DELETE: Stop the server and kill the tmux session
 */

import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * @param {string} sessionName
 * @returns {boolean}
 */
function isValidServerSessionName(sessionName) {
	return /^server-[A-Za-z0-9_-]+$/.test(sessionName);
}

/**
 * @param {string} sessionName
 * @returns {Promise<boolean>}
 */
async function hasTmuxSession(sessionName) {
	try {
		await execFileAsync('tmux', ['has-session', '-t', sessionName]);
		return true;
	} catch {
		return false;
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params }) {
	const { sessionName } = params;

	if (!sessionName) {
		return json(
			{ error: 'Missing session name' },
			{ status: 400 }
		);
	}

	if (!isValidServerSessionName(sessionName)) {
		return json(
			{
				error: 'Invalid session name',
				message: 'Server sessions must have names like "server-projectName" (letters, numbers, _, -).'
			},
			{ status: 400 }
		);
	}

	try {
		const exists = await hasTmuxSession(sessionName);
		if (!exists) {
			return json(
				{
					error: 'Session not found',
					message: `Server session "${sessionName}" does not exist`
				},
				{ status: 404 }
			);
		}

		try {
			await execFileAsync('tmux', ['send-keys', '-t', sessionName, 'C-c']);
			await new Promise((resolve) => setTimeout(resolve, 500));
		} catch {
			// Ignore graceful-stop failures and continue with hard kill.
		}

		await execFileAsync('tmux', ['kill-session', '-t', sessionName]);

		return json({
			success: true,
			message: `Stopped and killed server session: ${sessionName}`,
			sessionName,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error in DELETE /api/servers/[sessionName]:', error);
		return json(
			{
				error: 'Failed to stop server session',
				message: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
}
