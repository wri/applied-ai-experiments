// Engine-agnostic agentic loop.
//
// The original demo executed tool calls once, after the stream ended, and never
// fed results back to the model — so multi-step requests ("geocode X, then fly
// there") could not work. This loop runs multiple model turns: stream → parse
// tool calls → execute → feed results back → repeat, until the model stops
// calling tools (or a turn cap is hit). It talks only to the ToolEngine
// interface, so it is identical for both the custom bridge and WebMCP.

import type { ToolEngine } from '$lib/mcp/engine';
import { chatStore } from '$lib/stores/chat.svelte';
import { mapStore } from '$lib/stores/map.svelte';

export interface StreamChunk {
  type: 'delta' | 'thinking_delta' | 'done' | 'error' | string;
  content?: string;
  error?: { message: string };
}

export interface ApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type ModelCaller = (
  system: string,
  messages: ApiMessage[]
) => AsyncIterable<StreamChunk>;

function mapStateSuffix(): string {
  const v = mapStore.view;
  const layers = mapStore.managedLayers.map((l) => l.id).join(', ') || 'none';
  return (
    `\n\nCurrent map state:\n` +
    `- Center: [${v.center[0].toFixed(4)}, ${v.center[1].toFixed(4)}]\n` +
    `- Zoom: ${v.zoom.toFixed(2)}\n` +
    `- Bearing: ${v.bearing}°, Pitch: ${v.pitch}°\n` +
    `- Data layers added: ${layers}\n` +
    `- Markers on map: ${mapStore.markerCount}`
  );
}

export interface RunAgentOptions {
  engine: ToolEngine;
  userMessage: string;
  callModel: ModelCaller;
  maxTurns?: number;
}

export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const { engine, userMessage, callModel } = opts;
  const maxTurns = opts.maxTurns ?? 6;

  // Ensure the engine is ready (WebMCP registers its tools here, idempotently)
  const ready = await engine.init();

  chatStore.addUserMessage(userMessage);
  chatStore.isStreaming = true;

  if (!ready.ok) {
    chatStore.addAssistantMessage('', engine.id);
    chatStore.updateLastAssistant({
      content: `Could not start the ${engine.label} engine: ${ready.reason ?? 'unknown error'}`,
      status: 'error',
    });
    chatStore.isStreaming = false;
    return;
  }

  // Model-facing history (visible transcript minus system messages). Synthetic
  // tool-result turns are appended here only — never shown in the UI.
  const apiMessages: ApiMessage[] = chatStore
    .getMessagesForAPI()
    .filter((m) => m.role !== 'system');

  for (let turn = 0; turn < maxTurns; turn++) {
    chatStore.addAssistantMessage('', engine.id);
    const system = await engine.getSystemPrompt(mapStateSuffix());

    let fullContent = '';
    let streamError: string | null = null;

    try {
      for await (const chunk of callModel(system, apiMessages)) {
        if (chunk.type === 'delta' && chunk.content) {
          fullContent += chunk.content;
          chatStore.appendContent(chunk.content);
        } else if (chunk.type === 'error') {
          streamError = chunk.error?.message ?? 'Stream error';
          break;
        } else if (chunk.type === 'done') {
          break;
        }
      }
    } catch (e) {
      streamError = e instanceof Error ? e.message : 'Unknown error';
    }

    if (streamError) {
      chatStore.updateLastAssistant({ content: `Error: ${streamError}`, status: 'error' });
      chatStore.isStreaming = false;
      return;
    }

    const toolCalls = engine.parseToolCalls(fullContent);
    const cleaned = engine.cleanContent(fullContent);

    // Record the raw assistant turn (incl. tool block) for model continuity
    apiMessages.push({ role: 'assistant', content: fullContent });

    // Final turn: no tools → show summary and finish
    if (toolCalls.length === 0) {
      chatStore.updateLastAssistant({ content: cleaned, status: 'complete' });
      chatStore.isStreaming = false;
      return;
    }

    // Show the prose, then run the tool calls under this assistant turn
    chatStore.updateLastAssistant({ content: cleaned, status: 'complete' });
    chatStore.isStreaming = true; // keep input disabled across the loop

    const results: Array<{
      name: string;
      arguments: unknown;
      success: boolean;
      result?: unknown;
      error?: string;
    }> = [];

    for (const tc of toolCalls) {
      const entry = chatStore.addToolCall({
        id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: tc.name,
        arguments: tc.arguments,
      });
      chatStore.updateToolCall(entry.id, { status: 'running' });

      const res = await engine.execute(tc.name, tc.arguments, entry.id);
      if (res.success) {
        chatStore.updateToolCall(entry.id, { status: 'completed', result: res.result });
      } else {
        chatStore.updateToolCall(entry.id, { status: 'error', error: res.error });
      }
      results.push({
        name: tc.name,
        arguments: tc.arguments,
        success: res.success,
        result: res.result,
        error: res.error,
      });
    }

    // Feed tool results back to the model (next turn). Not shown in the UI.
    apiMessages.push({
      role: 'user',
      content:
        'Tool results (JSON). Use these to continue. If the task is complete, reply with a brief summary and no tool block.\n```json\n' +
        JSON.stringify(results) +
        '\n```',
    });
  }

  // Reached the turn cap with tools still firing
  chatStore.addAssistantMessage('', engine.id);
  chatStore.updateLastAssistant({
    content: '(Reached the step limit for one request. Ask me to continue if needed.)',
    status: 'complete',
  });
  chatStore.isStreaming = false;
}
