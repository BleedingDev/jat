/**
 * Servers API - Start Server Session
 * POST /api/servers/start - Start a new dev server in a tmux session
 *
 * Request body:
 * - projectName: Name of the project (required)
 * - command: Command to run (optional, defaults to 'npm run dev')
 * - port: Port to use (optional, will be detected from config)
 *
 * Creates a tmux session named: server-{projectName}
 */

import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);
const JAT_PROJECTS_CONFIG_PATH = join(homedir(), '.config', 'jat', 'projects.json');

/**
 * @param {string} projectName
 * @returns {boolean}
 */
function isValidProjectName(projectName) {
	return /^[a-zA-Z0-9_-]+$/.test(projectName);
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

/**
 * @typedef {{ path: string | null, serverPath: string | null, port: number | null }} ProjectServerConfig
 */

/**
 * @param {string} projectName
 * @returns {ProjectServerConfig | null}
 */
function readProjectServerConfig(projectName) {
	try {
		if (!existsSync(JAT_PROJECTS_CONFIG_PATH)) return null;

		const parsed = JSON.parse(readFileSync(JAT_PROJECTS_CONFIG_PATH, 'utf-8'));
		const entry = parsed?.projects?.[projectName];
		if (!entry || typeof entry !== 'object') return null;

		const home = process.env.HOME || homedir();
		const path = typeof entry.path === 'string' && entry.path.length > 0
			? entry.path.replace(/^~/, home)
			: null;
		const serverPath = typeof entry.server_path === 'string' && entry.server_path.length > 0
			? entry.server_path.replace(/^~/, home)
			: null;
		const rawPort = typeof entry.port === 'number' ? entry.port : Number.parseInt(String(entry.port || ''), 10);
		const port = Number.isFinite(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : null;

		return { path, serverPath, port };
	} catch {
		return null;
	}
}

/**
 * @param {string} path
 * @returns {boolean}
 */
function isDirectory(path) {
	try {
		return existsSync(path) && statSync(path).isDirectory();
	} catch {
		return false;
	}
}

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

		if (!isValidProjectName(projectName)) {
			return json(
				{ error: 'Invalid project name. Use only letters, numbers, hyphens, and underscores.' },
				{ status: 400 }
			);
		}

		const sessionName = `server-${projectName}`;
		const sessionExists = await hasTmuxSession(sessionName);
		if (sessionExists) {
			return json(
				{
					error: 'Session already exists',
					message: `Server session "${sessionName}" is already running`
				},
				{ status: 409 }
			);
		}

		const projectConfig = readProjectServerConfig(projectName);
		const projectPath = projectConfig?.path || `${process.env.HOME || homedir()}/code/${projectName}`;
		const executionPath = projectConfig?.serverPath || projectPath;

		if (!isDirectory(executionPath)) {
			return json(
				{
					error: 'Project directory not found',
					message: `Directory does not exist: ${executionPath}`
				},
				{ status: 404 }
			);
		}

		const configPort = projectConfig?.port || null;
		const requestedPort = Number.isFinite(Number(port)) ? Number(port) : null;
		const effectivePort = requestedPort || configPort;

		let serverCommand = String(command || 'npm run dev').trim();
		if (effectivePort && !/\b--port\b/.test(serverCommand)) {
			serverCommand = `${serverCommand} -- --port ${effectivePort}`;
		}

		await execFileAsync('tmux', ['new-session', '-d', '-s', sessionName, '-x', '80', '-y', '40', '-c', executionPath]);
		await new Promise((resolve) => setTimeout(resolve, 300));
		await execFileAsync('tmux', ['send-keys', '-t', sessionName, '-l', serverCommand]);
		await execFileAsync('tmux', ['send-keys', '-t', sessionName, 'Enter']);

		await new Promise((resolve) => setTimeout(resolve, 500));

		let output = '';
		let lineCount = 0;
		try {
			const captured = await execFileAsync('tmux', ['capture-pane', '-p', '-e', '-t', sessionName, '-S', '-50'], {
				maxBuffer: 1024 * 1024
			});
			output = captured.stdout;
			lineCount = captured.stdout.split('\n').length;
		} catch {
			// Session may not have produced output yet.
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
