/**
 * Badge helper utilities for consistent styling across the dashboard.
 *
 * Consolidates duplicate badge functions from:
 * - TaskTable.svelte
 * - TaskQueue.svelte
 * - AgentCard.svelte
 */

// Task priority badge classes
export function getPriorityBadge(priority: number | null | undefined): string {
	switch (priority) {
		case 0: return 'badge-error';    // P0 - Critical (Red)
		case 1: return 'badge-warning';  // P1 - High (Yellow)
		case 2: return 'badge-info';     // P2 - Medium (Blue)
		default: return 'badge-ghost';   // P3+ - Low (Gray)
	}
}

// Task priority label
export function getPriorityLabel(priority: number | null | undefined): string {
	switch (priority) {
		case 0: return 'Critical';
		case 1: return 'High';
		case 2: return 'Medium';
		case 3: return 'Low';
		default: return 'Low';
	}
}

// Task status badge classes
export function getTaskStatusBadge(status: string | null | undefined): string {
	switch (status) {
		case 'open': return 'badge-info';
		case 'in_progress': return 'badge-warning';
		case 'blocked': return 'badge-error';
		case 'closed': return 'badge-success';
		default: return 'badge-ghost';
	}
}

// Task status label (formatted for display)
export function getTaskStatusLabel(status: string | null | undefined): string {
	switch (status) {
		case 'open': return 'Open';
		case 'in_progress': return 'In Progress';
		case 'blocked': return 'Blocked';
		case 'closed': return 'Closed';
		default: return status || 'Unknown';
	}
}

// Issue type badge classes
export function getTypeBadge(type: string | null | undefined): string {
	switch (type) {
		case 'bug': return 'badge-error';
		case 'feature': return 'badge-success';
		case 'epic': return 'badge-primary';
		case 'chore': return 'badge-ghost';
		case 'task': return 'badge-info';
		default: return 'badge-info';
	}
}

// Issue type label
export function getTypeLabel(type: string | null | undefined): string {
	if (!type) return 'No Type';
	return type.charAt(0).toUpperCase() + type.slice(1);
}

// Agent status badge classes (different from task status)
export function getAgentStatusBadge(status: string | null | undefined): string {
	switch (status) {
		case 'live': return 'badge-success';    // Green - truly responsive (< 1m)
		case 'working': return 'badge-warning'; // Yellow - actively coding (1-10m)
		case 'active': return 'badge-accent';   // Purple/accent - recent activity
		case 'idle': return 'badge-ghost';      // Gray - available but quiet
		case 'blocked': return 'badge-warning'; // Yellow - paused
		case 'offline': return 'badge-error';   // Red - disconnected
		default: return 'badge-ghost';
	}
}

// Agent status icon
export function getAgentStatusIcon(status: string | null | undefined): string {
	switch (status) {
		case 'live': return '●';     // Solid dot - truly live/responsive
		case 'working': return '⚙';  // Actively coding (gear will spin)
		case 'active': return '✓';   // Ready and engaged
		case 'idle': return '○';     // Available but quiet
		case 'blocked': return '⏸';  // Paused
		case 'offline': return '⏹';  // Disconnected
		default: return '?';
	}
}

// Agent status label
export function getAgentStatusLabel(status: string | null | undefined): string {
	switch (status) {
		case 'live': return 'Live';
		case 'working': return 'Working';
		case 'active': return 'Active';
		case 'idle': return 'Idle';
		case 'blocked': return 'Blocked';
		case 'offline': return 'Offline';
		default: return 'Unknown';
	}
}
