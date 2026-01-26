// Background service worker for JAT Browser Extension
console.log('JAT Browser Extension Background Script loaded')

// Storage for captured data
let capturedData: {
  screenshots: string[]
  consoleLogs: any[]
  networkRequests: any[]
  selectedElements: any[]
} = {
  screenshots: [],
  consoleLogs: [],
  networkRequests: [],
  selectedElements: []
}

// Install event - set up initial state
chrome.runtime.onInstalled.addListener((details) => {
  console.log('JAT Extension installed:', details.reason)
  
  // Initialize storage
  chrome.storage.local.set({
    capturedData: capturedData,
    extensionVersion: chrome.runtime.getManifest().version
  })
  
  // Create context menu for quick access
  chrome.contextMenus.create({
    id: 'jat-bug-report',
    title: 'Report Bug with JAT',
    contexts: ['page']
  })
})

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'jat-bug-report' && tab?.id) {
    // Send message to content script to open bug report
    chrome.tabs.sendMessage(tab.id, {
      type: 'OPEN_BUG_REPORT_FORM'
    })
  }
})

// Web request listener for network logging
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Only log requests from tabs, not extension requests
    if (details.tabId > 0 && details.type === 'xmlhttprequest') {
      const networkEntry = {
        id: details.requestId,
        url: details.url,
        method: details.method,
        timeStamp: details.timeStamp,
        type: details.type,
        tabId: details.tabId
      }
      
      capturedData.networkRequests.push(networkEntry)
      
      // Keep only last 100 requests to prevent memory issues
      if (capturedData.networkRequests.length > 100) {
        capturedData.networkRequests = capturedData.networkRequests.slice(-100)
      }
      
      // Update storage
      chrome.storage.local.set({ capturedData })
    }
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
)

// Response listener for network logging
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId > 0) {
      // Find and update the corresponding request
      const requestIndex = capturedData.networkRequests.findIndex(
        req => req.id === details.requestId
      )
      
      if (requestIndex !== -1) {
        capturedData.networkRequests[requestIndex] = {
          ...capturedData.networkRequests[requestIndex],
          statusCode: details.statusCode,
          responseHeaders: details.responseHeaders,
          completedTimeStamp: details.timeStamp
        }
        
        // Update storage
        chrome.storage.local.set({ capturedData })
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
)

// Message listener for communication with popup and content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Background received message:', message)
  
  switch (message.type) {
    case 'CAPTURE_NETWORK_LOGS':
      handleNetworkLogsRequest(sendResponse)
      return true // Keep message channel open for async response
      
    case 'STORE_SCREENSHOT':
      handleStoreScreenshot(message.data, sendResponse)
      return true
      
    case 'STORE_CONSOLE_LOGS':
      handleStoreConsoleLogs(message.data, sendResponse)
      return true
      
    case 'STORE_ELEMENT_DATA':
      handleStoreElementData(message.data, sendResponse)
      return true
      
    case 'GET_ALL_CAPTURED_DATA':
      handleGetAllData(sendResponse)
      return true
      
    case 'CLEAR_CAPTURED_DATA':
      handleClearData(sendResponse)
      return true
      
    case 'CAPTURE_VISIBLE_TAB':
      handleCaptureVisibleTab(sendResponse)
      return true
      
    case 'REQUEST_SCREENSHOT_CAPTURE':
      handleRequestScreenshotCapture(sendResponse)
      return true
      
    default:
      console.log('Unknown message type:', message.type)
      sendResponse({ success: false, error: 'Unknown message type' })
  }
})

// Handle network logs request
async function handleNetworkLogsRequest(sendResponse: Function) {
  try {
    const recent = capturedData.networkRequests.slice(-20) // Last 20 requests
    
    sendResponse({
      success: true,
      requestsCount: recent.length,
      requests: recent
    })
  } catch (error) {
    console.error('Error getting network logs:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle store screenshot
async function handleStoreScreenshot(data: string, sendResponse: Function) {
  try {
    capturedData.screenshots.push(data)
    
    // Keep only last 10 screenshots
    if (capturedData.screenshots.length > 10) {
      capturedData.screenshots = capturedData.screenshots.slice(-10)
    }
    
    await chrome.storage.local.set({ capturedData })
    
    sendResponse({ success: true })
  } catch (error) {
    console.error('Error storing screenshot:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle store console logs
async function handleStoreConsoleLogs(logs: any[], sendResponse: Function) {
  try {
    capturedData.consoleLogs.push(...logs)
    
    // Keep only last 200 log entries
    if (capturedData.consoleLogs.length > 200) {
      capturedData.consoleLogs = capturedData.consoleLogs.slice(-200)
    }
    
    await chrome.storage.local.set({ capturedData })
    
    sendResponse({ success: true, logsCount: logs.length })
  } catch (error) {
    console.error('Error storing console logs:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle store element data
async function handleStoreElementData(elementData: any, sendResponse: Function) {
  try {
    capturedData.selectedElements.push(elementData)
    
    // Keep only last 20 selected elements
    if (capturedData.selectedElements.length > 20) {
      capturedData.selectedElements = capturedData.selectedElements.slice(-20)
    }
    
    await chrome.storage.local.set({ capturedData })
    
    sendResponse({ success: true })
  } catch (error) {
    console.error('Error storing element data:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle get all captured data
async function handleGetAllData(sendResponse: Function) {
  try {
    const stored = await chrome.storage.local.get(['capturedData'])
    const data = stored.capturedData || capturedData
    
    sendResponse({
      success: true,
      data: data
    })
  } catch (error) {
    console.error('Error getting captured data:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle clear data
async function handleClearData(sendResponse: Function) {
  try {
    capturedData = {
      screenshots: [],
      consoleLogs: [],
      networkRequests: [],
      selectedElements: []
    }
    
    await chrome.storage.local.set({ capturedData })
    
    sendResponse({ success: true })
  } catch (error) {
    console.error('Error clearing data:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle capture visible tab
async function handleCaptureVisibleTab(sendResponse: Function) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' })
    sendResponse({ success: true, data: dataUrl })
  } catch (error) {
    console.error('Error capturing visible tab:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle request screenshot capture
async function handleRequestScreenshotCapture(sendResponse: Function) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' })
    
    // Store the screenshot
    capturedData.screenshots.push(dataUrl)
    
    // Keep only last 10 screenshots
    if (capturedData.screenshots.length > 10) {
      capturedData.screenshots = capturedData.screenshots.slice(-10)
    }
    
    await chrome.storage.local.set({ capturedData })
    
    sendResponse({ success: true, data: dataUrl })
  } catch (error) {
    console.error('Error capturing screenshot:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}