/**
 * Epic Children API
 * GET /api/epics/[id]/children
 *
 * Returns all children of an epic with blocking information.
 * This powers the EpicSwarmModal task list.
 */
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

/** Child task with blocking info */
interface EpicChild {
	id: string;
	title: string;
	priority: number;
	status: string;
	issue_type: string;
	assignee?: string;
	isBlocked: boolean;
	blockedBy: string[];
}

interface EpicChildrenResponse {
	epicId: string;
	epicTitle: string;
	children: EpicChild[];
	summary: {
		total: number;
		open: number;
		inProgress: number;
		closed: number;
		blocked: number;
		ready: number;
	};
}

/**
 * GET /api/epics/[id]/children
 * Returns all children of an epic with blocking information
 */
export const GET: RequestHandler = async ({ params }) => {
	const { id: epicId } = params;

	if (!epicId) {
		return json({ error: 'Epic ID is required' }, { status: 400 });
	}

	try {
		// Get the epic details first to verify it exists and is an epic
		const { stdout: epicStdout } = await execAsync(`bd show "${epicId}" --json`);
		const epicData = JSON.parse(epicStdout);

		if (!epicData || epicData.length === 0) {
			return json({ error: `Epic '${epicId}' not found` }, { status: 404 });
		}

		const epic = epicData[0];

		if (epic.issue_type !== 'epic') {
			return json({ error: `Task '${epicId}' is not an epic (type: ${epic.issue_type})` }, { status: 400 });
		}

		// Get children from the epic's dependencies array
		// In Beads, an epic's "dependencies" are actually its children (the tasks that block the epic)
		const childrenFromEpic = epic.dependencies || [];

		if (childrenFromEpic.length === 0) {
			return json({
				epicId,
				epicTitle: epic.title,
				children: [],
				summary: {
					total: 0,
					open: 0,
					inProgress: 0,
					closed: 0,
					blocked: 0,
					ready: 0
				}
			} satisfies EpicChildrenResponse);
		}

		// Build a set of child IDs for quick lookup
		const childIds = new Set(childrenFromEpic.map((c: { id: string }) => c.id));

		// Get full details for each child to find their dependencies
		const children: EpicChild[] = [];

		for (const child of childrenFromEpic) {
			// Get the child's own dependencies to determine blocking status
			let blockedBy: string[] = [];

			try {
				const { stdout: childStdout } = await execAsync(`bd show "${child.id}" --json`);
				const childData = JSON.parse(childStdout);

				if (childData && childData.length > 0) {
					const childDetails = childData[0];
					const childDeps = childDetails.dependencies || [];

					// Find dependencies that are also children of this epic AND are not closed
					blockedBy = childDeps
						.filter((dep: { id: string; status: string }) =>
							childIds.has(dep.id) &&
							dep.status !== 'closed'
						)
						.map((dep: { id: string }) => dep.id);
				}
			} catch {
				// If we can't get child details, assume no blocking
				blockedBy = [];
			}

			children.push({
				id: child.id,
				title: child.title,
				priority: child.priority,
				status: child.status,
				issue_type: child.issue_type || 'task',
				assignee: child.assignee,
				isBlocked: blockedBy.length > 0,
				blockedBy
			});
		}

		// Sort by priority (lower number = higher priority), then by blocked status (unblocked first)
		children.sort((a, b) => {
			// Closed tasks go to the end
			if (a.status === 'closed' && b.status !== 'closed') return 1;
			if (a.status !== 'closed' && b.status === 'closed') return -1;

			// Then by blocked status (unblocked first)
			if (a.isBlocked && !b.isBlocked) return 1;
			if (!a.isBlocked && b.isBlocked) return -1;

			// Then by priority
			return a.priority - b.priority;
		});

		// Calculate summary
		const summary = {
			total: children.length,
			open: children.filter(c => c.status === 'open').length,
			inProgress: children.filter(c => c.status === 'in_progress').length,
			closed: children.filter(c => c.status === 'closed').length,
			blocked: children.filter(c => c.isBlocked && c.status !== 'closed').length,
			ready: children.filter(c => !c.isBlocked && c.status !== 'closed' && c.status !== 'in_progress').length
		};

		return json({
			epicId,
			epicTitle: epic.title,
			children,
			summary
		} satisfies EpicChildrenResponse);

	} catch (err) {
		const error = err as Error & { stderr?: string };
		console.error('Error fetching epic children:', error);

		// Check if it's a "not found" error from bd
		if (error.stderr?.includes('not found') || error.stderr?.includes('no issue found')) {
			return json({ error: `Epic '${epicId}' not found` }, { status: 404 });
		}

		return json({ error: 'Failed to fetch epic children' }, { status: 500 });
	}
};
