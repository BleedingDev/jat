/**
 * Next Session API - Spawn session for next ready task
 *
 * POST /api/sessions/next
 * Purpose: After completed signal with completionMode: 'auto_proceed',
 *          spawn a new session for the next ready task
 *
 * Input: { completedTaskId, completedSessionName, nextTaskId?, project? }
 * Output: { success, nextTaskId, nextTaskTitle, sessionName } or { success: false, reason }
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getReadyTasks } from '$lib/server/beads.js';
import { getJatDefaults } from '$lib/server/projectPaths.js';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

interface NextSessionRequest {
	completedTaskId: string;
	completedSessionName: string;
	nextTaskId?: string;
	project?: string;
}

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const body: NextSessionRequest = await request.json();
		const { completedTaskId, completedSessionName, nextTaskId, project } = body;

		// 1. Find next ready task
		let nextTask;
		if (nextTaskId) {
			// If nextTaskId provided, use it (from signal)
			const readyTasks = getReadyTasks();
			nextTask = readyTasks.find(t => t.id === nextTaskId);
			if (!nextTask) {
				// Task ID was provided but not found in ready list - it may have been taken
				console.log(`[next] Provided nextTaskId ${nextTaskId} not ready, finding alternative`);
				nextTask = readyTasks[0];
			}
		} else {
			// Find first ready task
			const readyTasks = getReadyTasks();
			nextTask = readyTasks[0];
		}

		if (!nextTask) {
			return json({
				success: false,
				reason: 'no_ready_tasks',
				message: 'No ready tasks available to spawn',
				completedTaskId,
				timestamp: new Date().toISOString()
			});
		}

		// 2. Kill the completed session (optional - cleanup old session)
		if (completedSessionName) {
			try {
				await execAsync(`tmux kill-session -t "${completedSessionName}" 2>/dev/null || true`);
				console.log(`[next] Killed completed session: ${completedSessionName}`);
			} catch {
				// Ignore errors - session may already be dead
			}

			// Clean up signal files
			try {
				await execAsync(`rm -f /tmp/jat-signal-tmux-${completedSessionName}.json 2>/dev/null || true`);
			} catch {
				// Ignore cleanup errors
			}
		}

		// 3. Apply configurable delay before spawning (allows user to see completion)
		const jatDefaults = await getJatDefaults();
		const autoProceedDelay = jatDefaults.auto_proceed_delay || 2;
		if (autoProceedDelay > 0) {
			console.log(`[next] Waiting ${autoProceedDelay}s before spawning next task...`);
			await new Promise(resolve => setTimeout(resolve, autoProceedDelay * 1000));
		}

		// 4. Spawn new session for next task (agent-agnostic, Codex-first)
		// Delegate to the unified spawn endpoint so routing rules and agent programs apply.
		const projectHint = project && !project.includes('/') ? project : undefined;
		const spawnBody = {
			taskId: nextTask.id,
			attach: false,
			...(projectHint ? { project: projectHint } : {})
		};

		const spawnResponse = await fetch('/api/work/spawn', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(spawnBody)
		});

		const spawnResult = await spawnResponse.json().catch(() => ({}));

		if (!spawnResponse.ok || !spawnResult?.success || !spawnResult?.session?.sessionName) {
			return json({
				success: false,
				reason: 'spawn_failed',
				message: spawnResult?.message || spawnResult?.error || 'Failed to spawn next session',
				completedTaskId,
				nextTaskId: nextTask.id,
				nextTaskTitle: nextTask.title,
				timestamp: new Date().toISOString()
			}, { status: 500 });
		}

		return json({
			success: true,
			completedTaskId,
			nextTaskId: nextTask.id,
			nextTaskTitle: nextTask.title,
			sessionName: spawnResult.session.sessionName,
			project: spawnResult.session.project || projectHint || null,
			agentName: spawnResult.session.agentName,
			agentProgram: spawnResult.session.agentProgram,
			model: spawnResult.session.model,
			message: `Spawned ${spawnResult.session.agentProgram} session for task ${nextTask.id}`,
			timestamp: new Date().toISOString()
		});

	} catch (error) {
		console.error('Error in POST /api/sessions/next:', error);
		return json({
			success: false,
			reason: 'internal_error',
			message: error instanceof Error ? error.message : String(error),
			timestamp: new Date().toISOString()
		}, { status: 500 });
	}
};
