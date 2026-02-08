/**
 * Auto-Assignment Queue API Endpoint
 *
 * GET /api/tasks/queue → Returns ready tasks for auto-assignment queue
 *
 * Query Parameters:
 * - limit: Maximum number of tasks to return (default: 5)
 * - sort: Sort policy (hybrid, priority, oldest) (default: hybrid)
 * - project: Filter by project name
 *
 * Response includes:
 * - queue: Array of ready tasks (no blockers, open or in-progress)
 * - stats: Queue statistics (count by priority, total)
 * - timestamp: Response timestamp
 */

import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * @typedef {{ id: string, title: string, description?: string, status: string, priority: number, issue_type?: string, assignee?: string }} Task
 */

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	try {
		const parsedLimit = parseInt(url.searchParams.get('limit') || '5', 10);
		const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 5;
		const sortParam = url.searchParams.get('sort') || 'hybrid';
		const project = url.searchParams.get('project');

		// Validate sort parameter - only allow valid values
		const validSorts = ['hybrid', 'priority', 'oldest'];
		const sort = validSorts.includes(sortParam) ? sortParam : 'hybrid';

		// Execute bd ready to get queue
		const result = await execFileAsync('bd', [
			'ready',
			'--json',
			'--limit',
			String(limit),
			'--sort',
			sort
		]);
		const stdout = typeof result === 'string' ? result : result.stdout;
		/** @type {Task[]} */
		const tasks = JSON.parse(stdout);

		// Filter by project if specified
		/** @type {Task[]} */
		let filteredTasks = tasks;
		if (project && project !== 'All Projects') {
			filteredTasks = tasks.filter((t) => t.id.startsWith(`${project}-`));
		}

		// Calculate queue stats
		const stats = {
			total: filteredTasks.length,
			by_priority: {
				p0: filteredTasks.filter((t) => t.priority === 0).length,
				p1: filteredTasks.filter((t) => t.priority === 1).length,
				p2: filteredTasks.filter((t) => t.priority === 2).length,
				p3: filteredTasks.filter((t) => t.priority === 3).length
			}
		};

		return json({
			queue: filteredTasks,
			stats,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error fetching queue:', error);
		return json(
			{
				error: 'Failed to fetch queue',
				message: error instanceof Error ? error.message : String(error),
				queue: [],
				stats: { total: 0, by_priority: { p0: 0, p1: 0, p2: 0, p3: 0 } },
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
}
