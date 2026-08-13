// WebMCP engine backing — registers the shared tools with the browser's
// `navigator.modelContext` (W3C WebMCP) via the @mcp-b/webmcp-polyfill, then
// enumerates and dispatches them THROUGH that standard surface.
//
// Rough edges this exercises (documented in the brief):
//   - The strict W3C core only specifies registerTool + (preview) getTools/
//     executeTool. Page-side enumeration + invoke-by-name (listTools/callTool)
//     are MCP-B *extensions*, not standard. We prefer the standard surface and
//     fall back gracefully.
//   - The standard assumes a browser-native agent consumes the tools; here our
//     own in-page chat is the consumer, which is off the happy path.

import { allToolDefinitions, invokeTool } from './tools';

interface WebMCPContentItem {
  type: string;
  text?: string;
}
interface WebMCPToolResponse {
  content?: WebMCPContentItem[];
  isError?: boolean;
}
interface WebMCPToolDescriptor {
  name: string;
  description: string;
  inputSchema?: unknown;
  annotations?: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<WebMCPToolResponse>;
}
interface WebMCPToolInfo {
  name: string;
  description: string;
  inputSchema?: unknown;
}
interface WebMCPModelContext {
  registerTool(tool: WebMCPToolDescriptor, options?: { signal?: AbortSignal }): void;
  // MCP-B extensions (non-standard but provided by the polyfill runtime):
  listTools?(): WebMCPToolInfo[];
  callTool?(params: { name: string; arguments?: Record<string, unknown> }): Promise<WebMCPToolResponse>;
  // W3C producer-preview surface:
  getTools?(): Promise<Array<WebMCPToolInfo & { inputSchema?: string }>>;
  executeTool?(tool: unknown, inputArgsJson: string, options?: unknown): Promise<string | null>;
}

export interface WebMCPStatus {
  ok: boolean;
  reason?: string;
  registeredCount: number;
  enumeration: 'listTools' | 'getTools' | 'static-fallback' | 'none';
  dispatch: 'callTool' | 'executeTool' | 'direct-fallback' | 'none';
}

let initialized = false;
const abortController = typeof AbortController !== 'undefined' ? new AbortController() : undefined;

// Registration must track navigator.modelContext's lifetime, not this module's.
// navigator.modelContext is a global singleton that persists across HMR reloads
// (and the strict polyfill THROWS on duplicate tool names), so a module-local
// flag would reset on HMR and double-register. A window-scoped flag matches the
// real lifetime; on a full page reload, both reset together.
function windowFlags(): Record<string, unknown> | null {
  return typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null;
}
function isRegistered(): boolean {
  return !!windowFlags()?.__mcpWebmcpRegistered;
}
function markRegistered(): void {
  const w = windowFlags();
  if (w) w.__mcpWebmcpRegistered = true;
}

function getModelContext(): WebMCPModelContext | null {
  if (typeof navigator === 'undefined') return null;
  const mc = (navigator as unknown as { modelContext?: WebMCPModelContext }).modelContext;
  return mc ?? null;
}

// Idempotently load the polyfill and register every shared tool.
export async function ensureWebMCP(): Promise<WebMCPStatus> {
  const base: WebMCPStatus = {
    ok: false,
    registeredCount: 0,
    enumeration: 'none',
    dispatch: 'none',
  };

  if (typeof navigator === 'undefined') {
    return { ...base, reason: 'navigator unavailable (server-side)' };
  }

  if (!initialized) {
    try {
      const mod = await import('@mcp-b/webmcp-polyfill');
      mod.initializeWebMCPPolyfill();
      initialized = true;
    } catch (e) {
      return { ...base, reason: `Failed to load WebMCP polyfill: ${(e as Error).message}` };
    }
  }

  const mc = getModelContext();
  if (!mc) return { ...base, reason: 'navigator.modelContext is unavailable after init' };

  if (!isRegistered()) {
    for (const def of allToolDefinitions) {
      try {
        mc.registerTool(
          {
            name: def.name,
            description: def.description,
            inputSchema: def.parameters,
            annotations: { title: def.name },
            async execute(args: Record<string, unknown>): Promise<WebMCPToolResponse> {
              try {
                const result = await invokeTool(def.name, args ?? {});
                return { content: [{ type: 'text', text: JSON.stringify(result) }] };
              } catch (err) {
                return {
                  content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
                  isError: true,
                };
              }
            },
          },
          abortController ? { signal: abortController.signal } : undefined
        );
      } catch (err) {
        // The strict polyfill throws on duplicate names; ignore that and surface anything else.
        if (!(err instanceof Error) || !/already registered/i.test(err.message)) throw err;
      }
    }
    markRegistered();
  }

  return {
    ok: true,
    registeredCount: allToolDefinitions.length,
    enumeration: typeof mc.listTools === 'function'
      ? 'listTools'
      : typeof mc.getTools === 'function'
        ? 'getTools'
        : 'static-fallback',
    dispatch: typeof mc.callTool === 'function'
      ? 'callTool'
      : typeof mc.executeTool === 'function'
        ? 'executeTool'
        : 'direct-fallback',
  };
}

// Enumerate registered tools from navigator.modelContext (page-side), preferring
// the MCP-B sync extension `listTools()` and falling back to the W3C preview
// async `getTools()`. Returns null when no enumeration surface exists — then
// callers fall back to the static tool definitions (a documented rough edge:
// the strict standard offers no synchronous page-side enumeration).
export async function webmcpEnumerateTools(): Promise<WebMCPToolInfo[] | null> {
  const mc = getModelContext();
  if (!mc) return null;
  if (typeof mc.listTools === 'function') {
    try {
      return mc.listTools();
    } catch {
      /* fall through */
    }
  }
  if (typeof mc.getTools === 'function') {
    try {
      return await mc.getTools();
    } catch {
      /* fall through */
    }
  }
  return null;
}

// Dispatch a tool call through navigator.modelContext. Returns the parsed JSON
// result (or throws with the tool's error message).
export async function webmcpCallTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const mc = getModelContext();
  if (!mc) throw new Error('navigator.modelContext unavailable');

  let response: WebMCPToolResponse | null = null;

  if (typeof mc.callTool === 'function') {
    response = await mc.callTool({ name, arguments: args });
  } else if (typeof mc.getTools === 'function' && typeof mc.executeTool === 'function') {
    // W3C producer-preview path: find the tool info, then execute by passing it back
    const tools = await mc.getTools();
    const info = tools.find((t) => t.name === name);
    if (!info) throw new Error(`Tool "${name}" is not registered`);
    const raw = await mc.executeTool(info, JSON.stringify(args));
    response = raw ? (JSON.parse(raw) as WebMCPToolResponse) : { content: [] };
  } else {
    // Last resort: run the shared invocation directly (no standard surface)
    return invokeTool(name, args);
  }

  const text = (response?.content ?? [])
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('');

  let parsed: unknown = text;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      /* leave as raw string */
    }
  }

  if (response?.isError) {
    const message = typeof parsed === 'string' ? parsed : (parsed as { message?: string })?.message;
    throw new Error(message || 'Tool execution failed');
  }
  return parsed;
}
