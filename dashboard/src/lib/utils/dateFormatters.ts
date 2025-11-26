/**
 * Date formatting utilities for consistent date/time display across the dashboard.
 *
 * Consolidates duplicate date formatting functions from:
 * - TaskTable.svelte (formatRelativeTime, formatFullDate)
 * - AgentCard.svelte (formatLastActivity)
 * - TaskDetailDrawer.svelte (formatDate)
 * - DateRangePicker.svelte (inline formatting)
 *
 * UTC/ISO Timestamp Handling:
 * Database timestamps are often stored without timezone info (e.g., "2024-11-21 15:30:00").
 * These utilities normalize timestamps to ensure correct UTC parsing.
 */

/**
 * Normalize a timestamp string to proper ISO 8601 format.
 * Handles database timestamps that may lack 'T' separator or 'Z' suffix.
 *
 * @param timestamp - Raw timestamp string (may or may not have 'T' or 'Z')
 * @returns Properly formatted ISO timestamp with 'Z' suffix for UTC parsing
 *
 * @example
 * normalizeTimestamp("2024-11-21 15:30:00") // → "2024-11-21T15:30:00Z"
 * normalizeTimestamp("2024-11-21T15:30:00") // → "2024-11-21T15:30:00Z"
 * normalizeTimestamp("2024-11-21T15:30:00Z") // → "2024-11-21T15:30:00Z"
 */
export function normalizeTimestamp(timestamp: string): string {
	if (!timestamp) return timestamp;

	// If already has 'T', check for 'Z'
	if (timestamp.includes('T')) {
		return timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
	}

	// Replace space with 'T' and add 'Z'
	return timestamp.replace(' ', 'T') + 'Z';
}

/**
 * Parse a potentially non-standard timestamp into a Date object.
 * Uses normalizeTimestamp internally to handle various formats.
 *
 * @param timestamp - Raw timestamp string
 * @returns Date object or null if invalid
 */
export function parseTimestamp(timestamp: string | null | undefined): Date | null {
	if (!timestamp) return null;

	const normalized = normalizeTimestamp(timestamp);
	const date = new Date(normalized);

	return isNaN(date.getTime()) ? null : date;
}

/**
 * Format relative time (e.g., "2d", "3mo", "1y").
 * Compact format suitable for tables and compact UIs.
 *
 * @param dateStr - Date string or ISO timestamp
 * @returns Relative time string or '-' if invalid
 *
 * @example
 * formatRelativeTime("2024-11-21T15:30:00Z") // → "2h" (if 2 hours ago)
 * formatRelativeTime(null) // → "-"
 */
export function formatRelativeTime(dateStr: string | null | undefined): string {
	if (!dateStr) return '-';

	const date = parseTimestamp(dateStr);
	if (!date) return '-';

	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffWeeks = Math.floor(diffDays / 7);
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffMins < 1) return 'now';
	if (diffMins < 60) return `${diffMins}m`;
	if (diffHours < 24) return `${diffHours}h`;
	if (diffDays < 7) return `${diffDays}d`;
	if (diffWeeks < 4) return `${diffWeeks}w`;
	if (diffMonths < 12) return `${diffMonths}mo`;
	return `${diffYears}y`;
}

/**
 * Format full date and time for tooltips and detailed views.
 * Uses locale-specific formatting.
 *
 * @param dateStr - Date string or ISO timestamp
 * @returns Formatted date string or empty string if invalid
 *
 * @example
 * formatFullDate("2024-11-21T15:30:00Z") // → "Nov 21, 2024, 3:30 PM"
 */
export function formatFullDate(dateStr: string | null | undefined): string {
	if (!dateStr) return '';

	const date = parseTimestamp(dateStr);
	if (!date) return '';

	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Format last activity time for agent cards.
 * Shows "Just now", "Xm ago", "Xh ago", or "Xd ago".
 *
 * @param timestamp - Timestamp string (handles UTC quirks)
 * @returns Formatted activity string or "Never" if no timestamp
 *
 * @example
 * formatLastActivity("2024-11-21 15:30:00") // → "5m ago"
 * formatLastActivity(null) // → "Never"
 */
export function formatLastActivity(timestamp: string | null | undefined): string {
	if (!timestamp) return 'Never';

	const date = parseTimestamp(timestamp);
	if (!date) return 'Never';

	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return 'Just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	return `${diffDays}d ago`;
}

/**
 * Format date for display (simple locale string).
 * Used in detail views and metadata displays.
 *
 * @param dateString - Date string
 * @returns Formatted date string or "N/A" if invalid
 *
 * @example
 * formatDate("2024-11-21T15:30:00Z") // → "11/21/2024, 3:30:00 PM"
 */
export function formatDate(dateString: string | null | undefined): string {
	if (!dateString) return 'N/A';

	const date = parseTimestamp(dateString);
	if (!date) return 'N/A';

	return date.toLocaleString();
}

/**
 * Format short date for compact displays (e.g., date range picker).
 *
 * @param dateStr - Date string
 * @returns Short formatted date like "Nov 21" or empty string
 */
export function formatShortDate(dateStr: string | null | undefined): string {
	if (!dateStr) return '';

	const date = parseTimestamp(dateStr);
	if (!date) return '';

	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get milliseconds since timestamp (for calculations).
 *
 * @param timestamp - Timestamp string
 * @returns Milliseconds since timestamp, or Infinity if invalid
 */
export function getTimeSinceMs(timestamp: string | null | undefined): number {
	if (!timestamp) return Infinity;

	const date = parseTimestamp(timestamp);
	if (!date) return Infinity;

	return Date.now() - date.getTime();
}

/**
 * Get minutes since timestamp (for activity status calculations).
 *
 * @param timestamp - Timestamp string
 * @returns Minutes since timestamp, or Infinity if invalid
 */
export function getTimeSinceMinutes(timestamp: string | null | undefined): number {
	return getTimeSinceMs(timestamp) / 60000;
}

/**
 * Check if timestamp is within a given number of minutes.
 *
 * @param timestamp - Timestamp string
 * @param minutes - Number of minutes threshold
 * @returns true if within threshold, false otherwise
 */
export function isWithinMinutes(timestamp: string | null | undefined, minutes: number): boolean {
	return getTimeSinceMinutes(timestamp) < minutes;
}
