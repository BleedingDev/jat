console.log("JAT Browser Extension Background Script loaded");
let capturedData = {
  screenshots: [],
  consoleLogs: [],
  networkRequests: [],
  selectedElements: []
};
chrome.runtime.onInstalled.addListener((details) => {
  console.log("JAT Extension installed:", details.reason);
  chrome.storage.local.set({
    capturedData,
    extensionVersion: chrome.runtime.getManifest().version
  });
  chrome.contextMenus.create({
    id: "jat-bug-report",
    title: "Report Bug with JAT",
    contexts: ["page"]
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "jat-bug-report" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "OPEN_BUG_REPORT_FORM"
    });
  }
});
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId > 0 && details.type === "xmlhttprequest") {
      const networkEntry = {
        id: details.requestId,
        url: details.url,
        method: details.method,
        timeStamp: details.timeStamp,
        type: details.type,
        tabId: details.tabId
      };
      capturedData.networkRequests.push(networkEntry);
      if (capturedData.networkRequests.length > 100) {
        capturedData.networkRequests = capturedData.networkRequests.slice(-100);
      }
      chrome.storage.local.set({ capturedData });
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId > 0) {
      const requestIndex = capturedData.networkRequests.findIndex(
        (req) => req.id === details.requestId
      );
      if (requestIndex !== -1) {
        capturedData.networkRequests[requestIndex] = {
          ...capturedData.networkRequests[requestIndex],
          statusCode: details.statusCode,
          responseHeaders: details.responseHeaders,
          completedTimeStamp: details.timeStamp
        };
        chrome.storage.local.set({ capturedData });
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("Background received message:", message);
  switch (message.type) {
    case "CAPTURE_NETWORK_LOGS":
      handleNetworkLogsRequest(sendResponse);
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
async function handleNetworkLogsRequest(sendResponse) {
  try {
    const recent = capturedData.networkRequests.slice(-20);
    sendResponse({
      success: true,
      requestsCount: recent.length,
      requests: recent
    });
  } catch (error) {
    console.error("Error getting network logs:", error);
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
    await chrome.storage.local.set({ capturedData });
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error storing screenshot:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleStoreConsoleLogs(logs, sendResponse) {
  try {
    capturedData.consoleLogs.push(...logs);
    if (capturedData.consoleLogs.length > 200) {
      capturedData.consoleLogs = capturedData.consoleLogs.slice(-200);
    }
    await chrome.storage.local.set({ capturedData });
    sendResponse({ success: true, logsCount: logs.length });
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
    await chrome.storage.local.set({ capturedData });
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
    const stored = await chrome.storage.local.get(["capturedData"]);
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
    await chrome.storage.local.set({ capturedData });
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
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
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
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
    capturedData.screenshots.push(dataUrl);
    if (capturedData.screenshots.length > 10) {
      capturedData.screenshots = capturedData.screenshots.slice(-10);
    }
    await chrome.storage.local.set({ capturedData });
    sendResponse({ success: true, data: dataUrl });
  } catch (error) {
    console.error("Error capturing screenshot:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
