import type { ToolDefinition, ToolResult } from './types';
import { allToolDefinitions, invokeTool } from './tools';

// The custom "MCP bridge": a hand-rolled tool registry + dispatcher that runs
// tools directly on the main thread. This is the original implementation the
// WebMCP engine is compared against.

export class MCPBridge {
  private tools: ToolDefinition[] = allToolDefinitions;

  getTools(): ToolDefinition[] {
    return this.tools;
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.find((t) => t.name === name);
  }

  // Execute a tool and wrap the outcome in a ToolResult
  async execute(
    name: string,
    args: Record<string, unknown>,
    id: string = `tool-${Date.now()}`
  ): Promise<ToolResult> {
    try {
      const result = await invokeTool(name, args);
      return { id, name, success: true, result };
    } catch (error) {
      return {
        id,
        name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const mcpBridge = new MCPBridge();
