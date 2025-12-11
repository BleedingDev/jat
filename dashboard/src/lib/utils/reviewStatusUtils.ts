/**
 * Review Status Utilities
 *
 * Computes whether a task requires human review or can auto-proceed
 * based on review rules configuration and task-level overrides.
 */

export interface ReviewRule {
	type: string;
	maxAutoPriority: number;
	note?: string;
}

export interface ReviewRulesConfig {
	version?: number;
	defaultAction?: 'review' | 'auto';
	priorityThreshold?: number;
	rules: ReviewRule[];
	overrides?: Array<{ taskId: string; action: 'always_review' | 'always_auto' }>;
}

export type ReviewAction = 'review' | 'auto';
export type ReviewSource = 'override' | 'type_rule' | 'default';

export interface ReviewStatus {
	/** Whether the task requires review or can auto-proceed */
	action: ReviewAction;
	/** Why this action was determined */
	reason: string;
	/** Source of the determination: override, type_rule, or default */
	source: ReviewSource;
	/** Whether this task has a review_override set */
	hasOverride: boolean;
	/** The rule that was applied (if source is type_rule) */
	rule?: ReviewRule;
}

export interface TaskForReview {
	id: string;
	issue_type?: string | null;
	priority?: number;
	review_override?: string | null;
}

/**
 * Compute the review status for a task based on review rules
 *
 * @param task - The task to check
 * @param reviewRules - The review rules configuration (or just rules array)
 * @returns ReviewStatus with action, reason, source, and hasOverride
 */
export function computeReviewStatus(
	task: TaskForReview,
	reviewRules: ReviewRulesConfig | ReviewRule[]
): ReviewStatus {
	// Normalize rules input
	const config: ReviewRulesConfig = Array.isArray(reviewRules)
		? { rules: reviewRules, defaultAction: 'review' }
		: reviewRules;

	const rules = config.rules || [];
	const defaultAction = config.defaultAction || 'review';

	// Get task properties with defaults
	const taskType = task.issue_type || 'task';
	const taskPriority = task.priority ?? 2;
	const taskOverride = task.review_override;

	// 1. Check task-level override first
	if (taskOverride === 'always_review') {
		return {
			action: 'review',
			reason: 'Task override: always require review',
			source: 'override',
			hasOverride: true
		};
	}

	if (taskOverride === 'always_auto') {
		return {
			action: 'auto',
			reason: 'Task override: always auto-proceed',
			source: 'override',
			hasOverride: true
		};
	}

	// 2. Check centralized overrides (from review-rules.json)
	const centralOverride = config.overrides?.find(o => o.taskId === task.id);
	if (centralOverride) {
		return {
			action: centralOverride.action === 'always_review' ? 'review' : 'auto',
			reason: `Centralized override: ${centralOverride.action}`,
			source: 'override',
			hasOverride: true
		};
	}

	// 3. Find type-specific rule
	const rule = rules.find(r => r.type === taskType);

	if (rule) {
		const maxAuto = rule.maxAutoPriority;

		// maxAuto < 0 means all priorities require review
		if (maxAuto < 0) {
			return {
				action: 'review',
				reason: `${taskType}: all priorities require review`,
				source: 'type_rule',
				hasOverride: false,
				rule
			};
		}

		// Check if priority is within auto-proceed range
		if (taskPriority <= maxAuto) {
			return {
				action: 'auto',
				reason: `${taskType}: P${taskPriority} <= P${maxAuto} auto threshold`,
				source: 'type_rule',
				hasOverride: false,
				rule
			};
		} else {
			return {
				action: 'review',
				reason: `${taskType}: P${taskPriority} > P${maxAuto} auto threshold`,
				source: 'type_rule',
				hasOverride: false,
				rule
			};
		}
	}

	// 4. No type-specific rule found, use default
	return {
		action: defaultAction,
		reason: `No rule for type '${taskType}', using default: ${defaultAction}`,
		source: 'default',
		hasOverride: false
	};
}

/**
 * Get a short label for the review status (for badges)
 */
export function getReviewStatusLabel(status: ReviewStatus): string {
	return status.action === 'review' ? 'Review' : 'Auto';
}

/**
 * Get icon info for review status display
 */
export function getReviewStatusIcon(status: ReviewStatus): {
	icon: 'eye' | 'check';
	color: string;
	bgColor: string;
} {
	if (status.action === 'review') {
		return {
			icon: 'eye',
			color: 'oklch(0.80 0.15 45)', // Orange/amber
			bgColor: 'oklch(0.80 0.15 45 / 0.15)'
		};
	} else {
		return {
			icon: 'check',
			color: 'oklch(0.75 0.15 145)', // Green
			bgColor: 'oklch(0.75 0.15 145 / 0.15)'
		};
	}
}
