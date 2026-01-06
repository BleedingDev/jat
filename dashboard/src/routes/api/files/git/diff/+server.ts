/**
 * Git Diff API Endpoint
 *
 * GET /api/files/git/diff?project=<name>&path=<file>
 * Returns diff for a specific file or all changes if no path specified.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGitForProject, formatGitError } from '$lib/server/git.js';

export const GET: RequestHandler = async ({ url }) => {
	const projectName = url.searchParams.get('project');
	const filePath = url.searchParams.get('path');
	const staged = url.searchParams.get('staged') === 'true';

	const result = await getGitForProject(projectName);
	if ('error' in result) {
		throw error(result.status, result.error);
	}

	const { git, projectPath } = result;

	try {
		let diff: string;

		if (staged) {
			// Staged changes (--cached)
			diff = filePath ? await git.diff(['--cached', '--', filePath]) : await git.diff(['--cached']);
		} else {
			// Unstaged changes
			diff = filePath ? await git.diff(['--', filePath]) : await git.diff();
		}

		// Parse diff into structured format
		const files = parseDiff(diff);

		return json({
			project: projectName,
			projectPath,
			path: filePath || null,
			staged,
			raw: diff,
			files
		});
	} catch (err) {
		const gitError = formatGitError(err as Error);
		throw error(gitError.status, gitError.error);
	}
};

interface DiffFile {
	path: string;
	additions: number;
	deletions: number;
	chunks: DiffChunk[];
}

interface DiffChunk {
	header: string;
	changes: DiffChange[];
}

interface DiffChange {
	type: 'add' | 'delete' | 'normal';
	line: string;
	lineNumber?: number;
}

/**
 * Parse git diff output into structured format
 */
function parseDiff(diff: string): DiffFile[] {
	if (!diff.trim()) {
		return [];
	}

	const files: DiffFile[] = [];
	const fileDiffs = diff.split(/^diff --git /m).filter(Boolean);

	for (const fileDiff of fileDiffs) {
		const lines = fileDiff.split('\n');

		// Extract file path from first line (a/path b/path)
		const firstLine = lines[0];
		const pathMatch = firstLine.match(/a\/(.+?) b\//);
		const path = pathMatch ? pathMatch[1] : 'unknown';

		let additions = 0;
		let deletions = 0;
		const chunks: DiffChunk[] = [];
		let currentChunk: DiffChunk | null = null;

		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];

			// Chunk header
			if (line.startsWith('@@')) {
				if (currentChunk) {
					chunks.push(currentChunk);
				}
				currentChunk = {
					header: line,
					changes: []
				};
				continue;
			}

			// Skip diff metadata lines
			if (
				line.startsWith('index ') ||
				line.startsWith('---') ||
				line.startsWith('+++') ||
				line.startsWith('new file') ||
				line.startsWith('deleted file')
			) {
				continue;
			}

			// Parse changes
			if (currentChunk) {
				if (line.startsWith('+')) {
					currentChunk.changes.push({ type: 'add', line: line.substring(1) });
					additions++;
				} else if (line.startsWith('-')) {
					currentChunk.changes.push({ type: 'delete', line: line.substring(1) });
					deletions++;
				} else if (line.startsWith(' ') || line === '') {
					currentChunk.changes.push({ type: 'normal', line: line.substring(1) || '' });
				}
			}
		}

		if (currentChunk) {
			chunks.push(currentChunk);
		}

		files.push({
			path,
			additions,
			deletions,
			chunks
		});
	}

	return files;
}
