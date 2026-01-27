// Network request types for JAT Browser Extension

/**
 * Sensitive headers that should be filtered from captured requests
 * These headers may contain authentication credentials or session data
 */
export const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-xsrf-token',
  'proxy-authorization',
  'www-authenticate',
  'proxy-authenticate'
] as const

/**
 * Network request entry with timing and header information
 * Designed to be compatible with HAR format for export
 */
export interface NetworkRequestEntry {
  // Request identification
  id: string
  tabId: number

  // Request details
  url: string
  method: string
  type: chrome.webRequest.ResourceType

  // Timing information
  startedDateTime: string  // ISO 8601 format
  time: number             // Total elapsed time in ms
  timings: RequestTimings

  // Request data
  request: {
    httpVersion: string
    headers: HeaderEntry[]
    headersSize: number
    bodySize: number
    queryString: QueryStringEntry[]
  }

  // Response data (populated when response completes)
  response?: {
    status: number
    statusText: string
    httpVersion: string
    headers: HeaderEntry[]
    headersSize: number
    bodySize: number
    content: {
      size: number
      mimeType: string
    }
  }

  // Error information (if request failed)
  error?: string

  // State flags
  completed: boolean
}

/**
 * Request timing breakdown (HAR-compatible)
 */
export interface RequestTimings {
  blocked: number   // Time spent in a queue waiting for a network connection
  dns: number       // DNS resolution time
  connect: number   // Time to create TCP connection
  send: number      // Time to send HTTP request
  wait: number      // Time waiting for response (TTFB)
  receive: number   // Time to receive response
  ssl: number       // Time for SSL/TLS negotiation
}

/**
 * Header entry (HAR-compatible)
 */
export interface HeaderEntry {
  name: string
  value: string
}

/**
 * Query string parameter (HAR-compatible)
 */
export interface QueryStringEntry {
  name: string
  value: string
}

/**
 * HAR export format (simplified)
 * Full spec: http://www.softwareishard.com/blog/har-12-spec/
 */
export interface HARExport {
  log: {
    version: string
    creator: {
      name: string
      version: string
    }
    browser?: {
      name: string
      version: string
    }
    pages: HARPage[]
    entries: HAREntry[]
  }
}

export interface HARPage {
  startedDateTime: string
  id: string
  title: string
  pageTimings: {
    onContentLoad?: number
    onLoad?: number
  }
}

export interface HAREntry {
  startedDateTime: string
  time: number
  request: {
    method: string
    url: string
    httpVersion: string
    headers: HeaderEntry[]
    queryString: QueryStringEntry[]
    headersSize: number
    bodySize: number
  }
  response: {
    status: number
    statusText: string
    httpVersion: string
    headers: HeaderEntry[]
    content: {
      size: number
      mimeType: string
    }
    headersSize: number
    bodySize: number
  }
  cache: object
  timings: RequestTimings
}

/**
 * Network capture configuration
 */
export interface NetworkCaptureConfig {
  maxRequests: number        // Maximum number of requests to store (default: 100)
  filterSensitiveHeaders: boolean  // Whether to redact sensitive headers
  captureTypes: chrome.webRequest.ResourceType[]  // Request types to capture
  urlFilter?: string         // Optional URL pattern to filter
}

/**
 * Default configuration
 */
export const DEFAULT_NETWORK_CONFIG: NetworkCaptureConfig = {
  maxRequests: 100,
  filterSensitiveHeaders: true,
  captureTypes: [
    'xmlhttprequest',
    'script',
    'stylesheet',
    'image',
    'font',
    'media',
    'websocket',
    'other'
  ]
}

/**
 * Filter sensitive headers from a header list
 */
export function filterSensitiveHeaders(headers: HeaderEntry[]): HeaderEntry[] {
  return headers.map(header => {
    const lowerName = header.name.toLowerCase()
    if (SENSITIVE_HEADERS.includes(lowerName as typeof SENSITIVE_HEADERS[number])) {
      return {
        name: header.name,
        value: '[REDACTED]'
      }
    }
    return header
  })
}

/**
 * Parse URL query string into entries
 */
export function parseQueryString(url: string): QueryStringEntry[] {
  try {
    const urlObj = new URL(url)
    const entries: QueryStringEntry[] = []
    urlObj.searchParams.forEach((value, name) => {
      entries.push({ name, value })
    })
    return entries
  } catch {
    return []
  }
}

/**
 * Calculate header size in bytes
 */
export function calculateHeadersSize(headers: HeaderEntry[]): number {
  return headers.reduce((size, header) => {
    // Format: "Name: Value\r\n"
    return size + header.name.length + 2 + header.value.length + 2
  }, 0)
}

/**
 * Convert Chrome headers array to HeaderEntry array
 */
export function convertChromeHeaders(
  headers: chrome.webRequest.HttpHeader[] | undefined
): HeaderEntry[] {
  if (!headers) return []
  return headers.map(h => ({
    name: h.name,
    value: h.value || ''
  }))
}

/**
 * Get MIME type from Content-Type header
 */
export function getMimeType(headers: HeaderEntry[]): string {
  const contentType = headers.find(
    h => h.name.toLowerCase() === 'content-type'
  )
  if (!contentType) return 'application/octet-stream'
  // Strip charset and other parameters
  return contentType.value.split(';')[0].trim()
}

/**
 * Get content length from headers
 */
export function getContentLength(headers: HeaderEntry[]): number {
  const contentLength = headers.find(
    h => h.name.toLowerCase() === 'content-length'
  )
  if (!contentLength) return -1
  return parseInt(contentLength.value, 10) || -1
}

/**
 * Create a default timings object
 */
export function createDefaultTimings(): RequestTimings {
  return {
    blocked: -1,
    dns: -1,
    connect: -1,
    send: -1,
    wait: -1,
    receive: -1,
    ssl: -1
  }
}

/**
 * Convert internal entries to HAR format
 */
export function toHARExport(
  entries: NetworkRequestEntry[],
  pageTitle: string = 'Captured Requests'
): HARExport {
  const now = new Date().toISOString()

  return {
    log: {
      version: '1.2',
      creator: {
        name: 'JAT Browser Extension',
        version: '1.0.0'
      },
      pages: [{
        startedDateTime: entries[0]?.startedDateTime || now,
        id: 'page_1',
        title: pageTitle,
        pageTimings: {
          onContentLoad: -1,
          onLoad: -1
        }
      }],
      entries: entries
        .filter(e => e.completed && e.response)
        .map(entry => ({
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
            status: entry.response!.status,
            statusText: entry.response!.statusText,
            httpVersion: entry.response!.httpVersion,
            headers: entry.response!.headers,
            content: entry.response!.content,
            headersSize: entry.response!.headersSize,
            bodySize: entry.response!.bodySize
          },
          cache: {},
          timings: entry.timings
        }))
    }
  }
}
