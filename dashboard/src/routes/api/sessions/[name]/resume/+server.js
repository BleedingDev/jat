/**
 * Session Resume API
 * POST /api/sessions/[name]/resume - Resume a completed session using Claude's -r flag
 *
 * Uses the session_id from signal files to resume the Claude Code conversation.
 * Launches a new terminal window with the resumed session.
 */

import { json } from '@sveltejs/kit';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';

const execAsync = promisify(exec);

/**
 * Session name prefix for JAT agent sessions
 */
const SESSION_PREFIX = 'jat-';

/**
 * Get the full tmux session name from a name parameter.
 * @param {string} name - Agent name or full session name
 * @returns {{ agentName: string, sessionName: string }}
 */
function resolveSessionName(name) {
	if (name.startsWith(SESSION_PREFIX)) {
		return {
			agentName: name.slice(SESSION_PREFIX.length),
			sessionName: name
		};
	}
	return {
		agentName: name,
		sessionName: `${SESSION_PREFIX}${name}`
	};
}

/**
 * Find session_id from signal files
 * @param {string} sessionName - tmux session name (e.g., "jat-QuickOcean")
 * @returns {string | null} - Claude session_id or null if not found
 */
function findSessionId(sessionName) {
	// Try tmux-named signal file first
	const tmuxSignalFile = `/tmp/jat-signal-tmux-${sessionName}.json`;
	if (existsSync(tmuxSignalFile)) {
		try {
			const data = JSON.parse(readFileSync(tmuxSignalFile, 'utf-8'));
			if (data.session_id) {
				return data.session_id;
			}
		} catch (e) {
			console.error(`Failed to parse ${tmuxSignalFile}:`, e);
		}
	}

	// Fallback: search timeline for the session
	const agentName = sessionName.replace(/^jat-/, '');
	const timelineFile = `/tmp/jat-timeline-${sessionName}.jsonl`;
	if (existsSync(timelineFile)) {
		try {
			const lines = readFileSync(timelineFile, 'utf-8').trim().split('\n');
			// Search from newest to oldest for a session_id
			for (let i = lines.length - 1; i >= 0; i--) {
				try {
					const event = JSON.parse(lines[i]);
					if (event.session_id) {
						return event.session_id;
					}
				} catch (e) {
					// Skip malformed lines
				}
			}
		} catch (e) {
			console.error(`Failed to read timeline ${timelineFile}:`, e);
		}
	}

	return null;
}

/**
 * Resolve a project name or path to a full path
 * @param {string} project - Project name (e.g., "jat") or path (e.g., "~/code/jat")
 * @returns {string | null} - Full path or null
 */
function resolveProjectPath(project) {
	if (!project) return null;

	const homeDir = process.env.HOME || '';

	// If it's already a path (contains /), resolve ~ and return
	if (project.includes('/')) {
		return project.replace(/^~/, homeDir);
	}

	// It's a project name - look up in config
	const configPath = `${homeDir}/.config/jat/projects.json`;
	if (existsSync(configPath)) {
		try {
			const config = JSON.parse(readFileSync(configPath, 'utf-8'));
			const projectConfig = config.projects?.[project];
			if (projectConfig?.path) {
				return projectConfig.path.replace(/^~/, homeDir);
			}
		} catch (e) {
			// Continue to fallback
		}
	}

	// Fallback: assume ~/code/{project}
	const fallbackPath = `${homeDir}/code/${project}`;
	if (existsSync(fallbackPath)) {
		return fallbackPath;
	}

	return null;
}

/**
 * Get project path for an agent
 * @param {string} agentName - Agent name
 * @returns {Promise<string | null>} - Project path or null
 */
async function getProjectPath(agentName) {
	// Check signal file for project info
	const signalFile = `/tmp/jat-signal-tmux-jat-${agentName}.json`;
	if (existsSync(signalFile)) {
		try {
			const data = JSON.parse(readFileSync(signalFile, 'utf-8'));
			if (data.data?.project) {
				const resolved = resolveProjectPath(data.data.project);
				if (resolved) return resolved;
			}
		} catch (e) {
			// Continue to fallback
		}
	}

	// Check timeline for project
	const timelineFile = `/tmp/jat-timeline-jat-${agentName}.jsonl`;
	if (existsSync(timelineFile)) {
		try {
			const lines = readFileSync(timelineFile, 'utf-8').trim().split('\n');
			// Search for starting signal which has project info
			for (let i = lines.length - 1; i >= 0; i--) {
				try {
					const event = JSON.parse(lines[i]);
					if (event.data?.project) {
						const resolved = resolveProjectPath(event.data.project);
						if (resolved) return resolved;
					}
				} catch (e) {
					// Skip malformed lines
				}
			}
		} catch (e) {
			// Continue to fallback
		}
	}

	// Default to current working directory
	return process.cwd().replace(/\/dashboard$/, '');
}

/**
 * POST /api/sessions/[name]/resume
 * Resume a session using Claude's -r flag
 */
/** @type {import('./$types').RequestHandler} */
export async function POST({ params }) {
	try {
		const { agentName, sessionName } = resolveSessionName(params.name);

		if (!agentName) {
			return json({
				error: 'Missing agent name',
				message: 'Agent name is required'
			}, { status: 400 });
		}

		// Find the session_id from signal files
		const sessionId = findSessionId(sessionName);
		if (!sessionId) {
			return json({
				error: 'Session ID not found',
				message: `Could not find session ID for agent '${agentName}'. The session may be too old or the signal files may have been cleaned up.`,
				agentName,
				sessionName
			}, { status: 404 });
		}

		// Get project path
		const projectPath = await getProjectPath(agentName);
		if (!projectPath || !existsSync(projectPath)) {
			return json({
				error: 'Project path not found',
				message: `Could not find project path for agent '${agentName}'.`,
				agentName,
				sessionId
			}, { status: 404 });
		}

		// Get terminal emulator from config or use defaults
		let terminal = 'alacritty';
		const configPath = `${process.env.HOME}/.config/jat/projects.json`;
		if (existsSync(configPath)) {
			try {
				const config = JSON.parse(readFileSync(configPath, 'utf-8'));
				terminal = config.defaults?.terminal || 'alacritty';
			} catch (e) {
				// Use default
			}
		}

		// Get claude flags from config
		let claudeFlags = '--dangerously-skip-permissions';
		if (existsSync(configPath)) {
			try {
				const config = JSON.parse(readFileSync(configPath, 'utf-8'));
				claudeFlags = config.defaults?.claude_flags || claudeFlags;
			} catch (e) {
				// Use default
			}
		}

		// Build the resume command
		const resumeCommand = `cd "${projectPath}" && claude ${claudeFlags} -r "${sessionId}"`;

		// Launch in a new terminal
		let child;
		switch (terminal) {
			case 'alacritty':
				child = spawn('alacritty', ['-e', 'bash', '-c', resumeCommand], {
					detached: true,
					stdio: 'ignore'
				});
				break;
			case 'kitty':
				child = spawn('kitty', ['bash', '-c', resumeCommand], {
					detached: true,
					stdio: 'ignore'
				});
				break;
			case 'gnome-terminal':
				child = spawn('gnome-terminal', ['--', 'bash', '-c', resumeCommand], {
					detached: true,
					stdio: 'ignore'
				});
				break;
			case 'konsole':
				child = spawn('konsole', ['-e', 'bash', '-c', resumeCommand], {
					detached: true,
					stdio: 'ignore'
				});
				break;
			default:
				child = spawn('xterm', ['-e', 'bash', '-c', resumeCommand], {
					detached: true,
					stdio: 'ignore'
				});
		}

		child.unref();

		return json({
			success: true,
			agentName,
			sessionName,
			sessionId,
			projectPath,
			terminal,
			message: `Resuming session for ${agentName} in new terminal`,
			timestamp: new Date().toISOString()
		});

	} catch (error) {
		console.error('Error in POST /api/sessions/[name]/resume:', error);
		return json({
			error: 'Internal server error',
			message: error instanceof Error ? error.message : String(error)
		}, { status: 500 });
	}
}
