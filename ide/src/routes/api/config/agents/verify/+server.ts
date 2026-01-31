/**
 * Verify Agent Harness Setup
 *
 * Checks if a harness CLI is installed and properly authenticated.
 * Used before adding a new harness to warn users of missing setup.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isCommandAvailable, getAgentStatus } from '$lib/utils/agentConfig';
import type { AgentProgram } from '$lib/types/agentProgram';

export interface VerifyResult {
	ready: boolean;
	commandInstalled: boolean;
	authConfigured: boolean;
	warnings: string[];
	instructions: string[];
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { command, authType, apiKeyProvider } = body as Partial<AgentProgram>;

		if (!command) {
			return json({ error: 'Command is required' }, { status: 400 });
		}

		const warnings: string[] = [];
		const instructions: string[] = [];

		// Check if command is installed
		const commandInstalled = isCommandAvailable(command);
		if (!commandInstalled) {
			warnings.push(`CLI command '${command}' is not installed`);

			// Add installation instructions based on command
			switch (command) {
				case 'claude':
					instructions.push('npm install -g @anthropic-ai/claude-code');
					break;
				case 'codex':
					instructions.push('npm install -g @openai/codex');
					break;
				case 'codex-native':
					instructions.push('Install codex-native (your fork)');
					break;
				case 'gemini':
					instructions.push('Visit https://geminicli.com/ for installation');
					break;
				case 'aider':
					instructions.push('pip install aider-chat');
					break;
				case 'opencode':
					instructions.push('curl -fsSL https://opencode.ai/install | bash');
					break;
				default:
					instructions.push(`Install the '${command}' CLI tool`);
			}
		}

		// Check authentication by creating a temporary program object
		const tempProgram: AgentProgram = {
			id: 'temp-verify',
			name: 'Temp Verify',
			command,
			models: [],
			defaultModel: '',
			flags: [],
			authType: authType || 'subscription',
			apiKeyProvider,
			enabled: true,
			isDefault: false
		};

		const status = getAgentStatus(tempProgram);
		const authConfigured = status.authConfigured;

		if (commandInstalled && !authConfigured) {
			warnings.push('Authentication is not configured');

			// Add auth instructions based on command
			switch (command) {
				case 'claude':
					instructions.push('Run: claude auth');
					break;
				case 'codex':
					instructions.push('Run: codex login');
					break;
				case 'codex-native':
					instructions.push('Run: codex login (writes ~/.codex/auth.json) or set OPENAI_API_KEY');
					break;
				case 'gemini':
					instructions.push('Run: gemini auth');
					break;
				case 'aider':
					if (apiKeyProvider) {
						instructions.push(
							`Add ${apiKeyProvider.toUpperCase()} API key in Settings → API Keys`
						);
					} else {
						instructions.push('Add API key in Settings → API Keys');
					}
					break;
				case 'opencode':
					instructions.push('Run: opencode auth login');
					break;
				default:
					if (authType === 'api_key' && apiKeyProvider) {
						instructions.push(
							`Add ${apiKeyProvider.toUpperCase()} API key in Settings → API Keys`
						);
					} else {
						instructions.push('Configure authentication for this CLI tool');
					}
			}
		}

		const ready = commandInstalled && authConfigured;

		return json({
			ready,
			commandInstalled,
			authConfigured,
			warnings,
			instructions
		} satisfies VerifyResult);
	} catch (err) {
		console.error('Verify harness error:', err);
		return json({ error: 'Failed to verify harness setup' }, { status: 500 });
	}
};
