// =============================================================================
// Storage Implementations
// =============================================================================

import type { 
  KeyStorage, 
  StoredKey, 
  KeyMetadata, 
  ProviderId,
  StorageOptions 
} from './types';

const DEFAULT_PREFIX = 'byo-keys:keys:';

// -----------------------------------------------------------------------------
// Browser Storage Check
// -----------------------------------------------------------------------------

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function assertBrowser(): void {
  if (!isBrowser()) {
    throw new Error(
      'BYOK storage requires a browser environment. ' +
      'Use MemoryStorage for SSR or testing.'
    );
  }
}

// -----------------------------------------------------------------------------
// Memory Storage (for SSR/testing)
// -----------------------------------------------------------------------------

export class MemoryStorage implements KeyStorage {
  private store = new Map<string, StoredKey>();
  
  async get(providerId: ProviderId): Promise<StoredKey | null> {
    return this.store.get(providerId) ?? null;
  }
  
  async set(providerId: ProviderId, key: string, metadata?: KeyMetadata): Promise<void> {
    this.store.set(providerId, {
      providerId,
      key,
      addedAt: Date.now(),
      metadata,
    });
  }
  
  async remove(providerId: ProviderId): Promise<void> {
    this.store.delete(providerId);
  }
  
  async list(): Promise<StoredKey[]> {
    return Array.from(this.store.values());
  }
  
  async clear(): Promise<void> {
    this.store.clear();
  }
}

// -----------------------------------------------------------------------------
// Local Storage Implementation
// -----------------------------------------------------------------------------

export class LocalStorage implements KeyStorage {
  private prefix: string;
  private backend: Storage;
  
  constructor(options: StorageOptions = {}) {
    assertBrowser();
    
    this.prefix = options.prefix ?? DEFAULT_PREFIX;
    this.backend = options.backend === 'sessionStorage' 
      ? window.sessionStorage 
      : window.localStorage;
  }
  
  private getStorageKey(providerId: ProviderId): string {
    return `${this.prefix}${providerId}`;
  }
  
  async get(providerId: ProviderId): Promise<StoredKey | null> {
    const raw = this.backend.getItem(this.getStorageKey(providerId));
    if (!raw) return null;
    
    try {
      return JSON.parse(raw) as StoredKey;
    } catch {
      // Corrupted data, remove it
      this.backend.removeItem(this.getStorageKey(providerId));
      return null;
    }
  }
  
  async set(providerId: ProviderId, key: string, metadata?: KeyMetadata): Promise<void> {
    const stored: StoredKey = {
      providerId,
      key,
      addedAt: Date.now(),
      metadata,
    };
    
    this.backend.setItem(this.getStorageKey(providerId), JSON.stringify(stored));
  }
  
  async remove(providerId: ProviderId): Promise<void> {
    this.backend.removeItem(this.getStorageKey(providerId));
  }
  
  async list(): Promise<StoredKey[]> {
    const keys: StoredKey[] = [];
    
    for (let i = 0; i < this.backend.length; i++) {
      const storageKey = this.backend.key(i);
      if (storageKey?.startsWith(this.prefix)) {
        const raw = this.backend.getItem(storageKey);
        if (raw) {
          try {
            keys.push(JSON.parse(raw) as StoredKey);
          } catch {
            // Skip corrupted entries
          }
        }
      }
    }
    
    return keys;
  }
  
  async clear(): Promise<void> {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < this.backend.length; i++) {
      const storageKey = this.backend.key(i);
      if (storageKey?.startsWith(this.prefix)) {
        keysToRemove.push(storageKey);
      }
    }
    
    keysToRemove.forEach(key => this.backend.removeItem(key));
  }
}

// -----------------------------------------------------------------------------
// Encrypted Storage Implementation (Web Crypto API)
// -----------------------------------------------------------------------------

export class EncryptedStorage implements KeyStorage {
  private prefix: string;
  private backend: Storage;
  private cryptoKey: CryptoKey | null = null;
  private salt: Uint8Array;
  
  constructor(options: StorageOptions = {}) {
    assertBrowser();
    
    if (!window.crypto?.subtle) {
      throw new Error('Web Crypto API not available. Cannot use encrypted storage.');
    }
    
    this.prefix = options.prefix ?? `${DEFAULT_PREFIX}encrypted:`;
    this.backend = options.backend === 'sessionStorage'
      ? window.sessionStorage
      : window.localStorage;
    
    // Use a stored salt or generate a new one
    const saltKey = `${this.prefix}__salt__`;
    const storedSalt = this.backend.getItem(saltKey);
    
    if (storedSalt) {
      this.salt = new Uint8Array(JSON.parse(storedSalt));
    } else {
      this.salt = crypto.getRandomValues(new Uint8Array(16));
      this.backend.setItem(saltKey, JSON.stringify(Array.from(this.salt)));
    }
  }
  
  /**
   * Derive an encryption key from a passphrase
   */
  async setEncryptionKey(passphrase: string): Promise<void> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    this.cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this.salt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  clearEncryptionKey(): void {
    this.cryptoKey = null;
  }
  
  isEncrypted(): boolean {
    return this.cryptoKey !== null;
  }
  
  private assertEncrypted(): void {
    if (!this.cryptoKey) {
      throw new Error(
        'Encryption key not set. Call setEncryptionKey(passphrase) first.'
      );
    }
  }
  
  private async encrypt(data: string): Promise<string> {
    this.assertEncrypted();
    
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.cryptoKey!,
      encoder.encode(data)
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }
  
  private async decrypt(data: string): Promise<string> {
    this.assertEncrypted();
    
    const combined = new Uint8Array(
      atob(data).split('').map(c => c.charCodeAt(0))
    );
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.cryptoKey!,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  }
  
  private getStorageKey(providerId: ProviderId): string {
    return `${this.prefix}${providerId}`;
  }
  
  async get(providerId: ProviderId): Promise<StoredKey | null> {
    this.assertEncrypted();
    
    const raw = this.backend.getItem(this.getStorageKey(providerId));
    if (!raw) return null;
    
    try {
      const decrypted = await this.decrypt(raw);
      return JSON.parse(decrypted) as StoredKey;
    } catch {
      // Corrupted or wrong key
      return null;
    }
  }
  
  async set(providerId: ProviderId, key: string, metadata?: KeyMetadata): Promise<void> {
    this.assertEncrypted();
    
    const stored: StoredKey = {
      providerId,
      key,
      addedAt: Date.now(),
      metadata,
    };
    
    const encrypted = await this.encrypt(JSON.stringify(stored));
    this.backend.setItem(this.getStorageKey(providerId), encrypted);
  }
  
  async remove(providerId: ProviderId): Promise<void> {
    this.backend.removeItem(this.getStorageKey(providerId));
  }
  
  async list(): Promise<StoredKey[]> {
    this.assertEncrypted();
    
    const keys: StoredKey[] = [];
    
    for (let i = 0; i < this.backend.length; i++) {
      const storageKey = this.backend.key(i);
      if (storageKey?.startsWith(this.prefix) && !storageKey.endsWith('__salt__')) {
        const raw = this.backend.getItem(storageKey);
        if (raw) {
          try {
            const decrypted = await this.decrypt(raw);
            keys.push(JSON.parse(decrypted) as StoredKey);
          } catch {
            // Skip entries that can't be decrypted
          }
        }
      }
    }
    
    return keys;
  }
  
  async clear(): Promise<void> {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < this.backend.length; i++) {
      const storageKey = this.backend.key(i);
      if (storageKey?.startsWith(this.prefix)) {
        keysToRemove.push(storageKey);
      }
    }
    
    keysToRemove.forEach(key => this.backend.removeItem(key));
  }
}

// -----------------------------------------------------------------------------
// Storage Factory
// -----------------------------------------------------------------------------

export function createStorage(options?: KeyStorage | StorageOptions): KeyStorage {
  // If already a KeyStorage instance, return it
  if (options && 'get' in options && typeof options.get === 'function') {
    return options as KeyStorage;
  }
  
  const opts = (options as StorageOptions) ?? {};
  
  // Use memory storage in non-browser environments
  if (!isBrowser()) {
    return new MemoryStorage();
  }
  
  // Use encrypted storage if requested
  if (opts.encrypted) {
    return new EncryptedStorage(opts);
  }
  
  // Default to localStorage
  return new LocalStorage(opts);
}
