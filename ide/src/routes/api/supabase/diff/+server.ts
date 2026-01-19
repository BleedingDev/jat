/**
 * GET /api/supabase/diff
 *
 * Returns schema diff between local and remote database.
 * This shows what changes would be needed to make remote match local.
 *
 * Query parameters:
 * - project: Project name (required)
 *
 * Response:
 * - hasDiff: Whether there are differences
 * - diffSql: SQL statements representing the diff
 * - error: Error message if diff failed
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	detectSupabaseConfig,
	getSchemaDiff,
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

export const GET: RequestHandler = async ({ url }) => {
	const projectName = url.searchParams.get('project');

	if (!projectName) {
		return json({ error: 'Missing required parameter: project' }, { status: 400 });
	}

	// Check if CLI is installed
	const cliInstalled = await isSupabaseCliInstalled();
	if (!cliInstalled) {
		return json({
			hasDiff: false,
			diffSql: '',
			error: 'Supabase CLI is not installed'
		}, { status: 503 });
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
			hasDiff: false,
			diffSql: '',
			error: 'Supabase is not initialized in this project'
		}, { status: 400 });
	}

	if (!config.isLinked) {
		return json({
			hasDiff: false,
			diffSql: '',
			error: 'Project is not linked to a remote Supabase project. Run `supabase link` first.'
		}, { status: 400 });
	}

	// Get schema diff
	const diff = await getSchemaDiff(projectPath);

	return json({
		hasDiff: diff.hasDiff,
		diffSql: diff.diffSql,
		error: diff.error,
		projectRef: config.projectRef
	});
};
