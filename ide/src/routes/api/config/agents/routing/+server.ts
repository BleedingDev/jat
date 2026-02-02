/**
 * Agent Routing Rules API Endpoint
 *
 * Manages routing rules that map task attributes to agent selection.
 *
 * Endpoints:
 * - GET: Get all routing rules
 * - PUT: Update all routing rules (replaces entire list)
 * - POST: Evaluate routing for a sample task (testing)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getRoutingRules,
	updateRoutingRules,
	evaluateRouting,
	validateRoutingRule,
	getAllAgentPrograms
} from '$lib/utils/agentConfig';
import type { AgentRoutingRule } from '$lib/types/agentProgram';

/**
 * GET /api/config/agents/routing
 *
 * Get all routing rules.
 */
export const GET: RequestHandler = async () => {
	try {
		const rules = getRoutingRules();
		const programs = getAllAgentPrograms();

		return json({
			success: true,
			rules,
			// Include agent names for UI display
			agents: programs.map((p) => ({
				id: p.id,
				name: p.name,
				isDefault: p.isDefault,
				models: p.models.map((m) => ({ shortName: m.shortName, name: m.name }))
			}))
		});
	} catch (error) {
		console.error('Error fetching routing rules:', error);
		return json(
			{ success: false, error: 'Failed to fetch routing rules' },
			{ status: 500 }
		);
	}
};

/**
 * PUT /api/config/agents/routing
 *
 * Update all routing rules.
 * Replaces the entire rule list with the provided rules.
 *
 * Body: { rules: AgentRoutingRule[] }
 */
export const PUT: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { rules } = body;

		if (!Array.isArray(rules)) {
			return json(
				{ success: false, error: 'Rules must be an array' },
				{ status: 400 }
			);
		}

		// Validate each rule
		const validationErrors: { index: number; errors: string[] }[] = [];
		rules.forEach((rule: Partial<AgentRoutingRule>, index: number) => {
			const validation = validateRoutingRule(rule);
			if (!validation.valid) {
				validationErrors.push({ index, errors: validation.errors });
			}
		});

		if (validationErrors.length > 0) {
			return json(
				{
					success: false,
					error: 'Validation failed for one or more rules',
					validationErrors
				},
				{ status: 400 }
			);
		}

		// Cast to proper type after validation
		const validatedRules = rules as AgentRoutingRule[];

		updateRoutingRules(validatedRules);

		// Return updated rules
		const updatedRules = getRoutingRules();

		return json({
			success: true,
			rules: updatedRules
		});
	} catch (error) {
		console.error('Error updating routing rules:', error);

		const errorMessage = error instanceof Error ? error.message : 'Failed to update routing rules';

		// Check for reference errors (unknown agent)
		if (errorMessage.includes('unknown agent')) {
			return json({ success: false, error: errorMessage }, { status: 400 });
		}

		return json({ success: false, error: errorMessage }, { status: 500 });
	}
};

/**
 * POST /api/config/agents/routing
 *
 * Evaluate routing rules for a sample task.
 * Used for testing/previewing which agent would be selected.
 *
 * Body: {
 *   task: {
 *     id?: string;
 *     type?: string;
 *     labels?: string[];
 *     priority?: number;
 *     project?: string;
 *     epic?: string;
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { task } = body;

		if (!task || typeof task !== 'object') {
			return json(
				{ success: false, error: 'Task object is required' },
				{ status: 400 }
			);
		}

		const result = evaluateRouting(task);

		return json({
			success: true,
			result: {
				agentId: result.agent.id,
				agentName: result.agent.name,
				modelId: result.model.id,
				modelName: result.model.name,
				matchedRule: result.matchedRule
					? {
							id: result.matchedRule.id,
							name: result.matchedRule.name
						}
					: null,
				reason: result.reason
			}
		});
	} catch (error) {
		console.error('Error evaluating routing:', error);

		const errorMessage = error instanceof Error ? error.message : 'Failed to evaluate routing';
		return json({ success: false, error: errorMessage }, { status: 500 });
	}
};
