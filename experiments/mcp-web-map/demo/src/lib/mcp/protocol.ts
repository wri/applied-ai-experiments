// Shared model-facing tool-call protocol.
//
// Both engines (custom bridge and WebMCP) keep the IDENTICAL wire format the
// model emits — a fenced ```tool block of JSON — so the only thing that varies
// between engines is how tools are registered and dispatched, not how the model
// is prompted or how it replies. That keeps the A/B comparison honest.

export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

const TOOL_BLOCK_RE = /```tool\s*([\s\S]*?)```/g;

// Extract tool calls from an LLM response.
export function parseToolCalls(content: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  let match: RegExpExecArray | null;
  TOOL_BLOCK_RE.lastIndex = 0;
  while ((match = TOOL_BLOCK_RE.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed.name === 'string') {
        calls.push({ name: parsed.name, arguments: parsed.arguments ?? {} });
      }
    } catch (e) {
      console.warn('Failed to parse tool call:', match[1], e);
    }
  }
  return calls;
}

// Strip tool blocks from content for display.
export function cleanContent(content: string): string {
  return content.replace(/```tool\s*[\s\S]*?```/g, '').trim();
}
