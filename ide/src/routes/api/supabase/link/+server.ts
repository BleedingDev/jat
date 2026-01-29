/**
 * Supabase Link API
 * POST /api/supabase/link - Run `supabase link` in a tmux session for interactive authentication
 *
 * This creates a tmux session where the user can complete the Supabase authentication flow.
 * The session runs `supabase link --project-ref <project_ref>` and the user can interact
 * with it via terminal.
 */

import { json } from '@sveltejs/kit';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const execAsync = promisify(exec);

/**
 * Check if a tmux session exists
 */
async function sessionExists(sessionName: string): Promise<boolean> {
	try {
		await execAsync(`tmux has-session -t "${sessionName}" 2>/dev/null`);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get terminal emulator from config
 */
function getTerminal(): string {
	const configPath = join(homedir(), '.config', 'jat', 'projects.json');
	if (existsSync(configPath)) {
		try {
			const config = JSON.parse(readFileSync(configPath, 'utf-8'));
			return config.defaults?.terminal || 'alacritty';
		} catch {
			// Use default
		}
	}
	return 'alacritty';
}

/**
 * Find parent session
 */
async function findParentSession(): Promise<string | null> {
	const candidates = ['server-jat', 'jat'];
	for (const name of candidates) {
		if (await sessionExists(name)) {
			return name;
		}
	}
	return null;
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const body = await request.json();
		const { project, projectRef, dbPassword } = body;

		if (!project) {
			return json({ error: 'Missing project parameter' }, { status: 400 });
		}

		if (!projectRef) {
			return json({ error: 'Missing projectRef parameter' }, { status: 400 });
		}

		// Resolve project path
		const projectPath = join(homedir(), 'code', project);
		if (!existsSync(projectPath)) {
			return json({ error: `Project not found: ${project}` }, { status: 404 });
		}

		// Check if supabase directory exists
		const supabasePath = join(projectPath, 'supabase');
		if (!existsSync(supabasePath)) {
			return json(
				{ error: 'Supabase not initialized. Run `supabase init` first.' },
				{ status: 400 }
			);
		}

		// Session name for linking
		const sessionName = `supabase-link-${project}`;

		// Kill existing session if present
		if (await sessionExists(sessionName)) {
			try {
				await execAsync(`tmux kill-session -t "${sessionName}"`);
			} catch {
				// Ignore
			}
		}

		// Build the supabase link command
		const supabaseCmd = `${homedir()}/.local/bin/supabase`;
		let linkCommand = `${supabaseCmd} link --project-ref ${projectRef}`;

		// Add password if provided (passes via stdin to avoid shell escaping issues)
		if (dbPassword) {
			linkCommand = `echo '${dbPassword.replace(/'/g, "'\\''")}' | ${supabaseCmd} link --project-ref ${projectRef}`;
		}

		// Wrap command to keep session alive after completion
		const wrappedCommand = `cd "${projectPath}" && ${linkCommand}; echo ""; echo "=== Supabase link completed. Press Enter to close. ==="; read`;

		// Create tmux session
		try {
			await execAsync(`tmux new-session -d -s "${sessionName}" "bash -c '${wrappedCommand.replace(/'/g, "'\\''")}'"`, {
				timeout: 10000
			});
		} catch (createError) {
			console.error('Failed to create tmux session:', createError);
			return json(
				{
					error: 'Failed to create tmux session',
					message: createError instanceof Error ? createError.message : String(createError)
				},
				{ status: 500 }
			);
		}

		// Try to attach to the session
		const terminal = getTerminal();
		const parentSession = await findParentSession();
		let attachMethod = 'none';

		if (parentSession) {
			// Create window in parent session
			try {
				await execAsync(
					`tmux new-window -t "${parentSession}" -n "supabase-link" "bash -c 'tmux attach-session -t \\"${sessionName}\\"'"`
				);
				attachMethod = 'tmux-window';
			} catch {
				// Fall through to terminal spawn
			}
		}

		if (attachMethod === 'none') {
			// Spawn new terminal
			const attachCommand = `tmux attach-session -t "${sessionName}"`;

			let child;
			switch (terminal) {
				case 'alacritty':
					child = spawn(
						'alacritty',
						['-T', `Supabase Link: ${project}`, '-e', 'bash', '-c', attachCommand],
						{
							detached: true,
							stdio: 'ignore'
						}
					);
					break;
				case 'kitty':
					child = spawn(
						'kitty',
						['--title', `Supabase Link: ${project}`, 'bash', '-c', attachCommand],
						{
							detached: true,
							stdio: 'ignore'
						}
					);
					break;
				case 'gnome-terminal':
					child = spawn(
						'gnome-terminal',
						['--title', `Supabase Link: ${project}`, '--', 'bash', '-c', attachCommand],
						{
							detached: true,
							stdio: 'ignore'
						}
					);
					break;
				default:
					child = spawn('xterm', ['-T', `Supabase Link: ${project}`, '-e', 'bash', '-c', attachCommand], {
						detached: true,
						stdio: 'ignore'
					});
			}
			child.unref();
			attachMethod = 'terminal';
		}

		return json({
			success: true,
			sessionName,
			projectRef,
			attachMethod,
			message: `Supabase link started in tmux session: ${sessionName}`
		});
	} catch (error) {
		console.error('Error in POST /api/supabase/link:', error);
		return json(
			{
				error: 'Internal server error',
				message: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
}

/**
 * GET /api/supabase/link - Check link session status
 */
/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	try {
		const project = url.searchParams.get('project');
		if (!project) {
			return json({ error: 'Missing project parameter' }, { status: 400 });
		}

		const sessionName = `supabase-link-${project}`;
		const exists = await sessionExists(sessionName);

		// Check if project is now linked by looking for .temp/project-ref
		const projectPath = join(homedir(), 'code', project);
		const projectRefPath = join(projectPath, 'supabase', '.temp', 'project-ref');
		let isLinked = false;
		let linkedProjectRef = null;

		if (existsSync(projectRefPath)) {
			try {
				linkedProjectRef = readFileSync(projectRefPath, 'utf-8').trim();
				isLinked = !!linkedProjectRef;
			} catch {
				// Ignore
			}
		}

		return json({
			sessionExists: exists,
			sessionName,
			isLinked,
			linkedProjectRef
		});
	} catch (error) {
		console.error('Error in GET /api/supabase/link:', error);
		return json(
			{
				error: 'Internal server error',
				message: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
}
