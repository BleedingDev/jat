/**
 * Git Checkout API Endpoint
 *
 * POST /api/files/git/checkout
 * Body: { project: string, branch: string, create?: boolean }
 * Switch branches or create a new branch.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGitForProject, formatGitError } from '$lib/server/git.js';

export const POST: RequestHandler = async ({ request }) => {
	let body: { project?: string; branch?: string; create?: boolean };

	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const { project: projectName, branch, create = false } = body;

	if (!projectName) {
		throw error(400, 'Missing required parameter: project');
	}

	if (!branch || typeof branch !== 'string' || branch.trim().length === 0) {
		throw error(400, 'Missing required parameter: branch');
	}

	const result = await getGitForProject(projectName);
	if ('error' in result) {
		throw error(result.status, result.error);
	}

	const { git, projectPath } = result;

	try {
		// Check for uncommitted changes that would be overwritten
		const status = await git.status();
		if (!status.isClean()) {
			// Allow checkout if only untracked files
			const hasModified =
				status.modified.length > 0 ||
				status.staged.length > 0 ||
				status.deleted.length > 0 ||
				status.conflicted.length > 0;

			if (hasModified) {
				throw error(
					409,
					'Cannot switch branches: uncommitted changes would be overwritten. Please commit or stash your changes first.'
				);
			}
		}

		// Checkout or create branch
		if (create) {
			await git.checkoutLocalBranch(branch.trim());
		} else {
			await git.checkout(branch.trim());
		}

		// Get updated status
		const newStatus = await git.status();

		return json({
			success: true,
			project: projectName,
			projectPath,
			branch: newStatus.current,
			created: create,
			tracking: newStatus.tracking
		});
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		const gitError = formatGitError(err as Error);
		throw error(gitError.status, gitError.error);
	}
};
