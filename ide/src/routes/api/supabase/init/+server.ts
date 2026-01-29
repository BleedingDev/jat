/**
 * Supabase Init API
 * POST /api/supabase/init - Run `supabase init` in a project directory
 *
 * Initializes Supabase configuration in the project if not already present.
 */

import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const execAsync = promisify(exec);

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const body = await request.json();
		const { project } = body;

		if (!project) {
			return json({ error: 'Missing project parameter' }, { status: 400 });
		}

		// Resolve project path
		const projectPath = join(homedir(), 'code', project);
		if (!existsSync(projectPath)) {
			return json({ error: `Project not found: ${project}` }, { status: 404 });
		}

		// Check if supabase is already initialized
		const supabasePath = join(projectPath, 'supabase');
		if (existsSync(supabasePath)) {
			return json({
				success: true,
				alreadyInitialized: true,
				message: 'Supabase is already initialized in this project'
			});
		}

		// Run supabase init
		const supabaseCmd = `${homedir()}/.local/bin/supabase`;

		try {
			const { stdout, stderr } = await execAsync(`${supabaseCmd} init`, {
				cwd: projectPath,
				timeout: 30000
			});

			return json({
				success: true,
				alreadyInitialized: false,
				message: 'Supabase initialized successfully',
				stdout: stdout.trim(),
				stderr: stderr.trim()
			});
		} catch (initError: unknown) {
			const execError = initError as { stdout?: string; stderr?: string; code?: number };
			return json(
				{
					error: 'Failed to initialize Supabase',
					stdout: execError.stdout?.trim() || '',
					stderr: execError.stderr?.trim() || '',
					exitCode: execError.code || 1
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error('Error in POST /api/supabase/init:', error);
		return json(
			{
				error: 'Internal server error',
				message: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
}
