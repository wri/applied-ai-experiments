import { describe, it, expect } from 'vitest';
import { extractJson } from './extract-json';

describe('extractJson', () => {
  it('parses plain JSON', () => {
    const result = extractJson('{"a": 1}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it('parses JSON inside a ```json fence', () => {
    const result = extractJson('Here you go:\n```json\n{"a": [1, 2]}\n```\nDone.');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: [1, 2] });
  });

  it('parses JSON inside a plain ``` fence', () => {
    const result = extractJson('```\n[1, 2, 3]\n```');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([1, 2, 3]);
  });

  it('finds JSON surrounded by prose', () => {
    const result = extractJson('Sure! The answer is {"verdict": "supported"} as requested.');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ verdict: 'supported' });
  });

  it('handles braces inside string values', () => {
    const result = extractJson('prefix {"text": "a } b { c", "n": 1} suffix');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ text: 'a } b { c', n: 1 });
  });

  it('handles escaped quotes inside strings', () => {
    const result = extractJson('{"quote": "she said \\"hi\\" {}"}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ quote: 'she said "hi" {}' });
  });

  it('picks an array when it comes first', () => {
    const result = extractJson('Result: [{"id": 1}] and {"ignored": true}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([{ id: 1 }]);
  });

  it('fails on empty input', () => {
    expect(extractJson('').ok).toBe(false);
  });

  it('fails on prose with no JSON', () => {
    expect(extractJson('I cannot answer that question.').ok).toBe(false);
  });
});
