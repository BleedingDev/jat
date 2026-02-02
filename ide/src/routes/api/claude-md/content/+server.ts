/**
 * API endpoint for reading/writing agent instruction file content.
 *
 * GET /api/claude-md/content?path=<filepath> - Read file content
 * PUT /api/claude-md/content - Write file content (body: { path, content })
 *
 * NOTE: Despite the route name, this endpoint supports both AGENTS.md and
 * CLAUDE.md.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, writeFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

// Security: Only allow reading/writing instruction files in specific locations.
function isAllowedPath(filePath: string): boolean {
	const ideDir = process.cwd();
	const projectRoot = dirname(ideDir);
	const userClaudeDir = join(homedir(), '.claude');
	const userCodexDir = join(homedir(), '.codex');

	const isClaude = filePath.endsWith('CLAUDE.md');
	const isAgents = filePath.endsWith('AGENTS.md');

	if (!isClaude && !isAgents) {
		return false;
	}

	// Project-local files are always allowed.
	if (filePath.startsWith(projectRoot)) {
		return true;
	}

	// Claude Code supports a user-level ~/.claude/CLAUDE.md.
	if (isClaude && filePath.startsWith(userClaudeDir)) {
		return true;
	}

	// Codex/Codex-native may optionally support a user-level ~/.codex/AGENTS.md.
	if (isAgents && filePath.startsWith(userCodexDir)) {
		return true;
	}

	return false;
}

export const GET: RequestHandler = async ({ url }) => {
	const filePath = url.searchParams.get('path');

	if (!filePath) {
		return json({ error: 'Missing path parameter' }, { status: 400 });
	}

	if (!isAllowedPath(filePath)) {
		return json({ error: 'Access denied: invalid file path' }, { status: 403 });
	}

	if (!existsSync(filePath)) {
		return json({ error: 'File not found' }, { status: 404 });
	}

	try {
		const content = await readFile(filePath, 'utf-8');
		const stats = await stat(filePath);

		return json({
			path: filePath,
			content,
			lastModified: stats.mtime.toISOString(),
			size: stats.size
		});
	} catch (error) {
		console.error('Error reading instruction file:', error);
		return json({ error: 'Failed to read file' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { path: filePath, content } = body;

		if (!filePath || content === undefined) {
			return json({ error: 'Missing path or content in request body' }, { status: 400 });
		}

		if (!isAllowedPath(filePath)) {
			return json({ error: 'Access denied: invalid file path' }, { status: 403 });
		}

		// Write the file
		await writeFile(filePath, content, 'utf-8');

		// Get updated stats
		const stats = await stat(filePath);

		return json({
			success: true,
			path: filePath,
			lastModified: stats.mtime.toISOString(),
			size: stats.size
		});
	} catch (error) {
		console.error('Error writing instruction file:', error);
		return json({ error: 'Failed to write file' }, { status: 500 });
	}
};
