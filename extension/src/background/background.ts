// Background service worker for JAT Browser Extension
import {
  NetworkRequestEntry,
  NetworkCaptureConfig,
  DEFAULT_NETWORK_CONFIG,
  filterSensitiveHeaders,
  parseQueryString,
  calculateHeadersSize,
  convertChromeHeaders,
  getMimeType,
  getContentLength,
  createDefaultTimings,
  toHARExport
} from '../types/network'
import {
  runtime,
  tabs,
  storage,
  contextMenus,
  webRequest,
  isExtensionUrl,
} from '../lib/browser-compat'

console.log('JAT Browser Extension Background Script loaded')

// Network capture configuration
let networkConfig: NetworkCaptureConfig = { ...DEFAULT_NETWORK_CONFIG }

// Storage for captured data
let capturedData: {
  screenshots: string[]
  consoleLogs: any[]
  networkRequests: NetworkRequestEntry[]
  selectedElements: any[]
} = {
  screenshots: [],
  consoleLogs: [],
  networkRequests: [],
  selectedElements: []
}

// Install event - set up initial state
runtime.onInstalled.addListener((details) => {
  console.log('JAT Extension installed:', details.reason)

  // Initialize storage
  storage.local.set({
    capturedData: capturedData,
    networkConfig: networkConfig,
    extensionVersion: runtime.getManifest().version
  })

  // Create context menu for quick access
  contextMenus.create({
    id: 'jat-bug-report',
    title: 'Report Bug with JAT',
    contexts: ['page']
  })
})

// Load config from storage on startup
storage.local.get(['networkConfig']).then((result) => {
  if (result.networkConfig) {
    networkConfig = { ...DEFAULT_NETWORK_CONFIG, ...result.networkConfig as NetworkCaptureConfig }
  }
})

// Context menu click handler
contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'jat-bug-report' && tab?.id) {
    // Send message to content script to open bug report
    tabs.sendMessage(tab.id, {
      type: 'OPEN_BUG_REPORT_FORM'
    })
  }
})

/**
 * Check if a request type should be captured
 */
function shouldCaptureRequest(
  type: chrome.webRequest.ResourceType,
  url: string
): boolean {
  // Always skip extension requests (chrome-extension:// or moz-extension://)
  if (isExtensionUrl(url)) return false

  // Check if type is in capture list
  if (!networkConfig.captureTypes.includes(type)) return false

  // Check URL filter if configured
  if (networkConfig.urlFilter) {
    try {
      const pattern = new RegExp(networkConfig.urlFilter)
      if (!pattern.test(url)) return false
    } catch {
      // Invalid regex, ignore filter
    }
  }

  return true
}

/**
 * Add or update a network request entry
 */
function addNetworkRequest(entry: NetworkRequestEntry): void {
  capturedData.networkRequests.push(entry)

  // Keep only last N requests based on config
  if (capturedData.networkRequests.length > networkConfig.maxRequests) {
    capturedData.networkRequests = capturedData.networkRequests.slice(
      -networkConfig.maxRequests
    )
  }

  // Update storage (debounced in production, immediate for now)
  storage.local.set({ capturedData })
}

/**
 * Update an existing network request entry
 */
function updateNetworkRequest(
  requestId: string,
  updates: Partial<NetworkRequestEntry>
): void {
  const index = capturedData.networkRequests.findIndex(
    (req) => req.id === requestId
  )

  if (index !== -1) {
    capturedData.networkRequests[index] = {
      ...capturedData.networkRequests[index],
      ...updates
    }
    storage.local.set({ capturedData })
  }
}

// Web request listener for network logging - onBeforeRequest
webRequest.onBeforeRequest.addListener(
  (details) => {
    // Only log requests from tabs
    if (details.tabId <= 0) return

    // Check if we should capture this request
    if (!shouldCaptureRequest(details.type, details.url)) return

    const requestHeaders: { name: string; value: string }[] = []
    let bodySize = 0

    // Estimate body size from requestBody if available
    if (details.requestBody) {
      if (details.requestBody.raw) {
        bodySize = details.requestBody.raw.reduce(
          (size, part) => size + (part.bytes?.byteLength || 0),
          0
        )
      } else if (details.requestBody.formData) {
        // Estimate form data size
        for (const key in details.requestBody.formData) {
          const values = details.requestBody.formData[key]
          bodySize += key.length + 1 // key=
          bodySize += values.join('&').length
        }
      }
    }

    const entry: NetworkRequestEntry = {
      id: details.requestId,
      tabId: details.tabId,
      url: details.url,
      method: details.method || 'GET',
      type: details.type,
      startedDateTime: new Date(details.timeStamp).toISOString(),
      time: 0,
      timings: createDefaultTimings(),
      request: {
        httpVersion: 'HTTP/1.1', // Will be updated if we can detect it
        headers: requestHeaders,
        headersSize: -1, // Unknown until onSendHeaders
        bodySize: bodySize,
        queryString: parseQueryString(details.url)
      },
      completed: false
    }

    addNetworkRequest(entry)
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
)

// Capture request headers
webRequest.onSendHeaders.addListener(
  (details) => {
    if (details.tabId <= 0) return

    const entry = capturedData.networkRequests.find(
      (req) => req.id === details.requestId
    )
    if (!entry) return

    let headers = convertChromeHeaders(details.requestHeaders)

    // Filter sensitive headers if configured
    if (networkConfig.filterSensitiveHeaders) {
      headers = filterSensitiveHeaders(headers)
    }

    updateNetworkRequest(details.requestId, {
      request: {
        ...entry.request,
        headers: headers,
        headersSize: calculateHeadersSize(headers)
      }
    })
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders']
)

// Capture response headers on completion
webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId <= 0) return

    const entry = capturedData.networkRequests.find(
      (req) => req.id === details.requestId
    )
    if (!entry) return

    let responseHeaders = convertChromeHeaders(details.responseHeaders)

    // Filter sensitive headers if configured
    if (networkConfig.filterSensitiveHeaders) {
      responseHeaders = filterSensitiveHeaders(responseHeaders)
    }

    const contentLength = getContentLength(responseHeaders)
    const mimeType = getMimeType(responseHeaders)

    // Calculate time to first byte (TTFB)
    const ttfb = details.timeStamp - new Date(entry.startedDateTime).getTime()

    updateNetworkRequest(details.requestId, {
      timings: {
        ...entry.timings,
        wait: ttfb
      },
      response: {
        status: details.statusCode || 0,
        statusText: details.statusLine?.split(' ').slice(1).join(' ') || '',
        httpVersion:
          details.statusLine?.split(' ')[0]?.replace('HTTP/', '') || '1.1',
        headers: responseHeaders,
        headersSize: calculateHeadersSize(responseHeaders),
        bodySize: contentLength,
        content: {
          size: contentLength,
          mimeType: mimeType
        }
      }
    })
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
)

// Response completed listener
webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId <= 0) return

    const entry = capturedData.networkRequests.find(
      (req) => req.id === details.requestId
    )
    if (!entry) return

    const totalTime = details.timeStamp - new Date(entry.startedDateTime).getTime()

    // Calculate receive time (total - wait)
    const receiveTime = entry.timings.wait > 0 ? totalTime - entry.timings.wait : -1

    updateNetworkRequest(details.requestId, {
      completed: true,
      time: totalTime,
      timings: {
        ...entry.timings,
        receive: receiveTime
      }
    })
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
)

// Handle request errors
webRequest.onErrorOccurred.addListener(
  (details) => {
    if (details.tabId <= 0) return

    const entry = capturedData.networkRequests.find(
      (req) => req.id === details.requestId
    )
    if (!entry) return

    const totalTime = details.timeStamp - new Date(entry.startedDateTime).getTime()

    updateNetworkRequest(details.requestId, {
      completed: true,
      time: totalTime,
      error: details.error
    })
  },
  { urls: ['<all_urls>'] }
)

// Message listener for communication with popup and content scripts
runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Background received message:', message)

  switch (message.type) {
    case 'CAPTURE_NETWORK_LOGS':
      handleNetworkLogsRequest(message.options, sendResponse)
      return true // Keep message channel open for async response

    case 'EXPORT_NETWORK_HAR':
      handleExportHAR(message.pageTitle, sendResponse)
      return true

    case 'CLEAR_NETWORK_LOGS':
      handleClearNetworkLogs(sendResponse)
      return true

    case 'GET_NETWORK_CONFIG':
      sendResponse({ success: true, config: networkConfig })
      return false

    case 'SET_NETWORK_CONFIG':
      handleSetNetworkConfig(message.config, sendResponse)
      return true

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
interface NetworkLogsOptions {
  limit?: number
  tabId?: number
  completed?: boolean
}

async function handleNetworkLogsRequest(
  options: NetworkLogsOptions | undefined,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    let requests = [...capturedData.networkRequests]

    // Filter by tab if specified
    if (options?.tabId) {
      requests = requests.filter((req) => req.tabId === options.tabId)
    }

    // Filter by completion status if specified
    if (options?.completed !== undefined) {
      requests = requests.filter((req) => req.completed === options.completed)
    }

    // Apply limit
    const limit = options?.limit || 50
    requests = requests.slice(-limit)

    sendResponse({
      success: true,
      requestsCount: requests.length,
      requests: requests
    })
  } catch (error) {
    console.error('Error getting network logs:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle HAR export
async function handleExportHAR(
  pageTitle: string | undefined,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    const har = toHARExport(
      capturedData.networkRequests,
      pageTitle || 'JAT Network Capture'
    )

    sendResponse({
      success: true,
      har: har,
      json: JSON.stringify(har, null, 2)
    })
  } catch (error) {
    console.error('Error exporting HAR:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle clear network logs
async function handleClearNetworkLogs(
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    capturedData.networkRequests = []
    await storage.local.set({ capturedData })

    sendResponse({ success: true })
  } catch (error) {
    console.error('Error clearing network logs:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle set network config
async function handleSetNetworkConfig(
  config: Partial<NetworkCaptureConfig>,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    networkConfig = { ...networkConfig, ...config }
    await storage.local.set({ networkConfig })

    sendResponse({ success: true, config: networkConfig })
  } catch (error) {
    console.error('Error setting network config:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle store screenshot
async function handleStoreScreenshot(
  data: string,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    capturedData.screenshots.push(data)

    // Keep only last 10 screenshots
    if (capturedData.screenshots.length > 10) {
      capturedData.screenshots = capturedData.screenshots.slice(-10)
    }

    await storage.local.set({ capturedData })

    sendResponse({ success: true })
  } catch (error) {
    console.error('Error storing screenshot:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Console log storage configuration
const CONSOLE_LOG_MAX_STORED = 200

// Handle store console logs
async function handleStoreConsoleLogs(
  logs: any[],
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    // Add logs with deduplication based on timestamp + message
    const existingKeys = new Set(
      capturedData.consoleLogs.map(
        (log) =>
          `${log.timestampMs || log.timestamp}:${log.message?.substring(0, 100)}`
      )
    )

    const newLogs = logs.filter((log) => {
      const key = `${log.timestampMs || log.timestamp}:${log.message?.substring(0, 100)}`
      if (existingKeys.has(key)) return false
      existingKeys.add(key)
      return true
    })

    capturedData.consoleLogs.push(...newLogs)

    // Keep only last N log entries
    if (capturedData.consoleLogs.length > CONSOLE_LOG_MAX_STORED) {
      capturedData.consoleLogs = capturedData.consoleLogs.slice(
        -CONSOLE_LOG_MAX_STORED
      )
    }

    await storage.local.set({ capturedData })

    sendResponse({
      success: true,
      logsCount: newLogs.length,
      totalLogs: capturedData.consoleLogs.length
    })
  } catch (error) {
    console.error('Error storing console logs:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle store element data
async function handleStoreElementData(
  elementData: any,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    capturedData.selectedElements.push(elementData)

    // Keep only last 20 selected elements
    if (capturedData.selectedElements.length > 20) {
      capturedData.selectedElements = capturedData.selectedElements.slice(-20)
    }

    await storage.local.set({ capturedData })

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
async function handleGetAllData(
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    const stored = await storage.local.get(['capturedData'])
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
async function handleClearData(
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    capturedData = {
      screenshots: [],
      consoleLogs: [],
      networkRequests: [],
      selectedElements: []
    }

    await storage.local.set({ capturedData })

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
async function handleCaptureVisibleTab(
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    const dataUrl = await tabs.captureVisibleTab({ format: 'png' })
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
async function handleRequestScreenshotCapture(
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    const dataUrl = await tabs.captureVisibleTab({ format: 'png' })

    // Store the screenshot
    capturedData.screenshots.push(dataUrl)

    // Keep only last 10 screenshots
    if (capturedData.screenshots.length > 10) {
      capturedData.screenshots = capturedData.screenshots.slice(-10)
    }

    await storage.local.set({ capturedData })

    sendResponse({ success: true, data: dataUrl })
  } catch (error) {
    console.error('Error capturing screenshot:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
