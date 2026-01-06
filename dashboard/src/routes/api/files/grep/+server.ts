/**
 * File Content Search API (grep-style)
 * GET /api/files/grep?project=<name>&q=<query>&glob=<pattern>&regex=<bool>&limit=<max>
 *
 * Searches file CONTENTS using ripgrep for fast, indexed search.
 * Returns matching lines with file paths, line numbers, and context.
 *
 * Response: { results: [{ file, line, content, before?, after? }], count, query }
 */

import { json } from '@sveltejs/kit';
import { spawn } from 'child_process';
import { homedir } from 'os';
import type { RequestHandler } from './$types';
import { getProjectPath } from '$lib/server/projectPaths';

interface SearchResult {
	file: string;      // Relative path from project root
	line: number;      // Line number (1-indexed)
	content: string;   // Matching line content
	before?: string[]; // Lines before match (context)
	after?: string[];  // Lines after match (context)
}

// Maximum results to return
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// Context lines before/after match
const DEFAULT_CONTEXT = 2;
const MAX_CONTEXT = 5;

/**
 * Expand ~ to home directory
 */
function expandHome(path: string): string {
	if (path.startsWith('~')) {
		return path.replace(/^~/, homedir());
	}
	return path;
}

/**
 * Run ripgrep and parse results
 */
async function runRipgrep(
	projectPath: string,
	query: string,
	options: {
		glob?: string;
		regex?: boolean;
		limit: number;
		context: number;
		caseSensitive?: boolean;
	}
): Promise<{ results: SearchResult[]; truncated: boolean }> {
	return new Promise((resolve, reject) => {
		const args: string[] = [
			'--json',                    // JSON output for structured parsing
			'--max-count', '1000',       // Limit matches per file
			'--max-filesize', '1M',      // Skip large files
			'--hidden',                  // Include hidden files
			'--no-ignore-vcs',           // Don't respect .gitignore for now
			'-C', String(options.context), // Context lines
		];

		// Case sensitivity
		if (!options.caseSensitive) {
			args.push('-i');
		}

		// Regex vs literal search
		if (!options.regex) {
			args.push('-F'); // Fixed string (literal)
		}

		// File type filter (glob pattern)
		if (options.glob) {
			args.push('-g', options.glob);
		}

		// Skip common large/generated directories
		args.push(
			'-g', '!node_modules/',
			'-g', '!.git/',
			'-g', '!dist/',
			'-g', '!build/',
			'-g', '!.svelte-kit/',
			'-g', '!.next/',
			'-g', '!.nuxt/',
			'-g', '!__pycache__/',
			'-g', '!target/',
			'-g', '!vendor/',
			'-g', '!coverage/'
		);

		// Add the search pattern
		args.push(query);

		// Search in project directory
		args.push(projectPath);

		const rg = spawn('rg', args);
		let stdout = '';
		let stderr = '';

		rg.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		rg.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		rg.on('close', (code) => {
			// Exit code 1 means no matches (not an error)
			// Exit code 2 means error
			if (code === 2) {
				reject(new Error(stderr || 'ripgrep error'));
				return;
			}

			const results: SearchResult[] = [];
			const resultMap = new Map<string, SearchResult>();
			let truncated = false;

			// Parse JSON lines from ripgrep
			const lines = stdout.split('\n').filter(Boolean);

			for (const line of lines) {
				if (results.length >= options.limit) {
					truncated = true;
					break;
				}

				try {
					const json = JSON.parse(line);

					if (json.type === 'match') {
						const data = json.data;
						const relativePath = data.path.text.replace(projectPath + '/', '');

						// Create unique key for deduplication
						const key = `${relativePath}:${data.line_number}`;

						if (!resultMap.has(key)) {
							const result: SearchResult = {
								file: relativePath,
								line: data.line_number,
								content: data.lines.text.replace(/\n$/, ''), // Remove trailing newline
							};

							resultMap.set(key, result);
							results.push(result);
						}
					} else if (json.type === 'context') {
						// Context lines - find the associated match
						const data = json.data;
						const relativePath = data.path.text.replace(projectPath + '/', '');

						// Find nearby match to attach context to
						// This is a simplified approach - ripgrep's JSON output
						// interleaves context with matches
						for (const result of results) {
							if (result.file === relativePath) {
								const lineDiff = data.line_number - result.line;
								if (lineDiff < 0 && Math.abs(lineDiff) <= options.context) {
									// Before context
									if (!result.before) result.before = [];
									result.before.push(data.lines.text.replace(/\n$/, ''));
								} else if (lineDiff > 0 && lineDiff <= options.context) {
									// After context
									if (!result.after) result.after = [];
									result.after.push(data.lines.text.replace(/\n$/, ''));
								}
							}
						}
					}
				} catch {
					// Skip malformed JSON lines
				}
			}

			resolve({ results, truncated });
		});

		rg.on('error', (err) => {
			reject(err);
		});
	});
}

/**
 * GET /api/files/grep
 */
export const GET: RequestHandler = async ({ url }) => {
	try {
		const projectName = url.searchParams.get('project');
		const query = url.searchParams.get('q') || url.searchParams.get('query') || '';
		const glob = url.searchParams.get('glob') || url.searchParams.get('type') || '';
		const regexParam = url.searchParams.get('regex');
		const regex = regexParam === 'true' || regexParam === '1';
		const caseSensitiveParam = url.searchParams.get('case');
		const caseSensitive = caseSensitiveParam === 'true' || caseSensitiveParam === '1';
		const limitParam = parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
		const limit = Math.min(Math.max(1, limitParam), MAX_LIMIT);
		const contextParam = parseInt(url.searchParams.get('context') || String(DEFAULT_CONTEXT), 10);
		const context = Math.min(Math.max(0, contextParam), MAX_CONTEXT);

		if (!projectName) {
			return json({ error: 'Project name is required' }, { status: 400 });
		}

		// Get project path
		const projectInfo = await getProjectPath(projectName);
		if (!projectInfo.exists) {
			return json({ error: `Project '${projectName}' not found` }, { status: 404 });
		}

		const projectPath = expandHome(projectInfo.path);

		// If no query, return empty results
		if (!query.trim()) {
			return json({
				results: [],
				count: 0,
				query: '',
				truncated: false
			});
		}

		// Run ripgrep search
		const { results, truncated } = await runRipgrep(projectPath, query.trim(), {
			glob: glob || undefined,
			regex,
			caseSensitive,
			limit,
			context
		});

		return json({
			results,
			count: results.length,
			query: query.trim(),
			glob: glob || null,
			regex,
			truncated,
			project: projectName
		});
	} catch (error) {
		console.error('[Files Grep API] Error:', error);

		// Check if ripgrep is not installed
		if (error instanceof Error && error.message.includes('ENOENT')) {
			return json(
				{ error: 'ripgrep (rg) is not installed. Please install it to use content search.' },
				{ status: 500 }
			);
		}

		return json(
			{ error: error instanceof Error ? error.message : 'Search failed' },
			{ status: 500 }
		);
	}
};
