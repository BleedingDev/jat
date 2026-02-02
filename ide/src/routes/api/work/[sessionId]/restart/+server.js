/**
 * Work Session Restart API
 * POST /api/work/[sessionId]/restart
 *
 * Restarts a work session by:
 * 1. Looking up the current task assigned to the session's agent
 * 2. Killing the tmux session
 * 3. Spawning a new tmux session with the same agent program
 *
 * Claude Code: restarts Claude Code and re-sends `/jat:start`.
 * Codex/Codex-native: restarts with an initial prompt containing task + JAT markers.
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, readdirSync, statSync, openSync, readSync, closeSync } from 'fs';
import { join, basename } from 'path';
import Database from 'better-sqlite3';
import { getTasks } from '$lib/server/beads.js';
import { AGENT_MAIL_URL } from '$lib/config/spawnConfig.js';
import { getJatDefaults } from '$lib/server/projectPaths.js';
import { getAgentConfig, getAgentProgram } from '$lib/utils/agentConfig.js';
import { getAgentModel } from '$lib/types/agentProgram.js';
import { getApiKey, getCustomApiKey } from '$lib/utils/credentials.js';
import { getReadyPatternsForAgent, SHELL_PROMPT_PATTERNS, isYoloWarningDialog } from '$lib/server/shellPatterns.js';
import { stripAnsi } from '$lib/utils/ansiToHtml.js';

const execAsync = promisify(exec);

const AGENT_MAIL_DB_PATH = process.env.AGENT_MAIL_DB || `${process.env.HOME}/.agent-mail.db`;

/**
 * @param {string} agentName
 * @returns {{ agentId: number, projectPath: string | null, program: string | null, model: string | null } | null}
 */
function getAgentInfoFromDb(agentName) {
	if (!existsSync(AGENT_MAIL_DB_PATH)) {
		return null;
	}
	try {
		const db = new Database(AGENT_MAIL_DB_PATH, { readonly: true });
		try {
			const row = /** @type {{ agent_id: number, project_path: string | null, program: string | null, model: string | null } | undefined} */ (
				db
					.prepare(
						`SELECT
							a.id as agent_id,
							p.human_key as project_path,
							a.program as program,
							a.model as model
						 FROM agents a
						 LEFT JOIN projects p ON a.project_id = p.id
						 WHERE a.name = ?
						 ORDER BY a.last_active_ts DESC
						 LIMIT 1`
					)
					.get(agentName)
			);
			return row
				? {
					agentId: row.agent_id,
					projectPath: row.project_path ?? null,
					program: row.program ?? null,
					model: row.model ?? null
				}
				: null;
		} finally {
			db.close();
		}
	} catch (err) {
		console.error(`[restart] Failed to query Agent Mail DB for ${agentName}:`, err);
		return null;
	}
}

/**
 * @param {string | null} model
 * @returns {string | null}
 */
function normalizeClaudeModelShort(model) {
	if (!model) return null;
	const lower = model.toLowerCase();
	if (lower.includes('opus')) return 'opus';
	if (lower.includes('sonnet')) return 'sonnet';
	if (lower.includes('haiku')) return 'haiku';
	return model;
}

// -----------------------------------------------------------------------------
// Codex Provider Session ID Persistence (Agent Mail DB)
// -----------------------------------------------------------------------------

/**
 * Persist provider session id mapping for reliable resume.
 * Stored in Agent Mail DB table agent_sessions.
 *
 * @param {number} agentId
 * @param {string} provider - e.g. 'codex' | 'codex-native'
 * @param {string} providerSessionId
 * @param {string} tmuxSession
 */
function upsertProviderSessionIdToDb(agentId, provider, providerSessionId, tmuxSession) {
	if (!agentId || !provider || !providerSessionId) {
		return;
	}
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
		console.warn('[restart] Failed to persist provider session id mapping:', e);
	}
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
 * Uses stable JAT markers embedded in the spawn prompt.
 * @param {string} agentName
 * @param {string} projectPath
 * @param {string} tmuxSession
 * @returns {string | null}
 */
function findCodexSessionIdFromSessions(agentName, projectPath, tmuxSession) {
	const homeDir = process.env.HOME || '';
	const sessionsRoot = join(homeDir, '.codex', 'sessions');
	if (!homeDir || !existsSync(sessionsRoot)) {
		return null;
	}

	const markerAgent = `[JAT_AGENT_NAME:${agentName}]`;
	const markerTmux = `[JAT_TMUX_SESSION:${tmuxSession}]`;
	const markerProject = `[JAT_PROJECT_PATH:${projectPath.replace(/\/+$/, '')}]`;
	const legacyNeedle = `Your agent name is: ${agentName}`;

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
			const cutoffMillis = Date.now() - 2 * 60 * 60 * 1000;
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

	// Prefer same cwd if available
	const normalizedProjectPath = projectPath.replace(/\/+$/, '');
	const byCwd = entries.filter((e) =>
		Array.isArray(e.cwds) && e.cwds.some((cwd) => String(cwd).replace(/\/+$/, '') === normalizedProjectPath)
	);

	let candidates = entries;
	if (byCwd.length > 0) {
		candidates = byCwd;
	}

	candidates = candidates
		.filter((e) => typeof e.path === 'string' && e.path.endsWith('.jsonl'))
		.sort((a, b) => (b.modified_millis || 0) - (a.modified_millis || 0));

	for (const entry of candidates.slice(0, 200)) {
		try {
			const prefix = readFilePrefix(entry.path, 1024 * 1024);
			if (!prefix) continue;
			if (!prefix.includes(markerProject)) continue;
			if (prefix.includes(markerAgent) || prefix.includes(markerTmux) || prefix.includes(legacyNeedle)) {
				const id = extractCodexSessionIdFromPath(entry.path);
				if (id) {
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
 * Retry Codex session id discovery for a short window.
 * Useful right after restart, when the provider session file may not exist yet.
 *
 * @param {{ agentName: string, projectPath: string, tmuxSession: string, maxAttempts?: number, delayMs?: number }} params
 * @returns {Promise<string | null>}
 */
async function findCodexSessionIdWithRetry(params) {
	const maxAttempts = params?.maxAttempts ?? 20;
	const delayMs = params?.delayMs ?? 500;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const id = findCodexSessionIdFromSessions(params.agentName, params.projectPath, params.tmuxSession);
		if (id) return id;
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	return null;
}

/**
 * Build a best-effort agent command for restarting a session.
 *
 * @param {object} params
 * @param {import('$lib/types/agentProgram.js').AgentProgram} params.agent
 * @param {import('$lib/types/agentProgram.js').AgentModel} params.model
 * @param {string} params.projectPath
 * @param {{ tools_path?: string, skip_permissions?: boolean }} params.jatDefaults
 * @param {string} params.agentName
 * @param {string | null} params.taskId
 * @param {string | null} params.taskTitle
 * @returns {{ command: string, needsClaudeStart: boolean }}
 */
function buildRestartCommand({ agent, model, projectPath, jatDefaults, agentName, taskId, taskTitle }) {
	/** @type {Record<string, string>} */
	const env = { AGENT_MAIL_URL, AGENT_MAIL_DB: AGENT_MAIL_DB_PATH };

	// Ensure JAT tools are on PATH for all agents (Codex/Claude/etc).
	const resolvedToolsPath = (jatDefaults.tools_path || '~/.local/bin').replace(/^~(?=\/)/, process.env.HOME || '');
	if (resolvedToolsPath) {
		const claudeToolsPath = agent.command === 'claude' ? `:${projectPath}/.claude/tools` : '';
		env.PATH = `$PATH:${resolvedToolsPath}${claudeToolsPath}`;
	}

	// For API key auth, inject the key as environment variable
	if (agent.authType === 'api_key' && agent.apiKeyEnvVar && agent.apiKeyProvider) {
		let apiKey = getApiKey(agent.apiKeyProvider);
		if (!apiKey) {
			apiKey = getCustomApiKey(agent.apiKeyProvider);
		}
		if (apiKey) {
			env[agent.apiKeyEnvVar] = apiKey;
		}
	}

	// Command parts: cd, export env, then run agent
	const cmdParts = [`cd "${projectPath}"`];
	for (const [key, value] of Object.entries(env)) {
		cmdParts.push(`${key}="${value}"`);
	}

	let agentCmd = agent.command;

	// Add model flags (agent-specific)
	if (agent.command === 'claude') {
		agentCmd += ` --model ${model.shortName}`;
	} else if (agent.command === 'codex') {
		agentCmd += ` --model ${model.id}`;
		if (model.costTier) {
			agentCmd += ` --config model_reasoning_effort=\"${model.costTier}\"`;
		}
	} else if (agent.command === 'codex-native') {
		agentCmd += ` --model ${model.id}`;
	} else if (agent.command === 'gemini') {
		agentCmd += ` --model ${model.id}`;
	} else if (agent.command === 'opencode') {
		const provider = agent.apiKeyProvider || 'anthropic';
		agentCmd += ` --model ${provider}/${model.id}`;
	} else {
		agentCmd += ` --model ${model.id}`;
	}

	// Add configured flags (normalize Codex approval flag naming for compatibility)
	if (agent.flags && agent.flags.length > 0) {
		const normalizedFlags =
			agent.command === 'codex'
				? agent.flags.map((f) =>
					f === '--approval'
						? '--ask-for-approval'
						: f.startsWith('--approval ')
							? f.replace(/^--approval /, '--ask-for-approval ')
							: f
				)
				: agent.command === 'codex-native'
					? agent.flags.map((f) =>
						f === '--ask-for-approval'
							? '--approval'
							: f.startsWith('--ask-for-approval ')
								? f.replace(/^--ask-for-approval /, '--approval ')
								: f
					)
					: agent.flags;

		agentCmd += ' ' + normalizedFlags.join(' ');
	}

	// Codex-family default: run with full permissions unless user explicitly configured sandboxing.
	if (agent.command === 'codex' || agent.command === 'codex-native') {
		const hasBypass = agent.flags?.some((f) => f.includes('--dangerously-bypass-approvals-and-sandbox')) || false;
		if (!hasBypass) {
			const hasSandbox = agent.flags?.some((f) => f === '--sandbox' || f.startsWith('--sandbox ')) || false;
			const hasApproval = agent.command === 'codex'
				? (agent.flags?.some((f) =>
					f === '--ask-for-approval' ||
					f.startsWith('--ask-for-approval ') ||
					f === '-a' ||
					f.startsWith('-a ') ||
					f === '--approval' ||
					f.startsWith('--approval ')
				) || false)
				: (agent.flags?.some((f) =>
					f === '--approval' ||
					f.startsWith('--approval ') ||
					f === '--ask-for-approval' ||
					f.startsWith('--ask-for-approval ')
				) || false);
			if (!hasSandbox) {
				agentCmd += ' --sandbox danger-full-access';
			}
			if (!hasApproval) {
				agentCmd += agent.command === 'codex' ? ' --ask-for-approval never' : ' --approval never';
			}
		}
	}

	// Claude Code: best-effort skip permissions from JAT config
	if (agent.command === 'claude' && jatDefaults.skip_permissions) {
		if (!agent.flags.includes('--dangerously-skip-permissions')) {
			agentCmd += ' --dangerously-skip-permissions';
		}
	}

	// Task injection
	const taskInjectionMode = agent.taskInjection || 'stdin';
	if (agent.command === 'claude') {
		agentCmd += ` --append-system-prompt 'You are a JAT agent. Run /jat:start to begin work.'`;
	} else if (taskInjectionMode === 'argument' && (agentName || taskId)) {
		const promptParts = [];
		promptParts.push('You are a JAT agent working on a software development task.');
		if (taskId) promptParts.push(`Task ID: ${taskId}`);
		if (taskTitle) promptParts.push(`Task: ${taskTitle}`);
		if (agentName) {
			promptParts.push(`Your agent name is: ${agentName}`);
			promptParts.push(`[JAT_AGENT_NAME:${agentName}]`);
			promptParts.push(`[JAT_TMUX_SESSION:jat-${agentName}]`);
		}
		if (taskId) promptParts.push(`[JAT_TASK_ID:${taskId}]`);
		if (taskTitle) promptParts.push(`[JAT_TASK_TITLE:${taskTitle}]`);
		promptParts.push(`[JAT_PROJECT_PATH:${projectPath.replace(/\/+$/, '')}]`);
		promptParts.push('Read AGENTS.md (preferred for Codex/Codex-native) and/or CLAUDE.md (Claude Code slash commands) in the project root for JAT workflow instructions.');
		promptParts.push('Start by understanding the task and implementing it.');

		const prompt = promptParts.join(' ');
		const escapedPrompt = prompt.replace(/"/g, '\\"');
		agentCmd += ` "${escapedPrompt}"`;
	} else if (taskInjectionMode === 'prompt' && (agentName || taskId)) {
		const promptParts = [];
		promptParts.push('You are a JAT agent working on a software development task.');
		if (taskId) promptParts.push(`Task ID: ${taskId}`);
		if (taskTitle) promptParts.push(`Task: ${taskTitle}`);
		if (agentName) {
			promptParts.push(`Your agent name is: ${agentName}`);
			promptParts.push(`[JAT_AGENT_NAME:${agentName}]`);
			promptParts.push(`[JAT_TMUX_SESSION:jat-${agentName}]`);
		}
		if (taskId) promptParts.push(`[JAT_TASK_ID:${taskId}]`);
		if (taskTitle) promptParts.push(`[JAT_TASK_TITLE:${taskTitle}]`);
		promptParts.push(`[JAT_PROJECT_PATH:${projectPath.replace(/\/+$/, '')}]`);
		promptParts.push('Read AGENTS.md (preferred for Codex/Codex-native) and/or CLAUDE.md (Claude Code slash commands) in the project root for JAT workflow instructions.');
		promptParts.push('Start by understanding the task and implementing it.');

		const prompt = promptParts.join(' ');
		const escapedPrompt = prompt.replace(/'/g, "'\\''");
		agentCmd += ` --prompt '${escapedPrompt}'`;
	}

	cmdParts.push(agentCmd);

	return {
		command: cmdParts.join(' && '),
		needsClaudeStart: agent.command === 'claude'
	};
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ params }) {
	try {
		const { sessionId } = params;

		if (!sessionId) {
			return json({
				error: 'Missing session ID',
				message: 'Session ID is required in path'
			}, { status: 400 });
		}

		// Extract agent name from session name (jat-AgentName -> AgentName)
		const agentName = sessionId.replace(/^jat-/, '');

		// Agent Mail DB is authoritative for program/model/project (durable across restarts)
		const agentInfo = getAgentInfoFromDb(agentName);

		// Step 1: Find in_progress task assigned to this agent
		let currentTask = null;
		let projectPath = null;
		try {
			const allTasks = getTasks({});
			currentTask = allTasks.find((t) => t.status === 'in_progress' && t.assignee === agentName) || null;
			if (currentTask) {
				projectPath = currentTask.project_path;
			}
		} catch (err) {
			console.error('[restart] Failed to fetch tasks:', err);
		}

		// If no task found, fall back to Agent Mail DB project (durable), then current working directory.
		if (!projectPath && agentInfo?.projectPath) {
			projectPath = agentInfo.projectPath;
		}
		if (!projectPath) {
			projectPath = process.cwd().replace('/ide', '');
		}

		if (!existsSync(projectPath)) {
			return json({
				error: 'Project path not found',
				message: `Project directory does not exist: ${projectPath}`,
				sessionId
			}, { status: 400 });
		}

		// Determine agent program + model
		const agentConfig = getAgentConfig();
		const fallbackAgentId = agentConfig.defaults?.fallbackAgent || 'codex-native';
		const agentProgramId = agentInfo?.program || fallbackAgentId;
		const agentProgram = agentProgramId ? getAgentProgram(agentProgramId) : undefined;

		if (!agentProgram) {
			return json({
				error: 'Agent program not configured',
				message: `Agent program '${agentProgramId}' was not found in ~/.config/jat/agents.json`,
				sessionId,
				agentName,
				agentProgramId
			}, { status: 500 });
		}

		let modelShort = agentInfo?.model || agentProgram.defaultModel || null;
		if (agentProgram.command === 'claude') {
			modelShort = normalizeClaudeModelShort(modelShort) || agentProgram.defaultModel;
		}
		const selectedModel = modelShort ? getAgentModel(agentProgram, modelShort) : null;
		const fallbackModel = getAgentModel(agentProgram, agentProgram.defaultModel) || agentProgram.models?.[0] || null;
		const model = selectedModel || fallbackModel;

		if (!model) {
			return json({
				error: 'Model not configured',
				message: `No model found for agent '${agentProgram.id}'.`,
				sessionId,
				agentName,
				agentProgramId
			}, { status: 500 });
		}

		// Get JAT defaults (used for tools_path, skip_permissions, timeouts, etc.)
		const jatDefaults = await getJatDefaults();

		// Step 2: Kill the existing tmux session
		try {
			await execAsync(`tmux kill-session -t "${sessionId}" 2>/dev/null`);
		} catch {
			// Session may not exist, that's okay
		}

		await new Promise((resolve) => setTimeout(resolve, 500));

		// Step 3: Create a new tmux session and launch the agent
		const TMUX_INITIAL_WIDTH = 80;
		const TMUX_INITIAL_HEIGHT = 40;

		const { command: agentCmd, needsClaudeStart } = buildRestartCommand({
			agent: agentProgram,
			model,
			projectPath,
			jatDefaults,
			agentName,
			taskId: currentTask?.id || null,
			taskTitle: currentTask?.title || null
		});

		const createSessionCmd = `tmux new-session -d -s "${sessionId}" -x ${TMUX_INITIAL_WIDTH} -y ${TMUX_INITIAL_HEIGHT} -c "${projectPath}" && sleep 0.3 && tmux send-keys -t "${sessionId}" "${agentCmd}" Enter`;

		try {
			await execAsync(createSessionCmd);
		} catch (err) {
			const execErr = /** @type {{ stderr?: string, message?: string }} */ (err);
			const errorMessage = execErr.stderr || (err instanceof Error ? err.message : String(err));
			return json({
				error: 'Failed to create session',
				message: errorMessage,
				sessionId,
				agentName
			}, { status: 500 });
		}

		// Step 3b (Codex-family): persist provider session id mapping for reliable resume.
		if (
			agentInfo?.agentId &&
			(agentProgram.command === 'codex' || agentProgram.command === 'codex-native')
		) {
			try {
				const providerSessionId = await findCodexSessionIdWithRetry({
					agentName,
					projectPath,
					tmuxSession: sessionId,
					maxAttempts: 20,
					delayMs: 500
				});
				if (providerSessionId) {
					upsertProviderSessionIdToDb(agentInfo.agentId, agentProgram.command, providerSessionId, sessionId);
					console.log(`[restart] Persisted ${agentProgram.command} provider session id for ${agentName}: ${providerSessionId}`);
				}
			} catch (e) {
				console.warn('[restart] Failed to persist Codex provider session id mapping:', e);
			}
		}

		// Step 4 (Claude only): wait for Claude to initialize, then send /jat:start
		if (needsClaudeStart) {
			const initialPrompt = currentTask
				? `/jat:start ${agentName} ${currentTask.id}`
				: `/jat:start ${agentName}`;

			const maxWaitSeconds = jatDefaults.claude_startup_timeout || 20;
			const checkIntervalMs = 500;
			let ready = false;
			let shellPromptDetected = false;
			const readyPatterns = getReadyPatternsForAgent('claude');

			for (let waited = 0; waited < maxWaitSeconds * 1000 && !ready; waited += checkIntervalMs) {
				await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));

				try {
					const { stdout: paneOutput } = await execAsync(
						`tmux capture-pane -t "${sessionId}" -p 2>/dev/null`
					);

					if (isYoloWarningDialog(paneOutput)) {
						console.log('[restart] YOLO permission warning detected - waiting for user to accept in terminal...');
						return json({
							error: 'Permission warning requires user acceptance',
							code: 'YOLO_WARNING_PENDING',
							message: 'Claude Code is showing a permissions warning dialog. Please open the terminal and accept it to continue.',
							sessionId,
							agentName,
							recoveryHint: `Run: tmux attach-session -t ${sessionId}`
						}, { status: 202 });
					}

					const hasReadyPatterns = readyPatterns.some((p) => paneOutput.includes(p));
					const outputLowercase = paneOutput.toLowerCase();
					const hasShellPatterns = SHELL_PROMPT_PATTERNS.some((p) => paneOutput.includes(p));
					const mentionsClaude = outputLowercase.includes('claude');
					const isLikelyShellPrompt = hasShellPatterns && !mentionsClaude && waited > 3000;

					if (hasReadyPatterns) {
						ready = true;
						console.log(`[restart] Claude Code ready after ${waited}ms`);
					} else if (isLikelyShellPrompt && waited > 5000) {
						shellPromptDetected = true;
						console.error('[restart] Claude Code failed to start - detected shell prompt');
						console.error(`[restart] Terminal output (last 300 chars): ${stripAnsi(paneOutput.slice(-300))}`);
						break;
					}
				} catch {
					// Session might not exist yet, continue waiting
				}
			}

			if (!ready) {
				if (shellPromptDetected) {
					console.error('[restart] ABORTING: Claude Code did not start (shell prompt detected)');
					return json({
						error: 'Claude Code failed to start',
						message: 'Claude Code did not start within the timeout period. The session was created but Claude is not running. Try attaching to the terminal manually.',
						sessionId,
						agentName,
						recoveryHint: `Try: tmux attach-session -t ${sessionId}`
					}, { status: 500 });
				}
				console.warn(`[restart] Claude Code may not have started properly after ${maxWaitSeconds}s, proceeding with caution`);
			}

			// Send initial prompt with retry logic
			const escapedPrompt = initialPrompt.replace(/"/g, '\\"').replace(/\$/g, '\\$');
			const maxRetries = 3;
			let commandSent = false;

			for (let attempt = 1; attempt <= maxRetries && !commandSent; attempt++) {
				try {
					await execAsync(`tmux send-keys -t "${sessionId}" -- "${escapedPrompt}"`);
					await new Promise((resolve) => setTimeout(resolve, 100));
					await execAsync(`tmux send-keys -t "${sessionId}" Enter`);

					await new Promise((resolve) => setTimeout(resolve, 2000));

					const { stdout: paneOutput } = await execAsync(
						`tmux capture-pane -t "${sessionId}" -p -S -40 -E -4 2>/dev/null`
					);

					const commandReceived =
						paneOutput.includes('is running') ||
						paneOutput.includes('STARTING') ||
						paneOutput.includes('Bash(') ||
						paneOutput.includes('● ');

					if (commandReceived) {
						commandSent = true;
						console.log(`[restart] Initial prompt sent successfully on attempt ${attempt}`);
					} else if (attempt < maxRetries) {
						const { stdout: inputArea } = await execAsync(
							`tmux capture-pane -t "${sessionId}" -p -S -4 -E -1 2>/dev/null`
						);
						const inputStillVisible = inputArea.includes(initialPrompt) && !inputArea.includes('is running');

						if (inputStillVisible) {
							console.log(`[restart] Attempt ${attempt}: Command visible in input, sending Enter again...`);
							await execAsync(`tmux send-keys -t "${sessionId}" Enter`);
							await new Promise((resolve) => setTimeout(resolve, 500));
						} else {
							console.log(`[restart] Attempt ${attempt}: Command likely in progress, waiting...`);
							await new Promise((resolve) => setTimeout(resolve, 2000));
						}
					}
				} catch (err) {
					console.error(`[restart] Attempt ${attempt} failed:`, err);
					if (attempt < maxRetries) {
						await new Promise((resolve) => setTimeout(resolve, 1000));
					}
				}
			}

			if (!commandSent) {
				console.warn(`[restart] Initial prompt may not have been executed after ${maxRetries} attempts`);
			}
		}

		return json({
			success: true,
			sessionId,
			agentName,
			taskId: currentTask?.id || null,
			projectPath,
			agentProgramId: agentProgram.id,
			model: model.shortName,
			message: currentTask
				? `Restarted session ${sessionId} with ${agentProgram.name} for task ${currentTask.id}`
				: `Restarted session ${sessionId} with ${agentProgram.name} (no task assigned)`,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error in POST /api/work/[sessionId]/restart:', error);
		return json({
			error: 'Internal server error',
			message: error instanceof Error ? error.message : String(error)
		}, { status: 500 });
	}
}
