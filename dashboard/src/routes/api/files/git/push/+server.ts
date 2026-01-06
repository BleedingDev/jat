/**
 * Git Push API Endpoint
 *
 * POST /api/files/git/push
 * Body: { project: string, remote?: string, branch?: string }
 * Push to remote.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGitForProject, formatGitError } from '$lib/server/git.js';

export const POST: RequestHandler = async ({ request }) => {
	let body: { project?: string; remote?: string; branch?: string };

	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { project: projectName, remote = 'origin', branch } = body;

	if (!projectName) {
		throw error(400, 'Missing required parameter: project');
	}

	const result = await getGitForProject(projectName);
	if ('error' in result) {
		throw error(result.status, result.error);
	}

	const { git, projectPath } = result;

	try {
		// Get current branch if not specified
		const status = await git.status();
		const pushBranch = branch || status.current;

		if (!pushBranch) {
			throw error(400, 'No branch specified and not on any branch');
		}

		// Push
		const pushResult = await git.push(remote, pushBranch);

		return json({
			success: true,
			project: projectName,
			projectPath,
			remote,
			branch: pushBranch,
			pushed: pushResult.pushed,
			update: pushResult.update
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		const gitError = formatGitError(err as Error);
		throw error(gitError.status, gitError.error);
	}
};
