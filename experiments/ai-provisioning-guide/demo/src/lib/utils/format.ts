/**
 * Format as currency (USD), no decimals for values >= $1, two decimals otherwise.
 */
export function formatCurrency(value: number): string {
  if (value >= 1) {
    return '$' + Math.round(value).toLocaleString('en-US');
  }
  return '$' + value.toFixed(2);
}

/**
 * Format as compact currency for charts (e.g., $1.2K, $3.4M).
 */
export function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return '$' + (value / 1_000).toFixed(1) + 'K';
  return formatCurrency(value);
}

/**
 * Format volume with compact notation.
 */
export function formatVolume(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(0) + 'K';
  return value.toLocaleString('en-US');
}

/**
 * Format as percent.
 */
export function formatPercent(value: number): string {
  return Math.round(value) + '%';
}

/**
 * Format cost per request with appropriate precision.
 */
export function formatCostPerRequest(value: number): string {
  if (value >= 1) return '$' + value.toFixed(2);
  if (value >= 0.01) return '$' + value.toFixed(3);
  if (value >= 0.001) return '$' + value.toFixed(4);
  return '<$0.001';
}
