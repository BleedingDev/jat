/**
 * Task Completion Bundle API
 *
 * GET /api/tasks/[id]/completion
 *   Returns the persisted completion bundle for a task
 *
 * DELETE /api/tasks/[id]/completion
 *   Deletes the completion bundle for a task
 */

import { json } from '@sveltejs/kit';
import { getCompletionBundle, deleteCompletionBundle } from '$lib/server/completionBundles.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	const taskId = params.id;

	if (!taskId) {
		return json({ error: 'Missing task ID' }, { status: 400 });
	}

	const bundle = getCompletionBundle(taskId);

	if (!bundle) {
		return json({
			hasBundle: false,
			taskId,
			message: 'No completion bundle found for this task'
		});
	}

	return json({
		hasBundle: true,
		taskId,
		bundle
	});
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params }) {
	const taskId = params.id;

	if (!taskId) {
		return json({ error: 'Missing task ID' }, { status: 400 });
	}

	const result = deleteCompletionBundle(taskId);

	return json({
		success: result.success,
		taskId,
		existed: result.existed
	});
}
