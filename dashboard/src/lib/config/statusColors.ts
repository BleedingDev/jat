/**
 * Unified Status Colors & Icons Configuration
 *
 * Single source of truth for all status-related visual styling.
 * Used by: AgentCard, TaskTable, TaskQueue, activity feeds
 *
 * DaisyUI color semantics:
 * - info (blue): Active work, in progress
 * - success (green): Positive, complete, online
 * - warning (yellow): Caution, blocked, needs attention
 * - error (red): Critical, offline, problem
 * - primary: Brand color (used for priorities)
 * - ghost/neutral: Deemphasized, inactive
 */

// =============================================================================
// AGENT STATUS VISUAL CONFIG
// =============================================================================

export interface AgentStatusVisual {
	badge: string;        // DaisyUI badge class (badge-info, badge-success, etc.)
	text: string;         // Tailwind text color (text-info, text-success, etc.)
	icon: string;         // Icon character or identifier
	iconType: 'emoji' | 'daisyui' | 'svg';  // How to render the icon
	animation?: string;   // Tailwind animation class (animate-spin, animate-pulse)
	label: string;        // Human-readable label
	description: string;  // Tooltip description
}

export const AGENT_STATUS_VISUALS: Record<string, AgentStatusVisual> = {
	// WORKING: Has task/locks, actively coding
	working: {
		badge: 'badge-info',
		text: 'text-info',
		icon: 'gear',
		iconType: 'svg',
		animation: 'animate-spin',
		label: 'Working',
		description: 'Actively working on a task'
	},

	// LIVE: Very recent activity (< 1 min) but no formal task
	live: {
		badge: 'badge-success',
		text: 'text-success',
		icon: 'loading-dots',
		iconType: 'daisyui',
		animation: undefined,  // loading-dots has built-in animation
		label: 'Live',
		description: 'Responsive and active (< 1 minute)'
	},

	// ACTIVE: Recent activity (1-10 min), probably still around
	active: {
		badge: 'badge-accent',
		text: 'text-accent',
		icon: 'pulse-dot',
		iconType: 'svg',
		animation: 'animate-pulse',
		label: 'Active',
		description: 'Recently active (< 10 minutes)'
	},

	// IDLE: Within 1 hour but quiet
	idle: {
		badge: 'badge-ghost',
		text: 'text-base-content/50',
		icon: 'circle',
		iconType: 'svg',
		animation: undefined,
		label: 'Idle',
		description: 'Available but quiet (< 1 hour)'
	},

	// OFFLINE: Gone for > 1 hour
	offline: {
		badge: 'badge-error',
		text: 'text-error',
		icon: 'power-off',
		iconType: 'svg',
		animation: undefined,
		label: 'Offline',
		description: 'Not active for over 1 hour'
	}
};

// =============================================================================
// TASK STATUS VISUAL CONFIG
// =============================================================================

export interface TaskStatusVisual {
	badge: string;        // DaisyUI badge class
	text: string;         // Tailwind text color
	icon: string;         // SVG path or emoji
	iconType: 'svg' | 'emoji';
	iconStyle?: 'outline' | 'solid';
	animation?: string;   // For in_progress spinning gear
	label: string;
	description: string;
}

export const TASK_STATUS_VISUALS: Record<string, TaskStatusVisual> = {
	// IN PROGRESS: Being worked on (uses STATUS_ICONS.gear)
	in_progress: {
		badge: 'badge-info',
		text: 'text-info',
		icon: 'gear',  // Reference to STATUS_ICONS.gear - with donut hole
		iconType: 'svg',
		iconStyle: 'solid',
		animation: 'animate-spin',
		label: 'In Progress',
		description: 'Currently being worked on'
	},

	// OPEN: Ready to start
	open: {
		badge: 'badge-ghost',
		text: 'text-base-content/60',
		icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
		iconType: 'svg',
		iconStyle: 'outline',
		animation: undefined,
		label: 'Open',
		description: 'Ready to start'
	},

	// BLOCKED: Waiting on dependencies
	blocked: {
		badge: 'badge-warning',
		text: 'text-warning',
		icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
		iconType: 'svg',
		iconStyle: 'outline',
		animation: undefined,
		label: 'Blocked',
		description: 'Blocked by dependencies'
	},

	// CLOSED: Completed
	closed: {
		badge: 'badge-success',
		text: 'text-success',
		icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		iconType: 'svg',
		iconStyle: 'outline',
		animation: undefined,
		label: 'Closed',
		description: 'Completed'
	}
};

// =============================================================================
// PRIORITY VISUAL CONFIG (using primary color with opacity)
// =============================================================================

export interface PriorityVisual {
	badge: string;        // Full badge class including opacity
	text: string;         // Text color
	label: string;        // P0, P1, etc.
	description: string;  // Critical, High, etc.
}

export const PRIORITY_VISUALS: Record<number, PriorityVisual> = {
	0: {
		badge: 'badge-primary',
		text: 'text-primary',
		label: 'P0',
		description: 'Critical'
	},
	1: {
		badge: 'badge-primary badge-outline',
		text: 'text-primary/80',
		label: 'P1',
		description: 'High'
	},
	2: {
		badge: 'badge-ghost text-primary/60',
		text: 'text-primary/60',
		label: 'P2',
		description: 'Medium'
	},
	3: {
		badge: 'badge-ghost text-base-content/40',
		text: 'text-base-content/40',
		label: 'P3',
		description: 'Low'
	}
};

// =============================================================================
// SVG ICON PATHS
// =============================================================================

export const STATUS_ICONS = {
	// Gear icon (for working/in_progress) - with donut hole center
	gear: 'M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM14.25 12a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',

	// Circle (for idle)
	circle: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z',

	// Filled circle/dot (for active pulse)
	'pulse-dot': 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',

	// Power off / sleep (for offline)
	'power-off': 'M5.636 5.636a9 9 0 1012.728 0M12 3v9',

	// Clock (for open/waiting)
	clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',

	// Warning triangle (for blocked)
	warning: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',

	// Checkmark circle (for closed/success)
	check: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get agent status visual config with fallback
 */
export function getAgentStatusVisual(status: string): AgentStatusVisual {
	return AGENT_STATUS_VISUALS[status] || AGENT_STATUS_VISUALS.idle;
}

/**
 * Get task status visual config with fallback
 */
export function getTaskStatusVisual(status: string): TaskStatusVisual {
	return TASK_STATUS_VISUALS[status] || TASK_STATUS_VISUALS.open;
}

/**
 * Get priority visual config with fallback
 */
export function getPriorityVisual(priority: number | null | undefined): PriorityVisual {
	const p = priority ?? 3;
	return PRIORITY_VISUALS[p] || PRIORITY_VISUALS[3];
}

/**
 * Get SVG icon path by name
 */
export function getStatusIcon(name: string): string {
	return STATUS_ICONS[name as keyof typeof STATUS_ICONS] || STATUS_ICONS.circle;
}
