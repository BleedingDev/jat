/**
 * Git Log API Endpoint
 *
 * GET /api/files/git/log?project=<name>&limit=<n>
 * Returns recent commits (timeline).
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGitForProject, formatGitError } from '$lib/server/git.js';

export const GET: RequestHandler = async ({ url }) => {
	const projectName = url.searchParams.get('project');
	const limitParam = url.searchParams.get('limit');
	const limit = limitParam ? parseInt(limitParam, 10) : 20;

	const result = await getGitForProject(projectName);
	if ('error' in result) {
		throw error(result.status, result.error);
	}

	const { git, projectPath } = result;

	try {
		const log = await git.log({ maxCount: limit });

		return json({
			project: projectName,
			projectPath,
			total: log.total,
			commits: log.all.map((commit) => ({
				hash: commit.hash,
				hashShort: commit.hash.substring(0, 7),
				date: commit.date,
				message: commit.message,
				author_name: commit.author_name,
				author_email: commit.author_email,
				refs: commit.refs
			}))
		});
	} catch (err) {
		const gitError = formatGitError(err as Error);
		throw error(gitError.status, gitError.error);
	}
};
