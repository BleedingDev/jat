/**
 * Type declaration for Firefox's `browser` namespace.
 *
 * Firefox provides the WebExtension API under `browser.*` with native
 * Promise support. The shape is structurally identical to Chrome's
 * `chrome.*` namespace, so we declare it as the same type.
 *
 * In Chrome, `browser` is undefined, so our compat layer falls back to `chrome`.
 */
declare const browser: typeof chrome | undefined
