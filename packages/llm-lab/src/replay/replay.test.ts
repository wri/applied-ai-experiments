import { describe, it, expect, afterEach, vi } from 'vitest';
import type { BYOKStores } from '@byo-keys/svelte';
import type { InspectableRequest, RunRecord } from '../types';
import {
  activateReplay,
  deactivateReplay,
  resetReplayCursor,
  isReplayActive,
  replayRun,
  type ReplayCall,
  type ReplaySession,
} from './replay.svelte';
import { recordToReplaySession } from './record';
import { runLLM, type RunLLMOptions } from '../run/run-llm';

function req(label: string): InspectableRequest {
  return {
    providerId: 'anthropic',
    model: 'claude-opus-4-8',
    messages: [{ role: 'user', content: 'x' }],
    params: {},
    label,
    sentAt: 0,
  };
}

function call(label: string, content: string): ReplayCall {
  return {
    label,
    request: req(label),
    response: {
      content,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      latencyMs: 0,
      finishReason: 'stop',
    },
  };
}

function session(calls: ReplayCall[]): ReplaySession {
  return { experiment: 'test', recordedAt: 0, config: {}, calls };
}

function opts(label: string, overrides: Partial<RunLLMOptions> = {}): RunLLMOptions {
  return {
    providerId: 'anthropic',
    model: 'claude-opus-4-8',
    messages: [{ role: 'user', content: 'x' }],
    label,
    telemetry: false,
    ...overrides,
  };
}

// Replay is a module singleton — reset between tests so state doesn't leak.
afterEach(() => {
  deactivateReplay();
  vi.useRealTimers();
});

describe('replay matcher', () => {
  it('matches by label regardless of call order, then exhausts', async () => {
    activateReplay(session([call('a', 'AAA'), call('b', 'BBB'), call('c', 'CCC')]));
    vi.useFakeTimers();

    const p1 = replayRun(req('b'), opts('b'));
    await vi.runAllTimersAsync();
    expect((await p1).content).toBe('BBB');

    const p2 = replayRun(req('a'), opts('a'));
    await vi.runAllTimersAsync();
    expect((await p2).content).toBe('AAA');

    // 'a' already consumed → no label match, falls back to the last unconsumed ('c').
    const p3 = replayRun(req('a'), opts('a'));
    await vi.runAllTimersAsync();
    expect((await p3).content).toBe('CCC');

    // Recording exhausted → error result.
    const p4 = replayRun(req('a'), opts('a'));
    await vi.runAllTimersAsync();
    const r4 = await p4;
    expect(r4.error).toMatch(/No recorded response/);
    expect(r4.content).toBe('');
  });

  it('consumes in sequence for unlabeled calls', async () => {
    const unlabeled = (content: string): ReplayCall => ({
      request: { ...req(''), label: undefined },
      response: { content, usage: undefined, latencyMs: 0, finishReason: 'stop' },
    });
    activateReplay(session([unlabeled('one'), unlabeled('two')]));
    vi.useFakeTimers();

    const p1 = replayRun(req(''), opts('', { label: undefined }));
    await vi.runAllTimersAsync();
    expect((await p1).content).toBe('one');

    const p2 = replayRun(req(''), opts('', { label: undefined }));
    await vi.runAllTimersAsync();
    expect((await p2).content).toBe('two');
  });

  it('resetReplayCursor replays the same session again', async () => {
    activateReplay(session([call('a', 'AAA')]));
    vi.useFakeTimers();

    const p1 = replayRun(req('a'), opts('a'));
    await vi.runAllTimersAsync();
    expect((await p1).content).toBe('AAA');

    resetReplayCursor();
    const p2 = replayRun(req('a'), opts('a'));
    await vi.runAllTimersAsync();
    expect((await p2).content).toBe('AAA');
  });
});

describe('replayRun playback', () => {
  it('drives onDelta to the full content and preserves recorded usage', async () => {
    const c = call('a', 'hello world this is a recorded response');
    c.response.usage = { inputTokens: 42, outputTokens: 7, totalTokens: 49 };
    c.response.latencyMs = 1234;
    activateReplay(session([c]));
    vi.useFakeTimers();

    let last = '';
    const deltas: string[] = [];
    const p = replayRun(
      req('a'),
      opts('a', {
        onDelta: (delta, full) => {
          deltas.push(delta);
          last = full;
        },
      })
    );
    await vi.runAllTimersAsync();
    const result = await p;

    expect(deltas.length).toBeGreaterThan(0);
    expect(last).toBe(c.response.content);
    expect(result.content).toBe(c.response.content);
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 7, totalTokens: 49 });
    expect(result.latencyMs).toBe(1234); // recorded latency, not playback wall-clock
    expect(result.finishReason).toBe('stop');
  });

  it('stops mid-playback when the signal aborts', async () => {
    activateReplay(session([call('a', 'x'.repeat(120))])); // ~4 chunks
    vi.useFakeTimers();

    const controller = new AbortController();
    let deltaCount = 0;
    const p = replayRun(
      req('a'),
      opts('a', {
        signal: controller.signal,
        onDelta: () => {
          deltaCount++;
          if (deltaCount === 1) controller.abort();
        },
      })
    );
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result.aborted).toBe(true);
    expect(result.error).toBe('Cancelled');
    expect(deltaCount).toBe(1); // stopped after the first chunk
    expect(result.content.length).toBeLessThan(120);
  });
});

describe('runLLM replay path', () => {
  it('resolves from the recording without touching stores.chatStream', async () => {
    const stores = {
      chatStream: () => {
        throw new Error('network must not be called in replay mode');
      },
    } as unknown as BYOKStores;

    activateReplay(session([call('only', 'recorded output')]));
    expect(isReplayActive()).toBe(true);
    vi.useFakeTimers();

    const p = runLLM(stores, opts('only'));
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result.content).toBe('recorded output');
    expect(result.error).toBeUndefined();
  });
});

describe('recordToReplaySession secret scrubbing', () => {
  it('redacts key-shaped values in messages, errors, and config; drops credential-named props', () => {
    const record: RunRecord = {
      id: 'rec-1',
      experiment: 'prompt-comparator',
      createdAt: 0,
      label: 'with secrets',
      config: {
        // Fake, and the point of the test: the scrubber must drop it.
        apiKey: 'sk-ant-api03-SHOULD-BE-DROPPED-BY-NAME-0123456789', // pragma: allowlist secret
        prompt: 'paste your key sk-proj-ABCDEFGHIJKLMNOPQRSTUVWX here',
      },
      requests: [
        {
          providerId: 'anthropic',
          model: 'claude-opus-4-8',
          messages: [
            { role: 'user', content: 'my key is sk-ant-api03-0123456789ABCDEFGHIJKLMNOP' },
          ],
          params: {},
          label: 'extract',
          sentAt: 0,
        },
      ],
      responses: [
        {
          content: 'leaked AIzaSyD0123456789abcdefghijklmnopqrstuvwxyz in output',
          error: 'auth failed: sk-ant-api03-ZZZZZZZZZZZZZZZZZZZZZZZZZ',
          latencyMs: 10,
          finishReason: 'stop',
        },
      ],
    };

    const { session: scrubbed, redactions } = recordToReplaySession(record, { title: 't' });

    expect(redactions).toBeGreaterThanOrEqual(4); // message + content + error + config.prompt
    const serialized = JSON.stringify(scrubbed);
    expect(serialized).not.toContain('sk-ant-');
    expect(serialized).not.toContain('sk-proj-');
    expect(serialized).not.toContain('AIza');
    expect(serialized).toContain('[redacted]');
    // Credential-named property removed entirely by stripSecrets.
    expect((scrubbed.config as Record<string, unknown>).apiKey).toBeUndefined();
    // Non-credential structure preserved.
    expect(scrubbed.calls).toHaveLength(1);
    expect(scrubbed.calls[0].label).toBe('extract');
  });
});
