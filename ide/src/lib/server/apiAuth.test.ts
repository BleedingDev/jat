import { describe, expect, it } from 'vitest';
import {
	parseApiAuthConfig,
	authorizeApiRequest,
	extractApiToken,
	type ApiAuthConfig
} from './apiAuth';

function makeHeaders(init?: Record<string, string>): Headers {
	return new Headers(init);
}

function auth(params: {
	pathname: string;
	method: string;
	clientAddress: string;
	headers?: Record<string, string>;
	config: ApiAuthConfig;
}) {
	return authorizeApiRequest({
		pathname: params.pathname,
		method: params.method,
		clientAddress: params.clientAddress,
		headers: makeHeaders(params.headers),
		config: params.config
	});
}

describe('parseApiAuthConfig', () => {
	it('parses single admin token', () => {
		const config = parseApiAuthConfig({ JAT_API_TOKEN: 'admin-token' } as NodeJS.ProcessEnv);
		expect(config.tokenRoles.get('admin-token')).toBe('admin');
		expect(config.tokenRoles.size).toBe(1);
	});

	it('parses role-scoped tokens', () => {
		const config = parseApiAuthConfig({
			JAT_API_TOKENS: 'read:viewer-token,write:operator-token,admin:owner-token'
		} as NodeJS.ProcessEnv);
		expect(config.tokenRoles.get('viewer-token')).toBe('read');
		expect(config.tokenRoles.get('operator-token')).toBe('write');
		expect(config.tokenRoles.get('owner-token')).toBe('admin');
	});
});

describe('extractApiToken', () => {
	it('extracts token from authorization header', () => {
		const token = extractApiToken(makeHeaders({ authorization: 'Bearer secret' }));
		expect(token).toBe('secret');
	});

	it('falls back to x-jat-token header', () => {
		const token = extractApiToken(makeHeaders({ 'x-jat-token': 'header-token' }));
		expect(token).toBe('header-token');
	});
});

describe('authorizeApiRequest', () => {
	it('allows loopback API access when no tokens are configured', () => {
		const config = parseApiAuthConfig({} as NodeJS.ProcessEnv);
		const result = auth({
			pathname: '/api/tasks',
			method: 'GET',
			clientAddress: '127.0.0.1',
			config
		});
		expect(result.authorized).toBe(true);
	});

	it('blocks remote API access when no tokens are configured', () => {
		const config = parseApiAuthConfig({} as NodeJS.ProcessEnv);
		const result = auth({
			pathname: '/api/tasks',
			method: 'GET',
			clientAddress: '10.0.0.42',
			config
		});
		expect(result.authorized).toBe(false);
		if (!result.authorized) {
			expect(result.status).toBe(403);
		}
	});

	it('enforces write role for mutating methods', () => {
		const config = parseApiAuthConfig({
			JAT_API_TOKENS: 'read:viewer-token,write:operator-token'
		} as NodeJS.ProcessEnv);
		const result = auth({
			pathname: '/api/tasks/abc',
			method: 'DELETE',
			clientAddress: '10.0.0.42',
			headers: { authorization: 'Bearer viewer-token' },
			config
		});
		expect(result.authorized).toBe(false);
		if (!result.authorized) {
			expect(result.status).toBe(403);
		}
	});

	it('authorizes write token for mutating methods', () => {
		const config = parseApiAuthConfig({
			JAT_API_TOKENS: 'write:operator-token'
		} as NodeJS.ProcessEnv);
		const result = auth({
			pathname: '/api/tasks/abc',
			method: 'PATCH',
			clientAddress: '10.0.0.42',
			headers: { authorization: 'Bearer operator-token' },
			config
		});
		expect(result.authorized).toBe(true);
	});

	it('can trust proxy forwarding when explicitly enabled', () => {
		const config = parseApiAuthConfig({
			JAT_TRUST_PROXY: 'true'
		} as NodeJS.ProcessEnv);
		const result = auth({
			pathname: '/api/tasks',
			method: 'GET',
			clientAddress: '127.0.0.1',
			headers: { 'x-forwarded-for': '203.0.113.9' },
			config
		});
		expect(result.authorized).toBe(false);
		if (!result.authorized) {
			expect(result.clientIp).toBe('203.0.113.9');
			expect(result.status).toBe(403);
		}
	});

	it('denies missing token when tokens are configured', () => {
		const config = parseApiAuthConfig({
			JAT_API_TOKENS: 'write:operator-token'
		} as NodeJS.ProcessEnv);

		const result = auth({
			pathname: '/api/tasks',
			method: 'GET',
			clientAddress: '10.0.0.42',
			config
		});

		expect(result.authorized).toBe(false);
		if (!result.authorized) {
			expect(result.status).toBe(401);
		}
	});

	it('supports optional loopback bypass without token when configured', () => {
		const config = parseApiAuthConfig({
			JAT_API_TOKENS: 'write:operator-token',
			JAT_ALLOW_LOOPBACK_WITHOUT_TOKEN: 'true'
		} as NodeJS.ProcessEnv);

		const result = auth({
			pathname: '/api/tasks',
			method: 'GET',
			clientAddress: '127.0.0.1',
			config
		});

		expect(result.authorized).toBe(true);
	});

	it('normalizes forwarded ip with port when trusting proxy', () => {
		const config = parseApiAuthConfig({
			JAT_TRUST_PROXY: 'true'
		} as NodeJS.ProcessEnv);

		const result = auth({
			pathname: '/api/tasks',
			method: 'GET',
			clientAddress: '127.0.0.1',
			headers: { 'x-forwarded-for': '203.0.113.9:4321, 10.0.0.1' },
			config
		});

		expect(result.authorized).toBe(false);
		if (!result.authorized) {
			expect(result.clientIp).toBe('203.0.113.9');
		}
	});
});
