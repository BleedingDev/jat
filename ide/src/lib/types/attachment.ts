import type { FileCategory } from '$lib/utils/fileUtils';

export interface PendingAttachment {
	id: string;
	file: File;
	preview: string;
	category: FileCategory;
	icon: string;
	iconColor: string;
}
