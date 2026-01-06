/**
 * Git Commit API Endpoint
 *
 * POST /api/files/git/commit
 * Body: { project: string, message: string }
 * Commit staged changes.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGitForProject, formatGitError } from '$lib/server/git.js';

export const POST: RequestHandler = async ({ request }) => {
	let body: { project?: string; message?: string };

	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { project: projectName, message } = body;

	if (!projectName) {
		throw error(400, 'Missing required parameter: project');
	}

	if (!message || typeof message !== 'string' || message.trim().length === 0) {
		throw error(400, 'Missing required parameter: message');
	}

	const result = await getGitForProject(projectName);
	if ('error' in result) {
		throw error(result.status, result.error);
	}

	const { git, projectPath } = result;

	try {
		// Check if there are staged changes
		const status = await git.status();
		if (status.staged.length === 0) {
			throw error(400, 'Nothing to commit: no staged changes');
		}

		// Commit
		const commitResult = await git.commit(message.trim());

		return json({
			success: true,
			project: projectName,
			projectPath,
			commit: {
				hash: commitResult.commit,
				branch: commitResult.branch,
				summary: {
					changes: commitResult.summary.changes,
					insertions: commitResult.summary.insertions,
					deletions: commitResult.summary.deletions
				}
			}
		});
	} catch (err) {
		// Handle the "nothing to commit" case that might slip through
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		const gitError = formatGitError(err as Error);
		throw error(gitError.status, gitError.error);
	}
};
