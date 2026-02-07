/**
 * Agent Inbox API - View Agent Messages
 * GET /api/agents/[name]/inbox
 *
 * Retrieves agent's unread messages using am-inbox
 */

import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	try {
		const agentName = params.name;

		if (!agentName) {
			return json({
				error: 'Missing agent name',
				message: 'Agent name is required'
			}, { status: 400 });
		}

		// Use am-inbox command with --json flag for structured output.
		// No shell interpolation: agentName is passed as a direct argument.
		const commandPath = `${process.env.HOME}/.local/bin/am-inbox`;
		const commandArgs = [agentName, '--json'];

		try {
			const { stdout } = await execFileAsync(commandPath, commandArgs);

			// Parse JSON output from am-inbox
			let messages = [];
			try {
				messages = JSON.parse(stdout.trim());
			} catch (parseError) {
				console.error('Failed to parse am-inbox output:', parseError);
			}

			return json({
				success: true,
				agentName,
				messages,
				count: messages.length,
				timestamp: new Date().toISOString()
			});
		} catch (execError) {
			console.error('am-inbox error:', execError);

			// Parse error message
			const execErr = /** @type {{ stderr?: string, message?: string }} */ (execError);
			const errorMessage = execErr.stderr || execErr.message || String(execError);

			// If agent not found or no inbox, return empty array
			if (execErr.stderr?.includes('not found') || execErr.stderr?.includes('No messages')) {
				return json({
					success: true,
					agentName,
					messages: [],
					count: 0,
					timestamp: new Date().toISOString()
				});
			}

			return json({
				error: 'Failed to fetch inbox',
				message: errorMessage,
				agentName
			}, { status: 500 });
		}
	} catch (error) {
		console.error('Error in GET /api/agents/[name]/inbox:', error);
		return json({
			error: 'Internal server error',
			message: error instanceof Error ? error.message : String(error)
		}, { status: 500 });
	}
}
