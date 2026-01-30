import { r as runtime, s as storage } from "./browser-compat.js";
async function captureFullPage(options = {}) {
  const format = options.format || "png";
  const quality = options.quality || 0.92;
  const scrollWidth = Math.max(
    document.body.scrollWidth,
    document.documentElement.scrollWidth
  );
  const scrollHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const originalScrollX = window.scrollX;
  const originalScrollY = window.scrollY;
  const cols = Math.ceil(scrollWidth / viewportWidth);
  const rows = Math.ceil(scrollHeight / viewportHeight);
  const canvas = document.createElement("canvas");
  canvas.width = scrollWidth;
  canvas.height = scrollHeight;
  const ctx = canvas.getContext("2d");
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  try {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * viewportWidth;
        const y = row * viewportHeight;
        window.scrollTo(x, y);
        await sleep(100);
        const dataUrl2 = await requestScreenshotCapture();
        const img = await loadImage(dataUrl2);
        const captureWidth = Math.min(viewportWidth, scrollWidth - x);
        const captureHeight = Math.min(viewportHeight, scrollHeight - y);
        ctx.drawImage(
          img,
          0,
          0,
          captureWidth,
          captureHeight,
          // Source
          x,
          y,
          captureWidth,
          captureHeight
          // Destination
        );
      }
    }
    window.scrollTo(originalScrollX, originalScrollY);
    let dataUrl = canvas.toDataURL(
      format === "jpeg" ? "image/jpeg" : "image/png",
      quality
    );
    if (options.maxWidth && canvas.width > options.maxWidth) {
      dataUrl = await compressImage(dataUrl, options.maxWidth, format, quality);
    }
    return {
      dataUrl,
      width: scrollWidth,
      height: scrollHeight,
      format,
      size: calculateBase64Size(dataUrl),
      capturedAt: (/* @__PURE__ */ new Date()).toISOString(),
      pageUrl: window.location.href
    };
  } finally {
    document.body.style.overflow = originalOverflow;
    window.scrollTo(originalScrollX, originalScrollY);
  }
}
async function captureElement(selector, options = {}) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  element.getBoundingClientRect();
  const format = options.format || "png";
  const quality = options.quality || 0.92;
  element.scrollIntoView({ block: "center", inline: "center" });
  await sleep(100);
  const dataUrl = await requestScreenshotCapture();
  const img = await loadImage(dataUrl);
  const newRect = element.getBoundingClientRect();
  const canvas = document.createElement("canvas");
  const padding = 4;
  canvas.width = Math.min(newRect.width + padding * 2, img.width);
  canvas.height = Math.min(newRect.height + padding * 2, img.height);
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const sourceX = Math.max(0, (newRect.left - padding) * dpr);
  const sourceY = Math.max(0, (newRect.top - padding) * dpr);
  const sourceWidth = canvas.width * dpr;
  const sourceHeight = canvas.height * dpr;
  ctx.drawImage(
    img,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );
  let resultDataUrl = canvas.toDataURL(
    format === "jpeg" ? "image/jpeg" : "image/png",
    quality
  );
  if (options.maxWidth && canvas.width > options.maxWidth) {
    resultDataUrl = await compressImage(resultDataUrl, options.maxWidth, format, quality);
  }
  return {
    dataUrl: resultDataUrl,
    width: canvas.width,
    height: canvas.height,
    format,
    size: calculateBase64Size(resultDataUrl),
    capturedAt: (/* @__PURE__ */ new Date()).toISOString(),
    pageUrl: window.location.href
  };
}
async function compressImage(dataUrl, maxWidth, format = "jpeg", quality = 0.8) {
  const img = await loadImage(dataUrl);
  const ratio = maxWidth / img.width;
  const newWidth = maxWidth;
  const newHeight = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, newWidth, newHeight);
  return canvas.toDataURL(
    format === "jpeg" ? "image/jpeg" : "image/png",
    quality
  );
}
async function requestScreenshotCapture() {
  const response = await runtime.sendMessage({
    type: "CAPTURE_VISIBLE_TAB"
  });
  if (response?.success) {
    return response.data;
  }
  throw new Error(response?.error || "Screenshot capture failed");
}
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}
function calculateBase64Size(dataUrl) {
  const base64 = dataUrl.split(",")[1] || dataUrl;
  return Math.round(base64.length * 3 / 4);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
class AnnotationEditor {
  constructor() {
    this.baseImage = null;
    this.annotations = [];
    this.currentTool = { type: "draw", color: "#ff0000", lineWidth: 3 };
    this.isDrawing = false;
    this.currentPath = [];
    this.startPoint = null;
    this.overlay = document.createElement("div");
    this.overlay.id = "jat-annotation-overlay";
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
    `;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = `
      max-width: 90%;
      max-height: 80%;
      cursor: crosshair;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;
    this.ctx = this.canvas.getContext("2d");
    const toolbar = this.createToolbar();
    this.overlay.appendChild(toolbar);
    this.overlay.appendChild(this.canvas);
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("mouseleave", this.handleMouseUp.bind(this));
  }
  createToolbar() {
    const toolbar = document.createElement("div");
    toolbar.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      padding: 12px 16px;
      background: #1f2937;
      border-radius: 8px;
      align-items: center;
    `;
    const tools = [
      { type: "draw", icon: "✏️", label: "Draw" },
      { type: "arrow", icon: "➡️", label: "Arrow" },
      { type: "rectangle", icon: "⬜", label: "Rectangle" },
      { type: "text", icon: "📝", label: "Text" },
      { type: "blur", icon: "🔲", label: "Blur" },
      { type: "highlight", icon: "🟡", label: "Highlight" }
    ];
    tools.forEach((tool) => {
      const btn = document.createElement("button");
      btn.textContent = `${tool.icon} ${tool.label}`;
      btn.style.cssText = `
        padding: 8px 12px;
        border: none;
        border-radius: 4px;
        background: ${this.currentTool.type === tool.type ? "#3b82f6" : "#374151"};
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      `;
      btn.addEventListener("click", () => {
        this.setTool({ ...this.currentTool, type: tool.type });
        toolbar.querySelectorAll("button").forEach((b) => {
          b.style.background = "#374151";
        });
        btn.style.background = "#3b82f6";
      });
      toolbar.appendChild(btn);
    });
    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = this.currentTool.color || "#ff0000";
    colorPicker.style.cssText = `
      width: 40px;
      height: 32px;
      border: none;
      cursor: pointer;
      margin-left: 16px;
    `;
    colorPicker.addEventListener("change", (e) => {
      this.setTool({ ...this.currentTool, color: e.target.value });
    });
    toolbar.appendChild(colorPicker);
    const undoBtn = this.createActionButton("↩️ Undo", () => this.undo());
    const saveBtn = this.createActionButton("💾 Save", () => this.save(), true);
    const cancelBtn = this.createActionButton("❌ Cancel", () => this.close());
    const spacer = document.createElement("div");
    spacer.style.flex = "1";
    toolbar.appendChild(spacer);
    toolbar.appendChild(undoBtn);
    toolbar.appendChild(saveBtn);
    toolbar.appendChild(cancelBtn);
    return toolbar;
  }
  createActionButton(text, onClick, primary = false) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.cssText = `
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      background: ${primary ? "#10b981" : "#6b7280"};
      color: white;
      cursor: pointer;
      font-size: 14px;
      margin-left: 8px;
    `;
    btn.addEventListener("click", onClick);
    return btn;
  }
  setTool(tool) {
    this.currentTool = tool;
    switch (tool.type) {
      case "text":
        this.canvas.style.cursor = "text";
        break;
      case "blur":
        this.canvas.style.cursor = "cell";
        break;
      default:
        this.canvas.style.cursor = "crosshair";
    }
  }
  async open(dataUrl) {
    return new Promise((resolve, reject) => {
      this.baseImage = new Image();
      this.baseImage.onload = () => {
        this.canvas.width = this.baseImage.width;
        this.canvas.height = this.baseImage.height;
        this.redraw();
        document.body.appendChild(this.overlay);
        this._resolve = resolve;
        this._reject = reject;
      };
      this.baseImage.onerror = () => reject(new Error("Failed to load image"));
      this.baseImage.src = dataUrl;
    });
  }
  close() {
    this.overlay.remove();
    this.annotations = [];
    this.baseImage = null;
    if (this._reject) {
      this._reject(new Error("Annotation cancelled"));
    }
  }
  save() {
    const dataUrl = this.canvas.toDataURL("image/png");
    this.overlay.remove();
    if (this._resolve) {
      this._resolve(dataUrl);
    }
  }
  undo() {
    this.annotations.pop();
    this.redraw();
  }
  redraw() {
    if (!this.baseImage) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.baseImage, 0, 0);
    this.annotations.forEach((annotation) => this.drawAnnotation(annotation));
  }
  drawAnnotation(annotation) {
    const { tool, points, text } = annotation;
    this.ctx.strokeStyle = tool.color || "#ff0000";
    this.ctx.fillStyle = tool.color || "#ff0000";
    this.ctx.lineWidth = tool.lineWidth || 3;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    switch (tool.type) {
      case "draw":
        if (points.length < 2) return;
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((p) => this.ctx.lineTo(p.x, p.y));
        this.ctx.stroke();
        break;
      case "arrow":
        if (points.length < 2) return;
        const start = points[0];
        const end = points[points.length - 1];
        this.drawArrow(start, end);
        break;
      case "rectangle":
        if (points.length < 2) return;
        const [p1, p2] = [points[0], points[points.length - 1]];
        this.ctx.strokeRect(
          Math.min(p1.x, p2.x),
          Math.min(p1.y, p2.y),
          Math.abs(p2.x - p1.x),
          Math.abs(p2.y - p1.y)
        );
        break;
      case "text":
        if (!text || points.length < 1) return;
        this.ctx.font = `${tool.fontSize || 16}px sans-serif`;
        this.ctx.fillText(text, points[0].x, points[0].y);
        break;
      case "blur":
        if (points.length < 2) return;
        this.applyBlur(points[0], points[points.length - 1]);
        break;
      case "highlight":
        if (points.length < 2) return;
        const [h1, h2] = [points[0], points[points.length - 1]];
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillRect(
          Math.min(h1.x, h2.x),
          Math.min(h1.y, h2.y),
          Math.abs(h2.x - h1.x),
          Math.abs(h2.y - h1.y)
        );
        this.ctx.globalAlpha = 1;
        break;
    }
  }
  drawArrow(start, end) {
    const headLength = 15;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.stroke();
  }
  applyBlur(start, end) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    if (width < 1 || height < 1) return;
    const imageData = this.ctx.getImageData(x, y, width, height);
    const data = imageData.data;
    const pixelSize = 8;
    for (let py = 0; py < height; py += pixelSize) {
      for (let px = 0; px < width; px += pixelSize) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = 0; dy < pixelSize && py + dy < height; dy++) {
          for (let dx = 0; dx < pixelSize && px + dx < width; dx++) {
            const i = ((py + dy) * width + (px + dx)) * 4;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        for (let dy = 0; dy < pixelSize && py + dy < height; dy++) {
          for (let dx = 0; dx < pixelSize && px + dx < width; dx++) {
            const i = ((py + dy) * width + (px + dx)) * 4;
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
          }
        }
      }
    }
    this.ctx.putImageData(imageData, x, y);
  }
  getCanvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }
  handleMouseDown(e) {
    this.isDrawing = true;
    const point = this.getCanvasPoint(e);
    this.startPoint = point;
    this.currentPath = [point];
    if (this.currentTool.type === "text") {
      const text = prompt("Enter text:");
      if (text) {
        this.annotations.push({
          tool: { ...this.currentTool },
          points: [point],
          text
        });
        this.redraw();
      }
      this.isDrawing = false;
    }
  }
  handleMouseMove(e) {
    if (!this.isDrawing) return;
    const point = this.getCanvasPoint(e);
    this.currentPath.push(point);
    this.redraw();
    if (this.currentTool.type === "draw") {
      this.ctx.strokeStyle = this.currentTool.color || "#ff0000";
      this.ctx.lineWidth = this.currentTool.lineWidth || 3;
      this.ctx.lineCap = "round";
      this.ctx.beginPath();
      this.ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
      this.currentPath.slice(1).forEach((p) => this.ctx.lineTo(p.x, p.y));
      this.ctx.stroke();
    } else if (this.startPoint) {
      this.drawAnnotation({
        tool: this.currentTool,
        points: [this.startPoint, point]
      });
    }
  }
  handleMouseUp(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (this.currentPath.length < 2) {
      this.currentPath = [];
      return;
    }
    this.annotations.push({
      tool: { ...this.currentTool },
      points: [...this.currentPath]
    });
    if (this.currentTool.type === "blur" && this.startPoint) {
      const end = this.getCanvasPoint(e);
      this.applyBlur(this.startPoint, end);
      this.baseImage = new Image();
      this.baseImage.src = this.canvas.toDataURL();
    }
    this.currentPath = [];
    this.startPoint = null;
    this.redraw();
  }
}
const annotationEditor = new AnnotationEditor();
console.log("JAT Browser Extension Content Script loaded on:", window.location.href);
let isElementPickerActive = false;
let isElementScreenshotMode = false;
let originalCursor = "";
let elementPickerOverlay = null;
let lastScreenshot = null;
const consoleConfig = {
  maxEntries: 50,
  // Default buffer size
  captureStackTraces: true,
  // Capture stack traces for errors/warnings
  filterSensitiveData: true
  // Filter sensitive data like tokens, passwords
};
const SENSITIVE_PATTERNS = [
  // API keys and tokens
  /\b(api[_-]?key|apikey|api[_-]?token|access[_-]?token|auth[_-]?token|bearer)\s*[:=]\s*["']?[\w\-\.]+["']?/gi,
  /\bBearer\s+[\w\-\.]+/gi,
  /\b(sk|pk|rk)[_-][a-zA-Z0-9]{20,}/gi,
  // Stripe-style keys
  /\bghp_[a-zA-Z0-9]{36,}/gi,
  // GitHub tokens
  /\bsk-[a-zA-Z0-9]{20,}/gi,
  // OpenAI-style keys
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
  /\b(aws[_-]?secret[_-]?access[_-]?key|aws[_-]?access[_-]?key[_-]?id)\s*[:=]\s*["']?[\w\/\+]+["']?/gi
];
const REDACTED = "[REDACTED]";
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
  trace: console.trace
};
const capturedLogs = [];
function filterSensitiveData(input) {
  if (!consoleConfig.filterSensitiveData) return input;
  let filtered = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    filtered = filtered.replace(pattern, REDACTED);
  }
  return filtered;
}
function safeStringify(arg) {
  if (arg === null) return "null";
  if (arg === void 0) return "undefined";
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
  if (typeof arg === "symbol") return arg.toString();
  if (typeof arg === "function") return `[Function: ${arg.name || "anonymous"}]`;
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? "\n" + arg.stack : ""}`;
  }
  if (typeof arg === "object") {
    try {
      const seen = /* @__PURE__ */ new WeakSet();
      return JSON.stringify(arg, (_key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return "[Circular]";
          seen.add(value);
        }
        if (typeof value === "function") return `[Function: ${value.name || "anonymous"}]`;
        if (value instanceof Error) return `${value.name}: ${value.message}`;
        return value;
      }, 2);
    } catch {
      return "[Object - stringify failed]";
    }
  }
  return String(arg);
}
function captureStackInfo() {
  if (!consoleConfig.captureStackTraces) return {};
  const stack = new Error().stack;
  if (!stack) return {};
  const lines = stack.split("\n");
  const relevantLines = lines.slice(4);
  const stackTrace = relevantLines.join("\n");
  const firstLine = relevantLines[0] || "";
  const locationMatch = firstLine.match(/(?:at\s+(?:\S+\s+)?\()?([^()]+):(\d+):(\d+)\)?/);
  if (locationMatch) {
    return {
      stackTrace,
      fileName: locationMatch[1],
      lineNumber: parseInt(locationMatch[2], 10),
      columnNumber: parseInt(locationMatch[3], 10)
    };
  }
  return { stackTrace };
}
function createLogEntry(type, args, includeStack) {
  const now = /* @__PURE__ */ new Date();
  const message = filterSensitiveData(
    args.map(safeStringify).join(" ")
  );
  const entry = {
    type,
    message,
    timestamp: now.toISOString(),
    timestampMs: now.getTime(),
    url: window.location.href
  };
  if (includeStack || type === "error" || type === "warn" || type === "trace") {
    const stackInfo = captureStackInfo();
    Object.assign(entry, stackInfo);
  }
  return entry;
}
function addLogEntry(entry) {
  capturedLogs.push(entry);
  while (capturedLogs.length > consoleConfig.maxEntries) {
    capturedLogs.shift();
  }
}
function setupConsoleCapture() {
  console.log = (...args) => {
    originalConsole.log(...args);
    addLogEntry(createLogEntry("log", args, false));
  };
  console.error = (...args) => {
    originalConsole.error(...args);
    addLogEntry(createLogEntry("error", args, true));
  };
  console.warn = (...args) => {
    originalConsole.warn(...args);
    addLogEntry(createLogEntry("warn", args, true));
  };
  console.info = (...args) => {
    originalConsole.info(...args);
    addLogEntry(createLogEntry("info", args, false));
  };
  console.debug = (...args) => {
    originalConsole.debug(...args);
    addLogEntry(createLogEntry("debug", args, false));
  };
  console.trace = (...args) => {
    originalConsole.trace(...args);
    addLogEntry(createLogEntry("trace", args, true));
  };
}
function updateConsoleConfig(config) {
  if (config.maxEntries !== void 0) {
    consoleConfig.maxEntries = Math.max(1, Math.min(500, config.maxEntries));
    while (capturedLogs.length > consoleConfig.maxEntries) {
      capturedLogs.shift();
    }
  }
  if (config.captureStackTraces !== void 0) {
    consoleConfig.captureStackTraces = config.captureStackTraces;
  }
  if (config.filterSensitiveData !== void 0) {
    consoleConfig.filterSensitiveData = config.filterSensitiveData;
  }
}
function getConsoleConfig() {
  return { ...consoleConfig };
}
function getCapturedLogs(filter) {
  let logs = [...capturedLogs];
  if (filter?.types && filter.types.length > 0) {
    logs = logs.filter((log) => filter.types.includes(log.type));
  }
  if (filter?.since) {
    logs = logs.filter((log) => log.timestampMs >= filter.since);
  }
  return logs;
}
function clearCapturedLogs() {
  capturedLogs.length = 0;
}
setupConsoleCapture();
function createElementPickerOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "jat-element-picker-overlay";
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
  `;
  document.body.appendChild(overlay);
  return overlay;
}
function startElementPicker() {
  if (isElementPickerActive) return;
  isElementPickerActive = true;
  originalCursor = document.body.style.cursor;
  document.body.style.cursor = "crosshair";
  elementPickerOverlay = createElementPickerOverlay();
  document.addEventListener("mousemove", handleElementHover);
  document.addEventListener("click", handleElementClick);
  document.addEventListener("keydown", handleElementPickerEscape);
  showInstructionTooltip();
}
function stopElementPicker() {
  if (!isElementPickerActive) return;
  isElementPickerActive = false;
  document.body.style.cursor = originalCursor;
  if (elementPickerOverlay) {
    elementPickerOverlay.remove();
    elementPickerOverlay = null;
  }
  document.removeEventListener("mousemove", handleElementHover);
  document.removeEventListener("click", handleElementClick);
  document.removeEventListener("keydown", handleElementPickerEscape);
  hideInstructionTooltip();
}
function handleElementHover(event) {
  if (!isElementPickerActive || !elementPickerOverlay) return;
  const target = event.target;
  if (target === elementPickerOverlay) return;
  const rect = target.getBoundingClientRect();
  elementPickerOverlay.style.top = `${rect.top}px`;
  elementPickerOverlay.style.left = `${rect.left}px`;
  elementPickerOverlay.style.width = `${rect.width}px`;
  elementPickerOverlay.style.height = `${rect.height}px`;
}
async function handleElementClick(event) {
  if (!isElementPickerActive) return;
  event.preventDefault();
  event.stopPropagation();
  const target = event.target;
  const rect = target.getBoundingClientRect();
  stopElementPicker();
  await new Promise((resolve) => setTimeout(resolve, 50));
  let elementScreenshot = null;
  try {
    elementScreenshot = await captureElementScreenshot(rect);
  } catch (error) {
    originalConsole.error("Element screenshot capture failed:", error);
  }
  const elementData = {
    tagName: target.tagName,
    className: target.className,
    id: target.id,
    textContent: target.textContent?.substring(0, 100) || "",
    attributes: Array.from(target.attributes).reduce((acc, attr) => {
      acc[attr.name] = attr.value;
      return acc;
    }, {}),
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
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    url: window.location.href
  };
  runtime.sendMessage({
    type: "STORE_ELEMENT_DATA",
    data: elementData
  });
  runtime.sendMessage({
    type: "ELEMENT_SELECTED",
    tagName: target.tagName,
    data: elementData
  });
}
async function captureElementScreenshot(rect) {
  try {
    const response = await runtime.sendMessage({
      type: "CAPTURE_VISIBLE_TAB"
    });
    if (!response?.success || !response.data) {
      return null;
    }
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image load failed"));
      image.src = response.data;
    });
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    const padding = 10;
    const x = Math.max(0, (rect.left - padding) * dpr);
    const y = Math.max(0, (rect.top - padding) * dpr);
    const width = Math.min((rect.width + padding * 2) * dpr, img.width - x);
    const height = Math.min((rect.height + padding * 2) * dpr, img.height - y);
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(
      img,
      x,
      y,
      width,
      height,
      // Source rectangle
      0,
      0,
      width,
      height
      // Destination rectangle
    );
    return canvas.toDataURL("image/png");
  } catch (error) {
    originalConsole.error("Error cropping screenshot:", error);
    return null;
  }
}
function handleElementPickerEscape(event) {
  if (event.key === "Escape") {
    stopElementPicker();
  }
}
function getXPath(element) {
  if (element.id !== "") {
    return 'id("' + element.id + '")';
  }
  if (element === document.body) {
    return element.tagName;
  }
  let ix = 0;
  const siblings = element.parentNode?.childNodes || [];
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (sibling === element) {
      return getXPath(element.parentElement) + "/" + element.tagName + "[" + (ix + 1) + "]";
    }
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
      ix++;
    }
  }
  return "";
}
function generateSelector(element) {
  if (element.id) {
    return "#" + CSS.escape(element.id);
  }
  const parts = [];
  let current = element;
  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = "#" + CSS.escape(current.id);
      parts.unshift(selector);
      break;
    }
    if (current.className && typeof current.className === "string") {
      const classes = current.className.split(/\s+/).filter((cls) => {
        return cls && !cls.match(/^(ng-|v-|svelte-|css-|_|js-|is-|has-)/) && !cls.match(/^\d/) && cls.length > 1;
      });
      if (classes.length > 0) {
        selector += "." + classes.slice(0, 2).map((c) => CSS.escape(c)).join(".");
      }
    }
    const dataAttrs = ["data-testid", "data-id", "data-name", "name", "role", "aria-label"];
    for (const attr of dataAttrs) {
      const value = current.getAttribute(attr);
      if (value) {
        selector += `[${attr}="${CSS.escape(value)}"]`;
        break;
      }
    }
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((el) => el.tagName === current.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    parts.unshift(selector);
    const testSelector = parts.join(" > ");
    try {
      if (document.querySelectorAll(testSelector).length === 1) {
        break;
      }
    } catch {
    }
    current = current.parentElement;
  }
  const fullSelector = parts.join(" > ");
  try {
    if (document.querySelectorAll(fullSelector).length === 1) {
      return fullSelector;
    }
  } catch {
  }
  return generateFallbackSelector(element);
}
function generateFallbackSelector(element) {
  const path = [];
  let current = element;
  while (current && current !== document.body) {
    const parentEl = current.parentElement;
    if (parentEl) {
      const index = Array.from(parentEl.children).indexOf(current) + 1;
      path.unshift(`*:nth-child(${index})`);
      current = parentEl;
    } else {
      break;
    }
  }
  return "body > " + path.join(" > ");
}
function showInstructionTooltip() {
  const tooltip = document.createElement("div");
  tooltip.id = "jat-instruction-tooltip";
  tooltip.innerHTML = "Click on any element to select it • Press <strong>ESC</strong> to cancel";
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
  `;
  document.body.appendChild(tooltip);
}
function hideInstructionTooltip() {
  const tooltip = document.getElementById("jat-instruction-tooltip");
  if (tooltip) {
    tooltip.remove();
  }
}
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
  `;
  document.body.insertAdjacentHTML("beforeend", formHtml);
  document.getElementById("jat-close-modal")?.addEventListener("click", closeBugReportForm);
  document.getElementById("jat-cancel-report")?.addEventListener("click", closeBugReportForm);
  document.getElementById("jat-bug-report-form")?.addEventListener("submit", handleBugReportSubmit);
  const titleField = document.getElementById("bug-title");
  titleField?.focus();
}
function closeBugReportForm() {
  const modal = document.getElementById("jat-bug-report-modal");
  if (modal) {
    modal.remove();
  }
}
async function handleBugReportSubmit(event) {
  event.preventDefault();
  const title = document.getElementById("bug-title").value;
  const description = document.getElementById("bug-description").value;
  const severity = document.getElementById("bug-severity").value;
  const response = await runtime.sendMessage({
    type: "GET_ALL_CAPTURED_DATA"
  });
  const bugReport = {
    title,
    description,
    severity,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    capturedData: response.success ? response.data : null
  };
  console.log("Bug Report:", bugReport);
  storage.local.set({
    [`bugReport_${Date.now()}`]: bugReport
  });
  alert("Bug report submitted successfully!");
  closeBugReportForm();
}
runtime.onMessage.addListener((message, _sender, sendResponse) => {
  originalConsole.log("Content script received message:", message);
  switch (message.type) {
    case "CAPTURE_SCREENSHOT":
      handleScreenshotRequest(sendResponse);
      return true;
    case "CAPTURE_CONSOLE_LOGS":
      handleConsoleLogsRequest(sendResponse, message.options);
      return true;
    case "GET_CONSOLE_LOGS":
      try {
        const logs = getCapturedLogs(message.options);
        sendResponse({
          success: true,
          logsCount: logs.length,
          logs,
          config: getConsoleConfig()
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
      break;
    case "UPDATE_CONSOLE_CONFIG":
      try {
        updateConsoleConfig(message.config);
        sendResponse({
          success: true,
          config: getConsoleConfig()
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
      break;
    case "GET_CONSOLE_CONFIG":
      sendResponse({
        success: true,
        config: getConsoleConfig()
      });
      break;
    case "CLEAR_CONSOLE_LOGS":
      clearCapturedLogs();
      sendResponse({ success: true });
      break;
    case "START_ELEMENT_PICKER":
      startElementPicker();
      sendResponse({ success: true });
      break;
    case "START_ELEMENT_SCREENSHOT":
      startElementScreenshotPicker();
      sendResponse({ success: true });
      break;
    case "OPEN_ANNOTATION_EDITOR":
      handleOpenAnnotationEditor(sendResponse);
      return true;
    case "OPEN_BUG_REPORT_FORM":
      createBugReportForm();
      sendResponse({ success: true });
      break;
    default:
      originalConsole.log("Unknown message type:", message.type);
      sendResponse({ success: false, error: "Unknown message type" });
  }
});
async function handleScreenshotRequest(sendResponse, options) {
  try {
    const captureType = options?.type || "visible";
    if (captureType === "fullpage") ;
    else if (captureType === "element" && options?.elementSelector) ;
    else {
      const response = await runtime.sendMessage({
        type: "CAPTURE_VISIBLE_TAB"
      });
      if (response?.success) {
        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("Failed to process screenshot"));
          image.src = response.data;
        });
        let dataUrl = response.data;
        let width = img.width;
        let height = img.height;
        if (options?.maxWidth && width > options.maxWidth) ;
        lastScreenshot = {
          dataUrl,
          width,
          height,
          format: options?.format || "png",
          size: Math.round((dataUrl.split(",")[1]?.length || 0) * 0.75),
          capturedAt: (/* @__PURE__ */ new Date()).toISOString(),
          pageUrl: window.location.href
        };
        runtime.sendMessage({
          type: "STORE_SCREENSHOT",
          data: dataUrl
        });
        sendResponse({
          success: true,
          width,
          height,
          size: lastScreenshot.size
        });
      } else {
        sendResponse({
          success: false,
          error: response?.error || "Screenshot capture failed"
        });
      }
    }
  } catch (error) {
    originalConsole.error("Screenshot error:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
async function handleConsoleLogsRequest(sendResponse, options) {
  try {
    const logs = getCapturedLogs(options);
    const response = await runtime.sendMessage({
      type: "STORE_CONSOLE_LOGS",
      data: logs
    });
    if (response?.success) {
      sendResponse({
        success: true,
        logsCount: logs.length,
        logs
        // Also return logs directly for immediate use
      });
      if (options?.clearAfter !== false) {
        clearCapturedLogs();
      }
    } else {
      sendResponse({
        success: false,
        error: response?.error || "Console log storage failed"
      });
    }
  } catch (error) {
    originalConsole.error("Console logs error:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
function startElementScreenshotPicker() {
  if (isElementScreenshotMode) return;
  isElementScreenshotMode = true;
  originalCursor = document.body.style.cursor;
  document.body.style.cursor = "crosshair";
  elementPickerOverlay = createElementPickerOverlay();
  document.addEventListener("mousemove", handleElementHover);
  document.addEventListener("click", handleElementScreenshotClick);
  document.addEventListener("keydown", handleElementScreenshotEscape);
  showScreenshotTooltip();
}
function stopElementScreenshotPicker() {
  if (!isElementScreenshotMode) return;
  isElementScreenshotMode = false;
  document.body.style.cursor = originalCursor;
  if (elementPickerOverlay) {
    elementPickerOverlay.remove();
    elementPickerOverlay = null;
  }
  document.removeEventListener("mousemove", handleElementHover);
  document.removeEventListener("click", handleElementScreenshotClick);
  document.removeEventListener("keydown", handleElementScreenshotEscape);
  hideScreenshotTooltip();
}
async function handleElementScreenshotClick(event) {
  if (!isElementScreenshotMode) return;
  event.preventDefault();
  event.stopPropagation();
  const target = event.target;
  const selector = generateSelector(target);
  stopElementScreenshotPicker();
  await new Promise((resolve) => setTimeout(resolve, 50));
  try {
    const result = await captureElement(selector);
    lastScreenshot = result;
    runtime.sendMessage({
      type: "STORE_SCREENSHOT",
      data: result.dataUrl
    });
    runtime.sendMessage({
      type: "STATUS_UPDATE",
      message: `Element captured (${result.width}x${result.height})`,
      isError: false
    });
  } catch (error) {
    originalConsole.error("Element screenshot error:", error);
    runtime.sendMessage({
      type: "STATUS_UPDATE",
      message: `Screenshot failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      isError: true
    });
  }
}
function handleElementScreenshotEscape(event) {
  if (event.key === "Escape") {
    stopElementScreenshotPicker();
  }
}
function showScreenshotTooltip() {
  const tooltip = document.createElement("div");
  tooltip.id = "jat-screenshot-tooltip";
  tooltip.innerHTML = "Click on any element to capture it • Press <strong>ESC</strong> to cancel";
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
  `;
  document.body.appendChild(tooltip);
}
function hideScreenshotTooltip() {
  const tooltip = document.getElementById("jat-screenshot-tooltip");
  if (tooltip) {
    tooltip.remove();
  }
}
async function handleOpenAnnotationEditor(sendResponse) {
  try {
    if (!lastScreenshot) {
      const response = await runtime.sendMessage({
        type: "GET_ALL_CAPTURED_DATA"
      });
      if (response?.success && response.data?.screenshots?.length > 0) {
        const latestScreenshot = response.data.screenshots[response.data.screenshots.length - 1];
        try {
          const annotated = await annotationEditor.open(latestScreenshot);
          runtime.sendMessage({
            type: "STORE_SCREENSHOT",
            data: annotated
          });
          sendResponse({ success: true });
        } catch (error) {
          if (error.message === "Annotation cancelled") {
            sendResponse({ success: true, cancelled: true });
          } else {
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : "Annotation failed"
            });
          }
        }
      } else {
        sendResponse({
          success: false,
          error: "No screenshot available. Capture a screenshot first."
        });
      }
    } else {
      try {
        const annotated = await annotationEditor.open(lastScreenshot.dataUrl);
        lastScreenshot.dataUrl = annotated;
        runtime.sendMessage({
          type: "STORE_SCREENSHOT",
          data: annotated
        });
        sendResponse({ success: true });
      } catch (error) {
        if (error.message === "Annotation cancelled") {
          sendResponse({ success: true, cancelled: true });
        } else {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : "Annotation failed"
          });
        }
      }
    }
  } catch (error) {
    originalConsole.error("Annotation editor error:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
console.log("JAT Content Script initialized");
