/**
 * LLM Service - Centralized IDE helper LLM provider management
 *
 * Provides a unified interface for IDE helper features (task suggestions, summaries,
 * commit message generation, etc.) with configurable provider selection.
 *
 * Provider modes:
 * - auto: codex-native → Anthropic API → Claude CLI
 * - codex-native: codex-native only (requires auth)
 * - api: Anthropic API only
 * - cli: Claude CLI only
 *
 * Configuration stored in: ~/.config/jat/projects.json under "llm" key
 *
 * Task: jat-2af.4 - Make IDE helper LLM provider pluggable (Codex-native-first)
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { getApiKeyWithFallback } from '$lib/utils/credentials';
import { claudeCliCall, isClaudeCliAvailable, type ClaudeCliOptions } from './claudeCli';
import {
	codexNativeCliCall,
	isCodexNativeAuthAvailable,
	isCodexNativeCliAvailable,
	type CodexNativeCliOptions
} from './codexNativeCli';
import { LLM_PROVIDER_DEFAULTS, type LlmProviderMode } from '$lib/config/constants';

// Configuration path
const CONFIG_PATH = join(homedir(), '.config', 'jat', 'projects.json');

// Response types
export interface LlmResponse {
	/** The response text from the LLM */
	result: string;
	/** Which provider was used */
	provider: 'codex-native' | 'api' | 'cli';
	/** Token usage (if available) */
	usage?: {
		input_tokens: number;
		output_tokens: number;
		cache_creation_input_tokens?: number;
		cache_read_input_tokens?: number;
	};
	/** Cost in USD (if available, mainly from Claude CLI) */
	cost_usd?: number;
	/** Duration in ms (best-effort) */
	duration_ms?: number;
	/** Model used */
	model?: string;
}

export interface LlmCallOptions {
	/** Maximum tokens for response (API only) */
	maxTokens?: number;
	/** Override provider mode for this call */
	providerMode?: LlmProviderMode;
	/** Timeout in ms (CLI providers) */
	timeout?: number;
	/** Working directory for provider calls (codex-native) */
	cwd?: string;
	/** Optional schema path (codex-native --schema) */
	schemaPath?: string;
	/** Provider-specific model overrides */
	codexModel?: string;
	apiModel?: string;
	cliModel?: ClaudeCliOptions['model'];
}

export interface LlmConfig {
	mode: LlmProviderMode;
	codex_model: string;
	api_model: string;
	cli_model: 'haiku' | 'sonnet' | 'opus';
	cli_timeout_ms: number;
	show_provider_status: boolean;
}

export interface LlmProviderStatus {
	/** Currently configured mode */
	mode: LlmProviderMode;
	/** Whether codex-native CLI is installed */
	codexNativeAvailable: boolean;
	/** Whether codex-native has usable auth */
	codexNativeAuthAvailable: boolean;
	/** Whether Anthropic API key is available */
	apiAvailable: boolean;
	/** Whether Claude CLI is available */
	cliAvailable: boolean;
	/** Which provider would be used with current config */
	activeProvider: 'codex-native' | 'api' | 'cli' | 'none';
	/** Human-readable status message */
	statusMessage: string;
}

/**
 * Load LLM configuration from projects.json
 */
export function getLlmConfig(): LlmConfig {
	try {
		if (!existsSync(CONFIG_PATH)) {
			return { ...LLM_PROVIDER_DEFAULTS };
		}
		const content = readFileSync(CONFIG_PATH, 'utf-8');
		const config = JSON.parse(content) as Record<string, unknown>;
		const llmConfig = (config.llm || {}) as Record<string, unknown>;

		return {
			mode: (llmConfig.mode as LlmProviderMode) || LLM_PROVIDER_DEFAULTS.mode,
			codex_model: (llmConfig.codex_model as string) || LLM_PROVIDER_DEFAULTS.codex_model,
			api_model: (llmConfig.api_model as string) || LLM_PROVIDER_DEFAULTS.api_model,
			cli_model:
				((llmConfig.cli_model as LlmConfig['cli_model']) || LLM_PROVIDER_DEFAULTS.cli_model) as LlmConfig['cli_model'],
			cli_timeout_ms: (llmConfig.cli_timeout_ms as number) ?? LLM_PROVIDER_DEFAULTS.cli_timeout_ms,
			show_provider_status:
				(llmConfig.show_provider_status as boolean) ?? LLM_PROVIDER_DEFAULTS.show_provider_status
		};
	} catch (err) {
		console.error('[llmService] Failed to load config:', err);
		return { ...LLM_PROVIDER_DEFAULTS };
	}
}

/**
 * Check if Anthropic API key is available
 */
export function isApiKeyAvailable(): boolean {
	const apiKey = getApiKeyWithFallback('anthropic', 'ANTHROPIC_API_KEY');
	return !!apiKey;
}

/**
 * Get current provider status and availability
 */
export async function getLlmProviderStatus(): Promise<LlmProviderStatus> {
	const config = getLlmConfig();

	const [codexNativeAvailable, cliAvailable] = await Promise.all([
		isCodexNativeCliAvailable(),
		isClaudeCliAvailable()
	]);
	const codexNativeAuthAvailable = isCodexNativeAuthAvailable();
	const apiAvailable = isApiKeyAvailable();

	let activeProvider: LlmProviderStatus['activeProvider'] = 'none';
	let statusMessage = '';

	switch (config.mode) {
		case 'codex-native':
			if (!codexNativeAvailable) {
				statusMessage = 'codex-native mode selected but codex-native is not installed';
				break;
			}
			if (!codexNativeAuthAvailable) {
				statusMessage = 'codex-native mode selected but no Codex auth available (set OPENAI_API_KEY or create ~/.codex/auth.json)';
				break;
			}
			activeProvider = 'codex-native';
			statusMessage = 'Using codex-native';
			break;

		case 'api':
			if (apiAvailable) {
				activeProvider = 'api';
				statusMessage = 'Using Anthropic API';
			} else {
				statusMessage = 'API mode selected but no Anthropic API key available';
			}
			break;

		case 'cli':
			if (cliAvailable) {
				activeProvider = 'cli';
				statusMessage = 'Using Claude CLI';
			} else {
				statusMessage = 'CLI mode selected but Claude CLI not available';
			}
			break;

		case 'auto':
		default:
			if (codexNativeAvailable && codexNativeAuthAvailable) {
				activeProvider = 'codex-native';
				statusMessage = 'Using codex-native (auto mode)';
				break;
			}
			if (apiAvailable) {
				activeProvider = 'api';
				statusMessage = 'Using Anthropic API (auto fallback)';
				break;
			}
			if (cliAvailable) {
				activeProvider = 'cli';
				statusMessage = 'Using Claude CLI (auto fallback)';
				break;
			}
			statusMessage = 'No LLM provider available - install codex-native, configure OPENAI_API_KEY, set ANTHROPIC_API_KEY, or install Claude Code';
			break;
	}

	return {
		mode: config.mode,
		codexNativeAvailable,
		codexNativeAuthAvailable,
		apiAvailable,
		cliAvailable,
		activeProvider,
		statusMessage
	};
}

/**
 * Make a direct API call to Anthropic
 */
async function callApi(
	prompt: string,
	options: {
		apiKey: string;
		model: string;
		maxTokens: number;
	}
): Promise<LlmResponse> {
	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': options.apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: options.model,
			max_tokens: options.maxTokens,
			messages: [{ role: 'user', content: prompt }]
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Anthropic API error: ${response.status} - ${errorText.slice(0, 200)}`);
	}

	const result = (await response.json()) as {
		content?: Array<{ type?: string; text?: string }>;
		usage?: {
			input_tokens?: number;
			output_tokens?: number;
			cache_creation_input_tokens?: number;
			cache_read_input_tokens?: number;
		};
	};

	const textContent = result.content?.find((c) => c.type === 'text');
	if (!textContent?.text) {
		throw new Error('No text response from Anthropic API');
	}

	return {
		result: textContent.text,
		provider: 'api',
		usage: result.usage
			? {
					input_tokens: result.usage.input_tokens || 0,
					output_tokens: result.usage.output_tokens || 0,
					cache_creation_input_tokens: result.usage.cache_creation_input_tokens,
					cache_read_input_tokens: result.usage.cache_read_input_tokens
				}
			: undefined,
		model: options.model
	};
}

async function callCodexNative(
	prompt: string,
	options: {
		model: string;
		schemaPath?: string;
		timeoutMs?: number;
		cwd?: string;
	}
): Promise<LlmResponse> {
	const start = Date.now();
	const response = await codexNativeCliCall(prompt, {
		model: options.model,
		schemaPath: options.schemaPath,
		timeout: options.timeoutMs,
		cwd: options.cwd
	} satisfies CodexNativeCliOptions);

	return {
		result: response.result,
		provider: 'codex-native',
		usage: response.usage,
		duration_ms: Date.now() - start,
		model: options.model
	};
}

async function callClaudeCli(
	prompt: string,
	options: {
		model: ClaudeCliOptions['model'];
		timeoutMs?: number;
	}
): Promise<LlmResponse> {
	const start = Date.now();
	const cliResponse = await claudeCliCall(prompt, {
		model: options.model,
		timeout: options.timeoutMs
	});

	return {
		result: cliResponse.result,
		provider: 'cli',
		usage: cliResponse.usage,
		cost_usd: cliResponse.cost_usd,
		duration_ms: cliResponse.duration_ms ?? Date.now() - start,
		model: cliResponse.model
	};
}

/**
 * Make an LLM call using the configured provider
 */
export async function llmCall(prompt: string, options?: LlmCallOptions): Promise<LlmResponse> {
	const config = getLlmConfig();
	const mode = options?.providerMode || config.mode;
	const maxTokens = options?.maxTokens || 1024;

	const codexModel = options?.codexModel || config.codex_model;
	const apiModel = options?.apiModel || config.api_model;
	const cliModel = options?.cliModel || config.cli_model;
	const schemaPath = options?.schemaPath;

	// codex-native runs an agent loop and can take longer than typical CLI calls.
	// Use a higher floor to avoid spurious timeouts and unnecessary provider fallbacks.
	const cliTimeoutMs = options?.timeout ?? config.cli_timeout_ms;
	const codexTimeoutMs = options?.timeout ?? Math.max(config.cli_timeout_ms, 60000);

	// Availability
	const apiKey = getApiKeyWithFallback('anthropic', 'ANTHROPIC_API_KEY');
	const apiAvailable = !!apiKey;

	switch (mode) {
		case 'codex-native': {
			const codexAvailable = await isCodexNativeCliAvailable();
			if (!codexAvailable) {
				throw new Error('codex-native mode selected but codex-native is not available on PATH.');
			}
			if (!isCodexNativeAuthAvailable()) {
				throw new Error(
					'codex-native mode selected but no Codex auth is available. Set OPENAI_API_KEY or create ~/.codex/auth.json (e.g., via "codex login").'
				);
			}
			return await callCodexNative(prompt, {
				model: codexModel,
				schemaPath,
				timeoutMs: codexTimeoutMs,
				cwd: options?.cwd
			});
		}

		case 'api':
			if (!apiAvailable) {
				throw new Error(
					'API mode selected but no Anthropic API key available. Configure in Settings → API Keys or set ANTHROPIC_API_KEY.'
				);
			}
			return await callApi(prompt, {
				apiKey: apiKey!,
				model: apiModel,
				maxTokens
			});

		case 'cli': {
			const cliAvailable = await isClaudeCliAvailable();
			if (!cliAvailable) {
				throw new Error('CLI mode selected but Claude CLI not available. Install Claude Code or switch providers.');
			}
			return await callClaudeCli(prompt, {
				model: cliModel,
				timeoutMs: cliTimeoutMs
			});
		}

		case 'auto':
		default: {
			const formatErr = (err: unknown): string => (err instanceof Error ? err.message : String(err));

			let codexError: string | undefined;
			let apiError: string | undefined;

			// 1) codex-native
			try {
				const codexAvailable = await isCodexNativeCliAvailable();
				if (!codexAvailable) {
					codexError = 'not installed';
				} else if (!isCodexNativeAuthAvailable()) {
					codexError = 'missing auth (set OPENAI_API_KEY or create ~/.codex/auth.json)';
				} else {
					return await callCodexNative(prompt, {
						model: codexModel,
						schemaPath,
						timeoutMs: codexTimeoutMs,
						cwd: options?.cwd
					});
				}
			} catch (codexErr) {
				codexError = formatErr(codexErr);
				console.warn('[llmService] codex-native call failed, falling back:', codexErr);
			}

			// 2) Anthropic API
			if (apiAvailable) {
				try {
					return await callApi(prompt, {
						apiKey: apiKey!,
						model: apiModel,
						maxTokens
					});
				} catch (apiErr) {
					apiError = formatErr(apiErr);
					console.warn('[llmService] API call failed, falling back:', apiErr);
				}
			} else {
				apiError = 'not configured (set ANTHROPIC_API_KEY)';
			}

			// 3) Claude CLI
			const cliAvailable = await isClaudeCliAvailable();
			if (cliAvailable) {
				try {
					return await callClaudeCli(prompt, {
						model: cliModel,
						timeoutMs: cliTimeoutMs
					});
				} catch (cliErr) {
					const cliError = formatErr(cliErr);
					throw new Error(
						'All providers failed.\n' +
							`- codex-native: ${codexError || 'unknown'}\n` +
							`- api: ${apiError || (apiAvailable ? 'unknown' : 'not configured')}\n` +
							`- cli: ${cliError}`
					);
				}
			}

			throw new Error(
				'All providers failed.\n' +
					`- codex-native: ${codexError || 'unknown'}\n` +
					`- api: ${apiError || (apiAvailable ? 'unknown' : 'not configured')}\n` +
					'- cli: not installed\n\n' +
				'Fix:\n' +
				'1. Install codex-native and authenticate (OPENAI_API_KEY or ~/.codex/auth.json)\n' +
				'2. Configure Anthropic API key in Settings → API Keys\n' +
				'3. Install Claude Code CLI and authenticate'
			);
		}
	}
}

/**
 * Strip markdown code blocks from LLM response (common with JSON output)
 */
export function stripCodeBlocks(text: string): string {
	let result = text.trim();
	if (result.startsWith('```')) {
		result = result.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
	}
	return result;
}

/**
 * Parse JSON from LLM response, handling common formatting issues
 */
export function parseJsonResponse<T>(text: string): T {
	const cleaned = stripCodeBlocks(text);
	return JSON.parse(cleaned) as T;
}

/**
 * Resolve the JAT repo root (directory containing tools/llm).
 * Useful for stable schema path resolution when IDE runs with cwd=ide/.
 */
export function getJatRepoRootPath(): string | null {
	let current = process.cwd();
	for (let i = 0; i < 10; i++) {
		const candidate = join(current, 'tools', 'llm');
		if (existsSync(candidate)) {
			return current;
		}
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return null;
}

/**
 * Resolve an absolute schema path from tools/llm/{schemaFile}.
 */
export function getLlmSchemaPath(schemaFile: string): string | null {
	const root = getJatRepoRootPath();
	if (!root) return null;
	const fullPath = join(root, 'tools', 'llm', schemaFile);
	return existsSync(fullPath) ? fullPath : null;
}
