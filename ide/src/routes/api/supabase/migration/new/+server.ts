/**
 * POST /api/supabase/migration/new
 *
 * Creates a new migration file.
 *
 * Query parameters:
 * - project: Project name (required)
 *
 * Request body:
 * - name: Migration name (required, will be sanitized)
 *
 * Response:
 * - success: Whether creation succeeded
 * - filename: Created migration filename
 * - path: Full path to the migration file
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	detectSupabaseConfig,
	createMigration,
	isSupabaseCliInstalled
} from '$lib/utils/supabase';
import { existsSync } from 'fs';
import { join, basename } from 'path';

/**
 * Get project path from config
 */
function getProjectPath(projectName: string): string | null {
	const configPath = join(process.env.HOME || '~', '.config', 'jat', 'projects.json');

	if (!existsSync(configPath)) {
		const defaultPath = join(process.env.HOME || '~', 'code', projectName);
		return existsSync(defaultPath) ? defaultPath : null;
	}

	try {
		const configContent = require('fs').readFileSync(configPath, 'utf-8');
		const config = JSON.parse(configContent);
		const projectConfig = config.projects?.[projectName];

		if (projectConfig?.path) {
			const resolvedPath = projectConfig.path.replace(/^~/, process.env.HOME || '');
			return existsSync(resolvedPath) ? resolvedPath : null;
		}

		const defaultPath = join(process.env.HOME || '~', 'code', projectName);
		return existsSync(defaultPath) ? defaultPath : null;
	} catch {
		const defaultPath = join(process.env.HOME || '~', 'code', projectName);
		return existsSync(defaultPath) ? defaultPath : null;
	}
}

export const POST: RequestHandler = async ({ url, request }) => {
	const projectName = url.searchParams.get('project');

	if (!projectName) {
		return json({ error: 'Missing required parameter: project' }, { status: 400 });
	}

	// Parse request body
	let body: { name?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const migrationName = body.name?.trim();
	if (!migrationName) {
		return json({ error: 'Missing required field: name' }, { status: 400 });
	}

	// Validate migration name
	if (migrationName.length > 100) {
		return json({ error: 'Migration name is too long (max 100 characters)' }, { status: 400 });
	}

	// Check if CLI is installed
	const cliInstalled = await isSupabaseCliInstalled();
	if (!cliInstalled) {
		return json({ error: 'Supabase CLI is not installed' }, { status: 503 });
	}

	// Get project path
	const projectPath = getProjectPath(projectName);
	if (!projectPath) {
		return json({ error: `Project not found: ${projectName}` }, { status: 404 });
	}

	// Check Supabase configuration
	const config = await detectSupabaseConfig(projectPath);

	if (!config.hasSupabase) {
		return json({
			error: 'Supabase is not initialized in this project. Run `supabase init` first.'
		}, { status: 400 });
	}

	// Create the migration
	try {
		const migrationPath = await createMigration(projectPath, migrationName);

		return json({
			success: true,
			filename: basename(migrationPath),
			path: migrationPath,
			// Return relative path for display
			relativePath: migrationPath.replace(projectPath + '/', '')
		});
	} catch (error) {
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Failed to create migration'
		}, { status: 500 });
	}
};
