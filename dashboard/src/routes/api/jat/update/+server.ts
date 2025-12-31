import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * POST /api/jat/update
 *
 * Updates JAT by:
 * 1. Running git pull in ~/code/jat
 * 2. Running symlink-tools.sh to update symlinks (non-interactive)
 *
 * Returns success/failure with message
 */
export async function POST() {
	const jatPath = join(homedir(), 'code', 'jat');

	// Verify JAT directory exists
	if (!existsSync(jatPath)) {
		return json({ success: false, error: 'JAT directory not found at ~/code/jat' }, { status: 404 });
	}

	try {
		// Step 1: Git pull
		const { stdout: pullOutput } = await execAsync('git pull', {
			cwd: jatPath,
			timeout: 30000 // 30 second timeout
		});

		// Check if already up to date
		const isUpToDate = pullOutput.includes('Already up to date');

		// Step 2: Run symlink-tools.sh directly (non-interactive, unlike install.sh)
		const { stdout: symlinkOutput } = await execAsync('bash tools/scripts/symlink-tools.sh', {
			cwd: jatPath,
			timeout: 30000
		});

		// Build result message
		let message: string;
		if (isUpToDate) {
			message = 'Already up to date. Symlinks refreshed.';
		} else {
			// Extract commit info from pull output
			const commitMatch = pullOutput.match(/([a-f0-9]+)\.\.([a-f0-9]+)/);
			if (commitMatch) {
				message = `Updated to ${commitMatch[2].substring(0, 7)}. Symlinks refreshed.`;
			} else {
				message = 'Updated successfully. Symlinks refreshed.';
			}
		}

		return json({
			success: true,
			message,
			details: {
				gitPull: pullOutput.trim(),
				symlinks: symlinkOutput.substring(0, 500)
			}
		});

	} catch (err: any) {
		// Handle specific error cases
		const errorMessage = err.stderr || err.message || 'Unknown error';

		if (errorMessage.includes('uncommitted changes') || errorMessage.includes('unstaged changes')) {
			return json({
				success: false,
				error: 'Cannot update: uncommitted changes in JAT repo. Please commit or stash first.'
			}, { status: 409 });
		}

		if (errorMessage.includes('CONFLICT')) {
			return json({
				success: false,
				error: 'Merge conflict during git pull. Manual resolution required.'
			}, { status: 409 });
		}

		return json({
			success: false,
			error: `Update failed: ${errorMessage.substring(0, 200)}`
		}, { status: 500 });
	}
}
