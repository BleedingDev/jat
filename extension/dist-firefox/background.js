import { r as runtime, s as storage, c as contextMenus, t as tabs, w as webRequest, i as isExtensionUrl } from "./browser-compat.js";
const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "x-csrf-token",
  "x-xsrf-token",
  "proxy-authorization",
  "www-authenticate",
  "proxy-authenticate"
];
const DEFAULT_NETWORK_CONFIG = {
  maxRequests: 100,
  filterSensitiveHeaders: true,
  captureTypes: [
    "xmlhttprequest",
    "script",
    "stylesheet",
    "image",
    "font",
    "media",
    "websocket",
    "other"
  ]
};
function filterSensitiveHeaders(headers) {
  return headers.map((header) => {
    const lowerName = header.name.toLowerCase();
    if (SENSITIVE_HEADERS.includes(lowerName)) {
      return {
        name: header.name,
        value: "[REDACTED]"
      };
    }
    return header;
  });
}
function parseQueryString(url) {
  try {
    const urlObj = new URL(url);
    const entries = [];
    urlObj.searchParams.forEach((value, name) => {
      entries.push({ name, value });
    });
    return entries;
  } catch {
    return [];
  }
}
function calculateHeadersSize(headers) {
  return headers.reduce((size, header) => {
    return size + header.name.length + 2 + header.value.length + 2;
  }, 0);
}
function convertChromeHeaders(headers) {
  if (!headers) return [];
  return headers.map((h) => ({
    name: h.name,
    value: h.value || ""
  }));
}
function getMimeType(headers) {
  const contentType = headers.find(
    (h) => h.name.toLowerCase() === "content-type"
  );
  if (!contentType) return "application/octet-stream";
  return contentType.value.split(";")[0].trim();
}
function getContentLength(headers) {
  const contentLength = headers.find(
    (h) => h.name.toLowerCase() === "content-length"
  );
  if (!contentLength) return -1;
  return parseInt(contentLength.value, 10) || -1;
}
function createDefaultTimings() {
  return {
    blocked: -1,
    dns: -1,
    connect: -1,
    send: -1,
    wait: -1,
    receive: -1,
    ssl: -1
  };
}
function toHARExport(entries, pageTitle = "Captured Requests") {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    log: {
      version: "1.2",
      creator: {
        name: "JAT Browser Extension",
        version: "1.0.0"
      },
      pages: [{
        startedDateTime: entries[0]?.startedDateTime || now,
        id: "page_1",
        title: pageTitle,
        pageTimings: {
          onContentLoad: -1,
          onLoad: -1
        }
      }],
      entries: entries.filter((e) => e.completed && e.response).map((entry) => ({
        startedDateTime: entry.startedDateTime,
        time: entry.time,
        request: {
          method: entry.method,
          url: entry.url,
          httpVersion: entry.request.httpVersion,
          headers: entry.request.headers,
          queryString: entry.request.queryString,
          headersSize: entry.request.headersSize,
          bodySize: entry.request.bodySize
        },
        response: {
          status: entry.response.status,
          statusText: entry.response.statusText,
          httpVersion: entry.response.httpVersion,
          headers: entry.response.headers,
          content: entry.response.content,
          headersSize: entry.response.headersSize,
          bodySize: entry.response.bodySize
        },
        cache: {},
        timings: entry.timings
      }))
    }
  };
}
console.log("JAT Browser Extension Background Script loaded");
let networkConfig = { ...DEFAULT_NETWORK_CONFIG };
let capturedData = {
  screenshots: [],
  consoleLogs: [],
  networkRequests: [],
  selectedElements: []
};
runtime.onInstalled.addListener((details) => {
  console.log("JAT Extension installed:", details.reason);
  storage.local.set({
    capturedData,
    networkConfig,
    extensionVersion: runtime.getManifest().version
  });
  contextMenus.create({
    id: "jat-bug-report",
    title: "Report Bug with JAT",
    contexts: ["page"]
  });
});
storage.local.get(["networkConfig"]).then((result) => {
  if (result.networkConfig) {
    networkConfig = { ...DEFAULT_NETWORK_CONFIG, ...result.networkConfig };
  }
});
contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "jat-bug-report" && tab?.id) {
    tabs.sendMessage(tab.id, {
      type: "OPEN_BUG_REPORT_FORM"
    });
  }
});
function shouldCaptureRequest(type, url) {
  if (isExtensionUrl(url)) return false;
  if (!networkConfig.captureTypes.includes(type)) return false;
  if (networkConfig.urlFilter) {
    try {
      const pattern = new RegExp(networkConfig.urlFilter);
      if (!pattern.test(url)) return false;
    } catch {
    }
  }
  return true;
}
function addNetworkRequest(entry) {
  capturedData.networkRequests.push(entry);
  if (capturedData.networkRequests.length > networkConfig.maxRequests) {
    capturedData.networkRequests = capturedData.networkRequests.slice(
      -networkConfig.maxRequests
    );
  }
  storage.local.set({ capturedData });
}
function updateNetworkRequest(requestId, updates) {
  const index = capturedData.networkRequests.findIndex(
    (req) => req.id === requestId
  );
  if (index !== -1) {
    capturedData.networkRequests[index] = {
      ...capturedData.networkRequests[index],
      ...updates
    };
    storage.local.set({ capturedData });
  }
}
webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId <= 0) return;
    if (!shouldCaptureRequest(details.type, details.url)) return;
    const requestHeaders = [];
    let bodySize = 0;
    if (details.requestBody) {
      if (details.requestBody.raw) {
        bodySize = details.requestBody.raw.reduce(
          (size, part) => size + (part.bytes?.byteLength || 0),
          0
        );
      } else if (details.requestBody.formData) {
        for (const key in details.requestBody.formData) {
          const values = details.requestBody.formData[key];
          bodySize += key.length + 1;
          bodySize += values.join("&").length;
        }
      }
    }
    const entry = {
      id: details.requestId,
      tabId: details.tabId,
      url: details.url,
      method: details.method || "GET",
      type: details.type,
      startedDateTime: new Date(details.timeStamp).toISOString(),
      time: 0,
      timings: createDefaultTimings(),
      request: {
        httpVersion: "HTTP/1.1",
        // Will be updated if we can detect it
        headers: requestHeaders,
        headersSize: -1,
        // Unknown until onSendHeaders
        bodySize,
        queryString: parseQueryString(details.url)
      },
      completed: false
    };
    addNetworkRequest(entry);
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);
webRequest.onSendHeaders.addListener(
  (details) => {
    if (details.tabId <= 0) return;
    const entry = capturedData.networkRequests.find(
      (req) => req.id === details.requestId
    );
    if (!entry) return;
    let headers = convertChromeHeaders(details.requestHeaders);
    if (networkConfig.filterSensitiveHeaders) {
      headers = filterSensitiveHeaders(headers);
    }
    updateNetworkRequest(details.requestId, {
      request: {
        ...entry.request,
        headers,
        headersSize: calculateHeadersSize(headers)
      }
    });
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);
webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId <= 0) return;
    const entry = capturedData.networkRequests.find(
      (req) => req.id === details.requestId
    );
    if (!entry) return;
    let responseHeaders = convertChromeHeaders(details.responseHeaders);
    if (networkConfig.filterSensitiveHeaders) {
      responseHeaders = filterSensitiveHeaders(responseHeaders);
    }
    const contentLength = getContentLength(responseHeaders);
    const mimeType = getMimeType(responseHeaders);
    const ttfb = details.timeStamp - new Date(entry.startedDateTime).getTime();
    updateNetworkRequest(details.requestId, {
      timings: {
        ...entry.timings,
        wait: ttfb
      },
      response: {
        status: details.statusCode || 0,
        statusText: details.statusLine?.split(" ").slice(1).join(" ") || "",
        httpVersion: details.statusLine?.split(" ")[0]?.replace("HTTP/", "") || "1.1",
        headers: responseHeaders,
        headersSize: calculateHeadersSize(responseHeaders),
        bodySize: contentLength,
        content: {
          size: contentLength,
          mimeType
        }
      }
    });
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);
webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId <= 0) return;
    const entry = capturedData.networkRequests.find(
      (req) => req.id === details.requestId
    );
    if (!entry) return;
    const totalTime = details.timeStamp - new Date(entry.startedDateTime).getTime();
    const receiveTime = entry.timings.wait > 0 ? totalTime - entry.timings.wait : -1;
    updateNetworkRequest(details.requestId, {
      completed: true,
      time: totalTime,
      timings: {
        ...entry.timings,
        receive: receiveTime
      }
    });
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);
webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.tabId <= 0) return;
    const entry = capturedData.networkRequests.find(
      (req) => req.id === details.requestId
    );
    if (!entry) return;
    const totalTime = details.timeStamp - new Date(entry.startedDateTime).getTime();
    updateNetworkRequest(details.requestId, {
      completed: true,
      time: totalTime,
      error: details.error
    });
  },
  { urls: ["<all_urls>"] }
);
runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("Background received message:", message);
  switch (message.type) {
    case "CAPTURE_NETWORK_LOGS":
      handleNetworkLogsRequest(message.options, sendResponse);
      return true;
    // Keep message channel open for async response
    case "EXPORT_NETWORK_HAR":
      handleExportHAR(message.pageTitle, sendResponse);
      return true;
    case "CLEAR_NETWORK_LOGS":
      handleClearNetworkLogs(sendResponse);
      return true;
    case "GET_NETWORK_CONFIG":
      sendResponse({ success: true, config: networkConfig });
      return false;
    case "SET_NETWORK_CONFIG":
      handleSetNetworkConfig(message.config, sendResponse);
      return true;
    case "STORE_SCREENSHOT":
      handleStoreScreenshot(message.data, sendResponse);
      return true;
    case "STORE_CONSOLE_LOGS":
      handleStoreConsoleLogs(message.data, sendResponse);
      return true;
    case "STORE_ELEMENT_DATA":
      handleStoreElementData(message.data, sendResponse);
      return true;
    case "GET_ALL_CAPTURED_DATA":
      handleGetAllData(sendResponse);
      return true;
    case "CLEAR_CAPTURED_DATA":
      handleClearData(sendResponse);
      return true;
    case "CAPTURE_VISIBLE_TAB":
      handleCaptureVisibleTab(sendResponse);
      return true;
    case "REQUEST_SCREENSHOT_CAPTURE":
      handleRequestScreenshotCapture(sendResponse);
      return true;
    default:
      console.log("Unknown message type:", message.type);
      sendResponse({ success: false, error: "Unknown message type" });
  }
});
async function handleNetworkLogsRequest(options, sendResponse) {
  try {
    let requests = [...capturedData.networkRequests];
    if (options?.tabId) {
      requests = requests.filter((req) => req.tabId === options.tabId);
    }
    if (options?.completed !== void 0) {
      requests = requests.filter((req) => req.completed === options.completed);
    }
    const limit = options?.limit || 50;
    requests = requests.slice(-limit);
    sendResponse({
      success: true,
      requestsCount: requests.length,
      requests
    });
  } catch (error) {
    console.error("Error getting network logs:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleExportHAR(pageTitle, sendResponse) {
  try {
    const har = toHARExport(
      capturedData.networkRequests,
      pageTitle || "JAT Network Capture"
    );
    sendResponse({
      success: true,
      har,
      json: JSON.stringify(har, null, 2)
    });
  } catch (error) {
    console.error("Error exporting HAR:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleClearNetworkLogs(sendResponse) {
  try {
    capturedData.networkRequests = [];
    await storage.local.set({ capturedData });
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error clearing network logs:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleSetNetworkConfig(config, sendResponse) {
  try {
    networkConfig = { ...networkConfig, ...config };
    await storage.local.set({ networkConfig });
    sendResponse({ success: true, config: networkConfig });
  } catch (error) {
    console.error("Error setting network config:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleStoreScreenshot(data, sendResponse) {
  try {
    capturedData.screenshots.push(data);
    if (capturedData.screenshots.length > 10) {
      capturedData.screenshots = capturedData.screenshots.slice(-10);
    }
    await storage.local.set({ capturedData });
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error storing screenshot:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
const CONSOLE_LOG_MAX_STORED = 200;
async function handleStoreConsoleLogs(logs, sendResponse) {
  try {
    const existingKeys = new Set(
      capturedData.consoleLogs.map(
        (log) => `${log.timestampMs || log.timestamp}:${log.message?.substring(0, 100)}`
      )
    );
    const newLogs = logs.filter((log) => {
      const key = `${log.timestampMs || log.timestamp}:${log.message?.substring(0, 100)}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
    capturedData.consoleLogs.push(...newLogs);
    if (capturedData.consoleLogs.length > CONSOLE_LOG_MAX_STORED) {
      capturedData.consoleLogs = capturedData.consoleLogs.slice(
        -CONSOLE_LOG_MAX_STORED
      );
    }
    await storage.local.set({ capturedData });
    sendResponse({
      success: true,
      logsCount: newLogs.length,
      totalLogs: capturedData.consoleLogs.length
    });
  } catch (error) {
    console.error("Error storing console logs:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleStoreElementData(elementData, sendResponse) {
  try {
    capturedData.selectedElements.push(elementData);
    if (capturedData.selectedElements.length > 20) {
      capturedData.selectedElements = capturedData.selectedElements.slice(-20);
    }
    await storage.local.set({ capturedData });
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error storing element data:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleGetAllData(sendResponse) {
  try {
    const stored = await storage.local.get(["capturedData"]);
    const data = stored.capturedData || capturedData;
    sendResponse({
      success: true,
      data
    });
  } catch (error) {
    console.error("Error getting captured data:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleClearData(sendResponse) {
  try {
    capturedData = {
      screenshots: [],
      consoleLogs: [],
      networkRequests: [],
      selectedElements: []
    };
    await storage.local.set({ capturedData });
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error clearing data:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleCaptureVisibleTab(sendResponse) {
  try {
    const dataUrl = await tabs.captureVisibleTab({ format: "png" });
    sendResponse({ success: true, data: dataUrl });
  } catch (error) {
    console.error("Error capturing visible tab:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleRequestScreenshotCapture(sendResponse) {
  try {
    const dataUrl = await tabs.captureVisibleTab({ format: "png" });
    capturedData.screenshots.push(dataUrl);
    if (capturedData.screenshots.length > 10) {
      capturedData.screenshots = capturedData.screenshots.slice(-10);
    }
    await storage.local.set({ capturedData });
    sendResponse({ success: true, data: dataUrl });
  } catch (error) {
    console.error("Error capturing screenshot:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
