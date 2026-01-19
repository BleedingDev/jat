/**
 * Supabase CLI utility functions
 *
 * Provides functions for running Supabase CLI commands and parsing their output.
 * Used by the /api/supabase/* endpoints to interface with the Supabase CLI.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * Supabase project configuration detected from filesystem
 */
export interface SupabaseConfig {
	/** Does supabase/ folder exist? */
	hasSupabase: boolean;
	/** Has `supabase link` been run? (checked via .supabase/ folder) */
	isLinked: boolean;
	/** Path to supabase/ folder */
	supabasePath: string;
	/** Project reference from config.toml (if linked) */
	projectRef?: string;
}

/**
 * Migration status from `supabase migration list`
 */
export interface MigrationStatus {
	/** Migration version (timestamp, e.g., "20241114184005") */
	version: string;
	/** Migration name (e.g., "remote_schema") */
	name: string;
	/** Full filename (e.g., "20241114184005_remote_schema.sql") */
	filename: string;
	/** Exists locally in supabase/migrations/ */
	local: boolean;
	/** Exists in remote schema_migrations table */
	remote: boolean;
	/** Status: 'synced' | 'local-only' | 'remote-only' */
	status: 'synced' | 'local-only' | 'remote-only';
	/** Timestamp if available */
	timestamp?: string;
}

/**
 * Schema diff result from `supabase db diff`
 */
export interface SchemaDiff {
	/** Whether there are differences */
	hasDiff: boolean;
	/** SQL statements representing the diff */
	diffSql: string;
	/** Error message if diff failed */
	error?: string;
}

/**
 * Result of a Supabase CLI command
 */
export interface SupabaseCommandResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

/**
 * Run a Supabase CLI command in the given project directory
 *
 * @param projectPath - Path to the project root
 * @param args - Arguments to pass to supabase CLI
 * @param timeoutMs - Command timeout in milliseconds (default: 60000)
 * @returns Command result with stdout, stderr, and exit code
 */
export async function runSupabaseCommand(
	projectPath: string,
	args: string[],
	timeoutMs: number = 60000
): Promise<SupabaseCommandResult> {
	const home = process.env.HOME || '';
	const supabaseCmd = `${home}/.local/bin/supabase`;
	const command = `${supabaseCmd} ${args.join(' ')}`;

	try {
		const { stdout, stderr } = await execAsync(command, {
			cwd: projectPath,
			timeout: timeoutMs,
			env: {
				...process.env
				// SUPABASE_ACCESS_TOKEN will be picked up from env if set
			}
		});

		return {
			stdout: stdout.trim(),
			stderr: stderr.trim(),
			exitCode: 0
		};
	} catch (error: unknown) {
		const execError = error as { stdout?: string; stderr?: string; code?: number };
		return {
			stdout: execError.stdout?.trim() || '',
			stderr: execError.stderr?.trim() || (error as Error).message,
			exitCode: execError.code || 1
		};
	}
}

/**
 * Detect Supabase configuration for a project
 *
 * @param projectPath - Path to the project root
 * @returns Configuration object describing Supabase state
 */
export async function detectSupabaseConfig(projectPath: string): Promise<SupabaseConfig> {
	const supabasePath = join(projectPath, 'supabase');
	const hasSupabase = existsSync(supabasePath);

	if (!hasSupabase) {
		return {
			hasSupabase: false,
			isLinked: false,
			supabasePath
		};
	}

	// Check if project is linked (has .temp/project-ref file from `supabase link`)
	const projectRefPath = join(supabasePath, '.temp', 'project-ref');
	const configPath = join(supabasePath, 'config.toml');

	// A project is considered "linked" if:
	// 1. supabase/config.toml exists (basic init)
	// 2. supabase/.temp/project-ref exists (from running `supabase link`)
	const hasConfig = existsSync(configPath);

	// Try to get project ref from .temp/project-ref file first (most reliable)
	// This file is created by `supabase link` and persists even when local DB isn't running
	let projectRef: string | undefined;
	let isLinked = false;

	if (hasConfig) {
		// Check for .temp/project-ref file (created by `supabase link`)
		if (existsSync(projectRefPath)) {
			try {
				const ref = readFileSync(projectRefPath, 'utf-8').trim();
				if (ref && ref.length > 0) {
					projectRef = ref;
					isLinked = true;
				}
			} catch {
				// Fall through to supabase status check
			}
		}

		// If no project-ref file, try supabase status as fallback
		// (This requires local DB to be running, so it's less reliable)
		if (!isLinked) {
			try {
				const result = await runSupabaseCommand(projectPath, ['status'], 10000);
				if (result.exitCode === 0) {
					// Parse project ref from status output
					const projectRefMatch = result.stdout.match(/Project ref:\s+(\S+)/i);
					if (projectRefMatch) {
						projectRef = projectRefMatch[1];
						isLinked = true;
					}
				}
			} catch {
				// Ignore errors - just means not linked
			}
		}
	}

	return {
		hasSupabase: true,
		isLinked,
		supabasePath,
		projectRef
	};
}

/**
 * Get migration list from Supabase CLI
 *
 * @param projectPath - Path to the project root
 * @returns Array of migration status objects
 */
export async function getMigrationList(projectPath: string): Promise<MigrationStatus[]> {
	const result = await runSupabaseCommand(projectPath, ['migration', 'list'], 30000);

	if (result.exitCode !== 0) {
		// Check if it's just not linked
		if (result.stderr.includes('not linked') || result.stderr.includes('no linked project')) {
			return [];
		}
		throw new Error(`Failed to list migrations: ${result.stderr}`);
	}

	// Parse the table output from `supabase migration list`
	// Format:
	// Local          | Remote         | Time (UTC)
	// ----------------|----------------|---------------------
	// 20241114184005 | 20241114184005 | 2024-11-14 18:40:05
	// 20250108       |                | 2025-01-08 ...

	const migrations: MigrationStatus[] = [];
	const lines = result.stdout.split('\n');

	for (const line of lines) {
		// Skip header and separator lines
		if (line.includes('Local') || line.includes('---') || !line.trim()) {
			continue;
		}

		// Parse the table row
		const parts = line.split('|').map((p) => p.trim());
		if (parts.length < 2) continue;

		const localVersion = parts[0];
		const remoteVersion = parts[1];
		const timestamp = parts[2] || undefined;

		// Determine status
		const hasLocal = !!localVersion;
		const hasRemote = !!remoteVersion;

		let status: 'synced' | 'local-only' | 'remote-only';
		if (hasLocal && hasRemote) {
			status = 'synced';
		} else if (hasLocal) {
			status = 'local-only';
		} else {
			status = 'remote-only';
		}

		const version = localVersion || remoteVersion;
		if (!version) continue;

		migrations.push({
			version,
			name: '', // Will be populated from filename if we read the files
			filename: '', // Will be populated from reading migrations folder
			local: hasLocal,
			remote: hasRemote,
			status,
			timestamp
		});
	}

	return migrations;
}

/**
 * Get schema diff from Supabase CLI
 *
 * @param projectPath - Path to the project root
 * @returns Schema diff result
 */
export async function getSchemaDiff(projectPath: string): Promise<SchemaDiff> {
	const result = await runSupabaseCommand(projectPath, ['db', 'diff'], 60000);

	if (result.exitCode !== 0) {
		return {
			hasDiff: false,
			diffSql: '',
			error: result.stderr
		};
	}

	const diffSql = result.stdout;
	const hasDiff = diffSql.length > 0 && !diffSql.includes('No changes detected');

	return {
		hasDiff,
		diffSql: hasDiff ? diffSql : ''
	};
}

/**
 * Create a new migration file
 *
 * @param projectPath - Path to the project root
 * @param name - Migration name (will be sanitized)
 * @returns Path to the created migration file
 */
export async function createMigration(projectPath: string, name: string): Promise<string> {
	// Sanitize the migration name
	const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

	const result = await runSupabaseCommand(projectPath, ['migration', 'new', safeName], 10000);

	if (result.exitCode !== 0) {
		throw new Error(`Failed to create migration: ${result.stderr}`);
	}

	// Parse the created file path from output
	// Output is typically: "Created new migration: supabase/migrations/20250119123456_name.sql"
	const match = result.stdout.match(/supabase\/migrations\/(\d+_\w+\.sql)/);
	if (match) {
		return join(projectPath, 'supabase', 'migrations', match[1]);
	}

	// If we can't parse, return a reasonable path
	return join(projectPath, 'supabase', 'migrations', `${Date.now()}_${safeName}.sql`);
}

/**
 * Push migrations to remote database
 *
 * @param projectPath - Path to the project root
 * @param dryRun - If true, only show what would be done
 * @returns Result of the push operation
 */
export async function pushMigrations(
	projectPath: string,
	dryRun: boolean = false
): Promise<SupabaseCommandResult> {
	const args = ['db', 'push'];
	if (dryRun) {
		args.push('--dry-run');
	}

	return runSupabaseCommand(projectPath, args, 120000);
}

/**
 * Pull schema from remote database
 *
 * @param projectPath - Path to the project root
 * @returns Result of the pull operation
 */
export async function pullSchema(projectPath: string): Promise<SupabaseCommandResult> {
	return runSupabaseCommand(projectPath, ['db', 'pull'], 120000);
}

/**
 * Get the supabase CLI command (handles PATH issues in dev server)
 */
function getSupabaseCommand(): string {
	const home = process.env.HOME || '';
	// Check common installation paths
	const paths = [
		'supabase', // System PATH
		`${home}/.local/bin/supabase`, // User local bin
		'/usr/local/bin/supabase', // Homebrew default
		`${home}/.npm-global/bin/supabase` // npm global
	];

	// For now, prefer ~/.local/bin since that's where it's installed
	return `${home}/.local/bin/supabase`;
}

/**
 * Check if Supabase CLI is installed and accessible
 *
 * @returns True if CLI is available
 */
export async function isSupabaseCliInstalled(): Promise<boolean> {
	try {
		const supabaseCmd = getSupabaseCommand();
		const { stdout } = await execAsync(`${supabaseCmd} --version`, { timeout: 5000 });
		return stdout.includes('supabase') || /\d+\.\d+\.\d+/.test(stdout);
	} catch {
		return false;
	}
}

/**
 * Get Supabase CLI version
 *
 * @returns Version string or null if not installed
 */
export async function getSupabaseCliVersion(): Promise<string | null> {
	try {
		const supabaseCmd = getSupabaseCommand();
		const { stdout } = await execAsync(`${supabaseCmd} --version`, { timeout: 5000 });
		// Output is typically: "1.123.4" or "Supabase CLI 1.123.4"
		const match = stdout.match(/(\d+\.\d+\.\d+)/);
		return match ? match[1] : null;
	} catch {
		return null;
	}
}
