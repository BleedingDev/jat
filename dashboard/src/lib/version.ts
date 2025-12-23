/**
 * Build-time version information injected by Vite at build time.
 * These values help identify which version of the app users are running.
 */

// These are injected by Vite at build time via vite.config.ts
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - These are defined at build time
export const BUILD_COMMIT_SHA: string = __BUILD_COMMIT_SHA__ || 'dev';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - These are defined at build time
export const BUILD_COMMIT_SHORT: string = __BUILD_COMMIT_SHORT__ || 'dev';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - These are defined at build time
export const BUILD_TIMESTAMP: string = __BUILD_TIMESTAMP__ || new Date().toISOString();
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - These are defined at build time
export const BUILD_DATE: string = __BUILD_DATE__ || new Date().toLocaleDateString();

/**
 * Get a formatted version string for display
 * e.g., "abc1234 (Dec 18, 2025)"
 */
export function getVersionString(): string {
	return `${BUILD_COMMIT_SHORT} (${BUILD_DATE})`;
}

/**
 * Get full version info for debugging
 */
export function getFullVersionInfo(): {
	commitSha: string;
	commitShort: string;
	buildTimestamp: string;
	buildDate: string;
} {
	return {
		commitSha: BUILD_COMMIT_SHA,
		commitShort: BUILD_COMMIT_SHORT,
		buildTimestamp: BUILD_TIMESTAMP,
		buildDate: BUILD_DATE
	};
}
