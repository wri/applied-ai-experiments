import type { ToolDefinition, ToolResult } from './types';
import { allToolDefinitions, executeTool } from './tools';
import { mapStore } from '../stores/map.svelte';

// Tool execution interface for the main thread
// This is a simplified "bridge" that runs tools directly (no web worker needed for this use case)

export class MCPBridge {
  private tools: ToolDefinition[] = allToolDefinitions;

  // Get all available tools
  getTools(): ToolDefinition[] {
    return this.tools;
  }

  // Get a specific tool definition
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.find((t) => t.name === name);
  }

  // Execute a tool
  async execute(
    name: string,
    args: Record<string, unknown>,
    id: string = `tool-${Date.now()}`
  ): Promise<ToolResult> {
    const tool = this.getTool(name);

    if (!tool) {
      return {
        id,
        name,
        success: false,
        error: `Unknown tool: ${name}`,
      };
    }

    try {
      // Wait for map to be ready before any tool execution
      await mapStore.waitForReady();

      // Validate required parameters
      const required = tool.parameters.required || [];
      for (const param of required) {
        if (args[param] === undefined) {
          return {
            id,
            name,
            success: false,
            error: `Missing required parameter: ${param}`,
          };
        }
      }

      // Execute the tool
      const result = await executeTool(name, args);

      return {
        id,
        name,
        success: true,
        result,
      };
    } catch (error) {
      return {
        id,
        name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Parse tool calls from LLM response
  parseToolCalls(content: string): Array<{ name: string; arguments: Record<string, unknown> }> {
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    // Match ```tool ... ``` blocks
    const toolBlockRegex = /```tool\s*([\s\S]*?)```/g;
    let match;

    while ((match = toolBlockRegex.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed.name && typeof parsed.name === 'string') {
          toolCalls.push({
            name: parsed.name,
            arguments: parsed.arguments || {},
          });
        }
      } catch (e) {
        console.warn('Failed to parse tool call:', match[1], e);
      }
    }

    return toolCalls;
  }

  // Remove tool call blocks from content for display
  cleanContent(content: string): string {
    return content.replace(/```tool\s*[\s\S]*?```/g, '').trim();
  }
}

// Export singleton instance
export const mcpBridge = new MCPBridge();
