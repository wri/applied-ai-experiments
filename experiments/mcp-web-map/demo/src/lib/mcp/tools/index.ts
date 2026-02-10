import type { ToolDefinition, ToolEntry, ToolHandler } from '../types';
import { navigationTools } from './navigation';
import { layerTools } from './layers';
import { uiTools } from './ui';

// Combine all tool definitions
export const allToolDefinitions: ToolDefinition[] = [
  ...navigationTools.map((t) => t.definition),
  ...layerTools.map((t) => t.definition),
  ...uiTools.map((t) => t.definition),
];

// Create a map of tool handlers
const toolEntries: ToolEntry[] = [
  ...navigationTools,
  ...layerTools,
  ...uiTools,
];

export const toolHandlers: Map<string, ToolHandler> = new Map(
  toolEntries.map((entry) => [entry.definition.name, entry.handler])
);

// Get tool by name
export function getTool(name: string): ToolEntry | undefined {
  return toolEntries.find((t) => t.definition.name === name);
}

// Execute a tool
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

// Format tools for system prompt
export function getToolsSystemPrompt(): string {
  const toolDescriptions = allToolDefinitions
    .map((tool) => {
      const params = Object.entries(tool.parameters.properties)
        .map(([name, schema]) => {
          const required = tool.parameters.required?.includes(name) ? ' (required)' : '';
          return `    - ${name}: ${schema.description || schema.type}${required}`;
        })
        .join('\n');

      return `- ${tool.name}: ${tool.description}\n  Parameters:\n${params}`;
    })
    .join('\n\n');

  return `You are a helpful AI assistant that can control a web map. You have access to the following tools:

${toolDescriptions}

When the user asks you to perform map actions, use the appropriate tool. Always explain what you're doing and confirm when actions are complete.

To use a tool, respond with a JSON object in this format:
\`\`\`tool
{
  "name": "tool_name",
  "arguments": { ... }
}
\`\`\`

You can include multiple tool calls in a single response. After each tool call, continue with your response.`;
}
