import { describe, it, expect } from 'vitest';
import { fanOut } from './fan-out';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('fanOut', () => {
  it('returns results in task order', async () => {
    const results = await fanOut([
      async () => {
        await delay(20);
        return 'slow';
      },
      async () => 'fast',
    ]);
    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([
      'slow',
      'fast',
    ]);
  });

  it('respects the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const task = async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await delay(10);
      inFlight--;
      return true;
    };
    await fanOut(Array.from({ length: 8 }, () => task), { concurrency: 2 });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('captures rejections without failing the batch', async () => {
    const results = await fanOut([
      async () => {
        throw new Error('boom');
      },
      async () => 'ok',
    ]);
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('fulfilled');
  });

  it('skips queued tasks after abort', async () => {
    const controller = new AbortController();
    let ran = 0;
    const tasks = Array.from({ length: 6 }, (_, i) => async () => {
      ran++;
      if (i === 0) controller.abort();
      await delay(5);
      return i;
    });
    const results = await fanOut(tasks, { concurrency: 1, signal: controller.signal });
    expect(ran).toBe(1);
    expect(results.filter((r) => r.status === 'rejected').length).toBe(5);
  });

  it('reports settle events with stable indices', async () => {
    const settled: number[] = [];
    await fanOut(
      [async () => 'a', async () => 'b', async () => 'c'],
      { onSettle: (index) => settled.push(index) }
    );
    expect([...settled].sort()).toEqual([0, 1, 2]);
  });
});
