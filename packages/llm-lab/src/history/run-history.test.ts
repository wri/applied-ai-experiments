import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createRunHistory } from './run-history';
import { resetDbForTests } from './db';
import type { NewRunRecord } from './run-history';

function makeRun(label: string): NewRunRecord {
  return {
    label,
    config: { question: 'q' },
    requests: [
      {
        providerId: 'anthropic',
        model: 'claude-test',
        messages: [{ role: 'user', content: 'hi' }],
        params: { temperature: 0.7 },
        sentAt: Date.now(),
      },
    ],
    responses: [{ content: 'hello', latencyMs: 100 }],
  };
}

describe('createRunHistory', () => {
  beforeEach(() => {
    // Fresh DB per test
    globalThis.indexedDB = new IDBFactory();
    resetDbForTests();
  });

  it('saves and lists newest-first, scoped to the experiment', async () => {
    const history = createRunHistory('demo-a');
    const other = createRunHistory('demo-b');

    const first = await history.save(makeRun('first'));
    expect(first).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await history.save(makeRun('second'));
    await other.save(makeRun('other-demo'));

    const records = await history.list();
    expect(records.map((r) => r.label)).toEqual(['second', 'first']);
  });

  it('gets only records from its own experiment', async () => {
    const a = createRunHistory('demo-a');
    const b = createRunHistory('demo-b');
    const saved = await a.save(makeRun('mine'));
    expect(await b.get(saved!.id)).toBeUndefined();
    expect((await a.get(saved!.id))?.label).toBe('mine');
  });

  it('duplicates a run with a new id', async () => {
    const history = createRunHistory('demo-a');
    const original = await history.save(makeRun('orig'));
    const copy = await history.duplicate(original!.id);
    expect(copy!.id).not.toBe(original!.id);
    expect(copy!.label).toBe('orig (copy)');
    expect((await history.list()).length).toBe(2);
  });

  it('clears only its own experiment', async () => {
    const a = createRunHistory('demo-a');
    const b = createRunHistory('demo-b');
    await a.save(makeRun('a1'));
    await b.save(makeRun('b1'));
    await a.clear();
    expect(await a.list()).toEqual([]);
    expect((await b.list()).length).toBe(1);
  });

  it('removes a single record', async () => {
    const history = createRunHistory('demo-a');
    const saved = await history.save(makeRun('x'));
    await history.remove(saved!.id);
    expect(await history.list()).toEqual([]);
  });
});
