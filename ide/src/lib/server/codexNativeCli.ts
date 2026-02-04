/**
 * Codex-native CLI Utility
 *
 * Provides utility LLM calls via `codex-native run`.
 * This is used for IDE helper features (task suggestions, summaries, etc.)
 * so that JAT can be Codex-native-first while preserving Claude compatibility.
 */

import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export interface CodexNativeRunUsage {
	input_tokens: number;
	cached_input_tokens?: number;
	output_tokens: number;
	reasoning_output_tokens?: number;
	total_tokens?: number;
}

export interface CodexNativeCliResponse {
	result: string;
	thread_id?: string;
	usage?: {
		input_tokens: number;
		cache_read_input_tokens?: number;
		output_tokens: number;
	};
	model?: string;
	stderr?: string;
}

export interface CodexNativeCliOptions {
	model?: string;
	schemaPath?: string;
	timeout?: number;
	cwd?: string;
}

/**
 * Check if codex-native CLI is available.
 */
export async function isCodexNativeCliAvailable(): Promise<boolean> {
	try {
		await execAsync('codex-native --version', { timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Best-effort auth detection for Codex.
 *
 * codex-native can reuse credentials written by `codex login` (typically ~/.codex/auth.json)
 * or use OPENAI_API_KEY / --api-key.
 */
export function isCodexNativeAuthAvailable(): boolean {
	if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0) {
		return true;
	}

	try {
		const authPath = join(homedir(), '.codex', 'auth.json');
		return existsSync(authPath);
	} catch {
		return false;
	}
}

/**
 * Run codex-native in non-interactive mode and return the final agent message.
 *
 * Note: codex-native emits JSONL events on stdout. We parse those events and
 * extract the last `agent_message` plus usage from `turn.completed`.
 */
export async function codexNativeCliCall(
	prompt: string,
	options?: CodexNativeCliOptions
): Promise<CodexNativeCliResponse> {
	const args: string[] = ['run', '--approval', 'never', '--sandbox', 'danger-full-access'];

	if (options?.model) {
		args.push('--model', options.model);
	}

	if (options?.schemaPath) {
		args.push('--schema', options.schemaPath);
	}

	// codex-native takes the prompt as a positional arg (no stdin mode).
	args.push(prompt);

	return await new Promise((resolve, reject) => {
		const child = spawn('codex-native', args, {
			cwd: options?.cwd,
			stdio: ['ignore', 'pipe', 'pipe']
		});

		let stdoutLineBuf = '';
		let stderrBuf = '';

		let threadId: string | undefined;
		let lastAgentMessage: string | undefined;
		let usage: CodexNativeRunUsage | undefined;

		const timeoutMs = options?.timeout ?? 30000;
		let didTimeout = false;
		const timeout = setTimeout(() => {
			didTimeout = true;
			try {
				child.kill('SIGTERM');
			} catch {
				// ignore
			}
		}, timeoutMs);

		child.stdout.on('data', (chunk) => {
			stdoutLineBuf += String(chunk);
			const lines = stdoutLineBuf.split(/\r?\n/);
			stdoutLineBuf = lines.pop() || '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;

				try {
					const evt = JSON.parse(trimmed) as Record<string, unknown>;
					const type = evt.type;

					if (type === 'thread.started') {
						const maybeThreadId = evt.thread_id;
						if (typeof maybeThreadId === 'string') {
							threadId = maybeThreadId;
						}
						continue;
					}

					if (type === 'item.completed') {
						const item = evt.item as Record<string, unknown> | undefined;
						if (item && item.type === 'agent_message') {
							const text = item.text;
							if (typeof text === 'string') {
								lastAgentMessage = text;
							}
						}
						continue;
					}

					if (type === 'turn.completed') {
						const u = evt.usage as Record<string, unknown> | undefined;
						if (u) {
							const input = u.input_tokens;
							const cached = u.cached_input_tokens;
							const output = u.output_tokens;
							const reasoningOut = u.reasoning_output_tokens;
							const total = u.total_tokens;

							if (typeof input === 'number' && typeof output === 'number') {
								usage = {
									input_tokens: input,
									cached_input_tokens: typeof cached === 'number' ? cached : undefined,
									output_tokens: output,
									reasoning_output_tokens: typeof reasoningOut === 'number' ? reasoningOut : undefined,
									total_tokens: typeof total === 'number' ? total : undefined
								};
							}
						}
						continue;
					}
				} catch {
					// Ignore non-JSON stdout lines.
				}
			}
		});

		child.stderr.on('data', (chunk) => {
			stderrBuf += String(chunk);
		});

		child.on('error', (err) => {
			clearTimeout(timeout);
			reject(err);
		});

		child.on('close', (code, signal) => {
			clearTimeout(timeout);

			if (signal) {
				if (didTimeout) {
					reject(new Error(`codex-native timed out after ${timeoutMs}ms`));
					return;
				}
				reject(new Error(`codex-native was terminated (${signal})`));
				return;
			}

			if (code !== 0) {
				reject(new Error(`codex-native exited with code ${code}${stderrBuf ? `: ${stderrBuf.trim()}` : ''}`));
				return;
			}

			if (!lastAgentMessage) {
				reject(new Error(`codex-native produced no agent message${stderrBuf ? `: ${stderrBuf.trim()}` : ''}`));
				return;
			}

			// Convert Codex usage into Claude-like fields.
			let normalizedUsage: CodexNativeCliResponse['usage'] | undefined;
			if (usage) {
				const cached = usage.cached_input_tokens ?? 0;
				const uncachedInput = Math.max(0, usage.input_tokens - cached);
				normalizedUsage = {
					input_tokens: uncachedInput,
					cache_read_input_tokens: cached,
					output_tokens: usage.output_tokens + (usage.reasoning_output_tokens ?? 0)
				};
			}

			resolve({
				result: lastAgentMessage,
				thread_id: threadId,
				usage: normalizedUsage,
				model: options?.model,
				stderr: stderrBuf || undefined
			});
		});
	});
}
