typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox");
const extensionAPI = typeof browser !== "undefined" ? browser : chrome;
const runtime = {
  get id() {
    return extensionAPI.runtime.id;
  },
  getManifest() {
    return extensionAPI.runtime.getManifest();
  },
  get lastError() {
    return extensionAPI.runtime.lastError;
  },
  onInstalled: extensionAPI.runtime.onInstalled,
  onMessage: extensionAPI.runtime.onMessage,
  sendMessage(message) {
    return extensionAPI.runtime.sendMessage(message);
  }
};
const tabs = {
  query(queryInfo) {
    return extensionAPI.tabs.query(queryInfo);
  },
  sendMessage(tabId, message) {
    return extensionAPI.tabs.sendMessage(tabId, message);
  },
  captureVisibleTab(options) {
    if (options) {
      return extensionAPI.tabs.captureVisibleTab(options);
    }
    return extensionAPI.tabs.captureVisibleTab(
      chrome.windows?.WINDOW_ID_CURRENT ?? -2
    );
  }
};
const storage = {
  local: {
    get(keys) {
      return extensionAPI.storage.local.get(keys ?? void 0);
    },
    set(items) {
      return extensionAPI.storage.local.set(items);
    },
    remove(keys) {
      return extensionAPI.storage.local.remove(keys);
    }
  }
};
const contextMenus = {
  create(createProperties, callback) {
    return extensionAPI.contextMenus.create(createProperties, callback);
  },
  onClicked: extensionAPI.contextMenus.onClicked
};
const webRequest = extensionAPI.webRequest;
extensionAPI.scripting;
function isExtensionUrl(url) {
  return url.startsWith("chrome-extension://") || url.startsWith("moz-extension://");
}
export {
  contextMenus as c,
  isExtensionUrl as i,
  runtime as r,
  storage as s,
  tabs as t,
  webRequest as w
};
