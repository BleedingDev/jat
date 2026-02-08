import { json } from '@sveltejs/kit';
import { accessSync, constants } from 'fs';
import { spawnSync } from 'child_process';
import type { RequestHandler } from './$types';

function checkCommandAvailable(command: string): boolean {
	const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
	const error = result.error as NodeJS.ErrnoException | undefined;
	return error?.code !== 'ENOENT';
}

function checkWritableDirectory(path: string): boolean {
	try {
		accessSync(path, constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

export const GET: RequestHandler = async () => {
	const checks = {
		tmpWritable: checkWritableDirectory('/tmp'),
		hasBd: checkCommandAvailable('bd'),
		hasTmux: checkCommandAvailable('tmux'),
		hasSqlite3: checkCommandAvailable('sqlite3')
	};

	const requiredFailures: string[] = [];
	if (!checks.tmpWritable) requiredFailures.push('tmpWritable');
	if (!checks.hasBd) requiredFailures.push('hasBd');
	if (!checks.hasTmux) requiredFailures.push('hasTmux');

	const ready = requiredFailures.length === 0;

	return json(
		{
			status: ready ? 'ready' : 'not_ready',
			ready,
			requiredFailures,
			checks,
			timestamp: new Date().toISOString(),
			uptimeSeconds: Math.floor(process.uptime())
		},
		{
			status: ready ? 200 : 503
		}
	);
};
