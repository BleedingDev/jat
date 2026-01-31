/**
 * Task Parse API
 * POST /api/tasks/parse
 *
 * Server-side parsing for CLI consumers and external tools.
 * Accepts raw text in any supported format and returns parsed tasks.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseTasks, type TaskDefaults } from '$lib/utils/taskParser';

interface ParseRequest {
	text: string;
	format?: 'auto' | 'yaml' | 'json' | 'markdown' | 'plain';
	defaults?: Partial<TaskDefaults>;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as ParseRequest;

		if (!body.text || typeof body.text !== 'string') {
			return json(
				{
					format: 'unknown',
					tasks: [],
					warnings: [],
					errors: ['Request must include a "text" string field'],
				},
				{ status: 400 }
			);
		}

		// Limit input size to prevent abuse (1MB)
		if (body.text.length > 1_000_000) {
			return json(
				{
					format: 'unknown',
					tasks: [],
					warnings: [],
					errors: ['Input text too large. Maximum is 1MB.'],
				},
				{ status: 400 }
			);
		}

		const result = parseTasks(body.text, {
			format: body.format || 'auto',
			defaults: body.defaults,
		});

		return json(result, { status: 200 });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Internal server error';
		return json(
			{
				format: 'unknown',
				tasks: [],
				warnings: [],
				errors: [message],
			},
			{ status: 500 }
		);
	}
};
