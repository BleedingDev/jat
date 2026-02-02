/**
 * Generate Commit Message API Endpoint
 *
 * POST /api/files/git/generate-commit-message
 * Generates a commit message based on staged changes.
 *
 * Request body:
 * - project: Project name (required)
 *
 * Response:
 * - message: Generated commit message
 * - reasoning: Brief explanation of the suggested message
 *
 * Uses configuration from /api/config/commit-message:
 * - model: Claude model to use (haiku or sonnet) for Anthropic/Claude fallbacks
 * - style: Message style (conventional, descriptive, imperative, gitmoji)
 * - max_tokens: Maximum response tokens (API only)
 * - include_body: Whether to include detailed body section
 * - subject_max_length: Maximum first line length
 * - custom_instructions: Additional instructions for the AI
 *
 * Uses centralized llmService (Codex-native-first, Claude-compatible).
 *
 * Task: jat-2d600 - Add a 'generate commit message' button in /files
 * Task: jat-i97j2 - Implement Commit Message Generation Configuration Options
 * Task: jat-2af.4 - Make IDE helper LLM provider pluggable (Codex-native-first)
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGitForProject, formatGitError } from '$lib/server/git.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
	COMMIT_MESSAGE_DEFAULTS,
	type CommitMessageStyle,
	type CommitMessageModel
} from '$lib/config/constants';
import { getLlmSchemaPath, llmCall, parseJsonResponse } from '$lib/server/llmService';

const CONFIG_PATH = join(homedir(), '.config', 'jat', 'projects.json');

interface CommitMessageConfig {
	model: CommitMessageModel;
	style: CommitMessageStyle;
	max_tokens: number;
	include_body: boolean;
	subject_max_length: number;
	custom_instructions: string;
}

/**
 * Load commit message config from file
 */
async function loadCommitMessageConfig(): Promise<CommitMessageConfig> {
	try {
		if (!existsSync(CONFIG_PATH)) {
			return { ...COMMIT_MESSAGE_DEFAULTS };
		}
		const content = await readFile(CONFIG_PATH, 'utf-8');
		const config = JSON.parse(content);
		const commitConfig = config.commit_message || {};

		return {
			model: commitConfig.model || COMMIT_MESSAGE_DEFAULTS.model,
			style: commitConfig.style || COMMIT_MESSAGE_DEFAULTS.style,
			max_tokens: commitConfig.max_tokens ?? COMMIT_MESSAGE_DEFAULTS.max_tokens,
			include_body: commitConfig.include_body ?? COMMIT_MESSAGE_DEFAULTS.include_body,
			subject_max_length: commitConfig.subject_max_length ?? COMMIT_MESSAGE_DEFAULTS.subject_max_length,
			custom_instructions: commitConfig.custom_instructions ?? COMMIT_MESSAGE_DEFAULTS.custom_instructions
		};
	} catch (err) {
		console.error('[generate-commit-message] Failed to load config:', err);
		return { ...COMMIT_MESSAGE_DEFAULTS };
	}
}

/**
 * Get style-specific instructions
 */
function getStyleInstructions(style: CommitMessageStyle): string {
	switch (style) {
		case 'conventional':
			return `Use conventional commit format with prefixes:
- feat: for new features
- fix: for bug fixes
- docs: for documentation changes
- refactor: for code refactoring
- test: for adding/updating tests
- chore: for maintenance tasks
- style: for formatting changes
- perf: for performance improvements`;

		case 'descriptive':
			return `Write a clear, descriptive message that explains what the change does.
Do NOT use prefixes like feat:, fix:, etc.
Just describe the change naturally.`;

		case 'imperative':
			return `Use imperative mood for the subject line:
- Start with a verb: Add, Fix, Update, Remove, Refactor, etc.
- Do NOT use prefixes like feat:, fix:, etc.
- Example: "Add user authentication", "Fix login validation bug"`;

		case 'gitmoji':
			return `Use gitmoji (emoji prefixes) for the commit type:
- ✨ :sparkles: for new features
- 🐛 :bug: for bug fixes
- 📝 :memo: for documentation
- ♻️ :recycle: for refactoring
- ✅ :white_check_mark: for tests
- 🔧 :wrench: for configuration
- ⚡ :zap: for performance
Example: "✨ Add user authentication" or ":sparkles: Add user authentication"`;

		default:
			return '';
	}
}

/**
 * Build the prompt to generate a commit message
 */
function buildPrompt(diff: string, stagedFiles: string[], config: CommitMessageConfig): string {
	// Truncate diff if too long (keep first 8000 chars to stay within token limits)
	const truncatedDiff = diff.length > 8000 ? diff.substring(0, 8000) + '\n\n[... diff truncated ...]' : diff;

	const styleInstructions = getStyleInstructions(config.style);

	const bodyInstruction = config.include_body
		? `After a blank line, include a body section that explains WHAT changed and WHY (not HOW).`
		: `Do NOT include a body section. Only generate the subject line.`;

	const customSection = config.custom_instructions
		? `\nADDITIONAL INSTRUCTIONS:\n${config.custom_instructions}`
		: '';

	return `Generate a git commit message for these staged changes.

STAGED FILES:
${stagedFiles.join('\n')}

DIFF:
${truncatedDiff}

STYLE: ${config.style}
${styleInstructions}

FORMAT RULES:
- Subject line (first line): maximum ${config.subject_max_length} characters
- ${bodyInstruction}
- Be specific and concise
${customSection}

IMPORTANT: Return ONLY valid JSON, no other text. Do not include markdown code blocks.

{"message": "<the commit message>", "reasoning": "<brief explanation>"}`;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { project } = body;

		if (!project) {
			throw error(400, 'Project name is required');
		}

		// Load commit message configuration
		const config = await loadCommitMessageConfig();

		// Get git instance for project
		const result = await getGitForProject(project);
		if ('error' in result) {
			throw error(result.status, result.error);
		}

		const { git } = result;

		// Get staged files list
		const status = await git.status();
		const stagedFiles = status.staged || [];

		if (stagedFiles.length === 0) {
			throw error(400, 'No staged changes to generate a commit message for');
		}

		// Get the diff for staged changes
		const diff = await git.diff(['--cached']);

		if (!diff.trim()) {
			throw error(400, 'No diff content available for staged changes');
		}

		// Build prompt with configuration
		const prompt = buildPrompt(diff, stagedFiles, config);
		const schemaPath = getLlmSchemaPath('git-commit-message-schema.json') ?? undefined;

		// For Claude-compatible providers, respect the commit message model setting.
		// codex-native uses the configured codex model (Settings → LLM Provider Settings).
		const cliModel = config.model.includes('haiku') ? 'haiku' : 'sonnet';

		const llmResponse = await llmCall(prompt, {
			maxTokens: config.max_tokens,
			schemaPath,
			apiModel: config.model,
			cliModel
		});

		let suggestion;
		try {
			suggestion = parseJsonResponse<{ message?: string; reasoning?: string }>(llmResponse.result);
		} catch (parseErr) {
			console.error('Failed to parse LLM response:', llmResponse.result);
			// Fall back to using the raw text as the message
			return json({
				success: true,
				message: llmResponse.result.trim(),
				reasoning: 'Could not parse structured response, using raw output'
			});
		}

		return json({
			success: true,
			message: suggestion.message || '',
			reasoning: suggestion.reasoning || '',
			provider: llmResponse.provider,
			usage: llmResponse.usage,
			config: {
				model: config.model,
				style: config.style
			}
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		const gitError = formatGitError(err as Error);
		throw error(gitError.status, gitError.error);
	}
};
