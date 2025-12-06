/**
 * Epic Queue Store
 *
 * Manages state for epic swarm execution - tracking which epic is running,
 * its children tasks, execution settings, and progress.
 *
 * Interface:
 * - state.epicId: string | null - Currently executing epic ID
 * - state.children: EpicChild[] - Children tasks with their status
 * - state.settings: ExecutionSettings - Parallel/sequential, review threshold, etc.
 * - state.progress: { completed: number, total: number }
 * - state.runningAgents: string[] - Agent names currently working on epic children
 * - startEpic(epicId, settings) - Begin epic execution
 * - completeTask(taskId) - Mark a child task as completed
 * - getNextReadyTask() - Get next task ready for assignment
 * - isEpicComplete() - Check if all children are done
 * - stopEpic() - Stop epic execution
 * - updateTaskStatus(taskId, status) - Update a child's status
 * - addRunningAgent(agentName) - Track agent working on epic
 * - removeRunningAgent(agentName) - Remove agent from tracking
 */

import type { Task } from '$lib/types/api.types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Review threshold options - which priority tasks require manual review
 */
export type ReviewThreshold = 'all' | 'p0' | 'p0-p1' | 'p0-p2' | 'none';

/**
 * Execution mode - parallel or sequential
 */
export type ExecutionMode = 'parallel' | 'sequential';

/**
 * Child task status within the epic execution
 */
export type ChildStatus = 'pending' | 'ready' | 'in_progress' | 'completed' | 'blocked';

/**
 * Child task in the epic queue
 */
export interface EpicChild {
	id: string;
	title: string;
	priority: number;
	status: ChildStatus;
	assignee?: string;
	dependsOn?: string[]; // Task IDs this child depends on
}

/**
 * Execution settings for the epic swarm
 */
export interface ExecutionSettings {
	mode: ExecutionMode;
	reviewThreshold: ReviewThreshold;
	maxConcurrent: number;
	autoSpawn: boolean;
}

/**
 * Epic queue state
 */
interface EpicQueueState {
	epicId: string | null;
	epicTitle: string | null;
	children: EpicChild[];
	settings: ExecutionSettings;
	progress: {
		completed: number;
		total: number;
	};
	runningAgents: string[];
	isActive: boolean;
	startedAt: Date | null;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const defaultSettings: ExecutionSettings = {
	mode: 'parallel',
	reviewThreshold: 'p0-p1',
	maxConcurrent: 4,
	autoSpawn: true
};

const defaultState: EpicQueueState = {
	epicId: null,
	epicTitle: null,
	children: [],
	settings: { ...defaultSettings },
	progress: { completed: 0, total: 0 },
	runningAgents: [],
	isActive: false,
	startedAt: null
};

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

// Reactive state using Svelte 5 runes
let state = $state<EpicQueueState>({ ...defaultState });

/**
 * Start epic execution with the given settings
 * @param epicId - The epic task ID to execute
 * @param epicTitle - The epic title for display
 * @param children - Child tasks to execute
 * @param settings - Execution settings (optional, uses defaults)
 */
export function startEpic(
	epicId: string,
	epicTitle: string,
	children: Task[],
	settings: Partial<ExecutionSettings> = {}
): void {
	// Build children list with status
	const epicChildren: EpicChild[] = children.map((task) => ({
		id: task.id,
		title: task.title,
		priority: task.priority,
		status: determineInitialStatus(task, children),
		assignee: task.assignee,
		dependsOn: task.depends_on?.map((d) => d.id)
	}));

	state = {
		epicId,
		epicTitle,
		children: epicChildren,
		settings: { ...defaultSettings, ...settings },
		progress: {
			completed: epicChildren.filter((c) => c.status === 'completed').length,
			total: epicChildren.length
		},
		runningAgents: [],
		isActive: true,
		startedAt: new Date()
	};
}

/**
 * Determine initial status for a child task
 */
function determineInitialStatus(task: Task, allChildren: Task[]): ChildStatus {
	// Already completed
	if (task.status === 'closed') {
		return 'completed';
	}

	// Already in progress
	if (task.status === 'in_progress') {
		return 'in_progress';
	}

	// Check if blocked by dependencies
	if (task.depends_on && task.depends_on.length > 0) {
		const childIds = new Set(allChildren.map((c) => c.id));
		const unblockedDeps = task.depends_on.filter((dep) => {
			// Only consider dependencies within this epic
			if (!childIds.has(dep.id)) return false;
			// Check if dependency is completed
			return dep.status !== 'closed';
		});

		if (unblockedDeps.length > 0) {
			return 'blocked';
		}
	}

	// Ready to start
	return 'ready';
}

/**
 * Mark a child task as completed
 * @param taskId - The task ID that completed
 */
export function completeTask(taskId: string): void {
	if (!state.isActive) return;

	// Update the child's status
	state.children = state.children.map((child) => {
		if (child.id === taskId) {
			return { ...child, status: 'completed' as ChildStatus, assignee: undefined };
		}
		return child;
	});

	// Update progress
	state.progress = {
		completed: state.children.filter((c) => c.status === 'completed').length,
		total: state.children.length
	};

	// Recalculate blocked status for other children
	recalculateBlockedStatus();
}

/**
 * Recalculate which tasks are blocked vs ready after a completion
 */
function recalculateBlockedStatus(): void {
	const completedIds = new Set(
		state.children.filter((c) => c.status === 'completed').map((c) => c.id)
	);

	state.children = state.children.map((child) => {
		// Skip already completed or in-progress tasks
		if (child.status === 'completed' || child.status === 'in_progress') {
			return child;
		}

		// Check if all dependencies are completed
		if (child.dependsOn && child.dependsOn.length > 0) {
			const hasBlockingDep = child.dependsOn.some((depId) => {
				// Only check dependencies within this epic's children
				const depChild = state.children.find((c) => c.id === depId);
				return depChild && depChild.status !== 'completed';
			});

			if (hasBlockingDep) {
				return { ...child, status: 'blocked' as ChildStatus };
			}
		}

		// No blocking dependencies - mark as ready
		return { ...child, status: 'ready' as ChildStatus };
	});
}

/**
 * Update a child task's status
 * @param taskId - The task ID to update
 * @param status - The new status
 * @param assignee - Optional assignee
 */
export function updateTaskStatus(taskId: string, status: ChildStatus, assignee?: string): void {
	if (!state.isActive) return;

	state.children = state.children.map((child) => {
		if (child.id === taskId) {
			return { ...child, status, assignee: assignee ?? child.assignee };
		}
		return child;
	});

	// Update progress if status changed to completed
	if (status === 'completed') {
		state.progress = {
			completed: state.children.filter((c) => c.status === 'completed').length,
			total: state.children.length
		};
		recalculateBlockedStatus();
	}
}

/**
 * Get the next task ready for assignment
 * @returns The next ready task, or null if none available
 */
export function getNextReadyTask(): EpicChild | null {
	if (!state.isActive) return null;

	// Find ready tasks sorted by priority (lower number = higher priority)
	const readyTasks = state.children
		.filter((child) => child.status === 'ready')
		.sort((a, b) => a.priority - b.priority);

	return readyTasks[0] || null;
}

/**
 * Get all tasks ready for assignment
 * @returns Array of ready tasks sorted by priority
 */
export function getReadyTasks(): EpicChild[] {
	if (!state.isActive) return [];

	return state.children
		.filter((child) => child.status === 'ready')
		.sort((a, b) => a.priority - b.priority);
}

/**
 * Check if the epic is complete (all children done)
 * @returns true if all children are completed
 */
export function isEpicComplete(): boolean {
	if (!state.isActive) return false;
	return state.progress.completed === state.progress.total && state.progress.total > 0;
}

/**
 * Stop epic execution
 */
export function stopEpic(): void {
	state = { ...defaultState };
}

/**
 * Add an agent to the running agents list
 * @param agentName - The agent name
 */
export function addRunningAgent(agentName: string): void {
	if (!state.runningAgents.includes(agentName)) {
		state.runningAgents = [...state.runningAgents, agentName];
	}
}

/**
 * Remove an agent from the running agents list
 * @param agentName - The agent name
 */
export function removeRunningAgent(agentName: string): void {
	state.runningAgents = state.runningAgents.filter((a) => a !== agentName);
}

/**
 * Check if we can spawn more agents
 * @returns true if under maxConcurrent limit
 */
export function canSpawnMore(): boolean {
	if (!state.isActive) return false;
	return state.runningAgents.length < state.settings.maxConcurrent;
}

/**
 * Check if a task requires review based on settings
 * @param priority - The task's priority (0-4)
 * @returns true if the task requires manual review
 */
export function requiresReview(priority: number): boolean {
	const threshold = state.settings.reviewThreshold;

	switch (threshold) {
		case 'all':
			return true;
		case 'none':
			return false;
		case 'p0':
			return priority === 0;
		case 'p0-p1':
			return priority <= 1;
		case 'p0-p2':
			return priority <= 2;
		default:
			return true;
	}
}

/**
 * Get currently in-progress tasks
 * @returns Array of in-progress children
 */
export function getInProgressTasks(): EpicChild[] {
	if (!state.isActive) return [];
	return state.children.filter((child) => child.status === 'in_progress');
}

/**
 * Get blocked tasks
 * @returns Array of blocked children
 */
export function getBlockedTasks(): EpicChild[] {
	if (!state.isActive) return [];
	return state.children.filter((child) => child.status === 'blocked');
}

/**
 * Get count of tasks by status
 * @returns Object with counts per status
 */
export function getStatusCounts(): Record<ChildStatus, number> {
	const counts: Record<ChildStatus, number> = {
		pending: 0,
		ready: 0,
		in_progress: 0,
		completed: 0,
		blocked: 0
	};

	for (const child of state.children) {
		counts[child.status]++;
	}

	return counts;
}

// =============================================================================
// REACTIVE GETTERS
// =============================================================================

export function getState(): EpicQueueState {
	return state;
}

export function getEpicId(): string | null {
	return state.epicId;
}

export function getEpicTitle(): string | null {
	return state.epicTitle;
}

export function getChildren(): EpicChild[] {
	return state.children;
}

export function getSettings(): ExecutionSettings {
	return state.settings;
}

export function getProgress(): { completed: number; total: number } {
	return state.progress;
}

export function getRunningAgents(): string[] {
	return state.runningAgents;
}

export function getIsActive(): boolean {
	return state.isActive;
}

export function getStartedAt(): Date | null {
	return state.startedAt;
}

// Export state for direct reactive access in components
export { state as epicQueueState };
