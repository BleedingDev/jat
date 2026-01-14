/**
 * Minimap Components
 *
 * Three prototype implementations for terminal output minimaps:
 *
 * - MinimapCssScale: CSS transform scale on cloned content (preserves colors)
 * - MinimapCanvas: Canvas-based rendering (fast, handles huge outputs)
 * - MinimapBlocks: Colored bars by content type (semantic, performant)
 */

export { default as MinimapCssScale } from './MinimapCssScale.svelte';
export { default as MinimapCanvas } from './MinimapCanvas.svelte';
export { default as MinimapBlocks } from './MinimapBlocks.svelte';
