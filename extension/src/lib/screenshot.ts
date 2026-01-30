// Screenshot capture and annotation module for JAT Browser Extension
import { tabs, runtime } from './browser-compat'

export interface ScreenshotOptions {
  type: 'visible' | 'fullpage' | 'element'
  quality?: number // 0-1 for JPEG quality
  format?: 'png' | 'jpeg'
  maxWidth?: number // Max width for compression
  elementSelector?: string // For element capture
}

export interface AnnotationTool {
  type: 'draw' | 'arrow' | 'text' | 'blur' | 'rectangle' | 'highlight'
  color?: string
  lineWidth?: number
  fontSize?: number
}

export interface Point {
  x: number
  y: number
}

export interface Annotation {
  tool: AnnotationTool
  points: Point[]
  text?: string
  bounds?: DOMRect
}

export interface ScreenshotResult {
  dataUrl: string
  width: number
  height: number
  format: string
  size: number // bytes
  capturedAt: string
  pageUrl: string
  annotations?: Annotation[]
}

/**
 * Capture visible area screenshot using chrome.tabs.captureVisibleTab
 */
export async function captureVisibleArea(options: Partial<ScreenshotOptions> = {}): Promise<ScreenshotResult> {
  const format = options.format || 'png'
  const quality = options.quality || 0.92

  const dataUrl = await tabs.captureVisibleTab({
    format,
    quality: format === 'jpeg' ? Math.round(quality * 100) : undefined,
  })

  if (!dataUrl) {
    throw new Error('Failed to capture screenshot')
  }

  // Get image dimensions
  const img = await loadImage(dataUrl)

  // Apply compression if needed
  let finalDataUrl = dataUrl
  if (options.maxWidth && img.width > options.maxWidth) {
    finalDataUrl = await compressImage(dataUrl, options.maxWidth, format, quality)
  }

  return {
    dataUrl: finalDataUrl,
    width: img.width,
    height: img.height,
    format,
    size: calculateBase64Size(finalDataUrl),
    capturedAt: new Date().toISOString(),
    pageUrl: '' // Will be filled by caller
  }
}

/**
 * Capture full page screenshot by scrolling and stitching
 * This runs in the content script context
 */
export async function captureFullPage(options: Partial<ScreenshotOptions> = {}): Promise<ScreenshotResult> {
  const format = options.format || 'png'
  const quality = options.quality || 0.92

  // Get page dimensions
  const scrollWidth = Math.max(
    document.body.scrollWidth,
    document.documentElement.scrollWidth
  )
  const scrollHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  )
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // Save original scroll position
  const originalScrollX = window.scrollX
  const originalScrollY = window.scrollY

  // Calculate number of captures needed
  const cols = Math.ceil(scrollWidth / viewportWidth)
  const rows = Math.ceil(scrollHeight / viewportHeight)

  // Create canvas for stitching
  const canvas = document.createElement('canvas')
  canvas.width = scrollWidth
  canvas.height = scrollHeight
  const ctx = canvas.getContext('2d')!

  // Temporarily hide scrollbars
  const originalOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  try {
    // Capture each viewport section
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * viewportWidth
        const y = row * viewportHeight

        // Scroll to position
        window.scrollTo(x, y)

        // Wait for scroll and render
        await sleep(100)

        // Request screenshot from background
        const dataUrl = await requestScreenshotCapture()

        // Draw to canvas
        const img = await loadImage(dataUrl)

        // Calculate actual capture dimensions (may be less at edges)
        const captureWidth = Math.min(viewportWidth, scrollWidth - x)
        const captureHeight = Math.min(viewportHeight, scrollHeight - y)

        ctx.drawImage(
          img,
          0, 0, captureWidth, captureHeight, // Source
          x, y, captureWidth, captureHeight  // Destination
        )
      }
    }

    // Restore scroll position
    window.scrollTo(originalScrollX, originalScrollY)

    // Convert canvas to data URL
    let dataUrl = canvas.toDataURL(
      format === 'jpeg' ? 'image/jpeg' : 'image/png',
      quality
    )

    // Apply compression if needed
    if (options.maxWidth && canvas.width > options.maxWidth) {
      dataUrl = await compressImage(dataUrl, options.maxWidth, format, quality)
    }

    return {
      dataUrl,
      width: scrollWidth,
      height: scrollHeight,
      format,
      size: calculateBase64Size(dataUrl),
      capturedAt: new Date().toISOString(),
      pageUrl: window.location.href
    }
  } finally {
    // Restore overflow
    document.body.style.overflow = originalOverflow
    // Restore scroll position
    window.scrollTo(originalScrollX, originalScrollY)
  }
}

/**
 * Capture a specific element
 */
export async function captureElement(
  selector: string,
  options: Partial<ScreenshotOptions> = {}
): Promise<ScreenshotResult> {
  const element = document.querySelector(selector)
  if (!element) {
    throw new Error(`Element not found: ${selector}`)
  }

  // Get initial rect (used for reference, actual capture uses post-scroll rect)
  element.getBoundingClientRect()
  const format = options.format || 'png'
  const quality = options.quality || 0.92

  // Scroll element into view
  element.scrollIntoView({ block: 'center', inline: 'center' })
  await sleep(100)

  // Capture visible area
  const dataUrl = await requestScreenshotCapture()
  const img = await loadImage(dataUrl)

  // Calculate element position relative to viewport after scroll
  const newRect = element.getBoundingClientRect()

  // Create canvas and crop to element
  const canvas = document.createElement('canvas')
  const padding = 4 // Small padding around element
  canvas.width = Math.min(newRect.width + padding * 2, img.width)
  canvas.height = Math.min(newRect.height + padding * 2, img.height)

  const ctx = canvas.getContext('2d')!

  // Calculate source coordinates (account for device pixel ratio)
  const dpr = window.devicePixelRatio || 1
  const sourceX = Math.max(0, (newRect.left - padding) * dpr)
  const sourceY = Math.max(0, (newRect.top - padding) * dpr)
  const sourceWidth = canvas.width * dpr
  const sourceHeight = canvas.height * dpr

  ctx.drawImage(
    img,
    sourceX, sourceY, sourceWidth, sourceHeight,
    0, 0, canvas.width, canvas.height
  )

  let resultDataUrl = canvas.toDataURL(
    format === 'jpeg' ? 'image/jpeg' : 'image/png',
    quality
  )

  // Apply compression if needed
  if (options.maxWidth && canvas.width > options.maxWidth) {
    resultDataUrl = await compressImage(resultDataUrl, options.maxWidth, format, quality)
  }

  return {
    dataUrl: resultDataUrl,
    width: canvas.width,
    height: canvas.height,
    format,
    size: calculateBase64Size(resultDataUrl),
    capturedAt: new Date().toISOString(),
    pageUrl: window.location.href
  }
}

/**
 * Compress an image to a maximum width while maintaining aspect ratio
 */
export async function compressImage(
  dataUrl: string,
  maxWidth: number,
  format: 'png' | 'jpeg' = 'jpeg',
  quality: number = 0.8
): Promise<string> {
  const img = await loadImage(dataUrl)

  // Calculate new dimensions
  const ratio = maxWidth / img.width
  const newWidth = maxWidth
  const newHeight = Math.round(img.height * ratio)

  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.width = newWidth
  canvas.height = newHeight

  const ctx = canvas.getContext('2d')!

  // Use better quality scaling
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  ctx.drawImage(img, 0, 0, newWidth, newHeight)

  return canvas.toDataURL(
    format === 'jpeg' ? 'image/jpeg' : 'image/png',
    quality
  )
}

/**
 * Request screenshot capture from background script
 */
async function requestScreenshotCapture(): Promise<string> {
  const response = await runtime.sendMessage({
    type: 'CAPTURE_VISIBLE_TAB'
  }) as any

  if (response?.success) {
    return response.data
  }
  throw new Error(response?.error || 'Screenshot capture failed')
}

/**
 * Load an image from data URL
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

/**
 * Calculate base64 data URL size in bytes
 */
function calculateBase64Size(dataUrl: string): number {
  // Remove data URL prefix
  const base64 = dataUrl.split(',')[1] || dataUrl
  // Base64 encodes 3 bytes into 4 characters
  return Math.round((base64.length * 3) / 4)
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// ANNOTATION EDITOR
// ============================================================================

export class AnnotationEditor {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private overlay: HTMLDivElement
  private baseImage: HTMLImageElement | null = null
  private annotations: Annotation[] = []
  private currentTool: AnnotationTool = { type: 'draw', color: '#ff0000', lineWidth: 3 }
  private isDrawing = false
  private currentPath: Point[] = []
  private startPoint: Point | null = null

  constructor() {
    // Create overlay container
    this.overlay = document.createElement('div')
    this.overlay.id = 'jat-annotation-overlay'
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 10000000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `

    // Create canvas
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = `
      max-width: 90%;
      max-height: 80%;
      cursor: crosshair;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `
    this.ctx = this.canvas.getContext('2d')!

    // Create toolbar
    const toolbar = this.createToolbar()

    this.overlay.appendChild(toolbar)
    this.overlay.appendChild(this.canvas)

    // Bind event handlers
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this))
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this))
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this))
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this))
  }

  private createToolbar(): HTMLDivElement {
    const toolbar = document.createElement('div')
    toolbar.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      padding: 12px 16px;
      background: #1f2937;
      border-radius: 8px;
      align-items: center;
    `

    const tools: { type: AnnotationTool['type']; icon: string; label: string }[] = [
      { type: 'draw', icon: '✏️', label: 'Draw' },
      { type: 'arrow', icon: '➡️', label: 'Arrow' },
      { type: 'rectangle', icon: '⬜', label: 'Rectangle' },
      { type: 'text', icon: '📝', label: 'Text' },
      { type: 'blur', icon: '🔲', label: 'Blur' },
      { type: 'highlight', icon: '🟡', label: 'Highlight' }
    ]

    tools.forEach(tool => {
      const btn = document.createElement('button')
      btn.textContent = `${tool.icon} ${tool.label}`
      btn.style.cssText = `
        padding: 8px 12px;
        border: none;
        border-radius: 4px;
        background: ${this.currentTool.type === tool.type ? '#3b82f6' : '#374151'};
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      `
      btn.addEventListener('click', () => {
        this.setTool({ ...this.currentTool, type: tool.type })
        toolbar.querySelectorAll('button').forEach(b => {
          (b as HTMLButtonElement).style.background = '#374151'
        })
        btn.style.background = '#3b82f6'
      })
      toolbar.appendChild(btn)
    })

    // Color picker
    const colorPicker = document.createElement('input')
    colorPicker.type = 'color'
    colorPicker.value = this.currentTool.color || '#ff0000'
    colorPicker.style.cssText = `
      width: 40px;
      height: 32px;
      border: none;
      cursor: pointer;
      margin-left: 16px;
    `
    colorPicker.addEventListener('change', (e) => {
      this.setTool({ ...this.currentTool, color: (e.target as HTMLInputElement).value })
    })
    toolbar.appendChild(colorPicker)

    // Action buttons
    const undoBtn = this.createActionButton('↩️ Undo', () => this.undo())
    const saveBtn = this.createActionButton('💾 Save', () => this.save(), true)
    const cancelBtn = this.createActionButton('❌ Cancel', () => this.close())

    const spacer = document.createElement('div')
    spacer.style.flex = '1'
    toolbar.appendChild(spacer)
    toolbar.appendChild(undoBtn)
    toolbar.appendChild(saveBtn)
    toolbar.appendChild(cancelBtn)

    return toolbar
  }

  private createActionButton(text: string, onClick: () => void, primary = false): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.textContent = text
    btn.style.cssText = `
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      background: ${primary ? '#10b981' : '#6b7280'};
      color: white;
      cursor: pointer;
      font-size: 14px;
      margin-left: 8px;
    `
    btn.addEventListener('click', onClick)
    return btn
  }

  setTool(tool: AnnotationTool) {
    this.currentTool = tool

    // Update cursor based on tool
    switch (tool.type) {
      case 'text':
        this.canvas.style.cursor = 'text'
        break
      case 'blur':
        this.canvas.style.cursor = 'cell'
        break
      default:
        this.canvas.style.cursor = 'crosshair'
    }
  }

  async open(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.baseImage = new Image()
      this.baseImage.onload = () => {
        this.canvas.width = this.baseImage!.width
        this.canvas.height = this.baseImage!.height
        this.redraw()
        document.body.appendChild(this.overlay);

        // Store resolve/reject for later using type assertion
        (this as unknown as { _resolve: typeof resolve })._resolve = resolve;
        (this as unknown as { _reject: typeof reject })._reject = reject
      }
      this.baseImage.onerror = () => reject(new Error('Failed to load image'))
      this.baseImage.src = dataUrl
    })
  }

  close() {
    this.overlay.remove()
    this.annotations = []
    this.baseImage = null
    if ((this as any)._reject) {
      (this as any)._reject(new Error('Annotation cancelled'))
    }
  }

  save() {
    const dataUrl = this.canvas.toDataURL('image/png')
    this.overlay.remove()
    if ((this as any)._resolve) {
      (this as any)._resolve(dataUrl)
    }
  }

  undo() {
    this.annotations.pop()
    this.redraw()
  }

  private redraw() {
    if (!this.baseImage) return

    // Clear and draw base image
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.drawImage(this.baseImage, 0, 0)

    // Draw all annotations
    this.annotations.forEach(annotation => this.drawAnnotation(annotation))
  }

  private drawAnnotation(annotation: Annotation) {
    const { tool, points, text } = annotation

    this.ctx.strokeStyle = tool.color || '#ff0000'
    this.ctx.fillStyle = tool.color || '#ff0000'
    this.ctx.lineWidth = tool.lineWidth || 3
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'

    switch (tool.type) {
      case 'draw':
        if (points.length < 2) return
        this.ctx.beginPath()
        this.ctx.moveTo(points[0].x, points[0].y)
        points.slice(1).forEach(p => this.ctx.lineTo(p.x, p.y))
        this.ctx.stroke()
        break

      case 'arrow':
        if (points.length < 2) return
        const start = points[0]
        const end = points[points.length - 1]
        this.drawArrow(start, end)
        break

      case 'rectangle':
        if (points.length < 2) return
        const [p1, p2] = [points[0], points[points.length - 1]]
        this.ctx.strokeRect(
          Math.min(p1.x, p2.x),
          Math.min(p1.y, p2.y),
          Math.abs(p2.x - p1.x),
          Math.abs(p2.y - p1.y)
        )
        break

      case 'text':
        if (!text || points.length < 1) return
        this.ctx.font = `${tool.fontSize || 16}px sans-serif`
        this.ctx.fillText(text, points[0].x, points[0].y)
        break

      case 'blur':
        if (points.length < 2) return
        this.applyBlur(points[0], points[points.length - 1])
        break

      case 'highlight':
        if (points.length < 2) return
        const [h1, h2] = [points[0], points[points.length - 1]]
        this.ctx.globalAlpha = 0.3
        this.ctx.fillRect(
          Math.min(h1.x, h2.x),
          Math.min(h1.y, h2.y),
          Math.abs(h2.x - h1.x),
          Math.abs(h2.y - h1.y)
        )
        this.ctx.globalAlpha = 1
        break
    }
  }

  private drawArrow(start: Point, end: Point) {
    const headLength = 15
    const angle = Math.atan2(end.y - start.y, end.x - start.x)

    // Draw line
    this.ctx.beginPath()
    this.ctx.moveTo(start.x, start.y)
    this.ctx.lineTo(end.x, end.y)
    this.ctx.stroke()

    // Draw arrowhead
    this.ctx.beginPath()
    this.ctx.moveTo(end.x, end.y)
    this.ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    )
    this.ctx.moveTo(end.x, end.y)
    this.ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    )
    this.ctx.stroke()
  }

  private applyBlur(start: Point, end: Point) {
    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)

    if (width < 1 || height < 1) return

    // Get image data for the region
    const imageData = this.ctx.getImageData(x, y, width, height)
    const data = imageData.data

    // Apply pixelation blur (faster than gaussian)
    const pixelSize = 8
    for (let py = 0; py < height; py += pixelSize) {
      for (let px = 0; px < width; px += pixelSize) {
        // Get average color for this block
        let r = 0, g = 0, b = 0, count = 0

        for (let dy = 0; dy < pixelSize && py + dy < height; dy++) {
          for (let dx = 0; dx < pixelSize && px + dx < width; dx++) {
            const i = ((py + dy) * width + (px + dx)) * 4
            r += data[i]
            g += data[i + 1]
            b += data[i + 2]
            count++
          }
        }

        r = Math.round(r / count)
        g = Math.round(g / count)
        b = Math.round(b / count)

        // Set all pixels in block to average
        for (let dy = 0; dy < pixelSize && py + dy < height; dy++) {
          for (let dx = 0; dx < pixelSize && px + dx < width; dx++) {
            const i = ((py + dy) * width + (px + dx)) * 4
            data[i] = r
            data[i + 1] = g
            data[i + 2] = b
          }
        }
      }
    }

    this.ctx.putImageData(imageData, x, y)
  }

  private getCanvasPoint(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect()
    const scaleX = this.canvas.width / rect.width
    const scaleY = this.canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  private handleMouseDown(e: MouseEvent) {
    this.isDrawing = true
    const point = this.getCanvasPoint(e)
    this.startPoint = point
    this.currentPath = [point]

    // For text tool, prompt for text
    if (this.currentTool.type === 'text') {
      const text = prompt('Enter text:')
      if (text) {
        this.annotations.push({
          tool: { ...this.currentTool },
          points: [point],
          text
        })
        this.redraw()
      }
      this.isDrawing = false
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isDrawing) return

    const point = this.getCanvasPoint(e)
    this.currentPath.push(point)

    // Redraw everything plus current drawing
    this.redraw()

    // Draw current annotation in progress
    if (this.currentTool.type === 'draw') {
      this.ctx.strokeStyle = this.currentTool.color || '#ff0000'
      this.ctx.lineWidth = this.currentTool.lineWidth || 3
      this.ctx.lineCap = 'round'
      this.ctx.beginPath()
      this.ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y)
      this.currentPath.slice(1).forEach(p => this.ctx.lineTo(p.x, p.y))
      this.ctx.stroke()
    } else if (this.startPoint) {
      // Preview shapes
      this.drawAnnotation({
        tool: this.currentTool,
        points: [this.startPoint, point]
      })
    }
  }

  private handleMouseUp(e: MouseEvent) {
    if (!this.isDrawing) return
    this.isDrawing = false

    if (this.currentPath.length < 2) {
      this.currentPath = []
      return
    }

    // Add completed annotation
    this.annotations.push({
      tool: { ...this.currentTool },
      points: [...this.currentPath]
    })

    // For blur, we need to apply it permanently
    if (this.currentTool.type === 'blur' && this.startPoint) {
      const end = this.getCanvasPoint(e)
      this.applyBlur(this.startPoint, end)
      // Update base image with blur applied
      this.baseImage = new Image()
      this.baseImage.src = this.canvas.toDataURL()
    }

    this.currentPath = []
    this.startPoint = null
    this.redraw()
  }
}

// Export singleton instance
export const annotationEditor = new AnnotationEditor()
