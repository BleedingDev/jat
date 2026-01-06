/**
 * Git Unstage API Endpoint
 *
 * POST /api/files/git/unstage
 * Body: { project: string, paths: string[] }
 * Unstage files from the index.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGitForProject, formatGitError } from '$lib/server/git.js';

export const POST: RequestHandler = async ({ request }) => {
	let body: { project?: string; paths?: string[] };

	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { project: projectName, paths } = body;

	if (!projectName) {
		throw error(400, 'Missing required parameter: project');
	}

	if (!paths || !Array.isArray(paths) || paths.length === 0) {
		throw error(400, 'Missing required parameter: paths (array of file paths)');
	}

	const result = await getGitForProject(projectName);
	if ('error' in result) {
		throw error(result.status, result.error);
	}

	const { git, projectPath } = result;

	try {
		// Reset the specified files from the index
		await git.reset(['HEAD', '--', ...paths]);

		// Get updated status
		const status = await git.status();

		return json({
			success: true,
			project: projectName,
			projectPath,
			unstaged: paths,
			stagedFiles: status.staged
		});
	} catch (err) {
		const gitError = formatGitError(err as Error);
		throw error(gitError.status, gitError.error);
	}
};
