/**
 * Agent session helpers (Agent Mail DB)
 *
 * Centralizes lookups that are needed to make the IDE agent-agnostic:
 * - Map agent → latest provider session id (Codex / codex-native)
 * - Map project path → agent names (for project stats)
 *
 * Note: Claude Code session IDs are not reliably persisted in Agent Mail DB today.
 * Claude compatibility still uses .claude/sessions/agent-*.txt and ~/.claude/projects/** logs.
 */

import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const DEFAULT_AGENT_MAIL_DB_PATH = join(homedir(), '.agent-mail.db');

export function getAgentMailDbPath(): string {
	return process.env.AGENT_MAIL_DB || DEFAULT_AGENT_MAIL_DB_PATH;
}

export interface LatestProviderSession {
	provider: string;
	sessionId: string;
	tmuxSession?: string;
	lastSeenTs?: string;
}

function parseSqliteDateTimeToMs(value: string): number | null {
	if (!value) return null;
	// SQLite datetime('now') uses "YYYY-MM-DD HH:MM:SS" (UTC). Convert to ISO.
	const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
	const ms = Date.parse(iso);
	return Number.isFinite(ms) ? ms : null;
}

function hasTable(db: Database.Database, name: string): boolean {
	try {
		const row = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1")
			.get(name) as { name?: string } | undefined;
		return !!row?.name;
	} catch {
		return false;
	}
}

/**
 * Get the most recently seen provider session id for an agent (Codex-family).
 * Returns null when Agent Mail DB or agent_sessions mapping is unavailable.
 */
export function getLatestProviderSessionIdForAgent(agentName: string): LatestProviderSession | null {
	if (!agentName) return null;

	const dbPath = getAgentMailDbPath();
	if (!existsSync(dbPath)) return null;

	let db: Database.Database;
	try {
		db = new Database(dbPath, { readonly: true });
	} catch {
		return null;
	}

	try {
		if (!hasTable(db, 'agent_sessions')) return null;

		const row = db
			.prepare(
				`
				SELECT
					s.provider as provider,
					s.provider_session_id as session_id,
					s.tmux_session as tmux_session,
					s.last_seen_ts as last_seen_ts
				FROM agent_sessions s
				JOIN agents a ON a.id = s.agent_id
				WHERE a.name = ?
				ORDER BY s.last_seen_ts DESC
				LIMIT 1
			`
			)
			.get(agentName) as
			| { provider?: string; session_id?: string; tmux_session?: string | null; last_seen_ts?: string | null }
			| undefined;

		if (!row?.provider || !row?.session_id) return null;

		return {
			provider: String(row.provider),
			sessionId: String(row.session_id),
			tmuxSession: row.tmux_session ? String(row.tmux_session) : undefined,
			lastSeenTs: (() => {
				if (!row.last_seen_ts) return undefined;
				const ms = parseSqliteDateTimeToMs(String(row.last_seen_ts));
				return ms ? new Date(ms).toISOString() : undefined;
			})()
		};
	} catch {
		return null;
	} finally {
		db.close();
	}
}

/**
 * Get all agent names registered for a project path.
 */
export function getAgentNamesForProjectPath(projectPath: string): string[] {
	if (!projectPath) return [];

	const dbPath = getAgentMailDbPath();
	if (!existsSync(dbPath)) return [];

	let db: Database.Database;
	try {
		db = new Database(dbPath, { readonly: true });
	} catch {
		return [];
	}

	try {
		const rows = db
			.prepare(
				`
				SELECT a.name as name
				FROM agents a
				JOIN projects p ON a.project_id = p.id
				WHERE p.human_key = ?
				ORDER BY a.last_active_ts DESC
			`
			)
			.all(projectPath) as Array<{ name?: string }>;

		return rows.map((r) => String(r.name || '')).filter((n) => n.length > 0);
	} catch {
		return [];
	} finally {
		db.close();
	}
}

/**
 * Best-effort "last agent activity" timestamp for a project (ms since epoch).
 * Uses Agent Mail DB agents.last_active_ts when available.
 */
export function getLatestAgentActivityMsForProject(projectPath: string): number | null {
	if (!projectPath) return null;

	const dbPath = getAgentMailDbPath();
	if (!existsSync(dbPath)) return null;

	let db: Database.Database;
	try {
		db = new Database(dbPath, { readonly: true });
	} catch {
		return null;
	}

	try {
		const row = db
			.prepare(
				`
				SELECT MAX(a.last_active_ts) as last_active_ts
				FROM agents a
				JOIN projects p ON a.project_id = p.id
				WHERE p.human_key = ?
			`
			)
			.get(projectPath) as { last_active_ts?: string | null } | undefined;

		const ts = row?.last_active_ts ? String(row.last_active_ts) : '';
		return ts ? parseSqliteDateTimeToMs(ts) : null;
	} catch {
		return null;
	} finally {
		db.close();
	}
}
