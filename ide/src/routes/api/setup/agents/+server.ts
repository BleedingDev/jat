/**
 * Setup Agents API - Bulk detect and configure agent harnesses
 *
 * POST /api/setup/agents
 *
 * Actions:
 *   - detect: Verify all 5 AGENT_PRESETS, return installation/auth status
 *   - configure: Add selected presets to agents.json, set first as default
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AGENT_PRESETS } from '$lib/types/agentProgram';
import type { AgentProgram } from '$lib/types/agentProgram';
import {
	isCommandAvailable,
	getAgentStatus,
	getAgentConfig,
	addAgentProgram,
	setDefaultAgent
} from '$lib/utils/agentConfig';

export interface DetectionResult {
	presetId: string;
	name: string;
	commandInstalled: boolean;
	authConfigured: boolean;
	ready: boolean;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { action } = body;

		if (action === 'detect') {
			return handleDetect();
		} else if (action === 'configure') {
			return handleConfigure(body.agents as string[]);
		} else {
			return json({ error: 'Invalid action. Use "detect" or "configure".' }, { status: 400 });
		}
	} catch (err) {
		console.error('Setup agents error:', err);
		return json({ error: 'Failed to process agent setup' }, { status: 500 });
	}
};

function handleDetect() {
	const config = getAgentConfig();
	const alreadyConfigured = Object.keys(config.programs).length > 0;

	const agents: DetectionResult[] = AGENT_PRESETS.map((preset) => {
		const presetConfig = preset.config;
		const command = presetConfig.command!;

		const commandInstalled = isCommandAvailable(command);

		// Build a temp program to check auth
		const tempProgram: AgentProgram = {
			id: preset.id,
			name: preset.name,
			command,
			models: presetConfig.models || [],
			defaultModel: presetConfig.defaultModel || '',
			flags: presetConfig.flags || [],
			authType: presetConfig.authType || 'subscription',
			apiKeyProvider: presetConfig.apiKeyProvider,
			apiKeyEnvVar: presetConfig.apiKeyEnvVar,
			enabled: true,
			isDefault: false
		};

		const status = getAgentStatus(tempProgram);
		const authConfigured = status.authConfigured;

		return {
			presetId: preset.id,
			name: preset.name,
			commandInstalled,
			authConfigured,
			ready: commandInstalled && authConfigured
		};
	});

	return json({ agents, alreadyConfigured });
}

function handleConfigure(selectedIds: string[]) {
	if (!selectedIds || !Array.isArray(selectedIds) || selectedIds.length === 0) {
		return json({ error: 'No agents selected' }, { status: 400 });
	}

	const config = getAgentConfig();
	const configured: string[] = [];
	let defaultAgent: string | null = null;

	for (const presetId of selectedIds) {
		const preset = AGENT_PRESETS.find((p) => p.id === presetId);
		if (!preset) continue;

		// Skip if already configured
		if (config.programs[presetId]) {
			configured.push(presetId);
			if (!defaultAgent) defaultAgent = presetId;
			continue;
		}

		const program: Omit<AgentProgram, 'createdAt' | 'updatedAt'> = {
			...preset.config,
			id: preset.id,
			name: preset.config.name || preset.name,
			command: preset.config.command!,
			models: preset.config.models || [],
			defaultModel: preset.config.defaultModel || '',
			flags: preset.config.flags || [],
			authType: preset.config.authType || 'subscription',
			enabled: true,
			isDefault: false,
			order: configured.length
		};

		try {
			addAgentProgram(program);
			configured.push(presetId);
			if (!defaultAgent) defaultAgent = presetId;
		} catch (err) {
			console.error(`Failed to add agent ${presetId}:`, err);
		}
	}

	// Set first configured agent as default
	if (defaultAgent) {
		try {
			setDefaultAgent(defaultAgent);
		} catch {
			// Non-fatal - default may already be set
		}
	}

	return json({
		success: true,
		configured,
		defaultAgent
	});
}
