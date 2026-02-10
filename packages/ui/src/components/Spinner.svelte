<script lang="ts">
  interface Props {
    size?: 'sm' | 'md' | 'lg';
    class?: string;
  }

  let {
    size = 'md',
    class: className = '',
  }: Props = $props();

  const sizeMap = {
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
  };
</script>

<span
  class="ui-spinner {className}"
  role="status"
  aria-label="Loading"
  style="
    display: inline-block;
    width: {sizeMap[size]};
    height: {sizeMap[size]};
    border: 2px solid var(--ui);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  "
></span>

<style>
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
