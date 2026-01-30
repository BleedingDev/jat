/**
 * Browser compatibility layer for Chrome/Firefox WebExtension APIs.
 *
 * Firefox supports the `browser.*` namespace (Promise-based) and also
 * provides `chrome.*` for backward compatibility. Chrome only provides
 * `chrome.*` (callback-based, with Promise support in MV3).
 *
 * This module detects the runtime environment and exports a unified
 * set of helpers so the rest of the codebase doesn't need to care.
 */

/** True when running in Firefox (Gecko) */
export const isFirefox: boolean =
  typeof navigator !== 'undefined' &&
  navigator.userAgent.includes('Firefox')

/** True when running in Chrome/Chromium */
export const isChrome: boolean = !isFirefox

/**
 * The base extension API object.
 * In Firefox this is `browser` (Promise-native); in Chrome it's `chrome`.
 */
export const extensionAPI: typeof chrome =
  (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome

// ---------------------------------------------------------------------------
// Runtime helpers
// ---------------------------------------------------------------------------

export const runtime = {
  get id() {
    return extensionAPI.runtime.id
  },

  getManifest() {
    return extensionAPI.runtime.getManifest()
  },

  get lastError() {
    return extensionAPI.runtime.lastError
  },

  onInstalled: extensionAPI.runtime.onInstalled,
  onMessage: extensionAPI.runtime.onMessage,

  sendMessage(message: unknown): Promise<unknown> {
    return extensionAPI.runtime.sendMessage(message)
  },
}

// ---------------------------------------------------------------------------
// Tabs helpers
// ---------------------------------------------------------------------------

export const tabs = {
  query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
    return extensionAPI.tabs.query(queryInfo)
  },

  sendMessage(tabId: number, message: unknown): Promise<unknown> {
    return extensionAPI.tabs.sendMessage(tabId, message)
  },

  captureVisibleTab(
    options?: chrome.tabs.CaptureVisibleTabOptions,
  ): Promise<string> {
    if (options) {
      return extensionAPI.tabs.captureVisibleTab(options)
    }
    // No options: call with just windowId (current window)
    return extensionAPI.tabs.captureVisibleTab(
      chrome.windows?.WINDOW_ID_CURRENT ?? -2,
    )
  },
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

export const storage = {
  local: {
    get(keys?: string | string[] | null): Promise<Record<string, unknown>> {
      return extensionAPI.storage.local.get(keys ?? undefined)
    },

    set(items: Record<string, unknown>): Promise<void> {
      return extensionAPI.storage.local.set(items)
    },

    remove(keys: string | string[]): Promise<void> {
      return extensionAPI.storage.local.remove(keys)
    },
  },
}

// ---------------------------------------------------------------------------
// Context Menus helpers
// ---------------------------------------------------------------------------

export const contextMenus = {
  create(
    createProperties: chrome.contextMenus.CreateProperties,
    callback?: () => void,
  ) {
    return extensionAPI.contextMenus.create(createProperties, callback)
  },

  onClicked: extensionAPI.contextMenus.onClicked,
}

// ---------------------------------------------------------------------------
// WebRequest helpers
// ---------------------------------------------------------------------------

export const webRequest = extensionAPI.webRequest

// ---------------------------------------------------------------------------
// Scripting helpers
// ---------------------------------------------------------------------------

export const scripting = extensionAPI.scripting

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the URL belongs to the extension itself.
 * In Chrome this is `chrome-extension://`, in Firefox `moz-extension://`.
 */
export function isExtensionUrl(url: string): boolean {
  return url.startsWith('chrome-extension://') ||
    url.startsWith('moz-extension://')
}
