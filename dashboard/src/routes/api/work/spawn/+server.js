/**
 * Work Spawn API - Auto-spawn agent + session for a task
 * POST /api/work/spawn
 *
 * Creates a NEW agent + tmux session to work on a specific task:
 * 1. Generate agent name via am-register
 * 2. Create tmux session jat-{AgentName}
 * 3. Assign task to agent in Beads (bd update)
 * 4. Run Claude Code with /jat:start auto to pick up task
 * 5. Return new WorkSession
 *
 * Body:
 * - taskId: Task ID to assign to the new agent (required)
 * - model: Model to use (default from spawnConfig)
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
	DEFAULT_MODEL,
	DANGEROUSLY_SKIP_PERMISSIONS,
	AGENT_MAIL_URL
} from '$lib/config/spawnConfig.js';

const execAsync = promisify(exec);

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const body = await request.json();
		const { taskId, model = DEFAULT_MODEL } = body;

		if (!taskId) {
			return json({
				error: 'Missing required field',
				message: 'taskId is required'
			}, { status: 400 });
		}

		const projectPath = process.cwd().replace('/dashboard', '');

		// Step 1: Generate new agent name via am-register
		let agentName;
		try {
			const registerResult = await execAsync(`am-register --json`, {
				cwd: projectPath,
				timeout: 10000
			});
			// am-register --json returns an array with the registered agent
			const registerData = JSON.parse(registerResult.stdout.trim());
			const agentRecord = Array.isArray(registerData) ? registerData[0] : registerData;
			agentName = agentRecord?.name;

			if (!agentName) {
				throw new Error('am-register did not return agent name');
			}
		} catch (err) {
			console.error('Failed to register agent:', err);
			return json({
				error: 'Failed to register agent',
				message: err instanceof Error ? err.message : String(err)
			}, { status: 500 });
		}

		// Step 2: Assign task to new agent in Beads
		try {
			await execAsync(`bd update "${taskId}" --status in_progress --assignee "${agentName}"`, {
				cwd: projectPath,
				timeout: 10000
			});
		} catch (err) {
			console.error('Failed to assign task:', err);
			return json({
				error: 'Failed to assign task',
				message: err instanceof Error ? err.message : String(err),
				agentName,
				taskId
			}, { status: 500 });
		}

		// Step 3: Create tmux session with Claude Code
		const sessionName = `jat-${agentName}`;

		// Build the claude command
		let claudeCmd = `cd "${projectPath}"`;
		claudeCmd += ` && AGENT_MAIL_URL="${AGENT_MAIL_URL}"`;
		claudeCmd += ` claude --model ${model}`;

		if (DANGEROUSLY_SKIP_PERMISSIONS) {
			claudeCmd += ' --dangerously-skip-permissions';
		}

		const createSessionCmd = `tmux new-session -d -s "${sessionName}" -c "${projectPath}" && tmux send-keys -t "${sessionName}" "${claudeCmd}" Enter`;

		try {
			await execAsync(createSessionCmd);
		} catch (err) {
			const execErr = /** @type {{ stderr?: string, message?: string }} */ (err);
			const errorMessage = execErr.stderr || (err instanceof Error ? err.message : String(err));

			// If session already exists, that's a conflict
			if (errorMessage.includes('duplicate session')) {
				return json({
					error: 'Session already exists',
					message: `Session '${sessionName}' already exists`,
					sessionName,
					agentName
				}, { status: 409 });
			}

			return json({
				error: 'Failed to create session',
				message: errorMessage,
				sessionName,
				agentName
			}, { status: 500 });
		}

		// Step 4: Wait for Claude to initialize, then send /jat:start {agentName}
		// Pass the agent name explicitly so /jat:start resumes the existing agent
		// instead of creating a new one with a different name
		const initialPrompt = `/jat:start ${agentName}`;

		await new Promise(resolve => setTimeout(resolve, 5000));

		try {
			const escapedPrompt = initialPrompt.replace(/"/g, '\\"');
			await execAsync(`tmux send-keys -t "${sessionName}" "${escapedPrompt}"`);
			await new Promise(resolve => setTimeout(resolve, 100));
			await execAsync(`tmux send-keys -t "${sessionName}" Enter`);
		} catch (err) {
			// Non-fatal - session is created, prompt just failed
			console.error('Failed to send initial prompt:', err);
		}

		// Step 5: Return WorkSession
		return json({
			success: true,
			session: {
				sessionName,
				agentName,
				task: {
					id: taskId
				},
				output: '',
				lineCount: 0,
				tokens: 0,
				cost: 0,
				created: new Date().toISOString(),
				attached: false
			},
			message: `Spawned agent ${agentName} for task ${taskId}`,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error in POST /api/work/spawn:', error);
		return json({
			error: 'Internal server error',
			message: error instanceof Error ? error.message : String(error)
		}, { status: 500 });
	}
}
