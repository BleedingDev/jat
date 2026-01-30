// Content script for JAT Browser Extension
import {
  captureFullPage,
  captureElement,
  compressImage,
  annotationEditor,
  type ScreenshotResult,
  type ScreenshotOptions
} from '../lib/screenshot'
import { runtime, storage } from '../lib/browser-compat'

console.log('JAT Browser Extension Content Script loaded on:', window.location.href)

// State management
let isElementPickerActive = false
let isElementScreenshotMode = false
let originalCursor = ''
let elementPickerOverlay: HTMLElement | null = null
let lastScreenshot: ScreenshotResult | null = null

// Console log capture configuration
interface ConsoleLogConfig {
  maxEntries: number
  captureStackTraces: boolean
  filterSensitiveData: boolean
}

const consoleConfig: ConsoleLogConfig = {
  maxEntries: 50,           // Default buffer size
  captureStackTraces: true, // Capture stack traces for errors/warnings
  filterSensitiveData: true // Filter sensitive data like tokens, passwords
}

// Patterns for sensitive data detection
const SENSITIVE_PATTERNS: RegExp[] = [
  // API keys and tokens
  /\b(api[_-]?key|apikey|api[_-]?token|access[_-]?token|auth[_-]?token|bearer)\s*[:=]\s*["']?[\w\-\.]+["']?/gi,
  /\bBearer\s+[\w\-\.]+/gi,
  /\b(sk|pk|rk)[_-][a-zA-Z0-9]{20,}/gi, // Stripe-style keys
  /\bghp_[a-zA-Z0-9]{36,}/gi, // GitHub tokens
  /\bsk-[a-zA-Z0-9]{20,}/gi, // OpenAI-style keys

  // Passwords and secrets
  /\b(password|passwd|pwd|secret|credential)\s*[:=]\s*["']?[^"'\s,}{]+["']?/gi,

  // JWT tokens (header.payload.signature format)
  /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/gi,

  // Credit card numbers (basic pattern)
  /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,

  // Email addresses in sensitive contexts
  /\b(email|e-mail)\s*[:=]\s*["']?[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}["']?/gi,

  // Private keys
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,

  // AWS-style credentials
  /\b(AKIA|ABIA|ACCA|AGPA|AIDA|AIPA|AKIA|ANPA|ANVA|AROA|APKA|ASCA|ASIA)[A-Z0-9]{16}\b/g,
  /\b(aws[_-]?secret[_-]?access[_-]?key|aws[_-]?access[_-]?key[_-]?id)\s*[:=]\s*["']?[\w\/\+]+["']?/gi,
]

// Replacement text for filtered content
const REDACTED = '[REDACTED]'

// Console log capture setup
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
  trace: console.trace
}

interface CapturedLogEntry {
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

const capturedLogs: CapturedLogEntry[] = []

/**
 * Filter sensitive data from a string
 */
function filterSensitiveData(input: string): string {
  if (!consoleConfig.filterSensitiveData) return input

  let filtered = input
  for (const pattern of SENSITIVE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0
    filtered = filtered.replace(pattern, REDACTED)
  }
  return filtered
}

/**
 * Safely stringify a value, handling circular references and special types
 */
function safeStringify(arg: unknown): string {
  if (arg === null) return 'null'
  if (arg === undefined) return 'undefined'

  if (typeof arg === 'string') return arg
  if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg)
  if (typeof arg === 'symbol') return arg.toString()
  if (typeof arg === 'function') return `[Function: ${arg.name || 'anonymous'}]`

  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? '\n' + arg.stack : ''}`
  }

  if (typeof arg === 'object') {
    try {
      const seen = new WeakSet()
      return JSON.stringify(arg, (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]'
          seen.add(value)
        }
        if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`
        if (value instanceof Error) return `${value.name}: ${value.message}`
        return value
      }, 2)
    } catch {
      return '[Object - stringify failed]'
    }
  }

  return String(arg)
}

/**
 * Capture stack trace information
 */
function captureStackInfo(): { stackTrace?: string; lineNumber?: number; columnNumber?: number; fileName?: string } {
  if (!consoleConfig.captureStackTraces) return {}

  const stack = new Error().stack
  if (!stack) return {}

  const lines = stack.split('\n')
  // Skip the first few lines (Error, captureStackInfo, createLogEntry, console override)
  const relevantLines = lines.slice(4)
  const stackTrace = relevantLines.join('\n')

  // Parse the first relevant line for location info
  // Format: "    at functionName (file:line:col)" or "    at file:line:col"
  const firstLine = relevantLines[0] || ''
  const locationMatch = firstLine.match(/(?:at\s+(?:\S+\s+)?\()?([^()]+):(\d+):(\d+)\)?/)

  if (locationMatch) {
    return {
      stackTrace,
      fileName: locationMatch[1],
      lineNumber: parseInt(locationMatch[2], 10),
      columnNumber: parseInt(locationMatch[3], 10)
    }
  }

  return { stackTrace }
}

/**
 * Create a log entry with all metadata
 */
function createLogEntry(type: CapturedLogEntry['type'], args: unknown[], includeStack: boolean): CapturedLogEntry {
  const now = new Date()
  const message = filterSensitiveData(
    args.map(safeStringify).join(' ')
  )

  const entry: CapturedLogEntry = {
    type,
    message,
    timestamp: now.toISOString(),
    timestampMs: now.getTime(),
    url: window.location.href
  }

  // Include stack trace for errors and warnings, or when explicitly requested
  if (includeStack || type === 'error' || type === 'warn' || type === 'trace') {
    const stackInfo = captureStackInfo()
    Object.assign(entry, stackInfo)
  }

  return entry
}

/**
 * Add a log entry to the buffer, maintaining max size
 */
function addLogEntry(entry: CapturedLogEntry) {
  capturedLogs.push(entry)

  // Maintain buffer size limit
  while (capturedLogs.length > consoleConfig.maxEntries) {
    capturedLogs.shift()
  }
}

// Override console methods to capture logs
function setupConsoleCapture() {
  console.log = (...args) => {
    originalConsole.log(...args)
    addLogEntry(createLogEntry('log', args, false))
  }

  console.error = (...args) => {
    originalConsole.error(...args)
    addLogEntry(createLogEntry('error', args, true))
  }

  console.warn = (...args) => {
    originalConsole.warn(...args)
    addLogEntry(createLogEntry('warn', args, true))
  }

  console.info = (...args) => {
    originalConsole.info(...args)
    addLogEntry(createLogEntry('info', args, false))
  }

  console.debug = (...args) => {
    originalConsole.debug(...args)
    addLogEntry(createLogEntry('debug', args, false))
  }

  console.trace = (...args) => {
    originalConsole.trace(...args)
    addLogEntry(createLogEntry('trace', args, true))
  }
}

/**
 * Update console capture configuration
 */
function updateConsoleConfig(config: Partial<ConsoleLogConfig>) {
  if (config.maxEntries !== undefined) {
    consoleConfig.maxEntries = Math.max(1, Math.min(500, config.maxEntries))
    // Trim buffer if new size is smaller
    while (capturedLogs.length > consoleConfig.maxEntries) {
      capturedLogs.shift()
    }
  }
  if (config.captureStackTraces !== undefined) {
    consoleConfig.captureStackTraces = config.captureStackTraces
  }
  if (config.filterSensitiveData !== undefined) {
    consoleConfig.filterSensitiveData = config.filterSensitiveData
  }
}

/**
 * Get current console capture configuration
 */
function getConsoleConfig(): ConsoleLogConfig {
  return { ...consoleConfig }
}

/**
 * Get captured logs, optionally filtered by type
 */
function getCapturedLogs(filter?: { types?: CapturedLogEntry['type'][]; since?: number }): CapturedLogEntry[] {
  let logs = [...capturedLogs]

  if (filter?.types && filter.types.length > 0) {
    logs = logs.filter(log => filter.types!.includes(log.type))
  }

  if (filter?.since) {
    logs = logs.filter(log => log.timestampMs >= filter.since!)
  }

  return logs
}

/**
 * Clear captured logs
 */
function clearCapturedLogs() {
  capturedLogs.length = 0
}

// Initialize console capture
setupConsoleCapture()

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

async function handleElementClick(event: MouseEvent) {
  if (!isElementPickerActive) return

  event.preventDefault()
  event.stopPropagation()

  const target = event.target as HTMLElement
  const rect = target.getBoundingClientRect()

  // Stop the picker first to remove overlay before screenshot
  stopElementPicker()

  // Small delay to ensure overlay is fully removed before screenshot
  await new Promise(resolve => setTimeout(resolve, 50))

  // Capture element-specific screenshot
  let elementScreenshot: string | null = null
  try {
    elementScreenshot = await captureElementScreenshot(rect)
  } catch (error) {
    originalConsole.error('Element screenshot capture failed:', error)
  }

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
    boundingRect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right
    },
    screenshot: elementScreenshot,
    timestamp: new Date().toISOString(),
    url: window.location.href
  }

  // Store element data
  runtime.sendMessage({
    type: 'STORE_ELEMENT_DATA',
    data: elementData
  })

  // Notify popup
  runtime.sendMessage({
    type: 'ELEMENT_SELECTED',
    tagName: target.tagName,
    data: elementData
  })
}

/**
 * Capture a screenshot of a specific element by cropping from the full page screenshot
 */
async function captureElementScreenshot(rect: DOMRect): Promise<string | null> {
  try {
    // Request full page screenshot from background
    const response = await runtime.sendMessage({
      type: 'CAPTURE_VISIBLE_TAB'
    }) as any

    if (!response?.success || !response.data) {
      return null
    }

    // Create an image from the full screenshot
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Image load failed'))
      image.src = response.data
    })

    // Calculate device pixel ratio for accurate cropping
    const dpr = window.devicePixelRatio || 1

    // Create canvas for cropping
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      return null
    }

    // Add padding around the element (10px on each side)
    const padding = 10
    const x = Math.max(0, (rect.left - padding) * dpr)
    const y = Math.max(0, (rect.top - padding) * dpr)
    const width = Math.min((rect.width + padding * 2) * dpr, img.width - x)
    const height = Math.min((rect.height + padding * 2) * dpr, img.height - y)

    // Set canvas size
    canvas.width = width
    canvas.height = height

    // Draw cropped region
    ctx.drawImage(
      img,
      x, y, width, height,  // Source rectangle
      0, 0, width, height   // Destination rectangle
    )

    // Convert to data URL
    return canvas.toDataURL('image/png')
  } catch (error) {
    originalConsole.error('Error cropping screenshot:', error)
    return null
  }
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
  // If element has a unique ID, use it directly
  if (element.id) {
    return '#' + CSS.escape(element.id)
  }

  // Build a unique selector by walking up the DOM tree
  const parts: string[] = []
  let current: Element | null = element

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase()

    // Check if element has unique ID
    if (current.id) {
      selector = '#' + CSS.escape(current.id)
      parts.unshift(selector)
      break // ID is unique, no need to go further up
    }

    // Add classes that help identify the element (filter out dynamic/utility classes)
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.split(/\s+/).filter(cls => {
        // Filter out common dynamic class patterns
        return cls &&
          !cls.match(/^(ng-|v-|svelte-|css-|_|js-|is-|has-)/) &&
          !cls.match(/^\d/) &&
          cls.length > 1
      })
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.')
      }
    }

    // Add data attributes that might help identify the element
    const dataAttrs = ['data-testid', 'data-id', 'data-name', 'name', 'role', 'aria-label']
    for (const attr of dataAttrs) {
      const value = current.getAttribute(attr)
      if (value) {
        selector += `[${attr}="${CSS.escape(value)}"]`
        break
      }
    }

    // Add nth-of-type if there are siblings with same tag
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(el => el.tagName === current!.tagName)
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += `:nth-of-type(${index})`
      }
    }

    parts.unshift(selector)

    // Check if current selector is already unique
    const testSelector = parts.join(' > ')
    try {
      if (document.querySelectorAll(testSelector).length === 1) {
        break
      }
    } catch {
      // Invalid selector, continue building
    }

    current = current.parentElement
  }

  // Build the final selector
  const fullSelector = parts.join(' > ')

  // Verify uniqueness and simplify if possible
  try {
    if (document.querySelectorAll(fullSelector).length === 1) {
      return fullSelector
    }
  } catch {
    // Fall back to a simpler approach
  }

  // Fallback: use nth-child from body
  return generateFallbackSelector(element)
}

function generateFallbackSelector(element: Element): string {
  const path: string[] = []
  let current: Element | null = element

  while (current && current !== document.body) {
    const parentEl: Element | null = current.parentElement
    if (parentEl) {
      const index = Array.from(parentEl.children).indexOf(current) + 1
      path.unshift(`*:nth-child(${index})`)
      current = parentEl
    } else {
      break
    }
  }

  return 'body > ' + path.join(' > ')
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
  const response = await runtime.sendMessage({
    type: 'GET_ALL_CAPTURED_DATA'
  }) as any

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
  storage.local.set({
    [`bugReport_${Date.now()}`]: bugReport
  })
  
  alert('Bug report submitted successfully!')
  closeBugReportForm()
}

// Message listener for communication with popup and background
runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Use original console to avoid capturing our own debug messages
  originalConsole.log('Content script received message:', message)

  switch (message.type) {
    case 'CAPTURE_SCREENSHOT':
      handleScreenshotRequest(sendResponse)
      return true

    case 'CAPTURE_CONSOLE_LOGS':
      handleConsoleLogsRequest(sendResponse, message.options)
      return true

    case 'GET_CONSOLE_LOGS':
      // Get logs without storing to background (for popup display)
      try {
        const logs = getCapturedLogs(message.options)
        sendResponse({
          success: true,
          logsCount: logs.length,
          logs: logs,
          config: getConsoleConfig()
        })
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      break

    case 'UPDATE_CONSOLE_CONFIG':
      // Update console capture configuration
      try {
        updateConsoleConfig(message.config)
        sendResponse({
          success: true,
          config: getConsoleConfig()
        })
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      break

    case 'GET_CONSOLE_CONFIG':
      // Get current console capture configuration
      sendResponse({
        success: true,
        config: getConsoleConfig()
      })
      break

    case 'CLEAR_CONSOLE_LOGS':
      // Clear captured logs without storing
      clearCapturedLogs()
      sendResponse({ success: true })
      break

    case 'START_ELEMENT_PICKER':
      startElementPicker()
      sendResponse({ success: true })
      break

    case 'START_ELEMENT_SCREENSHOT':
      startElementScreenshotPicker()
      sendResponse({ success: true })
      break

    case 'OPEN_ANNOTATION_EDITOR':
      handleOpenAnnotationEditor(sendResponse)
      return true

    case 'OPEN_BUG_REPORT_FORM':
      createBugReportForm()
      sendResponse({ success: true })
      break

    default:
      originalConsole.log('Unknown message type:', message.type)
      sendResponse({ success: false, error: 'Unknown message type' })
  }
})

// Handle screenshot request with options for different capture types
async function handleScreenshotRequest(sendResponse: Function, options?: ScreenshotOptions) {
  try {
    const captureType = options?.type || 'visible'

    if (captureType === 'fullpage') {
      // Full page capture using scroll + stitch
      const result = await captureFullPage({
        format: options?.format || 'png',
        quality: options?.quality || 0.92,
        maxWidth: options?.maxWidth
      })

      lastScreenshot = result

      // Store screenshot
      runtime.sendMessage({
        type: 'STORE_SCREENSHOT',
        data: result.dataUrl
      })

      sendResponse({
        success: true,
        width: result.width,
        height: result.height,
        size: result.size
      })
    } else if (captureType === 'element' && options?.elementSelector) {
      // Element capture
      const result = await captureElement(options.elementSelector, {
        format: options?.format || 'png',
        quality: options?.quality || 0.92,
        maxWidth: options?.maxWidth
      })

      lastScreenshot = result

      // Store screenshot
      runtime.sendMessage({
        type: 'STORE_SCREENSHOT',
        data: result.dataUrl
      })

      sendResponse({
        success: true,
        width: result.width,
        height: result.height,
        size: result.size
      })
    } else {
      // Visible area capture (default)
      const response = await runtime.sendMessage({
        type: 'CAPTURE_VISIBLE_TAB'
      }) as any

      if (response?.success) {
        // Create result object
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error('Failed to process screenshot'))
          image.src = response.data
        })

        let dataUrl = response.data
        let width = img.width
        let height = img.height

        // Apply compression if needed
        if (options?.maxWidth && width > options.maxWidth) {
          dataUrl = await compressImage(dataUrl, options.maxWidth, options?.format || 'jpeg', options?.quality || 0.8)
          // Update dimensions
          const compressed = await new Promise<HTMLImageElement>((resolve) => {
            const compImg = new Image()
            compImg.onload = () => resolve(compImg)
            compImg.src = dataUrl
          })
          width = compressed.width
          height = compressed.height
        }

        lastScreenshot = {
          dataUrl,
          width,
          height,
          format: options?.format || 'png',
          size: Math.round((dataUrl.split(',')[1]?.length || 0) * 0.75),
          capturedAt: new Date().toISOString(),
          pageUrl: window.location.href
        }

        // Store screenshot
        runtime.sendMessage({
          type: 'STORE_SCREENSHOT',
          data: dataUrl
        })

        sendResponse({
          success: true,
          width,
          height,
          size: lastScreenshot.size
        })
      } else {
        sendResponse({
          success: false,
          error: response?.error || 'Screenshot capture failed'
        })
      }
    }
  } catch (error) {
    originalConsole.error('Screenshot error:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Handle console logs request
async function handleConsoleLogsRequest(sendResponse: Function, options?: { types?: CapturedLogEntry['type'][]; since?: number; clearAfter?: boolean }) {
  try {
    const logs = getCapturedLogs(options)

    // Store console logs in background
    const response = await runtime.sendMessage({
      type: 'STORE_CONSOLE_LOGS',
      data: logs
    }) as any

    if (response?.success) {
      sendResponse({
        success: true,
        logsCount: logs.length,
        logs: logs // Also return logs directly for immediate use
      })
      // Clear captured logs after storing if requested (default: true for backward compatibility)
      if (options?.clearAfter !== false) {
        clearCapturedLogs()
      }
    } else {
      sendResponse({
        success: false,
        error: response?.error || 'Console log storage failed'
      })
    }
  } catch (error) {
    originalConsole.error('Console logs error:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Element screenshot picker - captures screenshot of clicked element
function startElementScreenshotPicker() {
  if (isElementScreenshotMode) return

  isElementScreenshotMode = true
  originalCursor = document.body.style.cursor
  document.body.style.cursor = 'crosshair'

  elementPickerOverlay = createElementPickerOverlay()

  document.addEventListener('mousemove', handleElementHover)
  document.addEventListener('click', handleElementScreenshotClick)
  document.addEventListener('keydown', handleElementScreenshotEscape)

  // Show instruction tooltip
  showScreenshotTooltip()
}

function stopElementScreenshotPicker() {
  if (!isElementScreenshotMode) return

  isElementScreenshotMode = false
  document.body.style.cursor = originalCursor

  if (elementPickerOverlay) {
    elementPickerOverlay.remove()
    elementPickerOverlay = null
  }

  document.removeEventListener('mousemove', handleElementHover)
  document.removeEventListener('click', handleElementScreenshotClick)
  document.removeEventListener('keydown', handleElementScreenshotEscape)

  hideScreenshotTooltip()
}

async function handleElementScreenshotClick(event: MouseEvent) {
  if (!isElementScreenshotMode) return

  event.preventDefault()
  event.stopPropagation()

  const target = event.target as HTMLElement

  // Generate selector for the element
  const selector = generateSelector(target)

  // Stop the picker first to remove overlay before screenshot
  stopElementScreenshotPicker()

  // Small delay to ensure overlay is fully removed before screenshot
  await new Promise(resolve => setTimeout(resolve, 50))

  try {
    // Capture element screenshot
    const result = await captureElement(selector)
    lastScreenshot = result

    // Store screenshot
    runtime.sendMessage({
      type: 'STORE_SCREENSHOT',
      data: result.dataUrl
    })

    // Notify that element was captured
    runtime.sendMessage({
      type: 'STATUS_UPDATE',
      message: `Element captured (${result.width}x${result.height})`,
      isError: false
    })
  } catch (error) {
    originalConsole.error('Element screenshot error:', error)
    runtime.sendMessage({
      type: 'STATUS_UPDATE',
      message: `Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true
    })
  }
}

function handleElementScreenshotEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    stopElementScreenshotPicker()
  }
}

function showScreenshotTooltip() {
  const tooltip = document.createElement('div')
  tooltip.id = 'jat-screenshot-tooltip'
  tooltip.innerHTML = 'Click on any element to capture it • Press <strong>ESC</strong> to cancel'
  tooltip.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #059669;
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

function hideScreenshotTooltip() {
  const tooltip = document.getElementById('jat-screenshot-tooltip')
  if (tooltip) {
    tooltip.remove()
  }
}

// Handle opening annotation editor for last screenshot
async function handleOpenAnnotationEditor(sendResponse: Function) {
  try {
    if (!lastScreenshot) {
      // Try to get the last screenshot from storage
      const response = await runtime.sendMessage({
        type: 'GET_ALL_CAPTURED_DATA'
      }) as any

      if (response?.success && response.data?.screenshots?.length > 0) {
        const latestScreenshot = response.data.screenshots[response.data.screenshots.length - 1]
        try {
          const annotated = await annotationEditor.open(latestScreenshot)

          // Store the annotated screenshot
          runtime.sendMessage({
            type: 'STORE_SCREENSHOT',
            data: annotated
          })

          sendResponse({ success: true })
        } catch (error) {
          if ((error as Error).message === 'Annotation cancelled') {
            sendResponse({ success: true, cancelled: true })
          } else {
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : 'Annotation failed'
            })
          }
        }
      } else {
        sendResponse({
          success: false,
          error: 'No screenshot available. Capture a screenshot first.'
        })
      }
    } else {
      try {
        const annotated = await annotationEditor.open(lastScreenshot.dataUrl)

        // Update last screenshot with annotated version
        lastScreenshot.dataUrl = annotated

        // Store the annotated screenshot
        runtime.sendMessage({
          type: 'STORE_SCREENSHOT',
          data: annotated
        })

        sendResponse({ success: true })
      } catch (error) {
        if ((error as Error).message === 'Annotation cancelled') {
          sendResponse({ success: true, cancelled: true })
        } else {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Annotation failed'
          })
        }
      }
    }
  } catch (error) {
    originalConsole.error('Annotation editor error:', error)
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Initialize content script
console.log('JAT Content Script initialized')