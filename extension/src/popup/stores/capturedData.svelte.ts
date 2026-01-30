// Reactive store for captured data from background script

export interface CapturedDataState {
  screenshots: string[]
  consoleLogs: ConsoleLogEntry[]
  networkRequests: unknown[]
  selectedElements: ElementData[]
}

export interface ConsoleLogEntry {
  type: 'log' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
  message: string
  timestamp: string
  timestampMs: number
  url: string
  stackTrace?: string
  lineNumber?: number
  columnNumber?: number
  fileName?: string
}

export interface ElementData {
  tagName: string
  className: string
  id: string
  textContent: string
  attributes: Record<string, string>
  xpath: string
  selector: string
  boundingRect: {
    x: number
    y: number
    width: number
    height: number
  }
  screenshot: string | null
  timestamp: string
  url: string
}

export let capturedData: CapturedDataState = $state({
  screenshots: [],
  consoleLogs: [],
  networkRequests: [],
  selectedElements: []
})

export async function loadCapturedData(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_CAPTURED_DATA' })
    if (response?.success && response.data) {
      capturedData.screenshots = response.data.screenshots || []
      capturedData.consoleLogs = response.data.consoleLogs || []
      capturedData.networkRequests = response.data.networkRequests || []
      capturedData.selectedElements = response.data.selectedElements || []
    }
  } catch (err) {
    console.error('Failed to load captured data:', err)
  }
}

export async function clearAllData(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'CLEAR_CAPTURED_DATA' })
    capturedData.screenshots = []
    capturedData.consoleLogs = []
    capturedData.networkRequests = []
    capturedData.selectedElements = []
  } catch (err) {
    console.error('Failed to clear data:', err)
  }
}
