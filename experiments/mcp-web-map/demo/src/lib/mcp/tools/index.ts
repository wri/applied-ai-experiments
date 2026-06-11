import type { ToolDefinition, ToolEntry, ToolHandler } from '../types';
import { mapStore } from '../../stores/map.svelte';
import { navigationTools } from './navigation';
import { layerTools } from './layers';
import { uiTools } from './ui';
import { dataTools } from './data';
import { geoTools } from './geo';

// Combine all tool definitions
export const allToolDefinitions: ToolDefinition[] = [
  ...navigationTools.map((t) => t.definition),
  ...layerTools.map((t) => t.definition),
  ...uiTools.map((t) => t.definition),
  ...dataTools.map((t) => t.definition),
  ...geoTools.map((t) => t.definition),
];

// Create a map of tool handlers
const toolEntries: ToolEntry[] = [
  ...navigationTools,
  ...layerTools,
  ...uiTools,
  ...dataTools,
  ...geoTools,
];

export const toolHandlers: Map<string, ToolHandler> = new Map(
  toolEntries.map((entry) => [entry.definition.name, entry.handler])
);

// Get tool by name
export function getTool(name: string): ToolEntry | undefined {
  return toolEntries.find((t) => t.definition.name === name);
}

// Execute a tool handler (no validation / readiness checks)
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const handler = toolHandlers.get(name);
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return handler(args);
}

// Shared invocation path used by BOTH engines: wait for the map, validate
// required params, then run the handler. Throws on any failure.
export async function invokeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const tool = getTool(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  // Tools assume the map is ready before they run
  await mapStore.waitForReady();

  const required = tool.definition.parameters.required ?? [];
  for (const param of required) {
    if (args[param] === undefined) {
      throw new Error(`Missing required parameter: ${param}`);
    }
  }

  return tool.handler(args);
}

// Render one tool's name/description/params as a prompt fragment
function formatTool(name: string, description: string, params: string): string {
  return params
    ? `- ${name}: ${description}\n  Parameters:\n${params}`
    : `- ${name}: ${description}`;
}

// Format static ToolDefinitions (used by the custom-bridge engine)
export function formatToolDefinitions(defs: ToolDefinition[]): string {
  return defs
    .map((tool) => {
      const params = Object.entries(tool.parameters.properties)
        .map(([name, schema]) => {
          const required = tool.parameters.required?.includes(name) ? ' (required)' : '';
          return `    - ${name}: ${schema.description || schema.type}${required}`;
        })
        .join('\n');
      return formatTool(tool.name, tool.description, params);
    })
    .join('\n\n');
}

// Format tools discovered at runtime from navigator.modelContext.listTools()
// (used by the WebMCP engine). inputSchema may be an object or a JSON string.
export function formatToolListItems(
  items: Array<{ name: string; description: string; inputSchema?: unknown }>
): string {
  return items
    .map((item) => {
      let props: Record<string, { type?: string; description?: string }> = {};
      let required: string[] = [];
      try {
        const schema =
          typeof item.inputSchema === 'string'
            ? JSON.parse(item.inputSchema)
            : item.inputSchema;
        props = schema?.properties ?? {};
        required = schema?.required ?? [];
      } catch {
        /* leave empty if the schema can't be parsed */
      }
      const params = Object.entries(props)
        .map(([name, schema]) => {
          const req = required.includes(name) ? ' (required)' : '';
          return `    - ${name}: ${schema?.description || schema?.type || ''}${req}`;
        })
        .join('\n');
      return formatTool(item.name, item.description, params);
    })
    .join('\n\n');
}

// Wrap a formatted tool list into the full system prompt (shared by engines)
export function buildSystemPrompt(toolDescriptions: string): string {
  return `You are a helpful AI assistant that can control a web map (MapLibre GL JS) and work with geospatial data. You have access to the following tools:

${toolDescriptions}

Guidelines:
- When the user asks you to do something with the map or data, use the appropriate tools.
- Some tools return data (e.g. search_place returns coordinates; measure returns distances). Read those results and chain follow-up tool calls as needed — for example, geocode a place with search_place, then fly_to its coordinates.
- When the task is fully complete, reply with a short natural-language summary and DO NOT include any tool block.

To use a tool, include a fenced \`tool\` block with JSON:
\`\`\`tool
{ "name": "tool_name", "arguments": { } }
\`\`\`
You can include multiple tool blocks in one response. After tools run, their results are sent back to you so you can continue.`;
}

// Back-compat: full system prompt for the static tool registry
export function getToolsSystemPrompt(): string {
  return buildSystemPrompt(formatToolDefinitions(allToolDefinitions));
}
