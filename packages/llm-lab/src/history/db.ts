import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { RunRecord } from '../types';

export interface LLMLabDB extends DBSchema {
  runs: {
    key: string;
    value: RunRecord;
    indexes: {
      'by-experiment': [string, number];
    };
  };
}

const DB_NAME = 'wri-llm-lab';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LLMLabDB>> | null = null;

export function indexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

/** Lazily open the shared demo DB. Never call at module top level. */
export function getDb(): Promise<IDBPDatabase<LLMLabDB>> {
  if (!indexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }
  if (!dbPromise) {
    dbPromise = openDB<LLMLabDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('runs', { keyPath: 'id' });
        store.createIndex('by-experiment', ['experiment', 'createdAt']);
      },
    });
  }
  return dbPromise;
}

/** Test hook: drop the cached connection so a fresh DB can be opened. */
export function resetDbForTests(): void {
  dbPromise = null;
}
