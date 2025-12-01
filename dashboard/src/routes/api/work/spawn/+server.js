/**
 * Work Spawn API - Auto-spawn agent + session
 * POST /api/work/spawn
 *
 * Creates a NEW agent + tmux session:
 * 1. Generate agent name via am-register
 * 2. Create tmux session jat-{AgentName}
 * 3. If taskId provided: Assign task to agent in Beads (bd update)
 * 4. Run Claude Code with /jat:start (with agent name, optionally with task)
 * 5. Return new WorkSession
 *
 * Body:
 * - taskId: Task ID to assign (optional - if omitted, creates planning session)
 * - model: Model to use (default from spawnConfig)
 * - attach: If true, immediately open terminal attached to session (default: false)
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
		const { taskId, model = DEFAULT_MODEL, attach = false, imagePath = null, project = null } = body;

		// taskId is now optional - if not provided, creates a planning session
		// imagePath is optional - if provided, will be sent to the session after startup
		// project is optional - if provided, use that path; otherwise default to cwd

		const projectPath = project || process.cwd().replace('/dashboard', '');

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

		// Step 2: Assign task to new agent in Beads (if taskId provided)
		if (taskId) {
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

		// Step 4: Wait for Claude to initialize, then send /jat:start {agentName} [taskId]
		// Pass the agent name explicitly so /jat:start resumes the existing agent
		// instead of creating a new one with a different name
		// If taskId provided, include BOTH agent name and task ID so the agent:
		// 1. Uses the pre-created agent name (no duplicate creation)
		// 2. Starts working on the specific task immediately
		const initialPrompt = taskId
			? `/jat:start ${agentName} ${taskId}`  // Agent name + task (prevents duplicate agent)
			: `/jat:start ${agentName}`;  // Planning mode - just register agent

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

		// Step 4c: If imagePath provided, wait for agent to start working, then send the image
		// This gives the agent context (e.g., bug screenshot) after it has initialized
		if (imagePath) {
			// Wait for the agent to fully start and be ready for input
			await new Promise(resolve => setTimeout(resolve, 8000));

			try {
				// Send the image path as input - the agent can then view it with Read tool
				const escapedPath = imagePath.replace(/"/g, '\\"');
				await execAsync(`tmux send-keys -t "${sessionName}" "${escapedPath}"`);
				await new Promise(resolve => setTimeout(resolve, 100));
				await execAsync(`tmux send-keys -t "${sessionName}" Enter`);
				console.log(`[spawn] Sent image path to session ${sessionName}: ${imagePath}`);
			} catch (err) {
				// Non-fatal - image send failed but session is still running
				console.error('Failed to send image path:', err);
			}
		}

		// Step 4b: If attach requested, open terminal window
		if (attach) {
			try {
				// Find available terminal
				const { stdout: whichResult } = await execAsync('which alacritty kitty gnome-terminal konsole xterm 2>/dev/null | head -1 || true');
				const terminalPath = whichResult.trim();

				if (terminalPath) {
					const { spawn } = await import('child_process');
					let child;

					if (terminalPath.includes('alacritty')) {
						child = spawn('alacritty', ['--title', `tmux: ${sessionName}`, '-e', 'tmux', 'attach-session', '-t', sessionName], {
							detached: true,
							stdio: 'ignore'
						});
					} else if (terminalPath.includes('kitty')) {
						child = spawn('kitty', ['--title', `tmux: ${sessionName}`, 'tmux', 'attach-session', '-t', sessionName], {
							detached: true,
							stdio: 'ignore'
						});
					} else if (terminalPath.includes('gnome-terminal')) {
						child = spawn('gnome-terminal', ['--title', `tmux: ${sessionName}`, '--', 'tmux', 'attach-session', '-t', sessionName], {
							detached: true,
							stdio: 'ignore'
						});
					} else if (terminalPath.includes('konsole')) {
						child = spawn('konsole', ['--new-tab', '-e', 'tmux', 'attach-session', '-t', sessionName], {
							detached: true,
							stdio: 'ignore'
						});
					} else {
						child = spawn('xterm', ['-title', `tmux: ${sessionName}`, '-e', 'tmux', 'attach-session', '-t', sessionName], {
							detached: true,
							stdio: 'ignore'
						});
					}

					child.unref();
				}
			} catch (err) {
				// Non-fatal - session is created, terminal just didn't open
				console.error('Failed to attach terminal:', err);
			}
		}

		// Step 5: Return WorkSession
		return json({
			success: true,
			session: {
				sessionName,
				agentName,
				task: taskId ? { id: taskId } : null,
				imagePath: imagePath || null,
				output: '',
				lineCount: 0,
				tokens: 0,
				cost: 0,
				created: new Date().toISOString(),
				attached: attach
			},
			message: taskId
				? `Spawned agent ${agentName} for task ${taskId}${imagePath ? ' (with attached image)' : ''}`
				: `Spawned planning session for agent ${agentName}`,
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
