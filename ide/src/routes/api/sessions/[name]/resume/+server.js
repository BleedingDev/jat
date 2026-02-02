/**
 * Session Resume API
 * POST /api/sessions/[name]/resume - Resume a completed session (agent-agnostic)
 *
 * Claude Code: Uses the Claude conversation session_id to resume via `claude -r`.
 * Codex CLI: Uses `codex resume` (prefers explicit session id; falls back to --last).
 * codex-native: Uses `codex-native tui --resume` (prefers explicit session id; falls back to --resume-last).
 * Launches a new terminal window attached to a tmux session.
 */

import { json } from '@sveltejs/kit';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, readdirSync, statSync, openSync, readSync, closeSync } from 'fs';
import { join, basename } from 'path';
import Database from 'better-sqlite3';
import { getAgentConfig, getAgentProgram } from '$lib/utils/agentConfig.js';
import { getAgentModel } from '$lib/types/agentProgram.js';

const execAsync = promisify(exec);

/**
 * Agent Mail database path
 */
const AGENT_MAIL_DB_PATH = process.env.AGENT_MAIL_DB || `${process.env.HOME}/.agent-mail.db`;

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
 * Convert a project path to Claude's project slug format
 * @param {string} projectPath - e.g., "/home/jw/code/jat"
 * @returns {string} - e.g., "-home-jw-code-jat"
 */
function getProjectSlug(projectPath) {
	return projectPath.replace(/\//g, '-');
}

/**
 * Look up agent info from Agent Mail database
 * @param {string} agentName - Agent name to look up
 * @returns {{ agentId: number, projectPath: string, program: string | null, model: string | null } | null}
 */
function getAgentInfoFromDb(agentName) {
	if (!existsSync(AGENT_MAIL_DB_PATH)) {
		return null;
	}

	try {
		const db = new Database(AGENT_MAIL_DB_PATH, { readonly: true });
		const result = /** @type {{ agent_id: number, project: string, program: string | null, model: string | null } | undefined} */ (
			db.prepare(`
				SELECT
					a.id as agent_id,
					p.human_key as project,
					a.program as program,
					a.model as model
				FROM agents a
				JOIN projects p ON a.project_id = p.id
				WHERE a.name = ?
			`).get(agentName)
		);
		db.close();

		if (result?.project) {
			// The human_key is already the full path (e.g., /home/jw/code/steelbridge)
			return {
				agentId: result.agent_id,
				projectPath: result.project,
				program: result.program ?? null,
				model: result.model ?? null
			};
		}
	} catch (e) {
		console.error(`Failed to query Agent Mail DB for ${agentName}:`, e);
	}

	return null;
}


// -----------------------------------------------------------------------------
// Provider Session ID Persistence (Agent Mail DB)
// -----------------------------------------------------------------------------

/**
 * @param {number} agentId
 * @param {string} provider
 * @returns {string | null}
 */
function getLatestProviderSessionIdFromDb(agentId, provider) {
	if (!existsSync(AGENT_MAIL_DB_PATH)) {
		return null;
	}
	try {
		const db = new Database(AGENT_MAIL_DB_PATH, { readonly: true });
		try {
			const row = /** @type {{ provider_session_id: string } | undefined} */ (
				db
					.prepare(
						'SELECT provider_session_id FROM agent_sessions WHERE agent_id = ? AND provider = ? ORDER BY last_seen_ts DESC LIMIT 1'
					)
					.get(agentId, provider)
			);
			return row?.provider_session_id ?? null;
		} catch {
			return null;
		} finally {
			db.close();
		}
	} catch {
		return null;
	}
}

/**
 * @param {number} agentId
 * @param {string} provider
 * @param {string} providerSessionId
 * @param {string} tmuxSession
 * @returns {void}
 */
function upsertProviderSessionIdToDb(agentId, provider, providerSessionId, tmuxSession) {
	if (!existsSync(AGENT_MAIL_DB_PATH)) {
		return;
	}
	try {
		const db = new Database(AGENT_MAIL_DB_PATH);
		try {
			// Ensure table exists (safe for existing DBs)
			db.exec(`
				CREATE TABLE IF NOT EXISTS agent_sessions (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					agent_id INTEGER NOT NULL,
					tmux_session TEXT,
					provider TEXT NOT NULL,
					provider_session_id TEXT NOT NULL,
					created_ts TEXT NOT NULL DEFAULT (datetime('now')),
					last_seen_ts TEXT NOT NULL DEFAULT (datetime('now')),
					FOREIGN KEY (agent_id) REFERENCES agents(id),
					UNIQUE (agent_id, provider, provider_session_id)
				);
				CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_sessions(agent_id);
				CREATE INDEX IF NOT EXISTS idx_agent_sessions_provider ON agent_sessions(provider);
				CREATE INDEX IF NOT EXISTS idx_agent_sessions_last_seen_ts ON agent_sessions(last_seen_ts);
			`);

			const stmt = db.prepare(`
				INSERT INTO agent_sessions (agent_id, tmux_session, provider, provider_session_id, created_ts, last_seen_ts)
				VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
				ON CONFLICT(agent_id, provider, provider_session_id) DO UPDATE SET
					tmux_session = excluded.tmux_session,
					last_seen_ts = datetime('now')
			`);
			stmt.run(agentId, tmuxSession, provider, providerSessionId);
		} finally {
			db.close();
		}
	} catch (e) {
		console.warn('[resume] Failed to persist provider session id mapping:', e);
	}
}

/**
 * Search Claude JSONL session files for an agent's most recent session
 * This is a last-resort fallback when no other session mapping exists
 * @param {string} agentName - Agent name to search for
 * @param {string} projectPath - Project path to compute the slug
 * @returns {string | null} - Session ID or null if not found
 */
function findSessionIdFromJsonl(agentName, projectPath) {
	const homeDir = process.env.HOME || '';
	const projectSlug = getProjectSlug(projectPath);
	const claudeProjectDir = join(homeDir, '.claude', 'projects', projectSlug);

	if (!existsSync(claudeProjectDir)) {
		return null;
	}

	try {
		const files = readdirSync(claudeProjectDir)
			.filter(f => f.endsWith('.jsonl'))
			.map(f => ({
				name: f,
				path: join(claudeProjectDir, f),
				sessionId: f.replace('.jsonl', ''),
				mtime: statSync(join(claudeProjectDir, f)).mtime.getTime()
			}))
			.sort((a, b) => b.mtime - a.mtime); // Newest first

		// Search for agent name in multiple patterns:
		// 1. "agentName":"TrueCave" in tool output - from jat-signal
		// 2. <command-args>TrueCave in early messages - from /jat:start command
		// Pattern 2 is checked only in the first 5 lines to avoid false positives from
		// tool_results that contain context from OTHER sessions. The /jat:start command
		// always appears in line 1-3 of the JSONL file.
		const signalPattern = new RegExp(`"agentName"\\s*:\\s*"${agentName}"`, 'i');
		const commandPattern = new RegExp(`<command-args>${agentName}\\s`, 'i');

		for (const file of files) {
			try {
				const content = readFileSync(file.path, 'utf-8');

				// Check signal pattern anywhere in file (reliable - from tool output)
				if (signalPattern.test(content)) {
					console.log(`Found session for ${agentName} via signal pattern: ${file.sessionId}`);
					return file.sessionId;
				}

				// Check command pattern only in first 5 lines (session start)
				// The /jat:start command is always in lines 1-3, so 5 lines is safe
				// but prevents matching tool_results that contain other session contexts
				const lines = content.split('\n').slice(0, 5).join('\n');
				if (commandPattern.test(lines)) {
					console.log(`Found session for ${agentName} via command pattern: ${file.sessionId}`);
					return file.sessionId;
				}
			} catch (e) {
				// Skip unreadable files
			}
		}
	} catch (e) {
		console.error(`Failed to scan Claude projects dir ${claudeProjectDir}:`, e);
	}

	return null;
}

/**
 * Read a small prefix of a file for fast substring checks.
 * Avoids loading large Codex session JSONL files fully.
 * @param {string} filePath
 * @param {number} [maxBytes]
 * @returns {string}
 */
function readFilePrefix(filePath, maxBytes = 1024 * 1024) {
	try {
		const fd = openSync(filePath, 'r');
		try {
			const buffer = Buffer.allocUnsafe(maxBytes);
			const bytesRead = readSync(fd, buffer, 0, maxBytes, 0);
			return buffer.toString('utf-8', 0, bytesRead);
		} finally {
			closeSync(fd);
		}
	} catch {
		return '';
	}
}

/**
 * Extract a provider session id from a Codex session JSONL filename.
 * Codex stores sessions like: rollout-YYYY-MM-DDTHH-MM-SS-<uuid>.jsonl
 * @param {string} filePath
 * @returns {string | null}
 */
function extractCodexSessionIdFromPath(filePath) {
	const base = basename(filePath);
	const match = base.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
	return match ? match[1] : null;
}

/**
 * Search Codex session logs for this agent's most recent provider session id.
 * Uses stable JAT markers embedded in the spawn prompt:
 * - [JAT_AGENT_NAME:Name]
 * - [JAT_TMUX_SESSION:jat-Name]
 * Falls back to the legacy plain-text prompt line if markers aren't present.
 * @param {string} agentName
 * @param {string | null} projectPath
 * @returns {string | null}
 */


/**
 * Find a Codex session JSONL file path for a given provider session id.
 * Uses the Codex index cache when present, otherwise falls back to a bounded recursive scan.
 * @param {string} providerSessionId
 * @returns {string | null}
 */
function findCodexSessionFileById(providerSessionId) {
	const homeDir = process.env.HOME || '';
	const sessionsRoot = join(homeDir, '.codex', 'sessions');
	if (!homeDir || !existsSync(sessionsRoot)) {
		return null;
	}

	const indexFile = join(sessionsRoot, '_schaltwerk_session_index_cache.json');
	if (existsSync(indexFile)) {
		try {
			const index = JSON.parse(readFileSync(indexFile, 'utf-8'));
			if (Array.isArray(index.entries)) {
				/** @type {Array<{ path?: string; modified_millis?: number }>} */
				const entries = index.entries;
				const matches = entries
					.filter((e) => typeof e.path === 'string' && e.path.includes(providerSessionId) && e.path.endsWith('.jsonl'))
					.sort((a, b) => (b.modified_millis || 0) - (a.modified_millis || 0));

				for (const entry of matches) {
					if (entry?.path && existsSync(entry.path)) {
						return entry.path;
					}
				}
			}
		} catch {
			// ignore
		}
	}

	// Fallback: bounded recursive scan for a filename ending with the session id.
	try {
		const stack = [{ dir: sessionsRoot, depth: 0 }];
		const maxDepth = 6;
		let bestPath = null;
		let bestMtime = 0;

		while (stack.length > 0) {
			const item = stack.pop();
			if (!item) break;
			if (item.depth > maxDepth) continue;

			let dirEntries;
			try {
				dirEntries = readdirSync(item.dir, { withFileTypes: true });
			} catch {
				continue;
			}

			for (const ent of dirEntries) {
				const fullPath = join(item.dir, ent.name);
				if (ent.isDirectory()) {
					if (ent.name.startsWith('.')) continue;
					stack.push({ dir: fullPath, depth: item.depth + 1 });
					continue;
				}
				if (!ent.isFile()) continue;
				if (!ent.name.endsWith(`${providerSessionId}.jsonl`)) continue;

				try {
					const st = statSync(fullPath);
					if (st.mtimeMs > bestMtime) {
						bestMtime = st.mtimeMs;
						bestPath = fullPath;
					}
				} catch {
					// ignore
				}
			}
		}

		return bestPath;
	} catch {
		return null;
	}
}

/**
 * Validate that a Codex provider session id belongs to this agent/project.
 * Prevents resuming the wrong session when DB mappings go stale.
 * @param {string} providerSessionId
 * @param {string} agentName
 * @param {string} projectPath
 * @param {string} tmuxSession
 * @returns {boolean}
 */
function isCodexProviderSessionIdMatchForAgent(providerSessionId, agentName, projectPath, tmuxSession) {
	const filePath = findCodexSessionFileById(providerSessionId);
	if (!filePath) {
		return false;
	}

	const prefix = readFilePrefix(filePath, 1024 * 1024);
	if (!prefix) {
		return false;
	}

	const normalizedProjectPath = projectPath.replace(/\/+$/, '');
	const markerProject = `[JAT_PROJECT_PATH:${normalizedProjectPath}]`;
	const markerAgent = `[JAT_AGENT_NAME:${agentName}]`;
	const markerTmux = `[JAT_TMUX_SESSION:${tmuxSession}]`;
	const legacyNeedle = `Your agent name is: ${agentName}`;

	if (!prefix.includes(markerProject)) {
		return false;
	}

	return prefix.includes(markerAgent) || prefix.includes(markerTmux) || prefix.includes(legacyNeedle);
}

/**
 * Search Codex session logs for this agent's most recent provider session id.
 * Uses stable JAT markers embedded in the spawn prompt.
 *
 * @param {string} agentName
 * @param {string | null} projectPath
 * @returns {string | null}
 */
function findCodexSessionIdFromSessions(agentName, projectPath) {
	const homeDir = process.env.HOME || '';
	const sessionsRoot = join(homeDir, '.codex', 'sessions');
	if (!homeDir || !existsSync(sessionsRoot)) {
		return null;
	}

	const marker1 = `[JAT_AGENT_NAME:${agentName}]`;
	const marker2 = `[JAT_TMUX_SESSION:jat-${agentName}]`;
	const legacyNeedle = `Your agent name is: ${agentName}`;
	const markerProject = projectPath ? `[JAT_PROJECT_PATH:${projectPath.replace(/\/+$/, '')}]` : null;

	/** @type {Array<{ path: string; modified_millis: number; cwds?: string[] }>} */
	let entries = [];
	const indexFile = join(sessionsRoot, '_schaltwerk_session_index_cache.json');
	if (existsSync(indexFile)) {
		try {
			const index = JSON.parse(readFileSync(indexFile, 'utf-8'));
			if (Array.isArray(index.entries)) {
				entries = index.entries;
			}
		} catch {
			// ignore
		}
	}

	if (entries.length === 0) {
		// Fallback: scan ~/.codex/sessions recursively for recent JSONL files (index cache may be absent).
		try {
			const cutoffMillis = Date.now() - 30 * 24 * 60 * 60 * 1000;
			const stack = [{ dir: sessionsRoot, depth: 0 }];
			const files = [];
			const maxDepth = 6;

			while (stack.length > 0) {
				const item = stack.pop();
				if (!item) break;
				if (item.depth > maxDepth) continue;

				let dirEntries;
				try {
					dirEntries = readdirSync(item.dir, { withFileTypes: true });
				} catch {
					continue;
				}

				for (const ent of dirEntries) {
					const fullPath = join(item.dir, ent.name);
					if (ent.isDirectory()) {
						if (ent.name.startsWith('.')) continue;
						stack.push({ dir: fullPath, depth: item.depth + 1 });
						continue;
					}
					if (!ent.isFile()) continue;
					if (!ent.name.endsWith('.jsonl')) continue;

					try {
						const st = statSync(fullPath);
						if (st.mtimeMs < cutoffMillis) continue;
						files.push({ path: fullPath, modified_millis: st.mtimeMs });
					} catch {
						// ignore
					}
				}
			}

			files.sort((a, b) => (b.modified_millis || 0) - (a.modified_millis || 0));
			entries = files.slice(0, 2000);
		} catch {
			// ignore
		}
	}

	// Prefer same cwd if projectPath is known; otherwise scan most recent sessions.
	let candidates = entries;
	if (projectPath) {
		const normalizedProjectPath = projectPath.replace(/\/+$/, '');
		const byCwd = entries.filter((e) =>
			Array.isArray(e.cwds) && e.cwds.some((cwd) => String(cwd).replace(/\/+$/, '') === normalizedProjectPath)
		);
		if (byCwd.length > 0) {
			candidates = byCwd;
		}
	}

	candidates = candidates
		.filter((e) => typeof e.path === 'string' && e.path.endsWith('.jsonl'))
		.sort((a, b) => (b.modified_millis || 0) - (a.modified_millis || 0));

	const maxCandidates = 200;
	for (const entry of candidates.slice(0, maxCandidates)) {
		try {
			const prefix = readFilePrefix(entry.path, 1024 * 1024);
			if (!prefix) continue;
			if (markerProject && !prefix.includes(markerProject)) continue;
			if (prefix.includes(marker1) || prefix.includes(marker2) || prefix.includes(legacyNeedle)) {
				const id = extractCodexSessionIdFromPath(entry.path);
				if (id) {
					console.log(`Found Codex session for ${agentName}: ${id}`);
					return id;
				}
			}
		} catch {
			// ignore
		}
	}

	return null;
}
/**
 * Find a provider session_id from signal files (tmux signal + timeline).
 * Works for any agent as long as jat-signal included a session_id value.
 * @param {string} sessionName - tmux session name (e.g., "jat-QuickOcean")
 * @returns {string | null}
 */
function findSessionIdFromSignals(sessionName) {
	// Try tmux-named signal file first (in /tmp, cleared on restart)
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

	// Fallback: search timeline for the session (in /tmp, cleared on restart)
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
 * Find Claude session_id from signal files or persistent agent session files
 * @param {string} sessionName - tmux session name (e.g., "jat-QuickOcean")
 * @param {string | null} projectPath - project path to search for persistent session files
 * @returns {string | null} - Claude session_id or null if not found
 */
function findSessionId(sessionName, projectPath = null) {
	const agentName = sessionName.replace(/^jat-/, '');
	const fromSignals = findSessionIdFromSignals(sessionName);
	if (fromSignals) {
		return fromSignals;
	}

	// Fallback: search persistent .claude/sessions/agent-*.txt files (survive restarts)
	// These files are named agent-{sessionId}.txt and contain the agent name
	if (projectPath) {
		const sessionsDir = join(projectPath, '.claude', 'sessions');
		if (existsSync(sessionsDir)) {
			try {
				const files = readdirSync(sessionsDir);
				// Sort by modification time (newest first) to get the most recent session
				const agentFiles = files
					.filter(f => f.startsWith('agent-') && f.endsWith('.txt'))
					.map(f => {
						const filePath = join(sessionsDir, f);
						return {
							name: f,
							path: filePath,
							mtime: existsSync(filePath) ? statSync(filePath).mtime.getTime() : 0
						};
					})
					.sort((a, b) => b.mtime - a.mtime);

				for (const file of agentFiles) {
					try {
						const content = readFileSync(file.path, 'utf-8').trim();
						if (content === agentName) {
							// Extract session ID from filename: agent-{sessionId}.txt
							const match = file.name.match(/^agent-(.+)\.txt$/);
							if (match) {
								return match[1];
							}
						}
					} catch (e) {
						// Skip unreadable files
					}
				}
			} catch (e) {
				console.error(`Failed to scan sessions dir ${sessionsDir}:`, e);
			}
		}
	}

	// Final fallback: scan Claude JSONL session files for agent's signals
	// This catches sessions where .claude/sessions/agent-*.txt was never created
	if (projectPath) {
		const jsonlSessionId = findSessionIdFromJsonl(agentName, projectPath);
		if (jsonlSessionId) {
			return jsonlSessionId;
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
			const projectRef = data.data?.project || data.project;
			if (projectRef) {
				const resolved = resolveProjectPath(projectRef);
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
					const projectRef = event.data?.project || event.project;
					if (projectRef) {
						const resolved = resolveProjectPath(projectRef);
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

	// Query Agent Mail database for agent's registered project
	// This is the most reliable source when temp files don't exist (e.g., after reboot)
	const dbInfo = getAgentInfoFromDb(agentName);
	if (dbInfo?.projectPath && existsSync(dbInfo.projectPath)) {
		return dbInfo.projectPath;
	}

	// Default to current working directory
	return process.cwd().replace(/\/ide$/, '');
}

/**
 * POST /api/sessions/[name]/resume
 * Resume a session in a new tmux session.
 *
 * Body can include:
 * - session_id: Provider session ID to resume (if known)
 * - project: Project name or path (optional override)
 */
/** @type {import('./$types').RequestHandler} */
export async function POST({ params, request }) {
	try {
		const { agentName, sessionName } = resolveSessionName(params.name);

		if (!agentName) {
			return json({
				error: 'Missing agent name',
				message: 'Agent name is required'
			}, { status: 400 });
		}

		// Parse request body for optional session_id
		/** @type {{ session_id?: string; project?: string; agentProgram?: string; model?: string }} */
		let body = {};
		try {
			body = await request.json();
		} catch {
			// No body or invalid JSON is fine
		}

		// Get project path - use provided path if available, otherwise look it up
		let projectPath = body.project ? resolveProjectPath(body.project) : null;
		if (!projectPath) {
			projectPath = await getProjectPath(agentName);
		}
		if (!projectPath || !existsSync(projectPath)) {
			return json({
				error: 'Project path not found',
				message: `Could not find project path for agent '${agentName}'.`,
				agentName,
				sessionName
			}, { status: 404 });
		}

		// Determine which agent program to resume (Agent Mail is authoritative)
		const dbInfo = getAgentInfoFromDb(agentName);
		const agentConfig = getAgentConfig();
		const fallbackAgentId = agentConfig.defaults?.fallbackAgent || 'codex-native';
		const agentProgramId = body.agentProgram || dbInfo?.program || fallbackAgentId;
		const agentProgram = agentProgramId ? getAgentProgram(agentProgramId) : undefined;
		const agentCommand =
			agentProgram?.command ||
			(agentProgramId === 'codex-native'
				? 'codex-native'
				: agentProgramId === 'codex-cli'
					? 'codex'
					: 'claude');

		// Resolve model (best-effort; used for Codex resume)
		const modelShortName = body.model || dbInfo?.model || null;
		const resolvedModel = modelShortName && agentProgram ? getAgentModel(agentProgram, modelShortName) : null;

		// Use provided session_id or look it up from signal files (and provider-specific fallbacks)
		/** @type {string | undefined} */
		let sessionId = body.session_id;
		// Prefer durable provider session mapping from Agent Mail DB (survives restarts).
		// Validate mappings against Codex session logs to avoid resuming the wrong session when mappings go stale.
		if (!sessionId && dbInfo?.agentId && (agentCommand === 'codex' || agentCommand === 'codex-native')) {
			const mapped = getLatestProviderSessionIdFromDb(dbInfo.agentId, agentCommand);
			if (mapped) {
				const ok = isCodexProviderSessionIdMatchForAgent(mapped, agentName, projectPath, sessionName);
				if (ok) {
					sessionId = mapped;
				} else {
					console.warn(`[resume] Ignoring stale provider session id mapping for ${agentName}: ${mapped}`);
				}
			}
		}
		if (!sessionId) {
			if (agentCommand === 'claude') {
				const found = findSessionId(sessionName, projectPath);
				if (found) sessionId = found;
			} else {
				const fromSignals = findSessionIdFromSignals(sessionName);
				if (fromSignals) sessionId = fromSignals;

				// For Codex-family sessions, recover provider session id from ~/.codex/sessions when signals lack session_id.
				if (!sessionId && (agentCommand === 'codex' || agentCommand === 'codex-native')) {
					const recovered = findCodexSessionIdFromSessions(agentName, projectPath);
					if (recovered) sessionId = recovered;
				}
			}
		}

		// Claude requires an explicit conversation id; Codex can fall back to --last.
		if (agentCommand === 'claude' && !sessionId) {
			return json({
				error: 'Session ID not found',
				message: `Could not find Claude session ID for agent '${agentName}'. No matching session files found in /tmp or .claude/sessions/.`,
				agentName,
				sessionName,
				projectPath
			}, { status: 404 });
		}

		// Get terminal emulator from config or use defaults
		let terminal = 'auto';
		const configPath = `${process.env.HOME}/.config/jat/projects.json`;
		if (existsSync(configPath)) {
			try {
				const config = JSON.parse(readFileSync(configPath, 'utf-8'));
				terminal = config.defaults?.terminal || 'auto';
			} catch (e) {
				// Use default
			}
		}
		// Resolve 'auto' to platform default
		if (terminal === 'auto') {
			if (process.platform === 'darwin') {
				if (existsSync('/Applications/Ghostty.app')) {
					terminal = 'ghostty';
				} else {
					terminal = existsSync('/Applications/iTerm.app') ? 'iterm2' : 'apple-terminal';
				}
			} else {
				terminal = 'alacritty';
			}
		}

		// Resolve tools + Agent Mail env for the resumed session (agent-agnostic).
		let toolsPath = `${process.env.HOME}/.local/bin`;
		if (existsSync(configPath)) {
			try {
				const config = JSON.parse(readFileSync(configPath, 'utf-8'));
				toolsPath = config.defaults?.tools_path || toolsPath;
			} catch {
				// Use default
			}
		}
		toolsPath = String(toolsPath).replace(/^~(?=\/)/, process.env.HOME || '');

		const basePath = process.env.PATH || '';
		const fullPath = `${basePath}:${toolsPath}` + (agentCommand === 'claude' ? `:${projectPath}/.claude/tools` : '');
		const envPrefix = `PATH="${fullPath}" AGENT_MAIL_URL="http://localhost:8765" AGENT_MAIL_DB="${AGENT_MAIL_DB_PATH}"`;

		// Get claude flags from config (legacy)
		let claudeFlags = '--dangerously-skip-permissions';
		if (existsSync(configPath)) {
			try {
				const config = JSON.parse(readFileSync(configPath, 'utf-8'));
				claudeFlags = config.defaults?.claude_flags || claudeFlags;
			} catch {
				// Use default
			}
		}

		// Persist provider session id mapping for reliable future resumes (best-effort).
		if (sessionId && dbInfo?.agentId) {
			upsertProviderSessionIdToDb(dbInfo.agentId, agentCommand, sessionId, sessionName);
		}

		// Write resume marker file so IDE can show "RESUMED" badge
		const resumeMarker = `/tmp/jat-resumed-${sessionName}.json`;
		const resumeData = JSON.stringify({
			resumed: true,
			originalSessionId: sessionId || null,
			agentName,
			agentProgram: agentProgramId,
			agentCommand,
			model: resolvedModel?.id || modelShortName || null,
			project: projectPath,
			resumedAt: new Date().toISOString()
		}, null, 2);
		try {
			const { writeFileSync } = await import('fs');
			writeFileSync(resumeMarker, resumeData);
		} catch (e) {
			console.error('Failed to write resume marker:', e);
		}

		const escapeForDoubleQuotedShell = (/** @type {unknown} */ s) =>
			String(s)
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"')
				.replace(/\$/g, '\\$')
				.replace(/`/g, '\\`');

		// Build the resume command wrapped in a tmux session for IDE tracking
		// 1. Kill any existing session with this name (in case it's stale)
		// 2. Create new tmux session with the agent resume command running inside
		// 3. Attach terminal to that session
		let innerCmd = '';

		if (agentCommand === 'claude') {
			// Merge agent-program flags with legacy claude_flags (best-effort)
			const extraFlags = (agentProgram?.flags || []).filter((f) => !claudeFlags.includes(f));
			const allFlags = [claudeFlags, ...extraFlags].filter(Boolean).join(' ').trim();
			innerCmd = `claude ${allFlags} -r '${sessionId}'`;
		} else if (agentCommand === 'codex') {
			const parts = ['codex', 'resume'];
			if (resolvedModel?.id) {
				parts.push('--model', resolvedModel.id);
			}
			let effectiveFlags = agentProgram?.flags?.length ? [...agentProgram.flags] : [];
			// Normalize legacy Codex approval flag name (`--approval` → `--ask-for-approval`).
			effectiveFlags = effectiveFlags.map((f) =>
				f === '--approval'
					? '--ask-for-approval'
					: f.startsWith('--approval ')
						? f.replace(/^--approval /, '--ask-for-approval ')
						: f
			);
			const hasBypass = effectiveFlags.some((f) => f.includes('--dangerously-bypass-approvals-and-sandbox'));
			if (!hasBypass) {
				const hasSandbox = effectiveFlags.some((f) => f === '--sandbox' || f.startsWith('--sandbox '));
				const hasApproval = effectiveFlags.some((f) =>
					f === '--ask-for-approval' ||
					f.startsWith('--ask-for-approval ') ||
					f === '-a' ||
					f.startsWith('-a ')
				);
				if (!hasSandbox) effectiveFlags.push('--sandbox', 'danger-full-access');
				if (!hasApproval) effectiveFlags.push('--ask-for-approval', 'never');
			}
			if (effectiveFlags.length) {
				parts.push(...effectiveFlags);
			}
			if (sessionId) {
				parts.push(sessionId);
			} else {
				parts.push('--last');
			}
			innerCmd = parts.join(' ');
		} else if (agentCommand === 'codex-native') {
			// codex-native does not have a 'resume' subcommand; use the TUI resume flags.
			const parts = ['codex-native', 'tui'];
			if (resolvedModel?.id) {
				parts.push('--model', resolvedModel.id);
			}
			let effectiveFlags = agentProgram?.flags?.length ? [...agentProgram.flags] : [];
			// Normalize legacy Codex approval flag name (`--ask-for-approval` → `--approval`) for codex-native.
			effectiveFlags = effectiveFlags.map((f) =>
				f === '--ask-for-approval'
					? '--approval'
					: f.startsWith('--ask-for-approval ')
						? f.replace(/^--ask-for-approval /, '--approval ')
						: f
			);
			const hasBypass = effectiveFlags.some((f) => f.includes('--dangerously-bypass-approvals-and-sandbox'));
			if (!hasBypass) {
				const hasSandbox = effectiveFlags.some((f) => f === '--sandbox' || f.startsWith('--sandbox '));
				const hasApproval = effectiveFlags.some((f) => f === '--approval' || f.startsWith('--approval '));
				if (!hasSandbox) effectiveFlags.push('--sandbox', 'danger-full-access');
				if (!hasApproval) effectiveFlags.push('--approval', 'never');
			}
			if (effectiveFlags.length) {
				parts.push(...effectiveFlags);
			}
			if (sessionId) {
				parts.push('--resume', sessionId);
			} else {
				parts.push('--resume-last');
			}
			innerCmd = parts.join(' ');
		} else {
			return json({
				error: 'Unsupported agent program',
				message: `Unsupported agent command '${agentCommand}' for resume`,
				agentName,
				sessionName,
				agentProgram: agentProgramId
			}, { status: 400 });
		}

		const fullInnerCmd = `${envPrefix} ${innerCmd}`.trim();
		const tmuxCreateCmd = `tmux kill-session -t "${sessionName}" 2>/dev/null; tmux new-session -d -s "${sessionName}" -c "${projectPath}" "${escapeForDoubleQuotedShell(fullInnerCmd)}"`;
		const tmuxAttachCmd = `tmux attach-session -t "${sessionName}"`;

		// First create the tmux session
		try {
			await execAsync(tmuxCreateCmd);
		} catch (e) {
			// Ignore errors from kill-session if session doesn't exist
			const msg = e instanceof Error ? e.message : String(e);
			console.log('tmux session creation:', msg);
		}

		// Then launch terminal attached to the tmux session
		const attachCommand = tmuxAttachCmd;
		let child;
		switch (terminal) {
			case 'apple-terminal':
				child = spawn('osascript', ['-e', `
					tell application "Terminal"
						do script "bash -c '${attachCommand}'"
						activate
					end tell
				`], { detached: true, stdio: 'ignore' });
				break;
			case 'iterm2':
				child = spawn('osascript', ['-e', `
					tell application "iTerm"
						create window with default profile command "bash -c '${attachCommand}'"
					end tell
				`], { detached: true, stdio: 'ignore' });
				break;
			case 'ghostty':
				if (process.platform === 'darwin') {
					child = spawn('ghostty', ['+new-window', '-e', 'bash', '-c', attachCommand], {
						detached: true, stdio: 'ignore'
					});
				} else {
					child = spawn('ghostty', ['-e', 'bash', '-c', attachCommand], {
						detached: true, stdio: 'ignore'
					});
				}
				break;
			case 'alacritty':
				child = spawn('alacritty', ['-e', 'bash', '-c', attachCommand], {
					detached: true,
					stdio: 'ignore'
				});
				break;
			case 'kitty':
				child = spawn('kitty', ['bash', '-c', attachCommand], {
					detached: true,
					stdio: 'ignore'
				});
				break;
			case 'gnome-terminal':
				child = spawn('gnome-terminal', ['--', 'bash', '-c', attachCommand], {
					detached: true,
					stdio: 'ignore'
				});
				break;
			case 'konsole':
				child = spawn('konsole', ['-e', 'bash', '-c', attachCommand], {
					detached: true,
					stdio: 'ignore'
				});
				break;
			default:
				child = spawn('xterm', ['-e', 'bash', '-c', attachCommand], {
					detached: true,
					stdio: 'ignore'
				});
		}

		child.unref();

		return json({
			success: true,
			agentName,
			sessionName,
			sessionId: sessionId || null,
			agentProgram: agentProgramId,
			agentCommand,
			model: resolvedModel?.id || modelShortName || null,
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
