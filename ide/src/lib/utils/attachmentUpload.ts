import type { PendingAttachment } from '$lib/types/attachment';

/**
 * Upload pending attachments for a task.
 * Two-step process: upload file to server, then save metadata.
 */
export async function uploadAttachments(
	taskId: string,
	attachments: PendingAttachment[]
): Promise<boolean> {
	if (attachments.length === 0) return true;

	let allSuccess = true;

	for (const att of attachments) {
		try {
			const formData = new FormData();
			formData.append('image', att.file, `task-${taskId}-${Date.now()}-${att.file.name}`);
			formData.append('sessionName', `task-${taskId}`);

			const uploadResponse = await fetch('/api/work/upload-image', {
				method: 'POST',
				body: formData
			});

			if (!uploadResponse.ok) {
				console.error('Failed to upload file:', att.file.name);
				allSuccess = false;
				continue;
			}

			const { filePath } = await uploadResponse.json();

			const saveResponse = await fetch(`/api/tasks/${taskId}/image`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: filePath, id: att.id })
			});

			if (!saveResponse.ok) {
				console.error('Failed to save attachment metadata:', att.file.name);
				allSuccess = false;
			}
		} catch (err) {
			console.error('Error processing attachment:', err);
			allSuccess = false;
		}
	}

	return allSuccess;
}

/**
 * Clean up object URLs from pending attachments.
 * Call when component unmounts or attachments are cleared.
 */
export function revokeAttachmentPreviews(attachments: PendingAttachment[]): void {
	for (const att of attachments) {
		if (att.preview) {
			URL.revokeObjectURL(att.preview);
		}
	}
}
