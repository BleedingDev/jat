<script lang="ts">
  import { loadCapturedData } from '../stores/capturedData.svelte'

  let status: { message: string; isError: boolean } | null = $state(null)

  async function getCurrentTab(): Promise<chrome.tabs.Tab> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab
  }

  function showStatus(message: string, isError = false) {
    status = { message, isError }
    setTimeout(() => { status = null }, 3000)
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  async function captureVisible() {
    try {
      showStatus('Capturing visible area...')
      const tab = await getCurrentTab()
      if (!tab.id) throw new Error('No active tab')
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'CAPTURE_SCREENSHOT',
        options: { type: 'visible' }
      })
      if (response?.success) {
        const size = response.size ? ` (${formatBytes(response.size)})` : ''
        showStatus(`Visible area captured${size}!`)
        await loadCapturedData()
      } else {
        throw new Error(response?.error || 'Capture failed')
      }
    } catch (err) {
      showStatus(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`, true)
    }
  }

  async function captureFullPage() {
    try {
      showStatus('Capturing full page...')
      const tab = await getCurrentTab()
      if (!tab.id) throw new Error('No active tab')
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'CAPTURE_SCREENSHOT',
        options: { type: 'fullpage' }
      })
      if (response?.success) {
        const dims = response.width && response.height ? ` ${response.width}x${response.height}` : ''
        showStatus(`Full page captured${dims}!`)
        await loadCapturedData()
      } else {
        throw new Error(response?.error || 'Capture failed')
      }
    } catch (err) {
      showStatus(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`, true)
    }
  }

  async function captureElement() {
    try {
      showStatus('Click an element to capture...')
      const tab = await getCurrentTab()
      if (!tab.id) throw new Error('No active tab')
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_SCREENSHOT' })
      if (response?.success) {
        window.close()
      } else {
        throw new Error(response?.error || 'Element picker failed')
      }
    } catch (err) {
      showStatus(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`, true)
    }
  }

  async function annotate() {
    try {
      showStatus('Opening annotation editor...')
      const tab = await getCurrentTab()
      if (!tab.id) throw new Error('No active tab')
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_ANNOTATION_EDITOR' })
      if (response?.success) {
        window.close()
      } else {
        throw new Error(response?.error || 'No screenshot to annotate')
      }
    } catch (err) {
      showStatus(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`, true)
    }
  }

  async function captureConsoleLogs() {
    try {
      showStatus('Capturing console logs...')
      const tab = await getCurrentTab()
      if (!tab.id) throw new Error('No active tab')
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_CONSOLE_LOGS' })
      if (response?.success) {
        showStatus(`Captured ${response.logsCount || 0} console logs!`)
        await loadCapturedData()
      } else {
        throw new Error(response?.error || 'Capture failed')
      }
    } catch (err) {
      showStatus(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`, true)
    }
  }

  async function captureNetworkLogs() {
    try {
      showStatus('Capturing network logs...')
      const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_NETWORK_LOGS' })
      if (response?.success) {
        showStatus(`Captured ${response.requestsCount || 0} network requests!`)
        await loadCapturedData()
      } else {
        throw new Error(response?.error || 'Capture failed')
      }
    } catch (err) {
      showStatus(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`, true)
    }
  }
</script>

<section class="actions">
  <div class="action-group">
    <span class="group-label">Screenshot</span>
    <div class="action-grid">
      <button class="action-btn primary" onclick={captureVisible}>
        <span class="icon">&#x1f4f8;</span> Visible Area
      </button>
      <button class="action-btn primary" onclick={captureFullPage}>
        <span class="icon">&#x1f4dc;</span> Full Page
      </button>
      <button class="action-btn" onclick={captureElement}>
        <span class="icon">&#x1f3af;</span> Element
      </button>
      <button class="action-btn" onclick={annotate}>
        <span class="icon">&#x270f;&#xfe0f;</span> Annotate
      </button>
    </div>
  </div>

  <div class="action-group">
    <span class="group-label">Capture Data</span>
    <div class="action-grid">
      <button class="action-btn" onclick={captureConsoleLogs}>
        <span class="icon">&#x1f41b;</span> Console Logs
      </button>
      <button class="action-btn" onclick={captureNetworkLogs}>
        <span class="icon">&#x1f310;</span> Network Logs
      </button>
    </div>
  </div>

  {#if status}
    <div class="status" class:error={status.isError}>
      {status.message}
    </div>
  {/if}
</section>

<style>
  .actions {
    margin-bottom: 12px;
  }

  .action-group {
    margin-bottom: 10px;
  }

  .group-label {
    display: block;
    font-weight: 600;
    font-size: 13px;
    color: #374151;
    margin-bottom: 6px;
  }

  .action-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .action-btn {
    padding: 9px 6px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #f9fafb;
    color: #374151;
    font-size: 12px;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
  .action-btn:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
  }
  .action-btn.primary {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }
  .action-btn.primary:hover {
    background: #2563eb;
    border-color: #2563eb;
  }

  .icon {
    font-size: 13px;
  }

  .status {
    margin-top: 8px;
    padding: 6px 10px;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 4px;
    font-size: 12px;
    color: #0369a1;
  }
  .status.error {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }
</style>
