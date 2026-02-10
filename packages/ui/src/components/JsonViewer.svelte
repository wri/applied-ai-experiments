<script lang="ts">
  import CopyButton from './CopyButton.svelte';
  import JsonNode from './JsonNode.svelte';

  interface Props {
    data: unknown;
    initialExpandDepth?: number;
    copyable?: boolean;
    maxStringLength?: number;
    class?: string;
  }

  let {
    data,
    initialExpandDepth = 1,
    copyable = true,
    maxStringLength = 100,
    class: className = '',
  }: Props = $props();
</script>

<div
  class="ui-json-viewer {className}"
  style="
    font-family: var(--font-mono);
    font-size: 0.875rem;
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    overflow: hidden;
  "
>
  {#if copyable}
    <div style="
      display: flex;
      justify-content: flex-end;
      padding: 0.5rem;
      background: var(--bg-3);
      border-bottom: 1px solid var(--ui);
    ">
      <CopyButton text={JSON.stringify(data, null, 2)} size="sm" variant="ghost" iconOnly />
    </div>
  {/if}
  <div style="padding: 1rem; overflow-x: auto;">
    <JsonNode value={data} depth={0} {initialExpandDepth} {maxStringLength} />
  </div>
</div>
