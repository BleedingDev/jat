import { json } from '@sveltejs/kit';
import { execSync } from 'child_process';

export async function GET() {
	let name = '';

	try {
		name = execSync('git config --global user.name', { encoding: 'utf-8', timeout: 3000 }).trim();
	} catch {
		// git config not set or git not installed
	}

	const initials = name
		? name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
		: '';

	return json({ name, initials });
}
