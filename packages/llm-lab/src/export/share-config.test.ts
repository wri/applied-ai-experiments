import { describe, it, expect } from 'vitest';
import { encodeShareConfig, decodeShareConfig, stripSecrets } from './share-config';

describe('share-config', () => {
  it('round-trips a config', () => {
    const config = { task: 'summarize — memo 🌍', temperature: 0.7, variants: ['a', 'b'] };
    const encoded = encodeShareConfig(config);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeShareConfig(encoded)).toEqual(config);
  });

  it('strips credential-like keys at any depth', () => {
    const config = {
      task: 'x',
      apiKey: 'sk-secret',
      api_key: 'sk-secret',
      nested: { authToken: 'abc', password: 'p', keep: 1 },
    };
    const decoded = decodeShareConfig<Record<string, unknown>>(encodeShareConfig(config));
    expect(decoded).toEqual({ task: 'x', nested: { keep: 1 } });
  });

  it('stripSecrets handles arrays', () => {
    expect(stripSecrets([{ token: 'x', a: 1 }])).toEqual([{ a: 1 }]);
  });

  it('returns null for garbage input', () => {
    expect(decodeShareConfig('!!!not-base64!!!')).toBeNull();
  });
});
