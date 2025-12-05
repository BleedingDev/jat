/**
 * File Utilities
 * Type detection, icon mapping, and display helpers for file attachments
 */

/**
 * Supported file type categories
 */
export type FileCategory = 'image' | 'pdf' | 'text' | 'code' | 'data' | 'document' | 'file';

/**
 * File type information for display
 */
export interface FileTypeInfo {
	category: FileCategory;
	label: string;
	icon: string; // SVG path data
	color: string; // oklch color for the icon
	previewable: boolean; // Can show inline preview
}

/**
 * Mapping of MIME types and extensions to file categories
 */
const mimeToCategory: Record<string, FileCategory> = {
	// Images
	'image/png': 'image',
	'image/jpeg': 'image',
	'image/gif': 'image',
	'image/webp': 'image',
	'image/svg+xml': 'image',
	'image/bmp': 'image',
	'image/ico': 'image',
	'image/x-icon': 'image',

	// PDF
	'application/pdf': 'pdf',

	// Text
	'text/plain': 'text',
	'text/markdown': 'text',
	'text/x-markdown': 'text',

	// Code
	'text/javascript': 'code',
	'application/javascript': 'code',
	'text/typescript': 'code',
	'text/x-typescript': 'code',
	'text/html': 'code',
	'text/css': 'code',
	'text/x-python': 'code',
	'text/x-java': 'code',
	'text/x-c': 'code',
	'text/x-c++': 'code',
	'text/x-go': 'code',
	'text/x-rust': 'code',
	'application/x-sh': 'code',
	'text/x-shellscript': 'code',

	// Data
	'application/json': 'data',
	'text/csv': 'data',
	'application/xml': 'data',
	'text/xml': 'data',
	'application/x-yaml': 'data',
	'text/yaml': 'data',

	// Documents
	'application/msword': 'document',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
	'application/vnd.ms-excel': 'document',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
	'application/vnd.ms-powerpoint': 'document',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document'
};

/**
 * Extension to category mapping (fallback when MIME type is unknown)
 */
const extensionToCategory: Record<string, FileCategory> = {
	// Images
	png: 'image',
	jpg: 'image',
	jpeg: 'image',
	gif: 'image',
	webp: 'image',
	svg: 'image',
	bmp: 'image',
	ico: 'image',

	// PDF
	pdf: 'pdf',

	// Text
	txt: 'text',
	md: 'text',
	markdown: 'text',
	rst: 'text',
	log: 'text',

	// Code
	js: 'code',
	mjs: 'code',
	cjs: 'code',
	ts: 'code',
	tsx: 'code',
	jsx: 'code',
	html: 'code',
	htm: 'code',
	css: 'code',
	scss: 'code',
	sass: 'code',
	less: 'code',
	py: 'code',
	java: 'code',
	c: 'code',
	cpp: 'code',
	h: 'code',
	hpp: 'code',
	go: 'code',
	rs: 'code',
	rb: 'code',
	php: 'code',
	sh: 'code',
	bash: 'code',
	zsh: 'code',
	sql: 'code',
	svelte: 'code',
	vue: 'code',

	// Data
	json: 'data',
	csv: 'data',
	xml: 'data',
	yaml: 'data',
	yml: 'data',
	toml: 'data',

	// Documents
	doc: 'document',
	docx: 'document',
	xls: 'document',
	xlsx: 'document',
	ppt: 'document',
	pptx: 'document',
	odt: 'document',
	ods: 'document',
	odp: 'document'
};

/**
 * SVG icon paths for each file category
 * Using Heroicons style paths
 */
const categoryIcons: Record<FileCategory, string> = {
	image:
		'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
	pdf: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
	text: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM9.75 12h4.5v.008H9.75V12zm0 3h4.5v.008H9.75V15z',
	code: 'M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5',
	data: 'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5',
	document:
		'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
	file: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
};

/**
 * Colors for each file category (oklch)
 */
const categoryColors: Record<FileCategory, string> = {
	image: 'oklch(0.70 0.18 200)', // Blue
	pdf: 'oklch(0.65 0.20 25)', // Red
	text: 'oklch(0.65 0.15 250)', // Purple
	code: 'oklch(0.70 0.18 150)', // Green
	data: 'oklch(0.70 0.15 45)', // Orange
	document: 'oklch(0.65 0.18 270)', // Indigo
	file: 'oklch(0.55 0.02 250)' // Gray
};

/**
 * Human-readable labels for each file category
 */
const categoryLabels: Record<FileCategory, string> = {
	image: 'Image',
	pdf: 'PDF',
	text: 'Text',
	code: 'Code',
	data: 'Data',
	document: 'Document',
	file: 'File'
};

/**
 * Get the file category from a MIME type
 */
export function getCategoryFromMimeType(mimeType: string): FileCategory {
	// Direct lookup
	if (mimeToCategory[mimeType]) {
		return mimeToCategory[mimeType];
	}

	// Check prefixes
	if (mimeType.startsWith('image/')) return 'image';
	if (mimeType.startsWith('text/')) return 'text';
	if (mimeType.startsWith('video/')) return 'file';
	if (mimeType.startsWith('audio/')) return 'file';

	return 'file';
}

/**
 * Get the file category from a filename extension
 */
export function getCategoryFromExtension(filename: string): FileCategory {
	const ext = filename.split('.').pop()?.toLowerCase();
	if (!ext) return 'file';
	return extensionToCategory[ext] || 'file';
}

/**
 * Get comprehensive file type info from a File object
 */
export function getFileTypeInfo(file: File): FileTypeInfo {
	// Try MIME type first, fall back to extension
	let category = getCategoryFromMimeType(file.type);
	if (category === 'file') {
		category = getCategoryFromExtension(file.name);
	}

	return {
		category,
		label: categoryLabels[category],
		icon: categoryIcons[category],
		color: categoryColors[category],
		previewable: category === 'image'
	};
}

/**
 * Get file type info from a file path
 */
export function getFileTypeInfoFromPath(path: string): FileTypeInfo {
	const category = getCategoryFromExtension(path);
	return {
		category,
		label: categoryLabels[category],
		icon: categoryIcons[category],
		color: categoryColors[category],
		previewable: category === 'image'
	};
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get a short file extension label for display (e.g., "PDF", "JSON", "TS")
 */
export function getExtensionLabel(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase();
	if (!ext) return '';
	return ext.toUpperCase();
}

/**
 * Check if a file can be previewed inline
 */
export function canPreviewFile(file: File): boolean {
	return getFileTypeInfo(file).previewable;
}

/**
 * Check if a file path points to a previewable file
 */
export function canPreviewPath(path: string): boolean {
	return getFileTypeInfoFromPath(path).previewable;
}

/**
 * Get the proper content type for serving a file
 */
export function getContentType(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase();
	if (!ext) return 'application/octet-stream';

	const contentTypes: Record<string, string> = {
		// Images
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		gif: 'image/gif',
		webp: 'image/webp',
		svg: 'image/svg+xml',
		bmp: 'image/bmp',
		ico: 'image/x-icon',

		// PDF
		pdf: 'application/pdf',

		// Text
		txt: 'text/plain',
		md: 'text/markdown',
		markdown: 'text/markdown',

		// Code
		js: 'text/javascript',
		mjs: 'text/javascript',
		ts: 'text/typescript',
		tsx: 'text/typescript',
		jsx: 'text/javascript',
		html: 'text/html',
		htm: 'text/html',
		css: 'text/css',
		py: 'text/x-python',
		java: 'text/x-java',
		c: 'text/x-c',
		cpp: 'text/x-c++',
		h: 'text/x-c',
		go: 'text/x-go',
		rs: 'text/x-rust',
		sh: 'application/x-sh',
		svelte: 'text/html',

		// Data
		json: 'application/json',
		csv: 'text/csv',
		xml: 'application/xml',
		yaml: 'text/yaml',
		yml: 'text/yaml',

		// Documents
		doc: 'application/msword',
		docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		xls: 'application/vnd.ms-excel',
		xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		ppt: 'application/vnd.ms-powerpoint',
		pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
	};

	return contentTypes[ext] || 'application/octet-stream';
}

/**
 * List of allowed file types for upload
 */
export const ALLOWED_FILE_TYPES = [
	// Images
	'image/*',
	// PDF
	'.pdf',
	// Text
	'.txt',
	'.md',
	'.markdown',
	'.rst',
	'.log',
	// Code
	'.js',
	'.ts',
	'.tsx',
	'.jsx',
	'.html',
	'.css',
	'.py',
	'.java',
	'.c',
	'.cpp',
	'.go',
	'.rs',
	'.rb',
	'.php',
	'.sh',
	'.sql',
	'.svelte',
	'.vue',
	// Data
	'.json',
	'.csv',
	'.xml',
	'.yaml',
	'.yml',
	'.toml'
];

/**
 * Get the accept attribute value for file inputs
 */
export function getAcceptAttribute(): string {
	return ALLOWED_FILE_TYPES.join(',');
}
