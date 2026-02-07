/**
 * Agent Message API - Send Message to Agent
 * POST /api/agents/[name]/message
 *
 * Sends a message to agent using am-send
 */

import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** @type {import('./$types').RequestHandler} */
export async function POST({ params, request }) {
	try {
		const agentName = params.name;
		const { subject, body } = await request.json();

		if (!agentName || !subject || !body) {
			return json({
				error: 'Missing required fields',
				message: 'Agent name, subject, and body are required'
			}, { status: 400 });
		}

		// Use am-send command without shell interpolation.
		// From: IDE, To: agentName
		const commandPath = `${process.env.HOME}/.local/bin/am-send`;
		const commandArgs = [subject, body, '--from', 'IDE', '--to', agentName];

		try {
			const { stdout } = await execFileAsync(commandPath, commandArgs);

			return json({
				success: true,
				agentName,
				subject,
				message: 'Message sent successfully',
				output: stdout,
				timestamp: new Date().toISOString()
			});
		} catch (execError) {
			console.error('am-send error:', execError);

			// Parse error message
			const execErr = /** @type {{ stderr?: string, message?: string }} */ (execError);
			const errorMessage = execErr.stderr || execErr.message || String(execError);

			return json({
				error: 'Failed to send message',
				message: errorMessage,
				agentName
			}, { status: 500 });
		}
	} catch (error) {
		console.error('Error in POST /api/agents/[name]/message:', error);
		return json({
			error: 'Internal server error',
			message: error instanceof Error ? error.message : String(error)
		}, { status: 500 });
	}
}
