// Tool definition with JSON Schema
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      items?: { type: string };
      enum?: string[];
      minimum?: number;
      maximum?: number;
      default?: unknown;
    }>;
    required?: string[];
  };
}

// Tool execution request
export interface ToolRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// Tool execution result
export interface ToolResult {
  id: string;
  name: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

// Messages between main thread and worker
export type WorkerMessage =
  | { type: 'init' }
  | { type: 'get_tools' }
  | { type: 'execute'; request: ToolRequest }
  | { type: 'update_state'; state: WorkerMapState };

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'tools'; tools: ToolDefinition[] }
  | { type: 'result'; result: ToolResult }
  | { type: 'error'; error: string };

// Map state passed to worker for context
export interface WorkerMapState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  layers: Array<{
    id: string;
    type: string;
    visible: boolean;
  }>;
}

// Tool handler function type (used in main thread)
export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

// Tool registry entry
export interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}
