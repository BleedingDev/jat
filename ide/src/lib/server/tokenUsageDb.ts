/**
 * Token Usage SQLite Database Module
 *
 * Pre-aggregates token usage from provider log files into SQLite for fast API queries.
 *
 * Design:
 * 1. Background job runs every 5 minutes (or on-demand)
 * 2. Scans provider session logs for new entries (tracks last processed byte offset per file)
 * 3. Aggregates into 30-minute buckets in SQLite (48 points per 24h for better sparkline resolution)
 * 4. API queries SQLite instead of parsing logs on demand
 *
 * Tables:
 * - token_usage_hourly: Per-bucket aggregation by project, agent, session
 *                       (column named "hour_start" for backward compatibility, but stores 30-min bucket start)
 * - aggregation_state: Tracks last processed position per log file
 * - session_agent_map: Session-id → agent/project mapping (for joining provider logs back to JAT agents)
 *
 * Providers:
 * - Claude Code: reads ~/.claude/projects/<project>/*.jsonl (message.usage)
 * - Codex / codex-native: reads ~/.codex/sessions/<session>/rollout-*.jsonl (event_msg token_count)
 *
 * Benefits:
 * - API response time: 109s → <100ms
 * - Incremental updates (only process new data)
 * - Historical queries become trivial
 * - 30-minute granularity for better sparkline resolution
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { readdir, readFile, stat, open as openFile } from 'fs/promises';
import { createInterface } from 'readline';
import type { Database as DatabaseType } from 'better-sqlite3';

// ============================================================================
// Types
// ============================================================================

export interface HourlyUsageRow {
	id: number;
	project: string;
	agent: string | null;
	session_id: string;
	hour_start: string; // ISO timestamp rounded to 30-minute bucket (named for backward compatibility)
	input_tokens: number;
	cache_creation_tokens: number;
	cache_read_tokens: number;
	output_tokens: number;
	total_tokens: number;
	cost_usd: number;
	entry_count: number;
	updated_at: string;
}

export interface AggregationStateRow {
	file_path: string;
	last_position: number;
	last_modified: number;
	// Optional columns (added later) used for Codex cumulative token_count deltas
	last_cumulative_input_tokens?: number;
	last_cumulative_cached_input_tokens?: number;
	last_cumulative_output_tokens?: number;
	last_cumulative_total_tokens?: number;
	processed_at: string;
}

export interface AggregatedUsage {
	total_tokens: number;
	input_tokens: number;
	cache_creation_tokens: number;
	cache_read_tokens: number;
	output_tokens: number;
	cost_usd: number;
	session_count: number;
}

// ============================================================================
// Constants
// ============================================================================

function getJatDataDir(): string {
	const xdgDataHome = process.env.XDG_DATA_HOME;
	if (xdgDataHome && xdgDataHome.trim()) {
		return path.join(xdgDataHome, 'jat');
	}

	return path.join(os.homedir(), '.local', 'share', 'jat');
}

const DB_PATH = path.join(getJatDataDir(), 'token-usage.db');

// Claude Sonnet 4.5 Pricing (per million tokens)
const PRICING = {
	input: 3.0,
	cache_creation: 3.75,
	cache_read: 0.30,
	output: 15.0
} as const;

const CODEX_SESSIONS_DIR = path.join(os.homedir(), '.codex', 'sessions');
const CODEX_SESSION_INDEX_FILE = path.join(CODEX_SESSIONS_DIR, '_schaltwerk_session_index_cache.json');
const CODEX_LOOKBACK_DAYS = (() => {
	const raw = process.env.JAT_CODEX_USAGE_LOOKBACK_DAYS;
	const parsed = raw ? Number(raw) : NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
})();

// ============================================================================
// Database Singleton
// ============================================================================

let db: DatabaseType | null = null;

/**
 * Get the SQLite database instance (creates if needed)
 */
export function getDatabase(): DatabaseType {
	if (!db) {
		const dbDir = path.dirname(DB_PATH);
		if (!existsSync(dbDir)) {
			mkdirSync(dbDir, { recursive: true });
		}

		db = new Database(DB_PATH);
		db.pragma('journal_mode = WAL');
		db.pragma('synchronous = NORMAL');
		initializeTables(db);
	}
	return db;
}

/**
 * Close the database connection (for cleanup)
 */
export function closeDatabase(): void {
	if (db) {
		db.close();
		db = null;
	}
}

// ============================================================================
// Schema Initialization
// ============================================================================

function ensureAggregationStateColumns(db: DatabaseType): void {
	try {
		const cols = db.prepare("PRAGMA table_info('aggregation_state')").all() as Array<{ name: string }>;
		const existing = new Set(cols.map(c => c.name));

		const additions: Array<{ name: string; sql: string }> = [
			{ name: 'last_cumulative_input_tokens', sql: 'ALTER TABLE aggregation_state ADD COLUMN last_cumulative_input_tokens INTEGER DEFAULT 0' },
			{ name: 'last_cumulative_cached_input_tokens', sql: 'ALTER TABLE aggregation_state ADD COLUMN last_cumulative_cached_input_tokens INTEGER DEFAULT 0' },
			{ name: 'last_cumulative_output_tokens', sql: 'ALTER TABLE aggregation_state ADD COLUMN last_cumulative_output_tokens INTEGER DEFAULT 0' },
			{ name: 'last_cumulative_total_tokens', sql: 'ALTER TABLE aggregation_state ADD COLUMN last_cumulative_total_tokens INTEGER DEFAULT 0' }
		];

		for (const add of additions) {
			if (!existing.has(add.name)) {
				db.exec(add.sql);
			}
		}
	} catch {
		// If PRAGMA fails or table is missing, initialization will recreate it.
	}
}

function initializeTables(db: DatabaseType): void {
	// Hourly usage aggregation table
	db.exec(`
		CREATE TABLE IF NOT EXISTS token_usage_hourly (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project TEXT NOT NULL,
			agent TEXT,
			session_id TEXT NOT NULL,
			hour_start TEXT NOT NULL,
			input_tokens INTEGER DEFAULT 0,
			cache_creation_tokens INTEGER DEFAULT 0,
			cache_read_tokens INTEGER DEFAULT 0,
			output_tokens INTEGER DEFAULT 0,
			total_tokens INTEGER DEFAULT 0,
			cost_usd REAL DEFAULT 0,
			entry_count INTEGER DEFAULT 0,
			updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(project, session_id, hour_start)
		);

		CREATE INDEX IF NOT EXISTS idx_usage_hour ON token_usage_hourly(hour_start);
		CREATE INDEX IF NOT EXISTS idx_usage_project ON token_usage_hourly(project);
		CREATE INDEX IF NOT EXISTS idx_usage_agent ON token_usage_hourly(agent);
		CREATE INDEX IF NOT EXISTS idx_usage_project_hour ON token_usage_hourly(project, hour_start);
	`);

	// Aggregation state tracking table
	db.exec(`
		CREATE TABLE IF NOT EXISTS aggregation_state (
			file_path TEXT PRIMARY KEY,
			last_position INTEGER DEFAULT 0,
			last_modified INTEGER DEFAULT 0,
			last_cumulative_input_tokens INTEGER DEFAULT 0,
			last_cumulative_cached_input_tokens INTEGER DEFAULT 0,
			last_cumulative_output_tokens INTEGER DEFAULT 0,
			last_cumulative_total_tokens INTEGER DEFAULT 0,
			processed_at TEXT DEFAULT CURRENT_TIMESTAMP
		)
	`);

	ensureAggregationStateColumns(db);

	// Session-to-agent mapping cache
	db.exec(`
		CREATE TABLE IF NOT EXISTS session_agent_map (
			session_id TEXT PRIMARY KEY,
			agent TEXT NOT NULL,
			project TEXT NOT NULL,
			discovered_at TEXT DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_sam_agent ON session_agent_map(agent);
		CREATE INDEX IF NOT EXISTS idx_sam_project ON session_agent_map(project);
	`);
}

// ============================================================================
// Session-Agent Mapping (Cached in SQLite)
// ============================================================================

function upsertSessionAgentMap(sessionId: string, agentName: string, projectName: string): void {
	const db = getDatabase();
	const stmt = db.prepare(`
		INSERT INTO session_agent_map (session_id, agent, project, discovered_at)
		VALUES (?, ?, ?, datetime('now'))
		ON CONFLICT(session_id) DO UPDATE SET
			agent = excluded.agent,
			project = excluded.project
	`);
	stmt.run(sessionId, agentName, projectName);
}

function getSessionMapping(sessionId: string): { agent: string; project: string } | null {
	const db = getDatabase();
	const row = db
		.prepare('SELECT agent, project FROM session_agent_map WHERE session_id = ?')
		.get(sessionId) as { agent: string; project: string } | undefined;
	return row ?? null;
}

/**
 * Scan for agent-*.txt files and update the session_agent_map table.
 *
 * This is Claude Code's durable mapping mechanism:
 * - .claude/sessions/agent-{sessionId}.txt contains the agent name
 */
export async function updateSessionAgentMap(projectPaths: string[]): Promise<void> {
	const db = getDatabase();

	const upsertStmt = db.prepare(`
		INSERT INTO session_agent_map (session_id, agent, project, discovered_at)
		VALUES (?, ?, ?, datetime('now'))
		ON CONFLICT(session_id) DO UPDATE SET
			agent = excluded.agent,
			project = excluded.project
	`);

	for (const projectPath of projectPaths) {
		const projectName = path.basename(projectPath);

		// Check both .claude/sessions/ (new) and .claude/ (legacy)
		const dirsToCheck = [
			path.join(projectPath, '.claude', 'sessions'),
			path.join(projectPath, '.claude')
		];

		for (const dir of dirsToCheck) {
			try {
				const files = await readdir(dir);
				const agentFiles = files.filter(f => f.startsWith('agent-') && f.endsWith('.txt'));

				for (const file of agentFiles) {
					const sessionId = file.slice(6, -4); // Remove 'agent-' and '.txt'
					try {
						const content = await readFile(path.join(dir, file), 'utf-8');
						const agentName = content.trim();
						if (agentName) {
							upsertStmt.run(sessionId, agentName, projectName);
						}
					} catch {
						// Skip unreadable files
					}
				}
			} catch {
				// Directory doesn't exist
			}
		}
	}
}

/**
 * Get agent name for a session from cache
 */
export function getAgentForSession(sessionId: string): string | null {
	const db = getDatabase();
	const row = db.prepare('SELECT agent FROM session_agent_map WHERE session_id = ?').get(sessionId) as { agent: string } | undefined;
	return row?.agent ?? null;
}

// ============================================================================
// JSONL Parsing and Aggregation
// ============================================================================

type BucketAgg = {
	input: number;
	cacheCreation: number;
	cacheRead: number;
	output: number;
	count: number;
};

interface ClaudeJSONLEntry {
	timestamp?: string;
	message?: {
		usage?: {
			input_tokens?: number;
			cache_creation_input_tokens?: number;
			cache_read_input_tokens?: number;
			output_tokens?: number;
		};
	};
}

interface CodexSessionIndex {
	version?: number;
	entries?: Array<{
		path?: string;
		modified_millis?: number;
		cwds?: string[];
	}>;
}

interface CodexTokenCountInfo {
	total_token_usage?: {
		input_tokens?: number;
		cached_input_tokens?: number;
		output_tokens?: number;
		total_tokens?: number;
	};
}

interface CodexJSONLEntry {
	timestamp?: string;
	type?: string;
	payload?: {
		type?: string;
		info?: CodexTokenCountInfo | null;
	};
}

/**
 * Default bucket size in minutes for token aggregation.
 * 30 minutes gives 48 data points per 24 hours for better sparkline resolution.
 */
export const DEFAULT_BUCKET_MINUTES = 30;

/**
 * Round timestamp to bucket start (for bucketing)
 */
function roundToBucket(timestamp: Date, bucketMinutes: number = DEFAULT_BUCKET_MINUTES): string {
	const rounded = new Date(timestamp);
	const minutes = rounded.getMinutes();
	const bucketStart = Math.floor(minutes / bucketMinutes) * bucketMinutes;
	rounded.setMinutes(bucketStart, 0, 0);
	return rounded.toISOString();
}

/**
 * Calculate Claude cost from token counts
 */
function calculateCost(input: number, cacheCreation: number, cacheRead: number, output: number): number {
	return (
		(input / 1_000_000) * PRICING.input +
		(cacheCreation / 1_000_000) * PRICING.cache_creation +
		(cacheRead / 1_000_000) * PRICING.cache_read +
		(output / 1_000_000) * PRICING.output
	);
}

async function readFilePrefix(filePath: string, maxBytes: number = 1024 * 1024): Promise<string> {
	try {
		const fh = await openFile(filePath, 'r');
		try {
			const buffer = Buffer.allocUnsafe(maxBytes);
			const { bytesRead } = await fh.read(buffer, 0, maxBytes, 0);
			return buffer.toString('utf-8', 0, bytesRead);
		} finally {
			await fh.close();
		}
	} catch {
		return '';
	}
}

async function scanCodexSessionEntriesFallback(params: {
	cutoffMillis: number;
	normalizedProjects: Set<string>;
	maxEntries?: number;
}): Promise<NonNullable<CodexSessionIndex['entries']>> {
	const results: NonNullable<CodexSessionIndex['entries']> = [];
	if (!existsSync(CODEX_SESSIONS_DIR)) {
		return results;
	}

	const maxEntries = params.maxEntries ?? 2000;

	type StackItem = { dir: string; depth: number };
	const stack: StackItem[] = [{ dir: CODEX_SESSIONS_DIR, depth: 0 }];
	const files: Array<{ path: string; modified_millis: number }> = [];

	// Codex stores sessions under ~/.codex/sessions/<year>/...; keep recursion bounded.
	const maxDepth = 6;

	while (stack.length > 0) {
		const item = stack.pop();
		if (!item) break;
		if (item.depth > maxDepth) continue;

		let dirEntries;
		try {
			dirEntries = await readdir(item.dir, { withFileTypes: true });
		} catch {
			continue;
		}

		for (const ent of dirEntries) {
			const fullPath = path.join(item.dir, ent.name);
			if (ent.isDirectory()) {
				if (ent.name.startsWith('.')) continue;
				stack.push({ dir: fullPath, depth: item.depth + 1 });
				continue;
			}
			if (!ent.isFile()) continue;
			if (!ent.name.endsWith('.jsonl')) continue;

			try {
				const st = await stat(fullPath);
				const m = st.mtimeMs;
				if (m < params.cutoffMillis) continue;
				files.push({ path: fullPath, modified_millis: m });
			} catch {
				// ignore
			}
		}
	}

	files.sort((a, b) => b.modified_millis - a.modified_millis);

	// Only inspect a bounded set of recent files; we'll filter further by JAT markers.
	const recent = files.slice(0, maxEntries * 2);

	for (const file of recent) {
		const prefix = await readFilePrefix(file.path, 1024 * 1024);
		if (!prefix) continue;

		const markers = parseJatMarkers(prefix);
		if (!markers.projectPath) continue;

		const normalizedProject = normalizePath(markers.projectPath);
		if (!params.normalizedProjects.has(normalizedProject)) continue;

		results.push({
			path: file.path,
			modified_millis: file.modified_millis,
			cwds: [normalizedProject]
		});

		if (results.length >= maxEntries) break;
	}

	return results;
}

function extractCodexSessionIdFromPath(filePath: string): string | null {
	const base = path.basename(filePath);
	const match = base.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
	return match ? match[1] : null;
}

function parseJatMarkers(text: string): { agentName?: string; projectPath?: string } {
	const agentMatch = text.match(/\[JAT_AGENT_NAME:([^\]]+)\]/);
	const projectMatch = text.match(/\[JAT_PROJECT_PATH:([^\]]+)\]/);
	return {
		agentName: agentMatch?.[1],
		projectPath: projectMatch?.[1]
	};
}

function normalizePath(p: string): string {
	return String(p).replace(/\/+$/, '');
}

async function streamJsonlLines(filePath: string, start: number, onLine: (line: string) => void): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const stream = createReadStream(filePath, { encoding: 'utf-8', start });
		stream.on('error', reject);

		const rl = createInterface({ input: stream, crlfDelay: Infinity });
		rl.on('line', onLine);
		rl.on('close', () => resolve());
		rl.on('error', reject);
	});
}

function upsertBucketsAndState(params: {
	filePath: string;
	project: string;
	agent: string | null;
	sessionId: string;
	hourlyBuckets: Map<string, BucketAgg>;
	lastPosition: number;
	currentModified: number;
	stateCumulative?: {
		inputTokens: number;
		cachedInputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
	provider: 'claude' | 'codex';
}): void {
	const db = getDatabase();

	const upsertUsage = db.prepare(`
		INSERT INTO token_usage_hourly (
			project, agent, session_id, hour_start,
			input_tokens, cache_creation_tokens, cache_read_tokens, output_tokens,
			total_tokens, cost_usd, entry_count, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(project, session_id, hour_start) DO UPDATE SET
			input_tokens = input_tokens + excluded.input_tokens,
			cache_creation_tokens = cache_creation_tokens + excluded.cache_creation_tokens,
			cache_read_tokens = cache_read_tokens + excluded.cache_read_tokens,
			output_tokens = output_tokens + excluded.output_tokens,
			total_tokens = total_tokens + excluded.total_tokens,
			cost_usd = cost_usd + excluded.cost_usd,
			entry_count = entry_count + excluded.entry_count,
			updated_at = datetime('now')
	`);

	const upsertState = db.prepare(`
		INSERT INTO aggregation_state (
			file_path,
			last_position,
			last_modified,
			last_cumulative_input_tokens,
			last_cumulative_cached_input_tokens,
			last_cumulative_output_tokens,
			last_cumulative_total_tokens,
			processed_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(file_path) DO UPDATE SET
			last_position = excluded.last_position,
			last_modified = excluded.last_modified,
			last_cumulative_input_tokens = excluded.last_cumulative_input_tokens,
			last_cumulative_cached_input_tokens = excluded.last_cumulative_cached_input_tokens,
			last_cumulative_output_tokens = excluded.last_cumulative_output_tokens,
			last_cumulative_total_tokens = excluded.last_cumulative_total_tokens,
			processed_at = datetime('now')
	`);

	db.transaction(() => {
		for (const [hourStart, bucket] of params.hourlyBuckets) {
			const total = bucket.input + bucket.cacheCreation + bucket.cacheRead + bucket.output;
			const cost = params.provider === 'claude'
				? calculateCost(bucket.input, bucket.cacheCreation, bucket.cacheRead, bucket.output)
				: 0;

			upsertUsage.run(
				params.project,
				params.agent,
				params.sessionId,
				hourStart,
				bucket.input,
				bucket.cacheCreation,
				bucket.cacheRead,
				bucket.output,
				total,
				cost,
				bucket.count
			);
		}

		const cum = params.stateCumulative ?? { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0 };
		upsertState.run(
			params.filePath,
			params.lastPosition,
			params.currentModified,
			cum.inputTokens,
			cum.cachedInputTokens,
			cum.outputTokens,
			cum.totalTokens
		);
	})();
}

/**
 * Process a single Claude JSONL file incrementally.
 * Returns number of new usage entries processed.
 */
async function processJSONLFile(filePath: string, project: string, sessionId: string): Promise<number> {
	const db = getDatabase();

	// Get last processed state
	const stateRow = db
		.prepare('SELECT last_position, last_modified FROM aggregation_state WHERE file_path = ?')
		.get(filePath) as AggregationStateRow | undefined;

	let lastPosition = stateRow?.last_position ?? 0;
	const lastModified = stateRow?.last_modified ?? 0;

	// Check file modification time
	const fileStat = await stat(filePath);
	const currentModified = fileStat.mtimeMs;

	// Reset state if file was truncated/rotated
	if (fileStat.size < lastPosition) {
		lastPosition = 0;
	}

	// Skip if file hasn't changed since last processing
	if (currentModified <= lastModified && lastPosition > 0) {
		return 0;
	}

	// Get agent for this session
	const agent = getAgentForSession(sessionId);

	// Prepare hourly aggregation buckets
	const hourlyBuckets = new Map<string, BucketAgg>();

	let entriesProcessed = 0;

	await streamJsonlLines(filePath, lastPosition, (line) => {
		if (!line.trim()) return;
		try {
			const entry: ClaudeJSONLEntry = JSON.parse(line);
			if (!entry.message?.usage || !entry.timestamp) return;

			const usage = entry.message.usage;
			const bucketStart = roundToBucket(new Date(entry.timestamp));

			let bucket = hourlyBuckets.get(bucketStart);
			if (!bucket) {
				bucket = { input: 0, cacheCreation: 0, cacheRead: 0, output: 0, count: 0 };
				hourlyBuckets.set(bucketStart, bucket);
			}

			bucket.input += usage.input_tokens || 0;
			bucket.cacheCreation += usage.cache_creation_input_tokens || 0;
			bucket.cacheRead += usage.cache_read_input_tokens || 0;
			bucket.output += usage.output_tokens || 0;
			bucket.count++;
			entriesProcessed++;
		} catch {
			// Skip malformed lines
		}
	});

	upsertBucketsAndState({
		filePath,
		project,
		agent,
		sessionId,
		hourlyBuckets,
		lastPosition: fileStat.size,
		currentModified,
		provider: 'claude'
	});

	return entriesProcessed;
}

/**
 * Process a single Codex session JSONL file incrementally.
 * Returns number of new token_count events processed.
 */
async function processCodexSessionFile(
	filePath: string,
	project: string,
	sessionId: string,
	agent: string | null
): Promise<number> {
	const db = getDatabase();

	const stateRow = db
		.prepare(`
			SELECT
				last_position,
				last_modified,
				last_cumulative_input_tokens,
				last_cumulative_cached_input_tokens,
				last_cumulative_output_tokens,
				last_cumulative_total_tokens
			FROM aggregation_state
			WHERE file_path = ?
		`)
		.get(filePath) as AggregationStateRow | undefined;

	let lastPosition = stateRow?.last_position ?? 0;
	const lastModified = stateRow?.last_modified ?? 0;

	let lastCumInput = stateRow?.last_cumulative_input_tokens ?? 0;
	let lastCumCached = stateRow?.last_cumulative_cached_input_tokens ?? 0;
	let lastCumOutput = stateRow?.last_cumulative_output_tokens ?? 0;
	let lastCumTotal = stateRow?.last_cumulative_total_tokens ?? 0;

	const fileStat = await stat(filePath);
	const currentModified = fileStat.mtimeMs;

	// Reset state if file was truncated/rotated
	if (fileStat.size < lastPosition) {
		lastPosition = 0;
		lastCumInput = 0;
		lastCumCached = 0;
		lastCumOutput = 0;
		lastCumTotal = 0;
	}

	if (currentModified <= lastModified && lastPosition > 0) {
		return 0;
	}

	const hourlyBuckets = new Map<string, BucketAgg>();
	let entriesProcessed = 0;

	await streamJsonlLines(filePath, lastPosition, (line) => {
		if (!line.trim()) return;

		let entry: CodexJSONLEntry;
		try {
			entry = JSON.parse(line) as CodexJSONLEntry;
		} catch {
			return;
		}

		if (!entry.timestamp || entry.type !== 'event_msg') return;
		const payload = entry.payload;
		if (!payload || payload.type !== 'token_count') return;

		const info = payload.info;
		const totalUsage = info?.total_token_usage;
		if (!totalUsage) return;

		const nextInput = Number(totalUsage.input_tokens ?? 0);
		const nextCached = Number(totalUsage.cached_input_tokens ?? 0);
		const nextOutput = Number(totalUsage.output_tokens ?? 0);
		const nextTotal = Number(totalUsage.total_tokens ?? 0);

		// If the session compacts/resets, totals can move backwards. Reset baseline and skip this event.
		if (nextInput < lastCumInput || nextCached < lastCumCached || nextOutput < lastCumOutput || nextTotal < lastCumTotal) {
			lastCumInput = nextInput;
			lastCumCached = nextCached;
			lastCumOutput = nextOutput;
			lastCumTotal = nextTotal;
			return;
		}

		const deltaInput = nextInput - lastCumInput;
		const deltaCached = nextCached - lastCumCached;
		const deltaOutput = nextOutput - lastCumOutput;

		// Total tokens is redundant (Codex reports total as input+output), but keep baseline in sync.
		lastCumInput = nextInput;
		lastCumCached = nextCached;
		lastCumOutput = nextOutput;
		lastCumTotal = nextTotal;

		// Nothing new
		if (deltaInput === 0 && deltaOutput === 0 && deltaCached === 0) {
			return;
		}

		const inputNonCached = Math.max(0, deltaInput - deltaCached);
		const cacheRead = Math.max(0, deltaCached);
		const output = Math.max(0, deltaOutput);

		const bucketStart = roundToBucket(new Date(entry.timestamp));
		let bucket = hourlyBuckets.get(bucketStart);
		if (!bucket) {
			bucket = { input: 0, cacheCreation: 0, cacheRead: 0, output: 0, count: 0 };
			hourlyBuckets.set(bucketStart, bucket);
		}

		bucket.input += inputNonCached;
		bucket.cacheRead += cacheRead;
		bucket.output += output;
		bucket.count++;
		entriesProcessed++;
	});

	upsertBucketsAndState({
		filePath,
		project,
		agent,
		sessionId,
		hourlyBuckets,
		lastPosition: fileStat.size,
		currentModified,
		provider: 'codex',
		stateCumulative: {
			inputTokens: lastCumInput,
			cachedInputTokens: lastCumCached,
			outputTokens: lastCumOutput,
			totalTokens: lastCumTotal
		}
	});

	return entriesProcessed;
}

// ============================================================================
// Aggregation Job
// ============================================================================

async function discoverProjectPathsForAggregation(homeDir: string): Promise<string[]> {
	const paths = new Set<string>();

	// 1) Configured JAT projects
	try {
		const configPath = path.join(homeDir, '.config', 'jat', 'projects.json');
		if (existsSync(configPath)) {
			const raw = await readFile(configPath, 'utf-8');
			const parsed = JSON.parse(raw) as { projects?: Record<string, { path?: string }> };
			for (const value of Object.values(parsed.projects ?? {})) {
				if (value?.path) {
					const expanded = value.path.replace(/^~(?=\/)/, homeDir);
					paths.add(normalizePath(expanded));
				}
			}
		}
	} catch {
		// ignore
	}

	// 2) ~/code/* projects
	try {
		const codeDir = path.join(homeDir, 'code');
		const codeDirs = await readdir(codeDir, { withFileTypes: true });
		for (const d of codeDirs) {
			if (d.isDirectory()) {
				paths.add(normalizePath(path.join(codeDir, d.name)));
			}
		}
	} catch {
		// ignore
	}

	// 3) Current working directory (IDE typically runs from <repo>/ide)
	try {
		const cwd = process.cwd();
		const guessedRoot = cwd.endsWith(`${path.sep}ide`) ? path.resolve(cwd, '..') : cwd;
		paths.add(normalizePath(guessedRoot));
	} catch {
		// ignore
	}

	return Array.from(paths);
}

/**
 * Run the full aggregation job
 * Scans all provider session logs and updates the SQLite database
 */
export async function runAggregation(): Promise<{
	filesProcessed: number;
	entriesProcessed: number;
	durationMs: number;
}> {
	const startTime = Date.now();
	const homeDir = os.homedir();
	const claudeProjectsDir = path.join(homeDir, '.claude', 'projects');

	let filesProcessed = 0;
	let entriesProcessed = 0;

	try {
		const projectPaths = await discoverProjectPathsForAggregation(homeDir);

		// Update session-agent mapping first (Claude file-based mapping)
		await updateSessionAgentMap(projectPaths);

		// ---------------------------------------------------------------------
		// Claude Code usage ingestion
		// ---------------------------------------------------------------------
		try {
			const projectDirs = await readdir(claudeProjectsDir, { withFileTypes: true });

			for (const dir of projectDirs) {
				if (!dir.isDirectory()) continue;

				const projectSlug = dir.name;
				// Extract project name from slug (e.g., "-home-jw-code-jat" -> "jat")
				const projectName = projectSlug.split('-').pop() || projectSlug;
				const projectDir = path.join(claudeProjectsDir, projectSlug);

				try {
					const files = await readdir(projectDir);
					const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

					for (const file of jsonlFiles) {
						const sessionId = file.replace('.jsonl', '');
						const filePath = path.join(projectDir, file);

						try {
							const count = await processJSONLFile(filePath, projectName, sessionId);
							if (count > 0) {
								filesProcessed++;
								entriesProcessed += count;
							}
						} catch (err) {
							console.error(`[Token Aggregation] Error processing Claude file ${filePath}:`, err);
						}
					}
				} catch {
					// Project directory unreadable, skip
				}
			}
		} catch {
			// No Claude directory, skip
		}

		// ---------------------------------------------------------------------
		// Codex / codex-native usage ingestion
		// ---------------------------------------------------------------------
		try {
			const cutoffMillis = Date.now() - CODEX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
			const normalizedProjects = new Set((await discoverProjectPathsForAggregation(homeDir)).map(normalizePath));

			let entries: NonNullable<CodexSessionIndex['entries']> = [];
			if (existsSync(CODEX_SESSION_INDEX_FILE)) {
				try {
					const raw = await readFile(CODEX_SESSION_INDEX_FILE, 'utf-8');
					const index = JSON.parse(raw) as CodexSessionIndex;
					entries = Array.isArray(index.entries) ? index.entries : [];
				} catch {
					entries = [];
				}
			} else {
				// No index cache available; fall back to scanning ~/.codex/sessions directly (only JAT-marked sessions).
				entries = await scanCodexSessionEntriesFallback({ cutoffMillis, normalizedProjects });
			}

			const candidates = entries
				.filter((e) => typeof e.path === 'string' && e.path.endsWith('.jsonl'))
				.filter((e) => typeof e.modified_millis === 'number' && e.modified_millis >= cutoffMillis)
				.filter((e) => Array.isArray(e.cwds) && e.cwds.some((cwd) => normalizedProjects.has(normalizePath(cwd))));

			for (const entry of candidates) {
				const filePath = entry.path as string;

				const codexSessionId = extractCodexSessionIdFromPath(filePath);
				if (!codexSessionId) continue;
				const sessionKey = `codex:${codexSessionId}`;

				let mapping = getSessionMapping(sessionKey);
				let projectName: string | null = mapping?.project ?? null;
				let agentName: string | null = mapping?.agent ?? null;

				if (!projectName || !agentName) {
					// Try to discover markers from the session file prefix (stable across runs)
					const prefix = await readFilePrefix(filePath, 1024 * 1024);
					const markers = prefix ? parseJatMarkers(prefix) : {};
					if (!projectName && markers.projectPath) {
						projectName = path.basename(markers.projectPath);
					}
					if (!agentName && markers.agentName) {
						agentName = markers.agentName;
					}

					if (agentName && projectName) {
						upsertSessionAgentMap(sessionKey, agentName, projectName);
						mapping = { agent: agentName, project: projectName };
					}
				}

				if (!projectName) {
					// Fallback: infer project from matching cwd
					const matchCwd = entry.cwds?.find((cwd) => normalizedProjects.has(normalizePath(cwd)));
					if (matchCwd) {
						projectName = path.basename(matchCwd);
					}
				}

				if (!projectName) {
					continue;
				}

				try {
					const count = await processCodexSessionFile(filePath, projectName, sessionKey, agentName);
					if (count > 0) {
						filesProcessed++;
						entriesProcessed += count;
					}
				} catch (err) {
					console.error(`[Token Aggregation] Error processing Codex file ${filePath}:`, err);
				}
			}
		} catch (err) {
			console.error('[Token Aggregation] Error during Codex aggregation:', err);
		}
	} catch (err) {
		console.error('[Token Aggregation] Error during aggregation:', err);
	}

	return {
		filesProcessed,
		entriesProcessed,
		durationMs: Date.now() - startTime
	};
}

// ============================================================================
// Query Functions (Fast!)
// ============================================================================

/**
 * Get aggregated usage for a time range
 */
export function getUsageForRange(
	startTime: Date,
	endTime: Date,
	options?: {
		project?: string;
		agent?: string;
	}
): AggregatedUsage {
	const db = getDatabase();

	let sql = `
		SELECT
			COALESCE(SUM(total_tokens), 0) as total_tokens,
			COALESCE(SUM(input_tokens), 0) as input_tokens,
			COALESCE(SUM(cache_creation_tokens), 0) as cache_creation_tokens,
			COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
			COALESCE(SUM(output_tokens), 0) as output_tokens,
			COALESCE(SUM(cost_usd), 0) as cost_usd,
			COUNT(DISTINCT session_id) as session_count
		FROM token_usage_hourly
		WHERE hour_start >= ? AND hour_start < ?
	`;

	const params: (string | number)[] = [startTime.toISOString(), endTime.toISOString()];

	if (options?.project) {
		sql += ' AND project = ?';
		params.push(options.project);
	}

	if (options?.agent) {
		sql += ' AND agent = ?';
		params.push(options.agent);
	}

	const row = db.prepare(sql).get(...params) as AggregatedUsage;
	return row;
}

/**
 * Get time-bucketed breakdown for sparklines.
 * Data is stored in 30-minute buckets by default.
 * Use bucketMinutes to aggregate into larger buckets (e.g., 60 for hourly).
 */
export function getHourlyBreakdown(
	startTime: Date,
	endTime: Date,
	options?: {
		project?: string;
		agent?: string;
		bucketMinutes?: number; // 30 for 30-min buckets (native), 60 for hourly aggregation
	}
): Array<{
	timestamp: string;
	total_tokens: number;
	cost_usd: number;
}> {
	const db = getDatabase();
	const bucketMinutes = options?.bucketMinutes ?? DEFAULT_BUCKET_MINUTES;

	let groupExpression: string;
	let selectExpression: string;

	if (bucketMinutes === 30 || bucketMinutes === DEFAULT_BUCKET_MINUTES) {
		groupExpression = 'hour_start';
		selectExpression = 'hour_start';
	} else if (bucketMinutes === 60) {
		groupExpression = "strftime('%Y-%m-%dT%H:00:00.000Z', hour_start)";
		selectExpression = groupExpression;
	} else {
		groupExpression = 'hour_start';
		selectExpression = 'hour_start';
	}

	let sql = `
		SELECT
			${selectExpression} as timestamp,
			COALESCE(SUM(total_tokens), 0) as total_tokens,
			COALESCE(SUM(cost_usd), 0) as cost_usd
		FROM token_usage_hourly
		WHERE hour_start >= ? AND hour_start < ?
	`;

	const params: (string | number)[] = [startTime.toISOString(), endTime.toISOString()];

	if (options?.project) {
		sql += ' AND project = ?';
		params.push(options.project);
	}

	if (options?.agent) {
		sql += ' AND agent = ?';
		params.push(options.agent);
	}

	sql += ` GROUP BY ${groupExpression} ORDER BY timestamp`;

	return db.prepare(sql).all(...params) as Array<{
		timestamp: string;
		total_tokens: number;
		cost_usd: number;
	}>;
}

/**
 * Get usage by project for multi-project sparklines
 */
export function getUsageByProject(
	startTime: Date,
	endTime: Date
): Array<{
	project: string;
	timestamp: string;
	total_tokens: number;
	cost_usd: number;
}> {
	const db = getDatabase();

	const sql = `
		SELECT
			project,
			hour_start as timestamp,
			COALESCE(SUM(total_tokens), 0) as total_tokens,
			COALESCE(SUM(cost_usd), 0) as cost_usd
		FROM token_usage_hourly
		WHERE hour_start >= ? AND hour_start < ?
		GROUP BY project, hour_start
		ORDER BY timestamp, project
	`;

	return db.prepare(sql).all(startTime.toISOString(), endTime.toISOString()) as Array<{
		project: string;
		timestamp: string;
		total_tokens: number;
		cost_usd: number;
	}>;
}

/**
 * Get usage by agent
 */
export function getUsageByAgent(
	startTime: Date,
	endTime: Date,
	options?: { project?: string }
): Array<{
	agent: string | null;
	total_tokens: number;
	cost_usd: number;
	session_count: number;
}> {
	const db = getDatabase();

	let sql = `
		SELECT
			agent,
			COALESCE(SUM(total_tokens), 0) as total_tokens,
			COALESCE(SUM(cost_usd), 0) as cost_usd,
			COUNT(DISTINCT session_id) as session_count
		FROM token_usage_hourly
		WHERE hour_start >= ? AND hour_start < ?
	`;

	const params: (string | number)[] = [startTime.toISOString(), endTime.toISOString()];

	if (options?.project) {
		sql += ' AND project = ?';
		params.push(options.project);
	}

	sql += ' GROUP BY agent ORDER BY total_tokens DESC';

	return db.prepare(sql).all(...params) as Array<{
		agent: string | null;
		total_tokens: number;
		cost_usd: number;
		session_count: number;
	}>;
}

/**
 * Get "today" usage (convenience function)
 */
export function getTodayUsage(options?: { project?: string; agent?: string }): AggregatedUsage {
	const now = new Date();
	const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

	return getUsageForRange(startOfDay, endOfDay, options);
}

/**
 * Get "this week" usage (convenience function)
 */
export function getWeekUsage(options?: { project?: string; agent?: string }): AggregatedUsage {
	const now = new Date();
	const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	return getUsageForRange(startOfWeek, now, options);
}

/**
 * Get last 24 hours breakdown for sparklines.
 * Returns 48 data points (30-minute buckets) by default, or 24 points if bucketMinutes=60.
 */
export function getLast24HoursHourly(options?: {
	project?: string;
	agent?: string;
	bucketMinutes?: number;
}): Array<{
	timestamp: string;
	total_tokens: number;
	cost_usd: number;
}> {
	const now = new Date();
	const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

	return getHourlyBreakdown(start24h, now, options);
}

// ============================================================================
// Database Stats
// ============================================================================

/**
 * Get database statistics
 */
export function getDatabaseStats(): {
	totalRows: number;
	uniqueSessions: number;
	uniqueAgents: number;
	uniqueProjects: number;
	oldestEntry: string | null;
	newestEntry: string | null;
} {
	const db = getDatabase();

	const stats = db.prepare(`
		SELECT
			COUNT(*) as totalRows,
			COUNT(DISTINCT session_id) as uniqueSessions,
			COUNT(DISTINCT agent) as uniqueAgents,
			COUNT(DISTINCT project) as uniqueProjects,
			MIN(hour_start) as oldestEntry,
			MAX(hour_start) as newestEntry
		FROM token_usage_hourly
	`).get() as {
		totalRows: number;
		uniqueSessions: number;
		uniqueAgents: number;
		uniqueProjects: number;
		oldestEntry: string | null;
		newestEntry: string | null;
	};

	return stats;
}
