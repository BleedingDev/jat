import { json } from '@sveltejs/kit';
import { execFileSync } from 'child_process';
import { platform } from 'os';

interface PrerequisiteCheck {
	name: string;
	installed: boolean;
	version: string | null;
	required: boolean;
	fixHint: string;
}

function checkTool(command: string, args: string[]): { installed: boolean; version: string | null } {
	try {
		const output = execFileSync(command, args, {
			timeout: 5000,
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'pipe']
		}).trim();
		// Extract version number from output
		const versionMatch = output.match(/(\d+\.\d+[\.\d]*)/);
		return { installed: true, version: versionMatch ? versionMatch[1] : output.split('\n')[0].slice(0, 30) };
	} catch {
		return { installed: false, version: null };
	}
}

function getFixHint(name: string, plat: string): string {
	const isMac = plat === 'darwin';
	const hints: Record<string, string> = {
		tmux: isMac ? 'brew install tmux' : 'sudo pacman -S tmux  # or: sudo apt install tmux',
		sqlite3: isMac ? 'brew install sqlite' : 'sudo pacman -S sqlite  # or: sudo apt install sqlite3',
		jq: isMac ? 'brew install jq' : 'sudo pacman -S jq  # or: sudo apt install jq',
		git: isMac ? 'brew install git' : 'sudo pacman -S git  # or: sudo apt install git',
		bd: 'cd ~/code/jat && ./install.sh  # or: bash tools/scripts/install-beads.sh',
		node: isMac ? 'brew install node' : 'sudo pacman -S nodejs npm  # or: nvm install --lts'
	};
	return hints[name] || `Install ${name}`;
}

export async function GET() {
	const plat = platform();

	const tools: Array<{ name: string; command: string; args: string[]; required: boolean }> = [
		{ name: 'tmux', command: 'tmux', args: ['-V'], required: true },
		{ name: 'sqlite3', command: 'sqlite3', args: ['--version'], required: true },
		{ name: 'jq', command: 'jq', args: ['--version'], required: true },
		{ name: 'git', command: 'git', args: ['--version'], required: true },
		{ name: 'bd', command: 'bd', args: ['--version'], required: true },
		{ name: 'node', command: 'node', args: ['--version'], required: false }
	];

	const checks: PrerequisiteCheck[] = tools.map(tool => {
		const result = checkTool(tool.command, tool.args);
		return {
			name: tool.name,
			installed: result.installed,
			version: result.version,
			required: tool.required,
			fixHint: getFixHint(tool.name, plat)
		};
	});

	const allRequiredPassed = checks.filter(c => c.required).every(c => c.installed);

	return json({
		checks,
		allRequiredPassed,
		platform: plat
	});
}
