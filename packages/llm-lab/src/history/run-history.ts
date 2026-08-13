import type { RunRecord } from '../types';
import { getDb, indexedDbAvailable } from './db';
import { downloadJson } from '../export/download';

export type NewRunRecord = Omit<RunRecord, 'id' | 'createdAt' | 'experiment'>;

export interface RunHistory {
  /** false when IndexedDB is missing (SSR/private mode) — methods become no-ops */
  readonly available: boolean;
  save(run: NewRunRecord): Promise<RunRecord | null>;
  list(opts?: { limit?: number }): Promise<RunRecord[]>;
  get(id: string): Promise<RunRecord | undefined>;
  duplicate(id: string): Promise<RunRecord | null>;
  remove(id: string): Promise<void>;
  /** Clears this experiment's runs only */
  clear(): Promise<void>;
  exportJson(): Promise<void>;
}

/** Per-experiment view over the shared 'wri-llm-lab' IndexedDB. */
export function createRunHistory(experiment: string): RunHistory {
  const available = indexedDbAvailable();

  async function save(run: NewRunRecord): Promise<RunRecord | null> {
    if (!available) return null;
    // Callers pass reactive ($state) proxies and other structures IndexedDB's
    // structured clone can't serialize. Run records are JSON-shaped by contract
    // (InspectableRequest / RunResponse / config), so a JSON round-trip yields a
    // plain, cloneable value — and frees callers from snapshotting at every site.
    const plain = JSON.parse(JSON.stringify(run)) as NewRunRecord;
    const record: RunRecord = {
      ...plain,
      id: crypto.randomUUID(),
      experiment,
      createdAt: Date.now(),
    };
    const db = await getDb();
    await db.put('runs', record);
    return record;
  }

  async function list(opts: { limit?: number } = {}): Promise<RunRecord[]> {
    if (!available) return [];
    const db = await getDb();
    const range = IDBKeyRange.bound([experiment, 0], [experiment, Number.MAX_SAFE_INTEGER]);
    const records = await db.getAllFromIndex('runs', 'by-experiment', range);
    records.reverse(); // newest first
    return opts.limit ? records.slice(0, opts.limit) : records;
  }

  async function get(id: string): Promise<RunRecord | undefined> {
    if (!available) return undefined;
    const db = await getDb();
    const record = await db.get('runs', id);
    return record?.experiment === experiment ? record : undefined;
  }

  async function duplicate(id: string): Promise<RunRecord | null> {
    const original = await get(id);
    if (!original) return null;
    return save({
      label: original.label ? `${original.label} (copy)` : undefined,
      config: original.config,
      requests: original.requests,
      responses: original.responses,
    });
  }

  async function remove(id: string): Promise<void> {
    if (!available) return;
    const db = await getDb();
    await db.delete('runs', id);
  }

  async function clear(): Promise<void> {
    if (!available) return;
    const records = await list();
    const db = await getDb();
    const tx = db.transaction('runs', 'readwrite');
    await Promise.all(records.map((record) => tx.store.delete(record.id)));
    await tx.done;
  }

  async function exportJson(): Promise<void> {
    const records = await list();
    downloadJson(records, `${experiment}-runs.json`);
  }

  return { available, save, list, get, duplicate, remove, clear, exportJson };
}
