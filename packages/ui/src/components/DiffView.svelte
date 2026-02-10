<script lang="ts">
  import { computeDiff } from '../utils/diff';

  interface Props {
    oldText: string;
    newText: string;
    oldLabel?: string;
    newLabel?: string;
    mode?: 'unified' | 'split';
    showLineNumbers?: boolean;
    class?: string;
  }

  let {
    oldText,
    newText,
    oldLabel = 'Before',
    newLabel = 'After',
    mode = 'unified',
    showLineNumbers = true,
    class: className = '',
  }: Props = $props();

  const diff = $derived(computeDiff(oldText, newText));

  // For split view, we need to pair up lines
  const splitLines = $derived(() => {
    if (mode !== 'split') return [];

    const result: Array<{
      left: { type: string; content: string; lineNumber?: number } | null;
      right: { type: string; content: string; lineNumber?: number } | null;
    }> = [];

    let leftLine = 1;
    let rightLine = 1;
    let i = 0;

    while (i < diff.lines.length) {
      const line = diff.lines[i];

      if (line.type === 'unchanged') {
        result.push({
          left: { type: 'unchanged', content: line.content, lineNumber: leftLine++ },
          right: { type: 'unchanged', content: line.content, lineNumber: rightLine++ },
        });
        i++;
      } else if (line.type === 'removed') {
        // Check if next line is added (could be a modification)
        const nextLine = diff.lines[i + 1];
        if (nextLine && nextLine.type === 'added') {
          result.push({
            left: { type: 'removed', content: line.content, lineNumber: leftLine++ },
            right: { type: 'added', content: nextLine.content, lineNumber: rightLine++ },
          });
          i += 2;
        } else {
          result.push({
            left: { type: 'removed', content: line.content, lineNumber: leftLine++ },
            right: null,
          });
          i++;
        }
      } else if (line.type === 'added') {
        result.push({
          left: null,
          right: { type: 'added', content: line.content, lineNumber: rightLine++ },
        });
        i++;
      } else {
        i++;
      }
    }

    return result;
  });

  function getLineStyle(type: string): string {
    switch (type) {
      case 'added':
        return 'background: var(--success-subtle); color: var(--success-text);';
      case 'removed':
        return 'background: var(--error-subtle); color: var(--error-text);';
      default:
        return '';
    }
  }

  function getPrefix(type: string): string {
    switch (type) {
      case 'added':
        return '+';
      case 'removed':
        return '-';
      default:
        return ' ';
    }
  }
</script>

<div
  class="ui-diff-view {className}"
  style="
    font-family: var(--font-mono);
    font-size: 0.875rem;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    overflow: hidden;
  "
>
  <!-- Stats header -->
  <div style="
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: var(--bg-3);
    border-bottom: 1px solid var(--ui);
  ">
    <div style="display: flex; gap: 1rem;">
      <span style="color: var(--success-text);">+{diff.stats.added}</span>
      <span style="color: var(--error-text);">-{diff.stats.removed}</span>
    </div>
    {#if diff.stats.added === 0 && diff.stats.removed === 0}
      <span style="color: var(--tx-3); font-size: 0.75rem;">No changes</span>
    {/if}
  </div>

  {#if mode === 'unified'}
    <!-- Unified view -->
    <div style="overflow-x: auto;">
      {#each diff.lines as line}
        <div style="
          display: flex;
          {getLineStyle(line.type)}
        ">
          {#if showLineNumbers}
            <span style="
              width: 3rem;
              padding: 0 0.5rem;
              text-align: right;
              color: var(--tx-3);
              background: var(--bg-3);
              user-select: none;
              flex-shrink: 0;
            ">
              {line.type === 'added' ? '' : line.oldLineNumber ?? ''}
            </span>
            <span style="
              width: 3rem;
              padding: 0 0.5rem;
              text-align: right;
              color: var(--tx-3);
              background: var(--bg-3);
              user-select: none;
              flex-shrink: 0;
              border-right: 1px solid var(--ui);
            ">
              {line.type === 'removed' ? '' : line.newLineNumber ?? ''}
            </span>
          {/if}
          <span style="
            width: 1.5rem;
            text-align: center;
            flex-shrink: 0;
            font-weight: 600;
          ">
            {getPrefix(line.type)}
          </span>
          <span style="
            flex: 1;
            padding-right: 1rem;
            white-space: pre;
          ">
            {line.content || ' '}
          </span>
        </div>
      {/each}
    </div>
  {:else}
    <!-- Split view -->
    <div style="display: flex;">
      <!-- Left header -->
      <div style="
        flex: 1;
        padding: 0.5rem 1rem;
        background: var(--bg);
        border-bottom: 1px solid var(--ui);
        border-right: 1px solid var(--ui);
        font-weight: 500;
        color: var(--tx-2);
      ">
        {oldLabel}
      </div>
      <!-- Right header -->
      <div style="
        flex: 1;
        padding: 0.5rem 1rem;
        background: var(--bg);
        border-bottom: 1px solid var(--ui);
        font-weight: 500;
        color: var(--tx-2);
      ">
        {newLabel}
      </div>
    </div>
    <div style="display: flex; overflow-x: auto;">
      <!-- Left side -->
      <div style="flex: 1; border-right: 1px solid var(--ui);">
        {#each splitLines() as row}
          <div style="
            display: flex;
            min-height: 1.5rem;
            {row.left ? getLineStyle(row.left.type) : ''}
          ">
            {#if showLineNumbers}
              <span style="
                width: 3rem;
                padding: 0 0.5rem;
                text-align: right;
                color: var(--tx-3);
                background: var(--bg-3);
                user-select: none;
                flex-shrink: 0;
                border-right: 1px solid var(--ui);
              ">
                {row.left?.lineNumber ?? ''}
              </span>
            {/if}
            <span style="
              flex: 1;
              padding: 0 0.5rem;
              white-space: pre;
            ">
              {row.left?.content ?? ''}
            </span>
          </div>
        {/each}
      </div>
      <!-- Right side -->
      <div style="flex: 1;">
        {#each splitLines() as row}
          <div style="
            display: flex;
            min-height: 1.5rem;
            {row.right ? getLineStyle(row.right.type) : ''}
          ">
            {#if showLineNumbers}
              <span style="
                width: 3rem;
                padding: 0 0.5rem;
                text-align: right;
                color: var(--tx-3);
                background: var(--bg-3);
                user-select: none;
                flex-shrink: 0;
                border-right: 1px solid var(--ui);
              ">
                {row.right?.lineNumber ?? ''}
              </span>
            {/if}
            <span style="
              flex: 1;
              padding: 0 0.5rem;
              white-space: pre;
            ">
              {row.right?.content ?? ''}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
