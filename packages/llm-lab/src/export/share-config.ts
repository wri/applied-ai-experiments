const SECRET_KEY_PATTERN = /(api[-_]?key|token|secret|password)/i;

/**
 * Serialize a demo config to a URL-safe string. Any property whose name
 * looks like a credential is stripped — defense in depth on top of demos
 * never putting keys in config in the first place.
 */
export function encodeShareConfig(config: Record<string, unknown>): string {
  const sanitized = stripSecrets(config) as Record<string, unknown>;
  const json = JSON.stringify(sanitized);
  const bytes = new TextEncoder().encode(json);
  return toBase64Url(bytes);
}

export function decodeShareConfig<T = Record<string, unknown>>(encoded: string): T | null {
  try {
    const bytes = fromBase64Url(encoded);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripSecrets);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) continue;
      out[key] = stripSecrets(val);
    }
    return out;
  }
  return value;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): Uint8Array {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
