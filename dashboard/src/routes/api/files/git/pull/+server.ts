/**
 * Git Pull API Endpoint
 *
 * POST /api/files/git/pull
 * Body: { project: string, remote?: string, branch?: string }
 * Pull from remote.
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
		// Pull with optional remote and branch
		const pullOptions: string[] = [];
		if (remote) pullOptions.push(remote);
		if (branch) pullOptions.push(branch);

		const pullResult = await git.pull(
			pullOptions[0] || undefined,
			pullOptions[1] || undefined
		);

		return json({
			success: true,
			project: projectName,
			projectPath,
			remote,
			branch: branch || null,
			files: pullResult.files,
			insertions: pullResult.insertions,
			deletions: pullResult.deletions,
			summary: {
				changes: pullResult.summary.changes,
				insertions: pullResult.summary.insertions,
				deletions: pullResult.summary.deletions
			}
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		const gitError = formatGitError(err as Error);
		throw error(gitError.status, gitError.error);
	}
};
