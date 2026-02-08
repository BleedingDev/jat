/**
 * Servers API - Restart Server Session
 * POST /api/servers/{sessionName}/restart - Restart a server session
 *
 * Stops the current tmux session and starts a fresh one with the same name.
 */

import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);
const JAT_PROJECTS_CONFIG_PATH = join(homedir(), '.config', 'jat', 'projects.json');

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
 * @param {string} output
 * @returns {number | null}
 */
function detectPortFromOutput(output) {
	const portPatterns = [
		/localhost:(\d+)/,
		/127\.0\.0\.1:(\d+)/,
		/--port\s+(\d+)/,
		/port\s+(\d+)/i
	];

	for (const pattern of portPatterns) {
		const match = output.match(pattern);
		if (!match || !match[1]) continue;
		const port = Number.parseInt(match[1], 10);
		if (port >= 1024 && port <= 65535) return port;
	}

	return null;
}

/**
 * @param {string} sessionName
 * @returns {Promise<string>}
 */
async function captureSessionOutput(sessionName) {
	try {
		const { stdout } = await execFileAsync('tmux', ['capture-pane', '-p', '-t', sessionName, '-S', '-500']);
		return stdout;
	} catch {
		return '';
	}
}

/**
 * @param {string} projectPath
 * @param {string | null} serverPath
 * @returns {string}
 */
function resolveWorkDir(projectPath, serverPath) {
	if (serverPath) return serverPath;
	const idePath = join(projectPath, 'ide');
	if (existsSync(join(idePath, 'package.json'))) {
		return idePath;
	}
	return projectPath;
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ params }) {
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

		const projectName = sessionName.replace(/^server-/, '');
		const currentOutput = await captureSessionOutput(sessionName);
		const detectedPort = detectPortFromOutput(currentOutput);

		const projectConfig = readProjectServerConfig(projectName);
		const projectPath = projectConfig?.path || `${process.env.HOME || homedir()}/code/${projectName}`;
		const serverPath = projectConfig?.serverPath || null;
		const configPort = projectConfig?.port || null;
		const port = detectedPort || configPort;
		const restartCommand = port ? `npm run dev -- --port ${port}` : 'npm run dev';
		const workDir = resolveWorkDir(projectPath, serverPath);

		try {
			await execFileAsync('tmux', ['kill-session', '-t', sessionName]);
		} catch {
			// Ignore if already stopped while we process.
		}

		await new Promise((resolve) => setTimeout(resolve, 300));
		await execFileAsync('tmux', ['new-session', '-d', '-s', sessionName, '-x', '80', '-y', '40', '-c', workDir]);
		await new Promise((resolve) => setTimeout(resolve, 300));
		await execFileAsync('tmux', ['send-keys', '-t', sessionName, '-l', restartCommand]);
		await execFileAsync('tmux', ['send-keys', '-t', sessionName, 'Enter']);

		return json({
			success: true,
			message: `Restarted server session: ${sessionName}`,
			command: restartCommand,
			session: {
				mode: 'server',
				sessionName,
				projectName,
				port,
				status: 'starting',
				output: 'Restarting server...',
				lineCount: 1,
				timestamp: new Date().toISOString()
			}
		});
	} catch (error) {
		console.error('Error in POST /api/servers/[sessionName]/restart:', error);
		return json(
			{
				error: 'Failed to restart server session',
				message: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
}
