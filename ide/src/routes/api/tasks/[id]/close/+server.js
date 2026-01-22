/**
 * Task Close API Route
 * Closes a task using `bd close` command
 * Used by Close & Kill action to abandon tasks quickly without full completion
 */
import { json } from '@sveltejs/kit';
import { getTaskById } from '../../../../../../../lib/beads.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { invalidateCache } from '$lib/server/cache.js';
import { _resetTaskCache } from '../../../../api/agents/+server.js';

const execAsync = promisify(exec);

/**
 * Escape a string for safe use in shell commands (single-quoted).
 * @param {string} str - The string to escape
 * @returns {string} - Shell-safe escaped string
 */
function shellEscape(str) {
	if (!str) return "''";
	return "'" + str.replace(/'/g, "'\\''") + "'";
}

/**
 * Close a task using bd close command
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ params, request }) {
	const taskId = params.id;

	try {
		// Check if task exists first
		const existingTask = getTaskById(taskId);
		if (!existingTask) {
			return json(
				{ error: true, message: `Task '${taskId}' not found` },
				{ status: 404 }
			);
		}

		// Check if task is already closed
		if (existingTask.status === 'closed') {
			return json({
				success: true,
				message: 'Task is already closed',
				task: existingTask
			});
		}

		// Parse optional reason from body
		let reason = 'Closed via IDE';
		try {
			const body = await request.json();
			if (body.reason) {
				reason = body.reason;
			}
		} catch {
			// Body is optional, use default reason
		}

		// Execute bd close command in correct project directory
		const projectPath = existingTask.project_path;
		const command = `cd "${projectPath}" && bd close ${taskId} --reason ${shellEscape(reason)}`;

		try {
			const { stdout, stderr } = await execAsync(command);

			// Check for errors in stderr
			if (stderr && stderr.includes('Error:')) {
				console.error('bd close error:', stderr);
				return json({ error: 'Failed to close task', details: stderr }, { status: 500 });
			}

			console.log(`[close] Closed task ${taskId}: ${stdout.trim()}`);
		} catch (execError) {
			const err = /** @type {Error & { stderr?: string }} */ (execError);
			console.error('bd close exec error:', err.message, err.stderr);
			return json({ error: 'Failed to close task', details: err.message }, { status: 500 });
		}

		// Invalidate related caches
		invalidateCache.tasks();
		invalidateCache.agents();
		_resetTaskCache();

		// Get updated task
		const updatedTask = getTaskById(taskId);

		return json({
			success: true,
			message: `Task ${taskId} closed`,
			task: updatedTask
		});
	} catch (error) {
		const err = /** @type {Error} */ (error);
		console.error('Error closing task:', err);
		return json({ error: 'Failed to close task', details: err.message }, { status: 500 });
	}
}
