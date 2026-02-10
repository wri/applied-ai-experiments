<script lang="ts">
  import { toastStore } from './toastStore';
  import Toast from './Toast.svelte';

  interface Props {
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
    class?: string;
  }

  let {
    position = 'bottom-right',
    class: className = '',
  }: Props = $props();

  const positionStyles = {
    'top-right': 'top: 1rem; right: 1rem;',
    'top-left': 'top: 1rem; left: 1rem;',
    'bottom-right': 'bottom: 1rem; right: 1rem;',
    'bottom-left': 'bottom: 1rem; left: 1rem;',
    'top-center': 'top: 1rem; left: 50%; transform: translateX(-50%);',
    'bottom-center': 'bottom: 1rem; left: 50%; transform: translateX(-50%);',
  };

  const flexDirection = $derived(
    position.startsWith('top') ? 'column' : 'column-reverse'
  );
</script>

<div
  class="ui-toast-container {className}"
  style="
    position: fixed;
    {positionStyles[position]}
    z-index: var(--z-modal, 1000);
    display: flex;
    flex-direction: {flexDirection};
    gap: 0.5rem;
    pointer-events: none;
  "
>
  {#each $toastStore as toast (toast.id)}
    <div style="pointer-events: auto;">
      <Toast {toast} onclose={() => toastStore.remove(toast.id)} />
    </div>
  {/each}
</div>
