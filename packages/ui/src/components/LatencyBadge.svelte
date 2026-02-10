<script lang="ts">
  import { formatLatency } from '../utils/formatters';

  interface Props {
    ms: number;
    thresholds?: { good: number; fair: number };
    showUnit?: boolean;
    size?: 'sm' | 'md';
    class?: string;
  }

  let {
    ms,
    thresholds = { good: 500, fair: 2000 },
    showUnit = true,
    size = 'md',
    class: className = '',
  }: Props = $props();

  const status = $derived<'good' | 'fair' | 'poor'>(
    ms <= thresholds.good ? 'good' : ms <= thresholds.fair ? 'fair' : 'poor'
  );

  const statusColors = {
    good: 'var(--success-text)',
    fair: 'var(--warning-text)',
    poor: 'var(--error-text)',
  };

  const formatted = $derived(formatLatency(ms));
  const fontSize = $derived(size === 'sm' ? '0.75rem' : 'var(--text-body-font-size)');
</script>

<span
  class="ui-latency-badge {className}"
  style="
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-family: var(--font-mono);
    font-size: {fontSize};
    font-variant-numeric: tabular-nums;
    color: {statusColors[status]};
  "
  title="{ms} ms"
>
  <span style="
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  "></span>
  {showUnit ? formatted : ms < 1000 ? Math.round(ms) : (ms / 1000).toFixed(1)}
</span>
