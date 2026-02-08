import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('child_process', () => ({
	execFile: vi.fn()
}));

import { execFile } from 'child_process';
import { GET } from './+server.js';

/**
 * @param {string} stdoutPayload
 */
function mockExecFileSuccess(stdoutPayload) {
	vi.mocked(execFile).mockImplementation((command, args, options, callback) => {
		const cb = typeof options === 'function' ? options : callback;
		cb?.(null, stdoutPayload, '');
		return /** @type {any} */ ({});
	});
}

describe('GET /api/tasks/queue', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('uses argument-safe execFile and clamps unsafe query values', async () => {
		mockExecFileSuccess(
			JSON.stringify([{ id: 'jat-abc', title: 'Task', status: 'open', priority: 1 }])
		);

		const url = new URL(
			'http://localhost/api/tasks/queue?limit=9999&sort=hybrid;rm%20-rf%20/'
		);
		const response = await GET(/** @type {any} */ ({ url }));
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.queue).toHaveLength(1);

		expect(execFile).toHaveBeenCalledTimes(1);
		const firstCall = vi.mocked(execFile).mock.calls[0];
		expect(firstCall[0]).toBe('bd');
		expect(firstCall[1]).toEqual([
			'ready',
			'--json',
			'--limit',
			'100',
			'--sort',
			'hybrid'
		]);
	});

	it('passes validated sort and limit arguments without shell construction', async () => {
		mockExecFileSuccess(JSON.stringify([]));

		const url = new URL('http://localhost/api/tasks/queue?limit=7&sort=oldest');
		await GET(/** @type {any} */ ({ url }));

		const firstCall = vi.mocked(execFile).mock.calls[0];
		expect(firstCall[0]).toBe('bd');
		expect(firstCall[1]).toEqual([
			'ready',
			'--json',
			'--limit',
			'7',
			'--sort',
			'oldest'
		]);
	});
});
