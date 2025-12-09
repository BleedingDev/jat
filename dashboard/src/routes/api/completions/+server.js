/**
 * Completion Bundles List API
 *
 * GET /api/completions
 *   Returns all persisted completion bundles
 *   Query params:
 *     ?taskId=xxx - Filter by specific task ID
 *     ?agent=xxx - Filter by agent name
 *
 * DELETE /api/completions
 *   Clears all persisted completion bundles
 */

import { json } from '@sveltejs/kit';
import { getAllCompletionBundles, clearAllCompletionBundles } from '$lib/server/completionBundles.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	const taskIdFilter = url.searchParams.get('taskId');
	const agentFilter = url.searchParams.get('agent');

	const allBundles = getAllCompletionBundles();
	let bundles = Object.values(allBundles);

	// Apply filters
	if (taskIdFilter) {
		bundles = bundles.filter(b => b.taskId === taskIdFilter);
	}

	if (agentFilter) {
		bundles = bundles.filter(b => b.agentName === agentFilter);
	}

	// Sort by completion time (newest first)
	bundles.sort((a, b) => {
		const timeA = new Date(a.completedAt || a.persistedAt || 0).getTime();
		const timeB = new Date(b.completedAt || b.persistedAt || 0).getTime();
		return timeB - timeA;
	});

	return json({
		count: bundles.length,
		bundles,
		filters: {
			taskId: taskIdFilter,
			agent: agentFilter
		}
	});
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE() {
	const result = clearAllCompletionBundles();

	return json({
		success: result.success,
		clearedCount: result.count
	});
}
