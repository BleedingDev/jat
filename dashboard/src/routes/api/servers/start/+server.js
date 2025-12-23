/**
 * Servers API - Start Server Session
 * POST /api/servers/start - Start a new dev server in a tmux session
 *
 * Request body:
 * - projectName: Name of the project (required)
 * - command: Command to run (optional, defaults to 'npm run dev')
 * - port: Port to use (optional, will be detected from output)
 *
 * Creates a tmux session named: server-{projectName}
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const body = await request.json();
		const { projectName, command = 'npm run dev', port } = body;

		if (!projectName) {
			return json(
				{ error: 'Missing required field: projectName' },
				{ status: 400 }
			);
		}

		// Validate project name (alphanumeric, hyphens, underscores only)
		if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
			return json(
				{ error: 'Invalid project name. Use only letters, numbers, hyphens, and underscores.' },
				{ status: 400 }
			);
		}

		const sessionName = `server-${projectName}`;

		// Check if session already exists
		try {
			const { stdout } = await execAsync(
				`tmux has-session -t "${sessionName}" 2>/dev/null && echo "exists" || echo "no"`
			);
			if (stdout.trim() === 'exists') {
				return json(
					{
						error: 'Session already exists',
						message: `Server session "${sessionName}" is already running`
					},
					{ status: 409 }
				);
			}
		} catch {
			// tmux might not be running, continue
		}

		// Get project settings from jat config
		let projectPath = null;
		let serverPath = null;
		let configPort = null;
		try {
			const configPath = `${process.env.HOME}/.config/jat/projects.json`;
			// Read all project settings at once
			// Note: \\n creates literal \n for jq to interpret as newline
			const { stdout: configOutput } = await execAsync(
				`jq -r '.projects["${projectName}"] | "\\(.path // "")\\n\\(.server_path // "")\\n\\(.port // "")"' "${configPath}" 2>/dev/null`
			);
			const [path, srvPath, portStr] = configOutput.trim().split('\n');
			if (path) {
				projectPath = path.replace(/^~/, process.env.HOME || '');
			}
			if (srvPath) {
				serverPath = srvPath.replace(/^~/, process.env.HOME || '');
			}
			if (portStr && portStr !== 'null') {
				configPort = parseInt(portStr, 10);
			}
		} catch {
			// Config not available
		}

		// Fall back to default path
		if (!projectPath) {
			projectPath = `${process.env.HOME}/code/${projectName}`;
		}

		// Use server_path if specified, otherwise use project path
		const executionPath = serverPath || projectPath;

		// Verify execution path exists
		try {
			const { stdout } = await execAsync(`test -d "${executionPath}" && echo "exists" || echo "no"`);
			if (stdout.trim() !== 'exists') {
				return json(
					{
						error: 'Project directory not found',
						message: `Directory does not exist: ${executionPath}`
					},
					{ status: 404 }
				);
			}
		} catch {
			return json(
				{
					error: 'Failed to verify project path',
					message: `Could not check directory: ${executionPath}`
				},
				{ status: 500 }
			);
		}

		// Use port from request, config, or nothing (let vite pick default)
		const effectivePort = port || configPort;

		// Build the command with port if specified
		let serverCommand = command;
		if (effectivePort && !command.includes('--port')) {
			serverCommand = `${command} -- --port ${effectivePort}`;
		}

		// Create tmux session and start the server
		// Use 80x40 dimensions for consistent output width in dashboard
		// Sleep allows shell to initialize before sending keys - prevents race condition
		const createCmd = `
			tmux new-session -d -s "${sessionName}" -x 80 -y 40 -c "${executionPath}" && \
			sleep 0.3 && \
			tmux send-keys -t "${sessionName}" "${serverCommand}" Enter
		`;

		try {
			await execAsync(createCmd);
		} catch (err) {
			return json(
				{
					error: 'Failed to create server session',
					message: err instanceof Error ? err.message : String(err)
				},
				{ status: 500 }
			);
		}

		// Wait a moment and get initial output
		await new Promise((resolve) => setTimeout(resolve, 500));

		let output = '';
		let lineCount = 0;
		try {
			const { stdout } = await execAsync(
				`tmux capture-pane -p -e -t "${sessionName}" -S -50`,
				{ maxBuffer: 1024 * 1024 }
			);
			output = stdout;
			lineCount = stdout.split('\n').length;
		} catch {
			// Session might not have output yet
		}

		return json({
			success: true,
			session: {
				mode: 'server',
				sessionName,
				projectName,
				displayName: `${projectName.charAt(0).toUpperCase() + projectName.slice(1)} Dev Server`,
				port: effectivePort || null,
				portRunning: false,
				status: 'starting',
				output,
				lineCount,
				created: new Date().toISOString(),
				attached: false,
				projectPath: executionPath,
				command: serverCommand
			},
			message: `Started server session: ${sessionName}`
		});
	} catch (error) {
		console.error('Error in POST /api/servers/start:', error);
		return json(
			{
				error: 'Internal server error',
				message: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
}
