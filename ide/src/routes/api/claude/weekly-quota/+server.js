import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * API endpoint for fetching weekly Claude API quota data
 *
 * Returns weekly usage metrics from Cost Report API (when available)
 * For now, returns mock data until Cost Report API is integrated
 *
 * Response format:
 * {
 *   tokensUsed: number,
 *   tokensLimit: number,
 *   costUsd: number,
 *   costLimit: number,
 *   periodStart: ISO date string,
 *   periodEnd: ISO date string,
 *   estimatedEndOfWeekCost: number (optional)
 * }
 */
export async function GET() {
	const claudeMetricsEnabled = env.JAT_ENABLE_CLAUDE_METRICS === 'true';
	const now = new Date();
	const weekStart = new Date(now);
	weekStart.setDate(now.getDate() - now.getDay()); // Sunday of current week
	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekStart.getDate() + 6); // Saturday of current week

	if (!claudeMetricsEnabled) {
		return json({
			enabled: false,
			tokensUsed: 0,
			tokensLimit: 0,
			costUsd: 0,
			costLimit: 0,
			periodStart: weekStart.toISOString(),
			periodEnd: weekEnd.toISOString(),
			estimatedEndOfWeekCost: null,
			message:
				'Claude weekly quota metrics are disabled. Set JAT_ENABLE_CLAUDE_METRICS=true to enable this endpoint.'
		});
	}

	return json({
		enabled: true,
		tokensUsed: 0,
		tokensLimit: 0,
		costUsd: 0,
		costLimit: 0,
		periodStart: weekStart.toISOString(),
		periodEnd: weekEnd.toISOString(),
		estimatedEndOfWeekCost: null,
		error: 'Not Implemented',
		message:
			'Claude weekly quota integration is not implemented. This endpoint no longer returns mock values.'
	}, { status: 501 });
}

/**
 * Integration notes for jat-sk1:
 *
 * 1. Add ANTHROPIC_ADMIN_API_KEY to environment variables
 * 2. Implement Cost Report API call:
 *    POST https://api.anthropic.com/v1/organization/cost_report
 *    Authorization: x-api-key: <admin-key>
 *    Body: { start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD" }
 *
 * 3. Parse response:
 *    - Sum daily_costs[].cost_usd for total cost
 *    - Estimate tokens from cost (rough: 20K tokens per dollar)
 *    - Calculate daily average and projected total
 *
 * 4. Cache response (5-minute TTL to respect rate limits)
 * 5. Handle errors gracefully (return last known good data)
 * 6. Add token limit from config (not returned by API)
 */
