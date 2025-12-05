/**
 * Toast Notification Store
 *
 * Provides a simple toast notification system for the dashboard.
 * Toasts auto-dismiss after a configurable duration.
 *
 * Usage:
 *   import { addToast, toasts } from '$lib/stores/toasts.svelte';
 *
 *   // Add a toast
 *   addToast({ message: 'Task created!', type: 'success' });
 *
 *   // In component, iterate over toasts
 *   {#each $toasts as toast}
 *     <ToastItem {toast} />
 *   {/each}
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
	id: string;
	message: string;
	type: ToastType;
	duration: number;
	details?: string;
	action?: {
		label: string;
		onClick: () => void;
	};
}

// Toast state
let toastList = $state<Toast[]>([]);

// Export reactive getter
export const toasts = {
	get value() {
		return toastList;
	},
};

// Generate unique ID
function generateId(): string {
	return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add a toast notification
 */
export function addToast(options: {
	message: string;
	type?: ToastType;
	duration?: number;
	details?: string;
	action?: Toast['action'];
}): string {
	const id = generateId();
	const toast: Toast = {
		id,
		message: options.message,
		type: options.type || 'info',
		duration: options.duration ?? 4000,
		details: options.details,
		action: options.action,
	};

	toastList = [...toastList, toast];

	// Auto-dismiss after duration
	if (toast.duration > 0) {
		setTimeout(() => {
			removeToast(id);
		}, toast.duration);
	}

	return id;
}

/**
 * Remove a toast by ID
 */
export function removeToast(id: string): void {
	toastList = toastList.filter((t) => t.id !== id);
}

/**
 * Clear all toasts
 */
export function clearToasts(): void {
	toastList = [];
}

// Convenience functions for common toast types
export function successToast(message: string, details?: string): string {
	return addToast({ message, type: 'success', details });
}

export function errorToast(message: string, details?: string): string {
	return addToast({ message, type: 'error', details, duration: 6000 });
}

export function warningToast(message: string, details?: string): string {
	return addToast({ message, type: 'warning', details });
}

export function infoToast(message: string, details?: string): string {
	return addToast({ message, type: 'info', details });
}
