<script lang="ts">
  import FeedbackForm from './components/FeedbackForm.svelte'
  import ScreenshotPreview from './components/ScreenshotPreview.svelte'
  import ElementPreview from './components/ElementPreview.svelte'
  import ConsoleLogPreview from './components/ConsoleLogPreview.svelte'
  import CaptureActions from './components/CaptureActions.svelte'
  import { capturedData, loadCapturedData, clearAllData } from './stores/capturedData.svelte'

  let view: 'main' | 'form' = $state('main')

  // Load captured data when popup opens
  $effect(() => {
    loadCapturedData()
  })

  function openForm() {
    view = 'form'
  }

  function closeForm() {
    view = 'form'
    // Reload data in case captures happened
    loadCapturedData()
    view = 'main'
  }

  async function handleClear() {
    await clearAllData()
  }
</script>

<div class="popup">
  <header class="header">
    <div class="logo">J</div>
    <h1 class="title">JAT Bug Reporter</h1>
    {#if view === 'form'}
      <button class="back-btn" onclick={() => { view = 'main' }}>
        &larr; Back
      </button>
    {/if}
  </header>

  {#if view === 'main'}
    <CaptureActions />

    {#if capturedData.screenshots.length > 0 || capturedData.selectedElements.length > 0 || capturedData.consoleLogs.length > 0}
      <div class="captured-section">
        <div class="section-header">
          <span class="section-title">Captured Data</span>
          <button class="clear-btn" onclick={handleClear}>Clear All</button>
        </div>

        {#if capturedData.screenshots.length > 0}
          <ScreenshotPreview screenshots={capturedData.screenshots} />
        {/if}

        {#if capturedData.selectedElements.length > 0}
          <ElementPreview elements={capturedData.selectedElements} />
        {/if}

        {#if capturedData.consoleLogs.length > 0}
          <ConsoleLogPreview logs={capturedData.consoleLogs} />
        {/if}
      </div>
    {/if}

    <div class="report-section">
      <button class="report-btn" onclick={openForm}>
        Create Bug Report
      </button>
    </div>

    <footer class="footer">
      <button class="settings-link" onclick={() => { chrome.runtime.openOptionsPage?.() }}>
        Settings
      </button>
    </footer>
  {:else}
    <FeedbackForm
      screenshots={capturedData.screenshots}
      consoleLogs={capturedData.consoleLogs}
      selectedElements={capturedData.selectedElements}
      onclose={closeForm}
    />
  {/if}
</div>

<style>
  :global(body) {
    width: 420px;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    background-color: #ffffff;
    color: #1f2937;
  }

  .popup {
    padding: 16px;
    min-height: 200px;
  }

  .header {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e7eb;
  }

  .logo {
    width: 28px;
    height: 28px;
    margin-right: 10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 14px;
    flex-shrink: 0;
  }

  .title {
    font-size: 15px;
    font-weight: 600;
    margin: 0;
    flex: 1;
  }

  .back-btn {
    padding: 4px 10px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: #f9fafb;
    color: #374151;
    font-size: 12px;
    cursor: pointer;
  }
  .back-btn:hover {
    background: #f3f4f6;
  }

  .captured-section {
    margin-bottom: 12px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .section-title {
    font-weight: 600;
    font-size: 13px;
    color: #374151;
  }

  .clear-btn {
    padding: 2px 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: #fff;
    color: #6b7280;
    font-size: 11px;
    cursor: pointer;
  }
  .clear-btn:hover {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #dc2626;
  }

  .report-section {
    margin-bottom: 12px;
  }

  .report-btn {
    width: 100%;
    padding: 10px;
    background: #3b82f6;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .report-btn:hover {
    background: #2563eb;
  }

  .footer {
    text-align: center;
    padding-top: 8px;
    border-top: 1px solid #f3f4f6;
  }

  .settings-link {
    color: #6b7280;
    font-size: 12px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .settings-link:hover {
    color: #374151;
    text-decoration: underline;
  }
</style>
