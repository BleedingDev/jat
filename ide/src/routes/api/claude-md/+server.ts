/**
 * API endpoint for listing discoverable agent instruction files.
 *
 * GET /api/claude-md - Returns list of instruction files with metadata
 *
 * Discovers files from:
 * - Project root AGENTS.md / CLAUDE.md
 * - ide/AGENTS.md / ide/CLAUDE.md (if present)
 * - User's ~/.claude/CLAUDE.md (Claude Code)
 * - User's ~/.codex/AGENTS.md (Codex/Codex-native, optional)
 * - Other project subdirectories with AGENTS.md / CLAUDE.md (1 level deep)
 *
 * NOTE: Despite the route name, this endpoint is agent-agnostic and includes
 * both AGENTS.md and CLAUDE.md.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { stat } from 'fs/promises';
import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

interface InstructionFile {
	path: string;
	displayName: string;
	kind: 'agents' | 'claude';
	location: 'project' | 'ide' | 'user' | 'subdirectory';
	lastModified: string;
	size: number;
}

async function getFileMetadata(filePath: string): Promise<{ lastModified: string; size: number } | null> {
	try {
		const stats = await stat(filePath);
		return {
			lastModified: stats.mtime.toISOString(),
			size: stats.size
		};
	} catch {
		return null;
	}
}

async function addFile(
	files: InstructionFile[],
	filePath: string,
	displayName: string,
	kind: InstructionFile['kind'],
	location: InstructionFile['location']
) {
	if (!existsSync(filePath)) return;
	const metadata = await getFileMetadata(filePath);
	if (!metadata) return;
	files.push({
		path: filePath,
		displayName,
		kind,
		location,
		...metadata
	});
}

export const GET: RequestHandler = async () => {
	try {
		// Get project root (ide parent directory)
		const ideDir = process.cwd();
		const projectRoot = dirname(ideDir);
		const userClaudeDir = join(homedir(), '.claude');
		const userCodexDir = join(homedir(), '.codex');

		const files: InstructionFile[] = [];

		// 1) Project root instruction files
		await addFile(files, join(projectRoot, 'AGENTS.md'), 'Project AGENTS.md', 'agents', 'project');
		await addFile(files, join(projectRoot, 'CLAUDE.md'), 'Project CLAUDE.md', 'claude', 'project');

		// 2) IDE instruction files (rare, but useful for monorepos)
		await addFile(files, join(ideDir, 'AGENTS.md'), 'IDE AGENTS.md', 'agents', 'ide');
		await addFile(files, join(ideDir, 'CLAUDE.md'), 'IDE CLAUDE.md', 'claude', 'ide');

		// 3) User/global instruction files
		await addFile(files, join(userClaudeDir, 'CLAUDE.md'), 'User CLAUDE.md', 'claude', 'user');
		await addFile(files, join(userCodexDir, 'AGENTS.md'), 'User AGENTS.md', 'agents', 'user');

		// 4) Scan 1 level deep for subdirectory instruction files
		try {
			const entries = readdirSync(projectRoot, { withFileTypes: true });
			for (const entry of entries) {
				if (
					!entry.isDirectory() ||
					entry.name.startsWith('.') ||
					entry.name === 'node_modules' ||
					entry.name === 'ide'
				) {
					continue;
				}

				await addFile(
					files,
					join(projectRoot, entry.name, 'AGENTS.md'),
					`${entry.name}/AGENTS.md`,
					'agents',
					'subdirectory'
				);
				await addFile(
					files,
					join(projectRoot, entry.name, 'CLAUDE.md'),
					`${entry.name}/CLAUDE.md`,
					'claude',
					'subdirectory'
				);
			}
		} catch (e) {
			console.error('Error scanning subdirectories:', e);
		}

		return json({ files });
	} catch (error) {
		console.error('Error listing instruction files:', error);
		return json({ error: 'Failed to list instruction files' }, { status: 500 });
	}
};
