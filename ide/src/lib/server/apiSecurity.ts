import { createHash } from 'crypto';
import { extractApiToken } from '$lib/server/apiAuth';

const BOOL_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const TERMINAL_CONTROL_ENDPOINT_PATTERNS: RegExp[] = [
	/^\/api\/work\/[^/]+\/attach$/,
	/^\/api\/sessions\/[^/]+\/attach$/,
	/^\/api\/sessions\/[^/]+\/resume$/,
	/^\/api\/sessions\/yolo$/,
	/^\/api\/supabase\/link$/
];

const HIGH_RISK_MUTATING_ENDPOINT_PATTERNS: RegExp[] = [
	/^\/api\/work\/spawn$/,
	/^\/api\/work\/[^/]+\/restart$/,
	/^\/api\/sessions\/[^/]+\/resume$/,
	/^\/api\/sessions\/batch$/,
	/^\/api\/tasks\/next$/
];

interface RateLimitBucket {
	windowStartMs: number;
	count: number;
}

export interface RateLimitCheckResult {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetAtMs: number;
	retryAfterSeconds: number;
}

export interface ApiSecurityConfig {
	rateLimitWindowMs: number;
	readRateLimitMax: number;
	writeRateLimitMax: number;
	maxBodyBytes: number;
	maxUploadBodyBytes: number;
	highRiskMutatingTimeoutMs: number;
	enableRemoteTerminalControl: boolean;
}

function parseBoolean(value: string | undefined): boolean {
	if (!value) return false;
	return BOOL_TRUE_VALUES.has(value.trim().toLowerCase());
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
	if (!value) return fallback;
	const parsed = Number.parseInt(value.trim(), 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return parsed;
}

export function parseApiSecurityConfig(env: NodeJS.ProcessEnv): ApiSecurityConfig {
	return {
		rateLimitWindowMs: parsePositiveInt(env.JAT_API_RATE_LIMIT_WINDOW_MS, 60_000),
		readRateLimitMax: parsePositiveInt(env.JAT_API_RATE_LIMIT_READ_MAX, 240),
		writeRateLimitMax: parsePositiveInt(env.JAT_API_RATE_LIMIT_WRITE_MAX, 120),
		maxBodyBytes: parsePositiveInt(env.JAT_MAX_API_BODY_BYTES, 10 * 1024 * 1024),
		maxUploadBodyBytes: parsePositiveInt(env.JAT_MAX_API_UPLOAD_BODY_BYTES, 50 * 1024 * 1024),
		highRiskMutatingTimeoutMs: parsePositiveInt(env.JAT_API_MUTATING_TIMEOUT_MS, 90_000),
		enableRemoteTerminalControl: parseBoolean(env.JAT_ENABLE_REMOTE_TERMINAL_CONTROL)
	};
}

export function isMutatingMethod(method: string): boolean {
	return MUTATING_METHODS.has(method.toUpperCase());
}

export function isTerminalControlEndpoint(pathname: string): boolean {
	return TERMINAL_CONTROL_ENDPOINT_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function isHighRiskMutatingEndpoint(pathname: string, method: string): boolean {
	if (!isMutatingMethod(method)) return false;
	return HIGH_RISK_MUTATING_ENDPOINT_PATTERNS.some((pattern) => pattern.test(pathname));
}

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

export function buildApiRateLimitKey(headers: Headers, clientIp: string): string {
	const token = extractApiToken(headers);
	if (token) {
		return `token:${hashToken(token)}`;
	}
	return `ip:${clientIp}`;
}

export function getBodySizeLimitForPath(pathname: string, config: ApiSecurityConfig): number {
	if (pathname === '/api/transcribe') {
		return config.maxUploadBodyBytes;
	}
	return config.maxBodyBytes;
}

export function validateApiBodySize(
	pathname: string,
	method: string,
	headers: Headers,
	config: ApiSecurityConfig
): { allowed: true } | { allowed: false; maxBodyBytes: number; contentLength: number } {
	if (!isMutatingMethod(method)) {
		return { allowed: true };
	}

	const contentLengthHeader = headers.get('content-length');
	if (!contentLengthHeader) {
		return { allowed: true };
	}

	const contentLength = Number.parseInt(contentLengthHeader, 10);
	if (!Number.isFinite(contentLength) || contentLength < 0) {
		return { allowed: true };
	}

	const maxBodyBytes = getBodySizeLimitForPath(pathname, config);
	if (contentLength > maxBodyBytes) {
		return {
			allowed: false,
			maxBodyBytes,
			contentLength
		};
	}

	return { allowed: true };
}

export class ApiRateLimiter {
	private readonly buckets = new Map<string, RateLimitBucket>();
	private mutationCount = 0;

	check(key: string, maxRequests: number, windowMs: number, nowMs = Date.now()): RateLimitCheckResult {
		const bucket = this.buckets.get(key);
		if (!bucket || nowMs - bucket.windowStartMs >= windowMs) {
			this.buckets.set(key, { windowStartMs: nowMs, count: 1 });
			this.prune(nowMs, windowMs);
			return {
				allowed: true,
				limit: maxRequests,
				remaining: Math.max(0, maxRequests - 1),
				resetAtMs: nowMs + windowMs,
				retryAfterSeconds: Math.ceil(windowMs / 1000)
			};
		}

		bucket.count += 1;
		const resetAtMs = bucket.windowStartMs + windowMs;
		const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));

		if (bucket.count > maxRequests) {
			return {
				allowed: false,
				limit: maxRequests,
				remaining: 0,
				resetAtMs,
				retryAfterSeconds
			};
		}

		return {
			allowed: true,
			limit: maxRequests,
			remaining: Math.max(0, maxRequests - bucket.count),
			resetAtMs,
			retryAfterSeconds
		};
	}

	private prune(nowMs: number, windowMs: number): void {
		this.mutationCount += 1;
		if (this.mutationCount % 200 !== 0) return;

		for (const [key, bucket] of this.buckets.entries()) {
			if (nowMs - bucket.windowStartMs >= windowMs * 2) {
				this.buckets.delete(key);
			}
		}
	}
}
