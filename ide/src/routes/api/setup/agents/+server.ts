/**
 * Setup Agents API - Bulk detect and configure agent harnesses
 *
 * POST /api/setup/agents
 *
 * Actions:
 *   - detect: Verify all AGENT_PRESETS, return installation/auth status
 *   - configure: Add selected presets to agents.json, set preferred default (Codex-first)
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

/**
 * Default selection priority (Codex-first).
 * This affects onboarding + initial config so new users default to codex-native when available.
 */
const DEFAULT_AGENT_PRIORITY = [
	'codex-native',
	'codex-cli',
	'claude-code',
	'gemini-cli',
	'aider',
	'opencode'
] as const;

function getPriorityIndex(presetId: string): number {
	const idx = DEFAULT_AGENT_PRIORITY.indexOf(presetId as any);
	return idx === -1 ? 999 : idx;
}

function getOrderForPreset(presetId: string): number {
	const pri = getPriorityIndex(presetId);
	if (pri !== 999) return pri;
	const presetIdx = AGENT_PRESETS.findIndex((p) => p.id === presetId);
	return presetIdx === -1 ? 999 : 100 + presetIdx;
}

function getDetectionForPreset(presetId: string): DetectionResult | null {
	const preset = AGENT_PRESETS.find((p) => p.id === presetId);
	if (!preset) return null;

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
}

function pickDefaultAgent(selectedIds: string[]): string | null {
	const detections = selectedIds
		.map((id) => getDetectionForPreset(id))
		.filter(Boolean) as DetectionResult[];

	// Prefer first READY agent by priority
	const ready = detections
		.filter((d) => d.ready)
		.sort((a, b) => getPriorityIndex(a.presetId) - getPriorityIndex(b.presetId));
	if (ready.length > 0) return ready[0].presetId;

	// Else prefer first INSTALLED agent by priority
	const installed = detections
		.filter((d) => d.commandInstalled)
		.sort((a, b) => getPriorityIndex(a.presetId) - getPriorityIndex(b.presetId));
	if (installed.length > 0) return installed[0].presetId;

	// Fallback: first selected
	return selectedIds[0] ?? null;
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
	const defaultAgent = pickDefaultAgent(selectedIds);

	for (const presetId of selectedIds) {
		const preset = AGENT_PRESETS.find((p) => p.id === presetId);
		if (!preset) continue;

		// Skip if already configured
		if (config.programs[presetId]) {
			configured.push(presetId);
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
			order: getOrderForPreset(presetId)
		};

		try {
			addAgentProgram(program);
			configured.push(presetId);
		} catch (err) {
			console.error(`Failed to add agent ${presetId}:`, err);
		}
	}

	// Set preferred default agent (Codex-first)
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
