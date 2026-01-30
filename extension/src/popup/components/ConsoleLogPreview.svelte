<script lang="ts">
  import type { ConsoleLogEntry } from '../stores/capturedData.svelte'

  interface Props {
    logs: ConsoleLogEntry[]
  }

  let { logs }: Props = $props()
  let expanded = $state(false)

  const typeColors: Record<string, { bg: string; text: string }> = {
    error: { bg: '#fef2f2', text: '#dc2626' },
    warn: { bg: '#fffbeb', text: '#d97706' },
    log: { bg: '#f9fafb', text: '#374151' },
    info: { bg: '#eff6ff', text: '#2563eb' },
    debug: { bg: '#f5f3ff', text: '#7c3aed' },
    trace: { bg: '#f0fdf4', text: '#16a34a' },
  }

  function getColor(type: string) {
    return typeColors[type] || typeColors.log
  }

  // Count by type
  function typeCounts(entries: ConsoleLogEntry[]) {
    const counts: Record<string, number> = {}
    for (const e of entries) {
      counts[e.type] = (counts[e.type] || 0) + 1
    }
    return counts
  }

  function formatTime(ts: string): string {
    try {
      const d = new Date(ts)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return ''
    }
  }
</script>

<div class="preview">
  <button class="preview-header" onclick={() => { expanded = !expanded }}>
    <span class="preview-icon">&#x1f41b;</span>
    <span class="preview-label">Console Logs ({logs.length})</span>
    <div class="type-badges">
      {#each Object.entries(typeCounts(logs)) as [type, count]}
        <span class="badge" style="background: {getColor(type).bg}; color: {getColor(type).text}">
          {count} {type}
        </span>
      {/each}
    </div>
    <span class="chevron" class:open={expanded}>&#x25b6;</span>
  </button>

  {#if expanded}
    <div class="logs-list">
      {#each logs as entry}
        <div class="log-entry" style="border-left-color: {getColor(entry.type).text}">
          <div class="log-header">
            <span class="log-type" style="color: {getColor(entry.type).text}">{entry.type}</span>
            <span class="log-time">{formatTime(entry.timestamp)}</span>
          </div>
          <div class="log-message">{entry.message.slice(0, 200)}{entry.message.length > 200 ? '...' : ''}</div>
          {#if entry.fileName}
            <div class="log-source">{entry.fileName}{entry.lineNumber ? `:${entry.lineNumber}` : ''}</div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .preview {
    margin-bottom: 8px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
  }

  .preview-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    background: #f9fafb;
    border: none;
    cursor: pointer;
    font-size: 12px;
    color: #374151;
    text-align: left;
  }
  .preview-header:hover {
    background: #f3f4f6;
  }

  .preview-icon {
    font-size: 13px;
  }

  .preview-label {
    font-weight: 500;
    white-space: nowrap;
  }

  .type-badges {
    display: flex;
    gap: 3px;
    flex: 1;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: 500;
  }

  .chevron {
    font-size: 10px;
    color: #9ca3af;
    transition: transform 0.15s;
    flex-shrink: 0;
  }
  .chevron.open {
    transform: rotate(90deg);
  }

  .logs-list {
    max-height: 250px;
    overflow-y: auto;
    background: #fff;
    padding: 4px;
  }

  .log-entry {
    padding: 4px 8px;
    border-left: 3px solid #d1d5db;
    margin-bottom: 2px;
    font-size: 11px;
    font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1px;
  }

  .log-type {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 9px;
    letter-spacing: 0.5px;
  }

  .log-time {
    color: #9ca3af;
    font-size: 10px;
  }

  .log-message {
    color: #374151;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .log-source {
    color: #9ca3af;
    font-size: 10px;
    margin-top: 1px;
  }
</style>
