/**
 * Minimap Components
 *
 * Terminal output minimap implementations:
 *
 * - MinimapCssScale: CSS transform scale on cloned content (preserves ANSI colors)
 *   ✓ INTEGRATED into SessionCard - shows on hover in agent mode
 *
 * Alternative prototypes (not currently used):
 * - MinimapCanvas: Canvas-based rendering (fast, handles huge outputs)
 * - MinimapBlocks: Colored bars by content type (semantic, performant)
 */

export { default as MinimapCssScale } from './MinimapCssScale.svelte';
export { default as MinimapCanvas } from './MinimapCanvas.svelte';
export { default as MinimapBlocks } from './MinimapBlocks.svelte';
