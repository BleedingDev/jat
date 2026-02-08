export type ApiRole = 'read' | 'write' | 'admin';

export interface ApiAuthConfig {
	tokenRoles: Map<string, ApiRole>;
	allowLoopbackWithoutToken: boolean;
	trustProxy: boolean;
}

export interface AuthorizeApiRequestParams {
	pathname: string;
	method: string;
	clientAddress: string;
	headers: Headers;
	config: ApiAuthConfig;
}

export type ApiAuthResult =
	| {
			authorized: true;
			role: ApiRole;
			clientIp: string;
			authSource: 'loopback' | 'token' | 'loopback-bypass';
	  }
	| {
			authorized: false;
			status: number;
			error: 'Unauthorized' | 'Forbidden';
			message: string;
			clientIp: string;
	  };

const BOOL_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function parseBoolean(value: string | undefined): boolean {
	if (!value) return false;
	return BOOL_TRUE_VALUES.has(value.trim().toLowerCase());
}

function roleRank(role: ApiRole): number {
	switch (role) {
		case 'read':
			return 1;
		case 'write':
			return 2;
		case 'admin':
			return 3;
		default:
			return 0;
	}
}

function normalizeRole(value: string): ApiRole | null {
	const normalized = value.trim().toLowerCase();
	if (normalized === 'read' || normalized === 'write' || normalized === 'admin') {
		return normalized;
	}
	return null;
}

export function isLoopbackAddress(ip: string): boolean {
	return (
		ip === '::1' ||
		ip.startsWith('127.') ||
		ip.startsWith('::ffff:127.') ||
		ip === 'localhost'
	);
}

function normalizeForwardedIp(forwardedValue: string): string {
	const first = forwardedValue.split(',')[0]?.trim() || '';
	if (!first) return '';

	// Handle IPv4 with optional port in X-Forwarded-For
	if (first.includes('.') && first.includes(':') && !first.includes(']')) {
		const [host] = first.split(':');
		return host || first;
	}

	return first;
}

function resolveClientIp(clientAddress: string, headers: Headers, trustProxy: boolean): string {
	if (!trustProxy) return clientAddress;
	const forwarded = headers.get('x-forwarded-for');
	if (!forwarded) return clientAddress;
	const forwardedIp = normalizeForwardedIp(forwarded);
	return forwardedIp || clientAddress;
}

export function extractApiToken(headers: Headers): string | null {
	const authHeader = headers.get('authorization');
	if (authHeader) {
		const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
		if (bearerMatch?.[1]) {
			return bearerMatch[1].trim();
		}
	}

	const tokenHeader = headers.get('x-jat-token');
	if (tokenHeader?.trim()) {
		return tokenHeader.trim();
	}

	return null;
}

export function parseApiAuthConfig(env: NodeJS.ProcessEnv): ApiAuthConfig {
	const tokenRoles = new Map<string, ApiRole>();

	const singleToken = env.JAT_API_TOKEN?.trim();
	if (singleToken) {
		tokenRoles.set(singleToken, 'admin');
	}

	const multiTokenConfig = env.JAT_API_TOKENS?.trim();
	if (multiTokenConfig) {
		const entries = multiTokenConfig
			.split(',')
			.map((entry) => entry.trim())
			.filter(Boolean);

		for (const entry of entries) {
			const roleTokenMatch = entry.match(/^([a-zA-Z]+):(.*)$/);
			if (!roleTokenMatch) {
				tokenRoles.set(entry, 'admin');
				continue;
			}

			const parsedRole = normalizeRole(roleTokenMatch[1]);
			const tokenValue = roleTokenMatch[2].trim();
			if (!parsedRole || !tokenValue) {
				tokenRoles.set(entry, 'admin');
				continue;
			}
			tokenRoles.set(tokenValue, parsedRole);
		}
	}

	return {
		tokenRoles,
		allowLoopbackWithoutToken: parseBoolean(env.JAT_ALLOW_LOOPBACK_WITHOUT_TOKEN),
		trustProxy: parseBoolean(env.JAT_TRUST_PROXY)
	};
}

export function authorizeApiRequest(params: AuthorizeApiRequestParams): ApiAuthResult {
	const { pathname, method, clientAddress, headers, config } = params;
	if (!pathname.startsWith('/api/')) {
		return {
			authorized: true,
			role: 'admin',
			clientIp: clientAddress,
			authSource: 'loopback'
		};
	}

	const clientIp = resolveClientIp(clientAddress, headers, config.trustProxy);
	const isLoopback = isLoopbackAddress(clientIp);
	const requiredRole: ApiRole = READ_METHODS.has(method.toUpperCase()) ? 'read' : 'write';

	// Default secure behavior: without tokens configured, only localhost is allowed.
	if (config.tokenRoles.size === 0) {
		if (isLoopback) {
			return {
				authorized: true,
				role: 'admin',
				clientIp,
				authSource: 'loopback'
			};
		}

		return {
			authorized: false,
			status: 403,
			error: 'Forbidden',
			message:
				'Remote API access is disabled. Configure JAT_API_TOKEN/JAT_API_TOKENS to enable authenticated remote access.',
			clientIp
		};
	}

	const presentedToken = extractApiToken(headers);
	if (!presentedToken) {
		if (isLoopback && config.allowLoopbackWithoutToken) {
			return {
				authorized: true,
				role: 'admin',
				clientIp,
				authSource: 'loopback-bypass'
			};
		}

		return {
			authorized: false,
			status: 401,
			error: 'Unauthorized',
			message: 'Missing API token. Provide Bearer token or x-jat-token header.',
			clientIp
		};
	}

	const role = config.tokenRoles.get(presentedToken);
	if (!role) {
		return {
			authorized: false,
			status: 401,
			error: 'Unauthorized',
			message: 'Invalid API token.',
			clientIp
		};
	}

	if (roleRank(role) < roleRank(requiredRole)) {
		return {
			authorized: false,
			status: 403,
			error: 'Forbidden',
			message: `Token role '${role}' cannot perform ${method.toUpperCase()} requests.`,
			clientIp
		};
	}

	return {
		authorized: true,
		role,
		clientIp,
		authSource: 'token'
	};
}
