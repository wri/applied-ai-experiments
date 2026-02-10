<script lang="ts">
  import { untrack } from 'svelte';
  import JsonNode from './JsonNode.svelte';

  interface Props {
    value: unknown;
    depth: number;
    initialExpandDepth: number;
    maxStringLength: number;
    keyName?: string;
    isLast?: boolean;
  }

  let {
    value,
    depth,
    initialExpandDepth,
    maxStringLength,
    keyName,
    isLast = true,
  }: Props = $props();

  // Intentionally captures initial prop values — expand state shouldn't re-derive
  let isExpanded = $state(untrack(() => depth < initialExpandDepth));

  function getType(val: unknown): 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'object' | 'array' {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (Array.isArray(val)) return 'array';
    return typeof val as 'string' | 'number' | 'boolean' | 'object';
  }

  function formatValue(val: unknown, type: string, maxLen: number): { text: string; color: string } {
    switch (type) {
      case 'string': {
        const str = val as string;
        const truncated = str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
        return { text: `"${truncated}"`, color: 'var(--success-text)' };
      }
      case 'number':
        return { text: String(val), color: 'var(--info-text)' };
      case 'boolean':
        return { text: String(val), color: 'oklch(0.7 0.15 300)' };
      case 'null':
        return { text: 'null', color: 'var(--tx-3)' };
      case 'undefined':
        return { text: 'undefined', color: 'var(--tx-3)' };
      default:
        return { text: String(val), color: 'var(--tx)' };
    }
  }

  const type = $derived(getType(value));
  const isCollapsible = $derived(type === 'object' || type === 'array');
  const entries = $derived(
    type === 'object'
      ? Object.entries(value as object)
      : type === 'array'
        ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
        : []
  );
  const bracket = $derived(type === 'array' ? ['[', ']'] : ['{', '}']);
  const formatted = $derived(formatValue(value, type, maxStringLength));
  const comma = $derived(isLast ? '' : ',');
</script>

<div style="line-height: 1.5;">
  {#if isCollapsible}
    <span
      style="cursor: pointer; user-select: none;"
      onclick={() => { isExpanded = !isExpanded; }}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isExpanded = !isExpanded; } }}
      tabindex="0"
      role="button"
      aria-expanded={isExpanded}
    >
      <span style="color: var(--tx-3); font-size: 0.75em; display: inline-block; width: 1em; text-align: center;">
        {isExpanded ? '▼' : '▶'}
      </span>
      {#if keyName !== undefined}
        <span style="color: var(--primary);">"{keyName}"</span><span style="color: var(--tx-3);">: </span>
      {/if}
      <span style="color: var(--tx-3);">{bracket[0]}</span>
      {#if !isExpanded}
        <span style="color: var(--tx-3);"> {entries.length} {type === 'array' ? 'items' : 'keys'} {bracket[1]}{comma}</span>
      {/if}
    </span>

    {#if isExpanded}
      <div style="padding-left: 1.25rem;">
        {#each entries as [key, val], i}
          <JsonNode
            value={val}
            depth={depth + 1}
            {initialExpandDepth}
            {maxStringLength}
            keyName={type === 'array' ? undefined : key}
            isLast={i === entries.length - 1}
          />
        {/each}
      </div>
      <span style="color: var(--tx-3);">{bracket[1]}{comma}</span>
    {/if}
  {:else}
    <span style="display: inline-block; width: 1em;"></span>
    {#if keyName !== undefined}
      <span style="color: var(--primary);">"{keyName}"</span><span style="color: var(--tx-3);">: </span>
    {/if}
    <span style="color: {formatted.color};">{formatted.text}</span><span style="color: var(--tx-3);">{comma}</span>
  {/if}
</div>
