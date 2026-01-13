/**
 * Hyprland Colors API
 * POST /api/hyprland/colors - Apply border colors to all project windows
 *
 * This endpoint is equivalent to the CLI's `jat colors` command.
 * It finds all Hyprland windows with project name prefixes and applies
 * the configured border colors.
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

const CONFIG_FILE = join(homedir(), '.config', 'jat', 'projects.json');

/**
 * Check if Hyprland is available
 */
async function isHyprlandAvailable() {
	try {
		await execAsync('command -v hyprctl', { timeout: 1000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get all Hyprland windows
 * @returns {Promise<Array<{address: string, title: string}>>}
 */
async function getHyprlandClients() {
	try {
		const { stdout } = await execAsync('hyprctl clients -j', { timeout: 5000 });
		return JSON.parse(stdout);
	} catch {
		return [];
	}
}

/**
 * Convert hex color to Hyprland rgb format
 * @param {string} color - Color in #rrggbb or rgb(rrggbb) format
 * @returns {string} Color in rgb(rrggbb) format
 */
function normalizeColor(color) {
	if (!color) return '';

	// Already in rgb(rrggbb) format
	if (color.startsWith('rgb(')) {
		return color;
	}

	// Convert #rrggbb to rgb(rrggbb)
	if (color.startsWith('#')) {
		return `rgb(${color.slice(1)})`;
	}

	// Assume it's a bare hex value
	return `rgb(${color})`;
}

/**
 * Get all project configs with colors
 * @returns {Promise<Array<{name: string, displayName: string, activeColor: string, inactiveColor: string}>>}
 */
async function getProjectsWithColors() {
	try {
		if (!existsSync(CONFIG_FILE)) {
			return [];
		}

		const content = await readFile(CONFIG_FILE, 'utf-8');
		const config = JSON.parse(content);

		if (!config.projects) {
			return [];
		}

		const projects = [];
		for (const [name, projectConfig] of Object.entries(config.projects)) {
			/** @type {any} */
			const pc = projectConfig;
			if (pc.active_color) {
				projects.push({
					name,
					displayName: pc.name || name.toUpperCase(),
					activeColor: normalizeColor(pc.active_color),
					inactiveColor: normalizeColor(pc.inactive_color)
				});
			}
		}

		return projects;
	} catch {
		return [];
	}
}

/**
 * Apply border colors for all projects using windowrulev2
 * This uses hyprctl keyword windowrulev2 to set per-window border colors
 * based on window title prefix matching.
 */
export async function POST() {
	// Check if Hyprland is available
	const hyprlandAvailable = await isHyprlandAvailable();
	if (!hyprlandAvailable) {
		return json({
			success: false,
			message: 'Hyprland not available',
			skipped: true
		});
	}

	// Get all projects with colors
	const projects = await getProjectsWithColors();
	if (projects.length === 0) {
		return json({
			success: false,
			message: 'No projects with colors configured'
		});
	}

	const results = [];

	// For each project, add a windowrulev2 for its title prefix
	for (const project of projects) {
		// Create rules for both displayName and uppercase name prefixes
		const prefixes = [
			project.displayName,
			project.name.toUpperCase()
		];

		// Remove duplicates
		const uniquePrefixes = [...new Set(prefixes)];

		for (const prefix of uniquePrefixes) {
			try {
				// Build the bordercolor rule
				// Format: bordercolor <active> [inactive],title:^(PREFIX:)
				let colorSpec = project.activeColor;
				if (project.inactiveColor) {
					colorSpec += ` ${project.inactiveColor}`;
				}

				// Use windowrulev2 to set border color for windows with this title prefix
				// The regex ^(PREFIX:) matches titles starting with "PREFIX:"
				const rule = `bordercolor ${colorSpec},title:^(${prefix}:)`;
				await execAsync(
					`hyprctl keyword windowrulev2 '${rule}'`,
					{ timeout: 2000 }
				);

				results.push({
					project: project.name,
					prefix,
					rule,
					success: true
				});
			} catch (err) {
				results.push({
					project: project.name,
					prefix,
					success: false,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	}

	return json({
		success: true,
		message: `Applied ${results.filter(r => r.success).length} window rules`,
		rulesApplied: results.filter(r => r.success).length,
		projectsWithColors: projects.length,
		results
	});
}

/**
 * GET /api/hyprland/colors - Get current Hyprland status and project colors
 */
export async function GET() {
	const hyprlandAvailable = await isHyprlandAvailable();
	const projects = await getProjectsWithColors();
	const clients = hyprlandAvailable ? await getHyprlandClients() : [];

	return json({
		available: hyprlandAvailable,
		projects: projects.map(p => ({
			name: p.name,
			displayName: p.displayName,
			activeColor: p.activeColor,
			inactiveColor: p.inactiveColor
		})),
		windowCount: clients.length,
		windows: clients.map(c => ({
			title: c.title,
			address: c.address
		}))
	});
}
