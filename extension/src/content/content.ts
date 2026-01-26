// Content script for JAT Browser Extension
console.log('JAT Browser Extension Content Script loaded on:', window.location.href)

// State management
let isElementPickerActive = false
let originalCursor = ''
let elementPickerOverlay: HTMLElement | null = null

// Console log capture setup
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
}

const capturedLogs: any[] = []

// Override console methods to capture logs
function setupConsoleCapture() {
  console.log = (...args) => {
    originalConsole.log(...args)
    capturedLogs.push({
      type: 'log',
      message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '),
      timestamp: new Date().toISOString(),
      url: window.location.href
    })
  }
  
  console.error = (...args) => {
    originalConsole.error(...args)
    capturedLogs.push({
      type: 'error',
      message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '),
      timestamp: new Date().toISOString(),
      url: window.location.href
    })
  }
  
  console.warn = (...args) => {
    originalConsole.warn(...args)
    capturedLogs.push({
      type: 'warn',
      message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '),
      timestamp: new Date().toISOString(),
      url: window.location.href
    })
  }
  
  console.info = (...args) => {
    originalConsole.info(...args)
    capturedLogs.push({
      type: 'info',
      message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '),
      timestamp: new Date().toISOString(),
      url: window.location.href
    })
  }
}

// Initialize console capture
setupConsoleCapture()

// Screenshot capture function
async function captureScreenshot(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use Chrome's captureVisibleTab API via background script
    chrome.runtime.sendMessage({
      type: 'REQUEST_SCREENSHOT_CAPTURE'
    }, (response) => {
      if (response?.success) {
        resolve(response.data)
      } else {
        reject(new Error(response?.error || 'Screenshot capture failed'))
      }
    })
  })
}

// Element picker functionality
function createElementPickerOverlay() {
  const overlay = document.createElement('div')
  overlay.id = 'jat-element-picker-overlay'
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(59, 130, 246, 0.1);
    z-index: 999999;
    pointer-events: none;
    border: 2px solid #3b82f6;
    box-sizing: border-box;
    transition: all 0.1s ease;
  `
  document.body.appendChild(overlay)
  return overlay
}

function startElementPicker() {
  if (isElementPickerActive) return
  
  isElementPickerActive = true
  originalCursor = document.body.style.cursor
  document.body.style.cursor = 'crosshair'
  
  elementPickerOverlay = createElementPickerOverlay()
  
  document.addEventListener('mousemove', handleElementHover)
  document.addEventListener('click', handleElementClick)
  document.addEventListener('keydown', handleElementPickerEscape)
  
  // Show instruction tooltip
  showInstructionTooltip()
}

function stopElementPicker() {
  if (!isElementPickerActive) return
  
  isElementPickerActive = false
  document.body.style.cursor = originalCursor
  
  if (elementPickerOverlay) {
    elementPickerOverlay.remove()
    elementPickerOverlay = null
  }
  
  document.removeEventListener('mousemove', handleElementHover)
  document.removeEventListener('click', handleElementClick)
  document.removeEventListener('keydown', handleElementPickerEscape)
  
  hideInstructionTooltip()
}

function handleElementHover(event: MouseEvent) {
  if (!isElementPickerActive || !elementPickerOverlay) return
  
  const target = event.target as HTMLElement
  if (target === elementPickerOverlay) return
  
  const rect = target.getBoundingClientRect()
  
  elementPickerOverlay.style.top = `${rect.top}px`
  elementPickerOverlay.style.left = `${rect.left}px`
  elementPickerOverlay.style.width = `${rect.width}px`
  elementPickerOverlay.style.height = `${rect.height}px`
}

function handleElementClick(event: MouseEvent) {
  if (!isElementPickerActive) return
  
  event.preventDefault()
  event.stopPropagation()
  
  const target = event.target as HTMLElement
  
  // Capture element information
  const elementData = {
    tagName: target.tagName,
    className: target.className,
    id: target.id,
    textContent: target.textContent?.substring(0, 100) || '',
    attributes: Array.from(target.attributes).reduce((acc, attr) => {
      acc[attr.name] = attr.value
      return acc
    }, {} as Record<string, string>),
    xpath: getXPath(target),
    selector: generateSelector(target),
    boundingRect: target.getBoundingClientRect(),
    timestamp: new Date().toISOString(),
    url: window.location.href
  }
  
  // Store element data
  chrome.runtime.sendMessage({
    type: 'STORE_ELEMENT_DATA',
    data: elementData
  })
  
  // Notify popup
  chrome.runtime.sendMessage({
    type: 'ELEMENT_SELECTED',
    tagName: target.tagName,
    data: elementData
  })
  
  stopElementPicker()
}

function handleElementPickerEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    stopElementPicker()
  }
}

// Helper functions
function getXPath(element: Element): string {
  if (element.id !== '') {
    return 'id("' + element.id + '")'
  }
  if (element === document.body) {
    return element.tagName
  }
  
  let ix = 0
  const siblings = element.parentNode?.childNodes || []
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i]
    if (sibling === element) {
      return getXPath(element.parentElement!) + '/' + element.tagName + '[' + (ix + 1) + ']'
    }
    if (sibling.nodeType === 1 && (sibling as Element).tagName === element.tagName) {
      ix++
    }
  }
  return ''
}

function generateSelector(element: Element): string {
  if (element.id) {
    return '#' + element.id
  }
  
  let selector = element.tagName.toLowerCase()
  
  if (element.className) {
    selector += '.' + element.className.split(' ').join('.')
  }
  
  // Add nth-child if needed for uniqueness
  const parent = element.parentElement
  if (parent) {
    const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName)
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1
      selector += `:nth-child(${index})`
    }
  }
  
  return selector
}

function showInstructionTooltip() {
  const tooltip = document.createElement('div')
  tooltip.id = 'jat-instruction-tooltip'
  tooltip.innerHTML = 'Click on any element to select it • Press <strong>ESC</strong> to cancel'
  tooltip.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #1f2937;
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 1000000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: none;
  `
  document.body.appendChild(tooltip)
}

function hideInstructionTooltip() {
  const tooltip = document.getElementById('jat-instruction-tooltip')
  if (tooltip) {
    tooltip.remove()
  }
}

// Bug report form
function createBugReportForm() {
  const formHtml = `
    <div id="jat-bug-report-modal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        background: white;
        border-radius: 8px;
        padding: 24px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #1f2937; font-size: 20px;">Bug Report</h2>
          <button id="jat-close-modal" style="
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            color: #6b7280;
          ">&times;</button>
        </div>
        
        <form id="jat-bug-report-form">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #374151;">Title</label>
            <input type="text" id="bug-title" style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              font-size: 14px;
              box-sizing: border-box;
            " placeholder="Brief description of the issue" required>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #374151;">Description</label>
            <textarea id="bug-description" style="
              width: 100%;
              height: 120px;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              font-size: 14px;
              resize: vertical;
              box-sizing: border-box;
            " placeholder="Detailed description of the bug, steps to reproduce, expected vs actual behavior" required></textarea>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 600; color: #374151;">Severity</label>
            <select id="bug-severity" style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              font-size: 14px;
              box-sizing: border-box;
            ">
              <option value="low">Low - Minor issue</option>
              <option value="medium" selected>Medium - Notable issue</option>
              <option value="high">High - Major issue</option>
              <option value="critical">Critical - Blocking issue</option>
            </select>
          </div>
          
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" id="jat-cancel-report" style="
              padding: 8px 16px;
              background: #f3f4f6;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
            ">Cancel</button>
            <button type="submit" style="
              padding: 8px 16px;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
            ">Submit Bug Report</button>
          </div>
        </form>
      </div>
    </div>
  `
  
  document.body.insertAdjacentHTML('beforeend', formHtml)
  
  // Event handlers
  document.getElementById('jat-close-modal')?.addEventListener('click', closeBugReportForm)
  document.getElementById('jat-cancel-report')?.addEventListener('click', closeBugReportForm)
  document.getElementById('jat-bug-report-form')?.addEventListener('submit', handleBugReportSubmit)
  
  // Focus on title field
  const titleField = document.getElementById('bug-title') as HTMLInputElement
  titleField?.focus()
}

function closeBugReportForm() {
  const modal = document.getElementById('jat-bug-report-modal')
  if (modal) {
    modal.remove()
  }
}

async function handleBugReportSubmit(event: Event) {
  event.preventDefault()
  
  const title = (document.getElementById('bug-title') as HTMLInputElement).value
  const description = (document.getElementById('bug-description') as HTMLTextAreaElement).value
  const severity = (document.getElementById('bug-severity') as HTMLSelectElement).value
  
  // Get all captured data
  const response = await chrome.runtime.sendMessage({
    type: 'GET_ALL_CAPTURED_DATA'
  })
  
  const bugReport = {
    title,
    description,
    severity,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    capturedData: response.success ? response.data : null
  }
  
  console.log('Bug Report:', bugReport)
  
  // Here you would typically send the bug report to your backend
  // For now, we'll just save it to storage and show a success message
  chrome.storage.local.set({
    [`bugReport_${Date.now()}`]: bugReport
  })
  
  alert('Bug report submitted successfully!')
  closeBugReportForm()
}

// Message listener for communication with popup and background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Content script received message:', message)
  
  switch (message.type) {
    case 'CAPTURE_SCREENSHOT':
      handleScreenshotRequest(sendResponse)
      return true
      
    case 'CAPTURE_CONSOLE_LOGS':
      handleConsoleLogsRequest(sendResponse)
      return true
      
    case 'START_ELEMENT_PICKER':
      startElementPicker()
      sendResponse({ success: true })
      break
      
    case 'OPEN_BUG_REPORT_FORM':
      createBugReportForm()
      sendResponse({ success: true })
      break
      
    default:
      console.log('Unknown message type:', message.type)
      sendResponse({ success: false, error: 'Unknown message type' })
  }
})

// Handle screenshot request
async function handleScreenshotRequest(sendResponse: Function) {
  try {
    // For full page screenshot, we need to capture via background script
    chrome.runtime.sendMessage({
      type: 'CAPTURE_VISIBLE_TAB'
    }, (response) => {
      if (response?.success) {
        // Store screenshot
        chrome.runtime.sendMessage({
          type: 'STORE_SCREENSHOT',
          data: response.data
        })
        sendResponse({ success: true })
      } else {
        sendResponse({ 
          success: false, 
          error: response?.error || 'Screenshot capture failed' 
        })
      }
    })
  } catch (error) {
    console.error('Screenshot error:', error)
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
}

// Handle console logs request
function handleConsoleLogsRequest(sendResponse: Function) {
  try {
    // Store console logs in background
    chrome.runtime.sendMessage({
      type: 'STORE_CONSOLE_LOGS',
      data: capturedLogs
    }, (response) => {
      if (response?.success) {
        sendResponse({ 
          success: true, 
          logsCount: capturedLogs.length 
        })
        // Clear captured logs after storing
        capturedLogs.length = 0
      } else {
        sendResponse({ 
          success: false, 
          error: response?.error || 'Console log storage failed' 
        })
      }
    })
  } catch (error) {
    console.error('Console logs error:', error)
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
}

// Initialize content script
console.log('JAT Content Script initialized')