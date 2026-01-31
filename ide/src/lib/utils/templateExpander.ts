/**
 * Template Expander — Expand a task blueprint with {{variable}} placeholders
 *
 * Input: YAML text with `template:` (task blueprint) and `data:` (variable rows)
 * Output: Expanded ParsedTask[] ready for bulk creation
 *
 * Used by: CreateTemplate tab
 */
import yaml from 'js-yaml';
import type { ParsedTask } from './taskParser';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TaskTemplate {
	title: string;
	type?: string;
	priority?: number;
	labels?: string[];
	description?: string;
	assignee?: string;
	deps?: string[];
}

export interface TemplateExpansionResult {
	tasks: ParsedTask[];
	variables: string[];
	rowCount: number;
	warnings: string[];
	errors: string[];
}

interface TemplateDocument {
	template: TaskTemplate;
	data: Record<string, string>[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const VALID_TYPES = ['bug', 'task', 'feature', 'epic', 'chore'];
const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

// ─── Core ───────────────────────────────────────────────────────────────────

/**
 * Extract all {{variable}} names from a string.
 */
function extractVariables(text: string): string[] {
	const vars = new Set<string>();
	let match;
	const regex = new RegExp(VARIABLE_REGEX.source, 'g');
	while ((match = regex.exec(text)) !== null) {
		vars.add(match[1]);
	}
	return Array.from(vars);
}

/**
 * Extract all variables from an entire template object.
 */
function extractAllVariables(template: TaskTemplate): string[] {
	const parts: string[] = [template.title];
	if (template.description) parts.push(template.description);
	if (template.assignee) parts.push(template.assignee);
	if (template.type) parts.push(template.type);
	if (template.labels) parts.push(template.labels.join(','));
	if (template.deps) parts.push(template.deps.join(','));
	return extractVariables(parts.join(' '));
}

/**
 * Substitute {{var}} placeholders in a string using a data row.
 */
function substituteString(text: string, row: Record<string, string>): string {
	return text.replace(VARIABLE_REGEX, (_, varName) => {
		return row[varName] !== undefined ? String(row[varName]) : `{{${varName}}}`;
	});
}

/**
 * Substitute variables in a labels array.
 */
function substituteLabels(
	labels: string[],
	row: Record<string, string>
): string[] {
	return labels.map((l) => substituteString(l, row));
}

/**
 * Substitute variables in a deps array.
 */
function substituteDeps(
	deps: string[],
	row: Record<string, string>
): string[] {
	return deps.map((d) => substituteString(d, row));
}

/**
 * Parse and validate the YAML template document.
 */
function parseTemplateYaml(text: string): { doc: TemplateDocument; errors: string[] } {
	const errors: string[] = [];

	let raw: unknown;
	try {
		raw = yaml.load(text);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { doc: { template: { title: '' }, data: [] }, errors: [`YAML parse error: ${msg}`] };
	}

	if (!raw || typeof raw !== 'object') {
		return { doc: { template: { title: '' }, data: [] }, errors: ['YAML must be an object with "template" and "data" keys'] };
	}

	const obj = raw as Record<string, unknown>;

	// Validate template section
	if (!obj.template || typeof obj.template !== 'object') {
		errors.push('Missing "template" section — expected an object with at least a "title" field');
	}

	// Validate data section
	if (!obj.data || !Array.isArray(obj.data)) {
		errors.push('Missing "data" section — expected an array of variable rows');
	}

	if (errors.length > 0) {
		return { doc: { template: { title: '' }, data: [] }, errors };
	}

	const template = obj.template as Record<string, unknown>;
	const data = obj.data as unknown[];

	// Validate template has title
	if (!template.title || typeof template.title !== 'string') {
		errors.push('Template must have a "title" field (string)');
		return { doc: { template: { title: '' }, data: [] }, errors };
	}

	// Parse template
	const taskTemplate: TaskTemplate = {
		title: String(template.title),
	};

	if (template.type) taskTemplate.type = String(template.type);
	if (template.priority !== undefined && template.priority !== null) {
		const p = Number(template.priority);
		if (!isNaN(p) && p >= 0 && p <= 4) {
			taskTemplate.priority = p;
		} else {
			errors.push(`Template priority "${template.priority}" is invalid (must be 0-4)`);
		}
	}
	if (template.labels) {
		if (Array.isArray(template.labels)) {
			taskTemplate.labels = template.labels.map(String);
		} else if (typeof template.labels === 'string') {
			taskTemplate.labels = template.labels.split(',').map((s) => s.trim()).filter(Boolean);
		}
	}
	if (template.description) taskTemplate.description = String(template.description);
	if (template.assignee) taskTemplate.assignee = String(template.assignee);
	if (template.deps) {
		if (Array.isArray(template.deps)) {
			taskTemplate.deps = template.deps.map(String);
		} else if (typeof template.deps === 'string') {
			taskTemplate.deps = template.deps.split(',').map((s) => s.trim()).filter(Boolean);
		}
	}

	// Parse data rows
	const parsedData: Record<string, string>[] = [];
	for (let i = 0; i < data.length; i++) {
		const row = data[i];
		if (!row || typeof row !== 'object') {
			errors.push(`Data row ${i + 1}: expected an object with variable key-value pairs`);
			continue;
		}
		const parsed: Record<string, string> = {};
		for (const [key, val] of Object.entries(row as Record<string, unknown>)) {
			parsed[key] = String(val);
		}
		parsedData.push(parsed);
	}

	return {
		doc: { template: taskTemplate, data: parsedData },
		errors,
	};
}

// ─── Main ───────────────────────────────────────────────────────────────────

/**
 * Expand a YAML template into ParsedTask[].
 *
 * @param templateYaml - YAML string with `template:` and `data:` sections
 * @returns TemplateExpansionResult with tasks, detected variables, warnings, errors
 */
export function expandTemplate(templateYaml: string): TemplateExpansionResult {
	const trimmed = templateYaml.trim();
	if (!trimmed) {
		return { tasks: [], variables: [], rowCount: 0, warnings: [], errors: [] };
	}

	const warnings: string[] = [];
	const { doc, errors } = parseTemplateYaml(trimmed);

	if (errors.length > 0) {
		return { tasks: [], variables: [], rowCount: 0, warnings, errors };
	}

	const { template, data } = doc;
	const variables = extractAllVariables(template);

	if (data.length === 0) {
		return { tasks: [], variables, rowCount: 0, warnings: ['No data rows — add rows to the "data" section'], errors };
	}

	// Check for unused variables in data rows
	if (data.length > 0) {
		const dataKeys = new Set(Object.keys(data[0]));
		for (const v of variables) {
			if (!dataKeys.has(v)) {
				warnings.push(`Variable "{{${v}}}" in template but not found in data rows`);
			}
		}
		for (const k of dataKeys) {
			if (!variables.includes(k)) {
				warnings.push(`Data key "${k}" not used in template`);
			}
		}
	}

	// Expand each data row into a task
	const tasks: ParsedTask[] = [];
	for (let i = 0; i < data.length; i++) {
		const row = data[i];
		const task: ParsedTask = {
			title: substituteString(template.title, row),
		};

		if (template.type) {
			const expandedType = substituteString(template.type, row).toLowerCase();
			if (VALID_TYPES.includes(expandedType)) {
				task.type = expandedType;
			} else {
				task.type = expandedType;
				warnings.push(`Row ${i + 1}: type "${expandedType}" may not be valid`);
			}
		}

		if (template.priority !== undefined) {
			task.priority = template.priority;
		}

		if (template.labels) {
			task.labels = substituteLabels(template.labels, row);
		}

		if (template.description) {
			task.description = substituteString(template.description, row);
		}

		if (template.assignee) {
			task.assignee = substituteString(template.assignee, row);
		}

		if (template.deps) {
			task.deps = substituteDeps(template.deps, row);
		}

		// Validate expanded title
		if (!task.title.trim()) {
			warnings.push(`Row ${i + 1}: expanded title is empty`);
		}

		tasks.push(task);
	}

	return {
		tasks,
		variables,
		rowCount: data.length,
		warnings,
		errors: [],
	};
}
