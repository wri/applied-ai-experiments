import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('produces header from union of keys', () => {
    const csv = toCsv([
      { a: 1, b: 'x' },
      { a: 2, c: true },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('a,b,c');
    expect(lines[1]).toBe('1,x,');
    expect(lines[2]).toBe('2,,true');
  });

  it('quotes commas, quotes, and newlines', () => {
    const csv = toCsv([{ text: 'a, "b"\nc' }]);
    expect(csv.split('\r\n')[1]).toBe('"a, ""b""\nc"');
  });

  it('JSON-encodes nested values', () => {
    const csv = toCsv([{ data: { x: 1 } }]);
    expect(csv).toContain('""x"":1');
  });

  it('respects explicit column order', () => {
    const csv = toCsv([{ a: 1, b: 2 }], ['b', 'a']);
    expect(csv.split('\r\n')[0]).toBe('b,a');
    expect(csv.split('\r\n')[1]).toBe('2,1');
  });
});
