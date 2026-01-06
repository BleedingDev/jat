// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { Logger } from 'pino';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			requestId: string;
			logger: Logger;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
