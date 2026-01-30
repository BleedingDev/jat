<script lang="ts">
  import type { ElementData } from '../stores/capturedData.svelte'

  interface Props {
    elements: ElementData[]
  }

  let { elements }: Props = $props()
  let expanded = $state(false)
</script>

<div class="preview">
  <button class="preview-header" onclick={() => { expanded = !expanded }}>
    <span class="preview-icon">&#x1f3af;</span>
    <span class="preview-label">Selected Elements ({elements.length})</span>
    <span class="chevron" class:open={expanded}>&#x25b6;</span>
  </button>

  {#if expanded}
    <div class="elements-list">
      {#each elements as el, i}
        <div class="element-item">
          <div class="element-tag">
            <code>&lt;{el.tagName.toLowerCase()}{el.id ? `#${el.id}` : ''}{el.className ? `.${el.className.split(' ')[0]}` : ''}&gt;</code>
          </div>
          {#if el.textContent}
            <div class="element-text">{el.textContent.slice(0, 60)}{el.textContent.length > 60 ? '...' : ''}</div>
          {/if}
          <div class="element-meta">
            <span class="meta-item">{Math.round(el.boundingRect.width)}x{Math.round(el.boundingRect.height)}</span>
            {#if el.selector}
              <code class="meta-selector" title={el.selector}>{el.selector.length > 40 ? el.selector.slice(0, 40) + '...' : el.selector}</code>
            {/if}
          </div>
          {#if el.screenshot}
            <img class="element-thumb" src={el.screenshot} alt="Element {i + 1}" />
          {/if}
        </div>
      {/each}
    </div>
  {:else if elements.length > 0}
    {@const latest = elements[elements.length - 1]}
    <div class="inline-preview">
      <code class="tag-inline">&lt;{latest.tagName.toLowerCase()}&gt;</code>
      {#if latest.textContent}
        <span class="text-inline">{latest.textContent.slice(0, 30)}...</span>
      {/if}
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

  .elements-list {
    padding: 8px;
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .element-item {
    padding: 6px 8px;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    background: #fafafa;
  }

  .element-tag {
    margin-bottom: 2px;
  }
  .element-tag code {
    font-size: 12px;
    color: #7c3aed;
    background: #f5f3ff;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .element-text {
    font-size: 11px;
    color: #6b7280;
    margin-bottom: 4px;
  }

  .element-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 10px;
  }

  .meta-item {
    color: #9ca3af;
  }

  .meta-selector {
    color: #9ca3af;
    font-size: 10px;
    background: #f3f4f6;
    padding: 1px 3px;
    border-radius: 2px;
  }

  .element-thumb {
    margin-top: 4px;
    max-width: 100%;
    max-height: 60px;
    object-fit: contain;
    border-radius: 3px;
    border: 1px solid #e5e7eb;
  }

  .inline-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #fff;
  }

  .tag-inline {
    font-size: 12px;
    color: #7c3aed;
    background: #f5f3ff;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .text-inline {
    font-size: 11px;
    color: #9ca3af;
  }
</style>
