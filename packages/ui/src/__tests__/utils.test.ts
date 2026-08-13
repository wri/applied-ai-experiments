import { describe, it, expect } from 'vitest';
import {
  formatTokens,
  formatLatency,
  formatBytes,
  formatPercent,
  formatRelativeTime,
  formatTimestamp,
} from '../utils/formatters';
import { computeDiff } from '../utils/diff';

describe('formatTokens', () => {
  it('formats small numbers as-is', () => {
    expect(formatTokens(42)).toBe('42');
  });

  it('formats thousands with K suffix', () => {
    expect(formatTokens(1500)).toBe('1.5K');
  });

  it('formats millions with M suffix', () => {
    expect(formatTokens(2_500_000)).toBe('2.5M');
  });

  it('handles zero', () => {
    expect(formatTokens(0)).toBe('0');
  });
});

describe('formatLatency', () => {
  it('formats milliseconds', () => {
    expect(formatLatency(250)).toBe('250 ms');
  });

  it('formats seconds', () => {
    expect(formatLatency(1500)).toBe('1.5s');
  });
});

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1_572_864)).toBe('1.5 MB');
  });
});

describe('formatPercent', () => {
  it('formats a decimal as percentage', () => {
    expect(formatPercent(0.425)).toBe('42.5%');
  });

  it('formats with custom decimals', () => {
    expect(formatPercent(0.3333, 1)).toBe('33.3%');
  });
});

describe('formatRelativeTime', () => {
  it('formats recent time as "just now"', () => {
    const result = formatRelativeTime(new Date());
    expect(result).toMatch(/just now|0s|1s/);
  });
});

describe('formatTimestamp', () => {
  it('formats a date to time string', () => {
    const date = new Date('2024-01-15T14:30:45');
    const result = formatTimestamp(date);
    // May be 24h or 12h format depending on locale
    expect(result).toMatch(/30:45/);
  });
});

describe('computeDiff', () => {
  it('computes diff between two strings', () => {
    const result = computeDiff('hello\nworld', 'hello\nearth');
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it('handles identical strings', () => {
    const result = computeDiff('same', 'same');
    expect(result.lines.every((l) => l.type === 'unchanged')).toBe(true);
  });

  it('handles empty strings', () => {
    const result = computeDiff('', 'new');
    expect(result.lines.length).toBeGreaterThan(0);
  });
});
