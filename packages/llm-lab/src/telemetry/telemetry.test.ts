import { describe, it, expect } from 'vitest';
import type { ChatStreamChunk } from '@byo-keys/core';
import type { BYOKStores } from '@byo-keys/svelte';
import type { InspectableRequest } from '../types';
import { createSessionTelemetry } from './session-telemetry.svelte';
import { registerTelemetrySink, emitTelemetry, type TelemetryRecord } from './sink';
import { runLLM } from '../run/run-llm';

function req(overrides: Partial<InspectableRequest> = {}): InspectableRequest {
  return {
    providerId: 'anthropic',
    model: 'claude-opus-4-8',
    messages: [{ role: 'user', content: 'hi' }],
    params: { temperature: 0.7, maxTokens: 100 },
    sentAt: 0,
    ...overrides,
  };
}

function streamStores(chunks: ChatStreamChunk[]): BYOKStores {
  return {
    chatStream: async function* () {
      for (const chunk of chunks) yield chunk;
    },
  } as unknown as BYOKStores;
}

describe('session telemetry store', () => {
  it('records calls and breaks tokens out by type', () => {
    const t = createSessionTelemetry();
    t.recordCall({
      request: req(),
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        cacheReadTokens: 20,
        thinkingTokens: 10,
      },
      latencyMs: 200,
      finishReason: 'stop',
    });
    expect(t.entries.length).toBe(1);
    const agg = t.aggregates;
    expect(agg.totalCalls).toBe(1);
    expect(agg.usageByType.inputTokens).toBe(100);
    expect(agg.usageByType.outputTokens).toBe(50);
    expect(agg.usageByType.totalTokens).toBe(150);
    expect(agg.usageByType.cacheReadTokens).toBe(20);
    expect(agg.usageByType.thinkingTokens).toBe(10);
    expect(agg.usageByType.cacheWriteTokens).toBe(0);
  });

  it('computes cost for priced models and null for unknown', () => {
    const t = createSessionTelemetry();
    const usage = { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 };
    t.recordCall({ request: req({ model: 'claude-opus-4-8' }), usage, latencyMs: 1 });
    t.recordCall({ request: req({ model: 'totally-made-up-model' }), usage, latencyMs: 1 });
    expect(t.entries[0].costUsd).toBeGreaterThan(0);
    expect(t.entries[1].costUsd).toBeNull();
    const agg = t.aggregates;
    expect(agg.hasUnknownCost).toBe(true);
    expect(agg.totalCostUsd).toBeGreaterThan(0);
  });

  it('counts errors and aborts, and groups by model/provider', () => {
    const t = createSessionTelemetry();
    t.recordCall({ request: req({ model: 'm1', providerId: 'openai' }), latencyMs: 100, error: 'boom' });
    t.recordCall({
      request: req({ model: 'm1', providerId: 'openai' }),
      latencyMs: 300,
      aborted: true,
      error: 'Cancelled',
    });
    const agg = t.aggregates;
    expect(agg.errorCount).toBe(2);
    expect(agg.abortedCount).toBe(1);
    expect(agg.avgLatencyMs).toBe(200);
    expect(agg.byModel['m1'].calls).toBe(2);
    expect(agg.byProvider['openai'].calls).toBe(2);
  });

  it('does not record while paused, and clears', () => {
    const t = createSessionTelemetry();
    t.setPaused(true);
    t.recordCall({ request: req(), latencyMs: 1 });
    expect(t.entries.length).toBe(0);
    t.setPaused(false);
    t.recordCall({ request: req(), latencyMs: 1 });
    expect(t.entries.length).toBe(1);
    t.clear();
    expect(t.entries.length).toBe(0);
  });

  it('rehydrates from sessionStorage on configure', () => {
    const seeded = {
      seq: 7,
      entries: [{ id: 'x', seq: 7, request: req(), costUsd: null, latencyMs: 5, recordedAt: 0 }],
    };
    window.sessionStorage.setItem('wri-llm-telemetry:rehydrate-test', JSON.stringify(seeded));
    const t = createSessionTelemetry();
    t.configure('rehydrate-test');
    expect(t.entries.length).toBe(1);
    expect(t.entries[0].id).toBe('x');
    window.sessionStorage.clear();
  });
});

describe('telemetry sink dispatch', () => {
  it('delivers to registered sinks and stops after unregister', () => {
    const got: TelemetryRecord[] = [];
    const off = registerTelemetrySink((r) => got.push(r));
    emitTelemetry({ request: req(), latencyMs: 1 });
    expect(got.length).toBe(1);
    off();
    emitTelemetry({ request: req(), latencyMs: 1 });
    expect(got.length).toBe(1);
  });
});

describe('runLLM telemetry tap', () => {
  it('emits one record per call with merged usage', async () => {
    const got: TelemetryRecord[] = [];
    const off = registerTelemetrySink((r) => got.push(r));
    const stores = streamStores([
      { type: 'start', id: '1', model: 'claude-opus-4-8' },
      { type: 'usage', usage: { inputTokens: 100, cacheReadTokens: 20 } },
      { type: 'delta', content: 'hello' },
      { type: 'usage', usage: { outputTokens: 50 } },
      { type: 'done', finishReason: 'stop' },
    ]);
    const result = await runLLM(stores, {
      providerId: 'anthropic',
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'hi' }],
    });
    off();
    expect(got.length).toBe(1);
    expect(got[0].usage).toMatchObject({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cacheReadTokens: 20,
    });
    expect(result.content).toBe('hello');
  });

  it('respects telemetry: false', async () => {
    const got: TelemetryRecord[] = [];
    const off = registerTelemetrySink((r) => got.push(r));
    const stores = streamStores([{ type: 'done', finishReason: 'stop' }]);
    await runLLM(stores, {
      providerId: 'anthropic',
      model: 'm',
      messages: [],
      telemetry: false,
    });
    off();
    expect(got.length).toBe(0);
  });

  it('records aborted-before-start calls', async () => {
    const got: TelemetryRecord[] = [];
    const off = registerTelemetrySink((r) => got.push(r));
    const ac = new AbortController();
    ac.abort();
    const stores = streamStores([{ type: 'done', finishReason: 'stop' }]);
    await runLLM(stores, {
      providerId: 'anthropic',
      model: 'm',
      messages: [],
      signal: ac.signal,
    });
    off();
    expect(got.length).toBe(1);
    expect(got[0].aborted).toBe(true);
  });
});
