/**
 * Agent Broadcast API
 * POST /api/agents/broadcast - Send message to all agents
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getAgents } from '$lib/server/agent-mail.js';

const execAsync = promisify(exec);

/**
 * POST /api/agents/broadcast
 * Send a message to all active agents via Agent Mail
 * Body:
 * - from: Sender agent name (required)
 * - subject: Message subject (required)
 * - body: Message body (required)
 * - importance: Message importance (normal, urgent) (default: normal)
 * - filter: Optional array of agent names to target (default: @active)
 * - thread: Optional thread ID
 */
/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const requestBody = await request.json();
		const {
			from,
			subject,
			body,
			importance = 'normal',
			filter,
			thread
		} = requestBody;

		// Validate required fields
		if (!from) {
			return json({
				error: 'Missing required field: from',
				message: 'Sender agent name is required'
			}, { status: 400 });
		}

		if (!subject) {
			return json({
				error: 'Missing required field: subject',
				message: 'Message subject is required'
			}, { status: 400 });
		}

		if (!body) {
			return json({
				error: 'Missing required field: body',
				message: 'Message body is required'
			}, { status: 400 });
		}

		// Determine recipients
		let recipients;
		if (filter && Array.isArray(filter) && filter.length > 0) {
			recipients = filter.join(',');
		} else {
			// Default to @active (agents active in last 60 min)
			recipients = '@active';
		}

		// Build am-send command
		const escapedSubject = subject.replace(/"/g, '\\"').replace(/`/g, '\\`');
		const escapedBody = body.replace(/"/g, '\\"').replace(/`/g, '\\`');

		let command = `am-send "${escapedSubject}" "${escapedBody}" --from "${from}" --to "${recipients}"`;

		if (importance === 'urgent') {
			command += ' --importance urgent';
		}

		if (thread) {
			command += ` --thread "${thread}"`;
		}

		try {
			const { stdout, stderr } = await execAsync(command);

			// Parse the output to get message details
			const messageIdMatch = stdout.match(/Message sent \(ID: (\d+)\)/);
			const expandedMatch = stdout.match(/Expanded @\w+ → (\d+) agent\(s\)/);

			return json({
				success: true,
				messageId: messageIdMatch ? parseInt(messageIdMatch[1], 10) : null,
				from,
				to: recipients,
				subject,
				body,
				importance,
				thread: thread || null,
				recipientCount: expandedMatch ? parseInt(expandedMatch[1], 10) : null,
				output: stdout.trim(),
				timestamp: new Date().toISOString()
			});
		} catch (execError) {
			const execErr = /** @type {{ stderr?: string, message?: string }} */ (execError);
			const errorMessage = execErr.stderr || execErr.message || String(execError);

			return json({
				error: 'Failed to send broadcast',
				message: errorMessage,
				command
			}, { status: 500 });
		}
	} catch (error) {
		console.error('Error in POST /api/agents/broadcast:', error);
		return json({
			error: 'Internal server error',
			message: error instanceof Error ? error.message : String(error)
		}, { status: 500 });
	}
}

/**
 * GET /api/agents/broadcast
 * Get list of available recipients for broadcasting
 */
/** @type {import('./$types').RequestHandler} */
export async function GET() {
	try {
		// Get all registered agents
		const agents = getAgents();

		// Get active agents (would need session check, simplified here)
		const allAgentNames = agents.map(a => a.name);

		return json({
			success: true,
			agents: allAgentNames,
			count: allAgentNames.length,
			groups: {
				'@active': 'Agents active in last 60 minutes',
				'@all': 'All registered agents'
			},
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error in GET /api/agents/broadcast:', error);
		return json({
			error: 'Internal server error',
			message: error instanceof Error ? error.message : String(error)
		}, { status: 500 });
	}
}
