/**
 * File Link Utilities
 *
 * Generates VS Code URLs for opening files with editor integration.
 * Supports line number deep links, git diff views, and localhost URLs.
 *
 * @see dashboard/CLAUDE.md for usage documentation
 */

// Project configuration loaded from ~/.config/jat/projects.json
// This will be populated by getProjectConfig()
let projectsCache: Record<string, ProjectConfig> | null = null;

/**
 * Project configuration from projects.json
 */
export interface ProjectConfig {
	name: string;
	path: string;
	port: number | null;
	description?: string;
}

/**
 * Options for generating file links
 */
export interface FileLinkOptions {
	/** Project root path (defaults to cwd) */
	projectRoot?: string;
	/** Line number to navigate to (1-indexed) */
	line?: number;
	/** Column number to navigate to (1-indexed) */
	column?: number;
}

/**
 * Options for generating diff links
 */
export interface DiffLinkOptions {
	/** Project root path (defaults to cwd) */
	projectRoot?: string;
	/** Git ref to compare against (defaults to HEAD) */
	ref?: string;
	/** Compare against staged changes */
	staged?: boolean;
}

/**
 * Generate a VS Code URL to open a file
 *
 * Uses the vscode:// URL scheme which opens VS Code if installed.
 * Falls back to file:// if vscode:// is not available.
 *
 * @example
 * ```typescript
 * // Open file
 * generateVSCodeUrl('src/lib/auth.ts')
 * // → vscode://file/home/user/project/src/lib/auth.ts
 *
 * // Open at specific line
 * generateVSCodeUrl('src/lib/auth.ts', { line: 42 })
 * // → vscode://file/home/user/project/src/lib/auth.ts:42
 *
 * // Open at specific line and column
 * generateVSCodeUrl('src/lib/auth.ts', { line: 42, column: 10 })
 * // → vscode://file/home/user/project/src/lib/auth.ts:42:10
 * ```
 */
export function generateVSCodeUrl(filePath: string, options: FileLinkOptions = {}): string {
	const { projectRoot, line, column } = options;

	// Resolve full path
	let fullPath = filePath;
	if (!filePath.startsWith('/')) {
		// Relative path - prepend project root
		const root = projectRoot || getDefaultProjectRoot();
		fullPath = `${root}/${filePath}`;
	}

	// Build URL with optional line:column suffix
	let url = `vscode://file${fullPath}`;

	if (line !== undefined && line > 0) {
		url += `:${line}`;
		if (column !== undefined && column > 0) {
			url += `:${column}`;
		}
	}

	return url;
}

/**
 * Generate a VS Code diff URL to show file changes
 *
 * Uses vscode://vscode.git/diff to show git diff in VS Code.
 * Falls back to a shell command hint if URL scheme not supported.
 *
 * @example
 * ```typescript
 * // Show unstaged diff
 * generateDiffUrl('src/lib/auth.ts')
 * // → vscode://vscode.git/diff?path=/home/user/project/src/lib/auth.ts
 *
 * // Show staged diff
 * generateDiffUrl('src/lib/auth.ts', { staged: true })
 * // → vscode://vscode.git/diff?path=/home/user/project/src/lib/auth.ts&staged=true
 *
 * // Show diff against specific ref
 * generateDiffUrl('src/lib/auth.ts', { ref: 'HEAD~1' })
 * // → vscode://vscode.git/diff?path=/home/user/project/src/lib/auth.ts&ref=HEAD~1
 * ```
 */
export function generateDiffUrl(filePath: string, options: DiffLinkOptions = {}): string {
	const { projectRoot, ref, staged } = options;

	// Resolve full path
	let fullPath = filePath;
	if (!filePath.startsWith('/')) {
		const root = projectRoot || getDefaultProjectRoot();
		fullPath = `${root}/${filePath}`;
	}

	// Build diff URL
	const params = new URLSearchParams();
	params.set('path', fullPath);

	if (ref) {
		params.set('ref', ref);
	}
	if (staged) {
		params.set('staged', 'true');
	}

	return `vscode://vscode.git/diff?${params.toString()}`;
}

/**
 * Generate a shell command for git diff (fallback for non-VS Code users)
 *
 * Returns a copy-pasteable command for the terminal.
 *
 * @example
 * ```typescript
 * generateGitDiffCommand('src/lib/auth.ts')
 * // → git diff -- src/lib/auth.ts
 *
 * generateGitDiffCommand('src/lib/auth.ts', 'HEAD~1')
 * // → git diff HEAD~1 -- src/lib/auth.ts
 * ```
 */
export function generateGitDiffCommand(filePath: string, ref?: string): string {
	if (ref) {
		return `git diff ${ref} -- ${filePath}`;
	}
	return `git diff -- ${filePath}`;
}

/**
 * Open a file in VS Code
 *
 * Attempts to open the file using the vscode:// URL scheme.
 * Falls back to window.open with file:// URL.
 *
 * Note: This only works in browser contexts and requires VS Code URL handler.
 */
export function openInVSCode(filePath: string, options: FileLinkOptions = {}): void {
	const url = generateVSCodeUrl(filePath, options);

	// Try to open using VS Code URL scheme
	window.open(url, '_blank');
}

/**
 * Open a diff view in VS Code
 *
 * Attempts to open the diff using VS Code's git extension URL scheme.
 *
 * Note: This only works in browser contexts and requires VS Code with git extension.
 */
export function openDiffInVSCode(filePath: string, options: DiffLinkOptions = {}): void {
	const url = generateDiffUrl(filePath, options);
	window.open(url, '_blank');
}

/**
 * Check if we're in a browser context where VS Code URLs might work
 */
export function canOpenInVSCode(): boolean {
	return typeof window !== 'undefined' && typeof window.open === 'function';
}

/**
 * Get file extension from path
 */
export function getFileExtension(filePath: string): string {
	const parts = filePath.split('.');
	return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Get file name from path (without directory)
 */
export function getFileName(filePath: string): string {
	const parts = filePath.split('/');
	return parts[parts.length - 1];
}

/**
 * Get directory path from file path
 */
export function getDirectory(filePath: string): string {
	const parts = filePath.split('/');
	parts.pop();
	return parts.join('/');
}

/**
 * Normalize file path (remove ./, ../, and double slashes)
 */
export function normalizePath(filePath: string): string {
	// Remove leading ./
	let normalized = filePath.replace(/^\.\//, '');

	// Remove double slashes
	normalized = normalized.replace(/\/+/g, '/');

	// Remove trailing slash
	normalized = normalized.replace(/\/$/, '');

	return normalized;
}

/**
 * Check if path looks like a glob pattern
 */
export function isGlobPattern(path: string): boolean {
	return path.includes('*') || path.includes('?') || path.includes('[');
}

/**
 * Get the default project root
 *
 * In browser context, we use a placeholder that should be replaced
 * by the actual project root at runtime.
 */
function getDefaultProjectRoot(): string {
	// This will be the jat project root when accessed from dashboard
	// The parent of /dashboard is the project root
	if (typeof window !== 'undefined' && window.location) {
		// We're in browser context - the API should provide the actual root
		// For now, use a common default that can be overridden
		return '/home/jw/code/jat';
	}
	return process.cwd();
}

/**
 * File link result containing both URL and fallback command
 */
export interface FileLinkResult {
	/** VS Code URL for direct opening */
	vscodeUrl: string;
	/** Shell command for terminal users */
	shellCommand?: string;
	/** Human-readable description */
	description: string;
}

/**
 * Generate complete file link result with URL and fallback
 *
 * @example
 * ```typescript
 * const link = getFileLink('src/lib/auth.ts', { line: 42 });
 * // link.vscodeUrl = 'vscode://file/home/user/project/src/lib/auth.ts:42'
 * // link.shellCommand = 'code src/lib/auth.ts:42'
 * // link.description = 'Open src/lib/auth.ts at line 42'
 * ```
 */
export function getFileLink(filePath: string, options: FileLinkOptions = {}): FileLinkResult {
	const { line, column } = options;

	const vscodeUrl = generateVSCodeUrl(filePath, options);

	// Build shell command for terminal users
	let shellCommand = `code ${filePath}`;
	if (line) {
		shellCommand += `:${line}`;
		if (column) {
			shellCommand += `:${column}`;
		}
	}

	// Build description
	let description = `Open ${getFileName(filePath)}`;
	if (line) {
		description += ` at line ${line}`;
		if (column) {
			description += `:${column}`;
		}
	}

	return {
		vscodeUrl,
		shellCommand,
		description
	};
}

/**
 * Generate complete diff link result with URL and fallback
 *
 * @example
 * ```typescript
 * const link = getDiffLink('src/lib/auth.ts', { ref: 'HEAD~1' });
 * // link.vscodeUrl = 'vscode://vscode.git/diff?...'
 * // link.shellCommand = 'git diff HEAD~1 -- src/lib/auth.ts'
 * // link.description = 'Show diff for src/lib/auth.ts'
 * ```
 */
export function getDiffLink(filePath: string, options: DiffLinkOptions = {}): FileLinkResult {
	const vscodeUrl = generateDiffUrl(filePath, options);
	const shellCommand = generateGitDiffCommand(filePath, options.ref);

	let description = `Show diff for ${getFileName(filePath)}`;
	if (options.ref) {
		description += ` against ${options.ref}`;
	} else if (options.staged) {
		description += ' (staged)';
	}

	return {
		vscodeUrl,
		shellCommand,
		description
	};
}

// =============================================================================
// LOCALHOST URL UTILITIES
// =============================================================================

/**
 * Set the projects cache (called from API or server-side)
 */
export function setProjectsCache(projects: Record<string, ProjectConfig>): void {
	projectsCache = projects;
}

/**
 * Get the projects cache
 */
export function getProjectsCache(): Record<string, ProjectConfig> | null {
	return projectsCache;
}

/**
 * Get the port for a project from the cache
 *
 * @param projectName - Project name (e.g., 'jat', 'chimaro')
 * @returns Port number or null if not found
 */
export function getProjectPort(projectName: string): number | null {
	if (!projectsCache) return null;
	const project = projectsCache[projectName.toLowerCase()];
	return project?.port ?? null;
}

/**
 * Generate a localhost URL for a route
 *
 * @param route - The route path (e.g., '/dashboard', '/api/users', '/login')
 * @param projectName - Project name to get port from
 * @returns Full localhost URL or null if port not available
 *
 * @example
 * ```typescript
 * generateLocalhostUrl('/dashboard', 'jat')
 * // → 'http://localhost:3333/dashboard'
 *
 * generateLocalhostUrl('/login', 'chimaro')
 * // → 'http://localhost:3500/login'
 * ```
 */
export function generateLocalhostUrl(route: string, projectName: string): string | null {
	const port = getProjectPort(projectName);
	if (!port) return null;

	// Ensure route starts with /
	const normalizedRoute = route.startsWith('/') ? route : `/${route}`;

	return `http://localhost:${port}${normalizedRoute}`;
}

/**
 * Open a localhost URL in a new browser tab
 *
 * @param route - The route path
 * @param projectName - Project name to get port from
 * @returns true if URL was opened, false if port not available
 */
export function openLocalhostUrl(route: string, projectName: string): boolean {
	const url = generateLocalhostUrl(route, projectName);
	if (!url) return false;

	window.open(url, '_blank');
	return true;
}

/**
 * Detect a route from a file path based on common patterns
 *
 * Supports SvelteKit routes (+page.svelte) and API routes (+server.ts/js)
 *
 * @param filePath - File path relative to project root
 * @returns Detected route or null if not a route file
 *
 * @example
 * ```typescript
 * detectRouteFromPath('src/routes/dashboard/+page.svelte')
 * // → '/dashboard'
 *
 * detectRouteFromPath('src/routes/api/users/+server.ts')
 * // → '/api/users'
 *
 * detectRouteFromPath('src/routes/tasks/[id]/+page.svelte')
 * // → '/tasks/[id]'
 *
 * detectRouteFromPath('src/lib/utils/auth.ts')
 * // → null (not a route)
 * ```
 */
export function detectRouteFromPath(filePath: string): string | null {
	// Normalize path separators
	const normalized = filePath.replace(/\\/g, '/');

	// Check if it's a SvelteKit route file
	const routeMatch = normalized.match(/src\/routes\/(.+?)\/\+(?:page|server|layout)\.(?:svelte|ts|js)$/);
	if (routeMatch) {
		const routePath = routeMatch[1];
		// Convert route path to URL (handle dynamic params like [id])
		return `/${routePath}`;
	}

	// Check for root route
	if (normalized.match(/src\/routes\/\+(?:page|server|layout)\.(?:svelte|ts|js)$/)) {
		return '/';
	}

	return null;
}

/**
 * Interface for all links related to a file
 */
export interface FileLinks {
	/** VS Code link to open the file */
	vscodeUrl: string;
	/** VS Code link to show diff */
	diffUrl: string;
	/** Localhost URL if this is a route file */
	localhostUrl: string | null;
	/** Detected route from file path */
	detectedRoute: string | null;
}

/**
 * Generate all links for a file
 *
 * @param filePath - File path relative to project root
 * @param projectName - Project name for localhost URL
 * @param options - Additional options
 * @returns All available links for the file
 *
 * @example
 * ```typescript
 * getAllFileLinks('src/routes/dashboard/+page.svelte', 'jat')
 * // → {
 * //     vscodeUrl: 'vscode://file/.../src/routes/dashboard/+page.svelte',
 * //     diffUrl: 'vscode://vscode.git/diff?path=...',
 * //     localhostUrl: 'http://localhost:3333/dashboard',
 * //     detectedRoute: '/dashboard'
 * //   }
 * ```
 */
export function getAllFileLinks(
	filePath: string,
	projectName: string,
	options: FileLinkOptions & { localhostRoute?: string } = {}
): FileLinks {
	const vscodeUrl = generateVSCodeUrl(filePath, options);
	const diffUrl = generateDiffUrl(filePath, {});

	// Use explicit localhost route if provided, otherwise try to detect
	const detectedRoute = options.localhostRoute || detectRouteFromPath(filePath);
	const localhostUrl = detectedRoute ? generateLocalhostUrl(detectedRoute, projectName) : null;

	return {
		vscodeUrl,
		diffUrl,
		localhostUrl,
		detectedRoute
	};
}

/**
 * Open all links for a file
 *
 * @param filePath - File path relative to project root
 * @param projectName - Project name for localhost URL
 * @param options - Which links to open
 */
export function openAllFileLinks(
	filePath: string,
	projectName: string,
	options: {
		openVscode?: boolean;
		openDiff?: boolean;
		openLocalhost?: boolean;
		localhostRoute?: string;
	} = { openVscode: true, openDiff: true, openLocalhost: true }
): void {
	const links = getAllFileLinks(filePath, projectName, { localhostRoute: options.localhostRoute });

	if (options.openVscode) {
		window.open(links.vscodeUrl, '_blank');
	}

	if (options.openDiff) {
		window.open(links.diffUrl, '_blank');
	}

	if (options.openLocalhost && links.localhostUrl) {
		window.open(links.localhostUrl, '_blank');
	}
}
