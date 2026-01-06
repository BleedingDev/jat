/**
 * Git Operations Helper
 *
 * Provides a shared simple-git instance configured for a project path.
 * Used by all git API endpoints.
 */
import simpleGit from 'simple-git';
import { getProjectPath } from './projectPaths.js';
import { existsSync } from 'fs';
import { homedir } from 'os';

/**
 * Expand ~ to home directory
 * @param {string} path
 * @returns {string}
 */
function expandHome(path) {
	if (path.startsWith('~')) {
		return path.replace(/^~/, homedir());
	}
	return path;
}

/**
 * Get a simple-git instance for a project
 * @param {string} projectName - Project name
 * @returns {Promise<{git: import('simple-git').SimpleGit, projectPath: string} | {error: string, status: number}>}
 */
export async function getGitForProject(projectName) {
	if (!projectName) {
		return { error: 'Missing required parameter: project', status: 400 };
	}

	const projectInfo = await getProjectPath(projectName);
	if (!projectInfo.exists) {
		return { error: `Project not found: ${projectName}`, status: 404 };
	}

	const projectPath = expandHome(projectInfo.path);

	// Check if it's a git repository
	const gitDir = `${projectPath}/.git`;
	if (!existsSync(gitDir)) {
		return { error: `Project is not a git repository: ${projectName}`, status: 400 };
	}

	const git = simpleGit(projectPath);
	return { git, projectPath };
}

/**
 * Format git error for API response
 * @param {Error} err
 * @returns {{error: string, status: number}}
 */
export function formatGitError(err) {
	const message = err.message || 'Git operation failed';

	// Common git error patterns
	if (message.includes('not a git repository')) {
		return { error: 'Not a git repository', status: 400 };
	}
	if (message.includes('Permission denied')) {
		return { error: 'Permission denied', status: 403 };
	}
	if (message.includes('Could not resolve host') || message.includes('Could not read from remote')) {
		return { error: 'Cannot connect to remote repository', status: 502 };
	}
	if (message.includes('Authentication failed')) {
		return { error: 'Authentication failed', status: 401 };
	}
	if (message.includes('nothing to commit')) {
		return { error: 'Nothing to commit', status: 400 };
	}
	if (message.includes('conflict')) {
		return { error: 'Merge conflict detected', status: 409 };
	}

	return { error: message, status: 500 };
}
