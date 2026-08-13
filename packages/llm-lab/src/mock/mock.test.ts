import { describe, it, expect, afterEach, vi } from 'vitest';
import { readable } from 'svelte/store';
import type { BYOKStores } from '@byo-keys/svelte';
import type { InspectableRequest } from '../types';
import {
  resolveMock,
  mockRun,
  lastUserText,
  shouldMock,
  canRunLive,
  setForceMock,
  isForceMock,
  type MockSpec,
} from './mock.svelte';
import { activateReplay, deactivateReplay } from '../replay/replay.svelte';
import { runLLM, type RunLLMOptions } from '../run/run-llm';

function req(content = 'Count the words in this paragraph'): InspectableRequest {
  return {
    providerId: 'anthropic',
    model: 'claude-opus-4-8',
    messages: [{ role: 'user', content }],
    params: {},
    sentAt: 0,
  };
}

function opts(overrides: Partial<RunLLMOptions> = {}): RunLLMOptions {
  return {
    providerId: 'anthropic',
    model: 'claude-opus-4-8',
    messages: [{ role: 'user', content: 'x' }],
    telemetry: false,
    ...overrides,
  };
}

/** Minimal BYOKStores stand-in — only `keys` and `providers` are read. */
function stubStores(opts: {
  requiresKey?: boolean;
  hasKey?: boolean;
  isValid?: boolean;
  models?: unknown[];
}): BYOKStores {
  return {
    keys: readable({
      anthropic: { hasKey: opts.hasKey, isValid: opts.isValid, models: opts.models },
    }),
    providers: readable([{ config: { id: 'anthropic', requiresKey: opts.requiresKey ?? true } }]),
  } as unknown as BYOKStores;
}

// Force-mock is a module singleton — reset between tests so state doesn't leak.
afterEach(() => {
  setForceMock(false);
  deactivateReplay();
  vi.useRealTimers();
});

describe('resolveMock', () => {
  it('returns text verbatim', async () => {
    await expect(resolveMock({ kind: 'text', text: 'hello' }, req())).resolves.toBe('hello');
  });

  it('fences JSON, so the demo extractor is exercised rather than bypassed', async () => {
    const out = await resolveMock({ kind: 'json', value: { a: 1 } }, req());
    expect(out).toMatch(/^```json\n/);
    expect(out).toMatch(/```$/);
    expect(JSON.parse(out.replace(/```json\n|\n```/g, ''))).toEqual({ a: 1 });
  });

  it('picks the first matching case against the last user text', async () => {
    const spec: MockSpec = {
      kind: 'match',
      cases: [
        { pattern: /rewrite/i, text: 'REWRITE' },
        { pattern: /count the words/i, text: 'COUNT' },
      ],
      fallback: 'FALLBACK',
    };
    await expect(resolveMock(spec, req('Count the words here'))).resolves.toBe('COUNT');
    await expect(resolveMock(spec, req('Rewrite this'))).resolves.toBe('REWRITE');
    await expect(resolveMock(spec, req('something else'))).resolves.toBe('FALLBACK');
  });

  it('awaits fn specs and passes the request through', async () => {
    const spec: MockSpec = { kind: 'fn', run: async (r) => `len:${lastUserText(r).length}` };
    await expect(resolveMock(spec, req('abcd'))).resolves.toBe('len:4');
  });
});

describe('lastUserText', () => {
  it('finds the last user message, ignoring assistant turns', () => {
    const r = req();
    r.messages = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second' },
    ];
    expect(lastUserText(r)).toBe('second');
  });

  it('joins text parts of a multimodal message and skips images', () => {
    const r = req();
    r.messages = [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', mediaType: 'image/png', data: 'zz' } },
          { type: 'text', text: 'alpha' },
          { type: 'text', text: 'beta' },
        ],
      },
    ] as unknown as typeof r.messages;
    expect(lastUserText(r)).toBe('alpha\nbeta');
  });

  it('returns empty string when there is no user message', () => {
    const r = req();
    r.messages = [{ role: 'assistant', content: 'only' }];
    expect(lastUserText(r)).toBe('');
  });
});

describe('mockRun', () => {
  it('streams deltas and reports NO usage, so nothing invents a cost', async () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const p = mockRun({ kind: 'text', text: 'one two three' }, req(), opts({ onDelta: (d) => seen.push(d) }));
    await vi.runAllTimersAsync();
    const r = await p;

    expect(r.content).toBe('one two three');
    expect(seen.join('')).toBe('one two three');
    // The load-bearing guarantee: a mock spent nothing, so it must claim nothing.
    expect(r.usage).toBeUndefined();
    expect(r.mocked).toBe(true);
    expect(r.error).toBeUndefined();
  });

  it('caps total playback so a large fixture does not stream for tens of seconds', async () => {
    // ~2000 word-chunks. At the uncapped per-chunk rate (14-40ms) this would be
    // 28-80s; the budget must pull the per-chunk delay down instead.
    const big = Array.from({ length: 2000 }, (_, i) => `word${i}`).join(' ');
    vi.useFakeTimers();
    const started = Date.now();
    const p = mockRun({ kind: 'text', text: big }, req(), opts());
    await vi.runAllTimersAsync();
    const r = await p;
    // Fake timers advance virtual time, so this measures the scheduled total.
    const virtualElapsed = Date.now() - started;
    expect(r.content).toBe(big);
    expect(virtualElapsed).toBeLessThan(6000); // 4000ms budget + the 350ms think + slack
  });

  it('honours an abort signal mid-stream and keeps what streamed', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const p = mockRun(
      { kind: 'text', text: 'a b c d e f g h' },
      req(),
      opts({ signal: controller.signal, onDelta: () => controller.abort() })
    );
    await vi.runAllTimersAsync();
    const r = await p;

    expect(r.aborted).toBe(true);
    expect(r.error).toBe('Cancelled');
    expect(r.content.length).toBeGreaterThan(0);
    expect(r.usage).toBeUndefined();
  });

  it('surfaces a throwing fn spec as an error result rather than rejecting', async () => {
    vi.useFakeTimers();
    const p = mockRun(
      { kind: 'fn', run: () => { throw new Error('bad fixture'); } },
      req(),
      opts()
    );
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.error).toBe('bad fixture');
    expect(r.mocked).toBe(true);
  });
});

describe('canRunLive', () => {
  it('requires a valid key for a key-required provider', () => {
    expect(canRunLive(stubStores({ hasKey: true, isValid: true }), 'anthropic')).toBe(true);
    expect(canRunLive(stubStores({ hasKey: true, isValid: false }), 'anthropic')).toBe(false);
    expect(canRunLive(stubStores({ hasKey: false }), 'anthropic')).toBe(false);
  });

  it('counts a keyless provider only once models are actually discovered', () => {
    expect(canRunLive(stubStores({ requiresKey: false, models: [] }), 'anthropic')).toBe(false);
    expect(canRunLive(stubStores({ requiresKey: false, models: [{ id: 'm' }] }), 'anthropic')).toBe(true);
  });
});

describe('shouldMock', () => {
  it('is false without a spec, however keyless the visitor', () => {
    expect(shouldMock(stubStores({ hasKey: false }), 'anthropic', false)).toBe(false);
  });

  it('is true with a spec and no live capability', () => {
    expect(shouldMock(stubStores({ hasKey: false }), 'anthropic', true)).toBe(true);
  });

  it('is false with a spec when a live call is possible', () => {
    expect(shouldMock(stubStores({ hasKey: true, isValid: true }), 'anthropic', true)).toBe(false);
  });

  it('force-mock overrides a usable key', () => {
    const s = stubStores({ hasKey: true, isValid: true });
    expect(shouldMock(s, 'anthropic', true)).toBe(false);
    setForceMock(true);
    expect(isForceMock()).toBe(true);
    expect(shouldMock(s, 'anthropic', true)).toBe(true);
  });
});

describe('runLLM integration', () => {
  it('resolves from the mock spec when the visitor has no key', async () => {
    vi.useFakeTimers();
    const p = runLLM(
      stubStores({ hasKey: false }),
      opts({ mock: { kind: 'text', text: 'from fixture' } })
    );
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.content).toBe('from fixture');
    expect(r.mocked).toBe(true);
    expect(r.usage).toBeUndefined();
  });

  it('prefers replay over mock — real recorded data beats synthetic', async () => {
    activateReplay({
      experiment: 'test',
      recordedAt: 0,
      config: {},
      calls: [
        {
          label: 'x',
          request: req(),
          response: {
            content: 'from recording',
            usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
            latencyMs: 0,
            finishReason: 'stop',
          },
        },
      ],
    });
    vi.useFakeTimers();
    const p = runLLM(
      stubStores({ hasKey: false }),
      opts({ label: 'x', mock: { kind: 'text', text: 'from fixture' } })
    );
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.content).toBe('from recording');
    expect(r.mocked).toBeUndefined();
    // Replay preserves recorded usage; the mock path would have had none.
    expect(r.usage).toEqual({ inputTokens: 1, outputTokens: 2, totalTokens: 3 });
  });
});
