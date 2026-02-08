import { describe, expect, it } from 'vitest';
import {
	ApiRateLimiter,
	buildApiRateLimitKey,
	getBodySizeLimitForPath,
	isHighRiskMutatingEndpoint,
	isTerminalControlEndpoint,
	parseApiSecurityConfig,
	validateApiBodySize
} from './apiSecurity';

describe('parseApiSecurityConfig', () => {
	it('parses config values from environment', () => {
		const config = parseApiSecurityConfig({
			JAT_API_RATE_LIMIT_WINDOW_MS: '120000',
			JAT_API_RATE_LIMIT_READ_MAX: '500',
			JAT_API_RATE_LIMIT_WRITE_MAX: '50',
			JAT_MAX_API_BODY_BYTES: '2048',
			JAT_MAX_API_UPLOAD_BODY_BYTES: '8192',
			JAT_API_MUTATING_TIMEOUT_MS: '45000',
			JAT_ENABLE_REMOTE_TERMINAL_CONTROL: 'true'
		} as NodeJS.ProcessEnv);

		expect(config.rateLimitWindowMs).toBe(120000);
		expect(config.readRateLimitMax).toBe(500);
		expect(config.writeRateLimitMax).toBe(50);
		expect(config.maxBodyBytes).toBe(2048);
		expect(config.maxUploadBodyBytes).toBe(8192);
		expect(config.highRiskMutatingTimeoutMs).toBe(45000);
		expect(config.enableRemoteTerminalControl).toBe(true);
	});
});

describe('endpoint classifiers', () => {
	it('detects terminal control endpoints', () => {
		expect(isTerminalControlEndpoint('/api/sessions/yolo')).toBe(true);
		expect(isTerminalControlEndpoint('/api/sessions/jat-abc/attach')).toBe(true);
		expect(isTerminalControlEndpoint('/api/work/jat-abc/attach')).toBe(true);
		expect(isTerminalControlEndpoint('/api/tasks/next')).toBe(false);
	});

	it('detects high-risk mutating endpoints', () => {
		expect(isHighRiskMutatingEndpoint('/api/work/spawn', 'POST')).toBe(true);
		expect(isHighRiskMutatingEndpoint('/api/work/jat-abc/restart', 'POST')).toBe(true);
		expect(isHighRiskMutatingEndpoint('/api/tasks/next', 'POST')).toBe(true);
		expect(isHighRiskMutatingEndpoint('/api/tasks/next', 'GET')).toBe(false);
	});
});

describe('rate limiter', () => {
	it('enforces limits per key and resets by window', () => {
		const limiter = new ApiRateLimiter();
		const base = 1_000_000;

		const first = limiter.check('ip:127.0.0.1', 2, 1000, base);
		const second = limiter.check('ip:127.0.0.1', 2, 1000, base + 100);
		const third = limiter.check('ip:127.0.0.1', 2, 1000, base + 200);
		const afterReset = limiter.check('ip:127.0.0.1', 2, 1000, base + 1500);

		expect(first.allowed).toBe(true);
		expect(second.allowed).toBe(true);
		expect(third.allowed).toBe(false);
		expect(afterReset.allowed).toBe(true);
	});
});

describe('rate limit key', () => {
	it('uses token-hash key when token is present', () => {
		const headers = new Headers({
			authorization: 'Bearer secret-token'
		});
		const key = buildApiRateLimitKey(headers, '203.0.113.1');
		expect(key.startsWith('token:')).toBe(true);
		expect(key).not.toContain('secret-token');
	});

	it('uses ip key when token is missing', () => {
		const key = buildApiRateLimitKey(new Headers(), '203.0.113.1');
		expect(key).toBe('ip:203.0.113.1');
	});
});

describe('body size checks', () => {
	const config = parseApiSecurityConfig({
		JAT_MAX_API_BODY_BYTES: '1024',
		JAT_MAX_API_UPLOAD_BODY_BYTES: '4096'
	} as NodeJS.ProcessEnv);

	it('uses upload limit for transcribe endpoint', () => {
		expect(getBodySizeLimitForPath('/api/transcribe', config)).toBe(4096);
		expect(getBodySizeLimitForPath('/api/tasks/next', config)).toBe(1024);
	});

	it('allows when content length is below limit', () => {
		const result = validateApiBodySize(
			'/api/tasks/next',
			'POST',
			new Headers({ 'content-length': '512' }),
			config
		);
		expect(result.allowed).toBe(true);
	});

	it('rejects when content length exceeds limit', () => {
		const result = validateApiBodySize(
			'/api/tasks/next',
			'POST',
			new Headers({ 'content-length': '2048' }),
			config
		);
		expect(result.allowed).toBe(false);
		if (!result.allowed) {
			expect(result.maxBodyBytes).toBe(1024);
			expect(result.contentLength).toBe(2048);
		}
	});
});
