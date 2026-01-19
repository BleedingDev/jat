/**
 * POST /api/supabase/push
 *
 * Pushes local migrations to the remote database.
 *
 * Query parameters:
 * - project: Project name (required)
 * - dryRun: If "true", only show what would be done (optional)
 *
 * Response:
 * - success: Whether push succeeded
 * - output: CLI output
 * - error: Error message if push failed
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	detectSupabaseConfig,
	pushMigrations,
	isSupabaseCliInstalled
} from '$lib/utils/supabase';
import { existsSync } from 'fs';
import { join } from 'path';

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

export const POST: RequestHandler = async ({ url }) => {
	const projectName = url.searchParams.get('project');
	const dryRun = url.searchParams.get('dryRun') === 'true';

	if (!projectName) {
		return json({ error: 'Missing required parameter: project' }, { status: 400 });
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
			error: 'Supabase is not initialized in this project'
		}, { status: 400 });
	}

	if (!config.isLinked) {
		return json({
			error: 'Project is not linked to a remote Supabase project. Run `supabase link` first.'
		}, { status: 400 });
	}

	// Push migrations
	const result = await pushMigrations(projectPath, dryRun);

	if (result.exitCode !== 0) {
		return json({
			success: false,
			output: result.stdout,
			error: result.stderr || 'Push failed',
			dryRun
		}, { status: 500 });
	}

	return json({
		success: true,
		output: result.stdout,
		dryRun,
		projectRef: config.projectRef
	});
};
