// A ToolEngine encapsulates everything that differs between the two
// implementations being compared. The agentic loop talks only to this
// interface, so switching engines swaps the registration + dispatch substrate
// without touching the chat/loop logic.

import type { ToolResult } from './types';
import { mcpBridge } from './bridge';
import {
  allToolDefinitions,
  buildSystemPrompt,
  formatToolDefinitions,
  formatToolListItems,
  getToolsSystemPrompt,
} from './tools';
import { parseToolCalls, cleanContent, type ParsedToolCall } from './protocol';
import { ensureWebMCP, webmcpEnumerateTools, webmcpCallTool, type WebMCPStatus } from './webmcp';

export type EngineId = 'bridge' | 'webmcp';

export interface ToolEngine {
  id: EngineId;
  label: string;
  description: string;
  /** Idempotent setup. For WebMCP this loads the polyfill + registers tools. */
  init(): Promise<{ ok: boolean; reason?: string; info?: unknown }>;
  /** Full system prompt, including the dynamic map-state suffix. */
  getSystemPrompt(mapStateSuffix: string): string | Promise<string>;
  parseToolCalls(content: string): ParsedToolCall[];
  cleanContent(content: string): string;
  execute(name: string, args: Record<string, unknown>, id?: string): Promise<ToolResult>;
}

// ---- Engine A: the original hand-rolled bridge --------------------------
export const bridgeEngine: ToolEngine = {
  id: 'bridge',
  label: 'Custom bridge',
  description:
    'Hand-rolled client-side tool registry + dispatcher. The system prompt and dispatch are written by hand; tool calls run directly on the main thread.',
  async init() {
    return { ok: true };
  },
  getSystemPrompt(suffix) {
    return getToolsSystemPrompt() + suffix;
  },
  parseToolCalls,
  cleanContent,
  execute(name, args, id) {
    return mcpBridge.execute(name, args, id);
  },
};

// ---- Engine B: WebMCP via navigator.modelContext ------------------------
let lastWebmcpStatus: WebMCPStatus | null = null;

export const webmcpEngine: ToolEngine = {
  id: 'webmcp',
  label: 'WebMCP',
  description:
    'Tools registered with the browser standard navigator.modelContext (W3C WebMCP) via @mcp-b/webmcp-polyfill. The prompt is built from the registered tool list and calls dispatch through navigator.modelContext.',
  async init() {
    lastWebmcpStatus = await ensureWebMCP();
    return { ok: lastWebmcpStatus.ok, reason: lastWebmcpStatus.reason, info: lastWebmcpStatus };
  },
  async getSystemPrompt(suffix) {
    // Build the prompt from the tools actually registered with
    // navigator.modelContext (via getTools/listTools), demonstrating standard
    // enumeration. Falls back to static defs if no enumeration surface exists.
    const items = await webmcpEnumerateTools();
    const toolText =
      items && items.length
        ? formatToolListItems(items)
        : formatToolDefinitions(allToolDefinitions);
    return buildSystemPrompt(toolText) + suffix;
  },
  parseToolCalls,
  cleanContent,
  async execute(name, args, id = `tool-${Date.now()}`) {
    try {
      const result = await webmcpCallTool(name, args);
      return { id, name, success: true, result };
    } catch (error) {
      return {
        id,
        name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

export function getEngine(id: EngineId): ToolEngine {
  return id === 'webmcp' ? webmcpEngine : bridgeEngine;
}

export function getWebMCPStatus(): WebMCPStatus | null {
  return lastWebmcpStatus;
}
