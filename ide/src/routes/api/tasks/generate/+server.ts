/**
 * AI Task Generator API
 * POST /api/tasks/generate
 *
 * Takes a natural language feature description and generates a structured
 * task breakdown. Returns ParsedTask[] for preview before bulk creation.
 *
 * Uses centralized llmService (auto-fallback: API key → Claude CLI subscription).
 */
import { json } from '@sveltejs/kit';
import { llmCall, parseJsonResponse } from '$lib/server/llmService';
import type { RequestHandler } from './$types';

interface GenerateRequest {
	description: string;
	project?: string;
	projectDescription?: string;
	openTasks?: { id: string; title: string; priority?: number; issue_type?: string }[];
	options?: {
		maxTasks?: number;
		includeEpic?: boolean;
		includeDeps?: boolean;
	};
}

interface GeneratedTask {
	title: string;
	type: string;
	priority: number;
	labels: string[];
	description: string;
	deps?: string[];
}

const VALID_TYPES = ['task', 'bug', 'feature', 'epic', 'chore'];

function buildPrompt(req: GenerateRequest): string {
	const maxTasks = req.options?.maxTasks || 10;
	const includeEpic = req.options?.includeEpic !== false;
	const includeDeps = req.options?.includeDeps !== false;

	const taskList = (req.openTasks || [])
		.slice(0, 20)
		.map((t) => `- ${t.id}: ${t.title} (P${t.priority ?? '?'}, ${t.issue_type ?? '?'})`)
		.join('\n');

	const projectSection = req.projectDescription
		? `PROJECT: ${req.project || 'unknown'}\nDescription: ${req.projectDescription}`
		: req.project
			? `PROJECT: ${req.project}`
			: '';

	return `You are a senior software architect. Break down this feature description into concrete, actionable development tasks.

FEATURE DESCRIPTION:
${req.description}

${projectSection}

${taskList ? `EXISTING OPEN TASKS (avoid duplicates):\n${taskList}` : ''}

Generate up to ${maxTasks} tasks as a JSON array. Each task object must have:
- "title": Clear, actionable task title (imperative form, e.g., "Add rate limiting to API endpoints")
- "type": One of: task, bug, feature, chore
- "priority": Number 0-4 (0=critical, 1=high, 2=medium, 3=low, 4=backlog)
- "labels": Array of 1-3 relevant tags (e.g., ["backend", "api"])
- "description": 1-2 sentence description of what needs to be done${includeDeps ? '\n- "deps": Array of other task titles from THIS list that must complete first (use exact title strings, not IDs). Omit if no dependencies.' : ''}

${includeEpic ? 'If the feature is large enough, the FIRST task should be an epic (type: "epic") that summarizes the whole feature. The remaining tasks are the implementation work.' : 'Do NOT include epics. Only concrete implementation tasks.'}

Guidelines:
- Order tasks by implementation sequence (foundation first, features second, polish last)
- Each task should be completable in a single work session
- Use specific, technical language — avoid vague titles like "Set up project"
- Priority 1 for core work, 2 for nice-to-haves, 3 for polish

Respond with ONLY the JSON array, no other text.`;
}

function sanitizeTasks(raw: unknown[]): GeneratedTask[] {
	return raw
		.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
		.map((item) => {
			const type = String(item.type || 'task').toLowerCase();
			const priority = Number(item.priority);

			return {
				title: String(item.title || '').trim(),
				type: VALID_TYPES.includes(type) ? type : 'task',
				priority: !isNaN(priority) && priority >= 0 && priority <= 4 ? priority : 2,
				labels: Array.isArray(item.labels)
					? (item.labels as unknown[])
							.filter((l): l is string => typeof l === 'string')
							.map((l) => l.trim())
							.filter(Boolean)
							.slice(0, 5)
					: [],
				description: String(item.description || '').trim(),
				deps: Array.isArray(item.deps)
					? (item.deps as unknown[])
							.filter((d): d is string => typeof d === 'string')
							.map((d) => d.trim())
							.filter(Boolean)
					: undefined,
			};
		})
		.filter((t) => t.title.length > 0);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as GenerateRequest;

		if (!body.description || typeof body.description !== 'string' || body.description.trim().length < 10) {
			return json(
				{ error: true, message: 'Description must be at least 10 characters' },
				{ status: 400 }
			);
		}

		const prompt = buildPrompt(body);

		// Use centralized LLM service (auto-fallback: API → CLI)
		const llmResponse = await llmCall(prompt, { maxTokens: 4096 });

		// Parse JSON response (handles markdown code blocks)
		let parsed: unknown[];
		try {
			const result = parseJsonResponse<unknown>(llmResponse.result);
			parsed = Array.isArray(result) ? result : [result];
		} catch {
			console.error('Failed to parse LLM response:', llmResponse.result);
			return json(
				{ error: true, message: 'Failed to parse AI response', raw: llmResponse.result },
				{ status: 500 }
			);
		}

		const tasks = sanitizeTasks(parsed);

		if (tasks.length === 0) {
			return json(
				{ error: true, message: 'AI did not generate any valid tasks' },
				{ status: 500 }
			);
		}

		return json({
			success: true,
			tasks,
			provider: llmResponse.provider,
			usage: llmResponse.usage,
		});
	} catch (err) {
		const error = err as Error;
		console.error('Error in task generate API:', error);

		return json({ error: true, message: error.message || 'Internal server error' }, { status: 500 });
	}
};
