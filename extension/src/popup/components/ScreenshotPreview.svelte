<script lang="ts">
  interface Props {
    screenshots: string[]
  }

  let { screenshots }: Props = $props()
  let expanded = $state(false)

  // Show the most recent screenshot as thumbnail
  $effect(() => {
    if (screenshots.length === 0) expanded = false
  })
</script>

<div class="preview">
  <button class="preview-header" onclick={() => { expanded = !expanded }}>
    <span class="preview-icon">&#x1f4f7;</span>
    <span class="preview-label">Screenshots ({screenshots.length})</span>
    <span class="chevron" class:open={expanded}>&#x25b6;</span>
  </button>

  {#if expanded}
    <div class="thumbnails">
      {#each screenshots as src, i}
        <div class="thumb-wrapper">
          <img class="thumb" src={src} alt="Screenshot {i + 1}" />
          <span class="thumb-index">{i + 1}</span>
        </div>
      {/each}
    </div>
  {:else if screenshots.length > 0}
    <div class="inline-thumb">
      <img class="thumb-sm" src={screenshots[screenshots.length - 1]} alt="Latest screenshot" />
      <span class="thumb-hint">Latest capture</span>
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
    flex: 1;
    font-weight: 500;
  }

  .chevron {
    font-size: 10px;
    color: #9ca3af;
    transition: transform 0.15s;
  }
  .chevron.open {
    transform: rotate(90deg);
  }

  .thumbnails {
    display: flex;
    gap: 6px;
    padding: 8px;
    overflow-x: auto;
    background: #fff;
  }

  .thumb-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .thumb {
    width: 100px;
    height: 70px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #e5e7eb;
  }

  .thumb-index {
    position: absolute;
    top: 2px;
    left: 2px;
    background: rgba(0,0,0,0.6);
    color: white;
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .inline-thumb {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #fff;
  }

  .thumb-sm {
    width: 48px;
    height: 32px;
    object-fit: cover;
    border-radius: 3px;
    border: 1px solid #e5e7eb;
  }

  .thumb-hint {
    font-size: 11px;
    color: #9ca3af;
  }
</style>
