/**
 * Request Throttler
 *
 * Prevents browser connection exhaustion (ERR_INSUFFICIENT_RESOURCES) by:
 * 1. Limiting max concurrent requests per domain
 * 2. Queueing excess requests
 * 3. Deduplicating identical in-flight requests
 *
 * Browser limits are typically:
 * - Chrome: 6 concurrent connections per domain
 * - Firefox: 6 concurrent connections per domain
 * - Safari: 6 concurrent connections per domain
 *
 * We limit to 4 to leave headroom for other requests (SSE, WebSocket, etc.)
 */

const MAX_CONCURRENT_REQUESTS = 4;
const REQUEST_TIMEOUT_MS = 30000; // 30 second timeout

interface QueuedRequest {
	url: string;
	options: RequestInit;
	resolve: (response: Response) => void;
	reject: (error: Error) => void;
	timestamp: number;
}

// Module-level state (shared across all components)
let activeRequests = 0;
const requestQueue: QueuedRequest[] = [];
const inFlightRequests = new Map<string, Promise<Response>>();

/**
 * Creates a cache key from URL and relevant options
 */
function getCacheKey(url: string, options?: RequestInit): string {
	const method = options?.method || 'GET';
	// Only cache GET requests
	if (method !== 'GET') {
		return `${method}:${url}:${Date.now()}:${Math.random()}`;
	}
	return `GET:${url}`;
}

/**
 * Process the next request in the queue
 */
function processQueue(): void {
	if (activeRequests >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) {
		return;
	}

	const request = requestQueue.shift();
	if (!request) return;

	// Check if request has timed out while waiting in queue
	if (Date.now() - request.timestamp > REQUEST_TIMEOUT_MS) {
		request.reject(new Error('Request timed out in queue'));
		processQueue();
		return;
	}

	executeRequest(request);
}

/**
 * Execute a request and manage concurrency
 */
async function executeRequest(request: QueuedRequest): Promise<void> {
	activeRequests++;

	try {
		const response = await globalThis.fetch(request.url, {
			...request.options,
			signal: request.options.signal || AbortSignal.timeout(REQUEST_TIMEOUT_MS)
		});
		request.resolve(response);
	} catch (error) {
		request.reject(error instanceof Error ? error : new Error(String(error)));
	} finally {
		activeRequests--;
		processQueue();
	}
}

/**
 * Throttled fetch - queues requests when at capacity
 * Deduplicates identical GET requests that are in-flight
 */
export async function throttledFetch(url: string, options?: RequestInit): Promise<Response> {
	const cacheKey = getCacheKey(url, options);
	const method = options?.method || 'GET';

	// For GET requests, check if we already have this request in-flight
	if (method === 'GET') {
		const existing = inFlightRequests.get(cacheKey);
		if (existing) {
			// Return the existing promise - deduplicate the request
			return existing.then(r => r.clone());
		}
	}

	// Create the request promise
	const requestPromise = new Promise<Response>((resolve, reject) => {
		const queuedRequest: QueuedRequest = {
			url,
			options: options || {},
			resolve,
			reject,
			timestamp: Date.now()
		};

		if (activeRequests < MAX_CONCURRENT_REQUESTS) {
			executeRequest(queuedRequest);
		} else {
			requestQueue.push(queuedRequest);
		}
	});

	// Track GET requests for deduplication
	if (method === 'GET') {
		inFlightRequests.set(cacheKey, requestPromise);
		requestPromise.finally(() => {
			inFlightRequests.delete(cacheKey);
		});
	}

	return requestPromise;
}

/**
 * Get current queue status (for debugging)
 */
export function getQueueStatus(): { active: number; queued: number; inFlight: number } {
	return {
		active: activeRequests,
		queued: requestQueue.length,
		inFlight: inFlightRequests.size
	};
}

/**
 * Clear the queue (useful for cleanup)
 */
export function clearQueue(): void {
	while (requestQueue.length > 0) {
		const request = requestQueue.pop();
		if (request) {
			request.reject(new Error('Queue cleared'));
		}
	}
	inFlightRequests.clear();
}
