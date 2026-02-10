// Chat message types
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  status?: 'streaming' | 'complete' | 'error';
  thinking?: string;
}

// Generate unique ID
function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Chat store
class ChatStore {
  messages = $state<ChatMessage[]>([]);
  isStreaming = $state(false);
  currentThinking = $state('');

  // Add a user message
  addUserMessage(content: string): ChatMessage {
    const message: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'complete',
    };
    this.messages = [...this.messages, message];
    return message;
  }

  // Add an assistant message (potentially streaming)
  addAssistantMessage(content: string = ''): ChatMessage {
    const message: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      status: 'streaming',
      toolCalls: [],
    };
    this.messages = [...this.messages, message];
    this.isStreaming = true;
    return message;
  }

  // Update the last assistant message
  updateLastAssistant(updates: Partial<Pick<ChatMessage, 'content' | 'status' | 'thinking' | 'toolCalls'>>) {
    const lastIndex = this.messages.length - 1;
    if (lastIndex < 0 || this.messages[lastIndex].role !== 'assistant') return;

    this.messages = this.messages.map((msg, i) => {
      if (i === lastIndex) {
        return { ...msg, ...updates };
      }
      return msg;
    });

    if (updates.status === 'complete' || updates.status === 'error') {
      this.isStreaming = false;
    }
  }

  // Append content to the last assistant message
  appendContent(content: string) {
    const lastIndex = this.messages.length - 1;
    if (lastIndex < 0 || this.messages[lastIndex].role !== 'assistant') return;

    this.messages = this.messages.map((msg, i) => {
      if (i === lastIndex) {
        return { ...msg, content: msg.content + content };
      }
      return msg;
    });
  }

  // Add a tool call to the last assistant message
  addToolCall(toolCall: Omit<ToolCall, 'status'>): ToolCall {
    const lastIndex = this.messages.length - 1;
    if (lastIndex < 0 || this.messages[lastIndex].role !== 'assistant') {
      throw new Error('No assistant message to add tool call to');
    }

    const tc: ToolCall = { ...toolCall, status: 'pending' };

    this.messages = this.messages.map((msg, i) => {
      if (i === lastIndex) {
        return { ...msg, toolCalls: [...(msg.toolCalls || []), tc] };
      }
      return msg;
    });

    return tc;
  }

  // Update a tool call's result
  updateToolCall(toolCallId: string, updates: Partial<Pick<ToolCall, 'result' | 'error' | 'status'>>) {
    this.messages = this.messages.map((msg) => {
      if (msg.role === 'assistant' && msg.toolCalls) {
        return {
          ...msg,
          toolCalls: msg.toolCalls.map((tc) => {
            if (tc.id === toolCallId) {
              return { ...tc, ...updates };
            }
            return tc;
          }),
        };
      }
      return msg;
    });
  }

  // Add a system message
  addSystemMessage(content: string): ChatMessage {
    const message: ChatMessage = {
      id: generateId(),
      role: 'system',
      content,
      timestamp: new Date(),
      status: 'complete',
    };
    this.messages = [...this.messages, message];
    return message;
  }

  // Clear all messages
  clear() {
    this.messages = [];
    this.isStreaming = false;
    this.currentThinking = '';
  }

  // Get messages for API (format for LLM)
  getMessagesForAPI(): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
    return this.messages
      .filter((m) => m.status === 'complete')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));
  }
}

// Export singleton instance
export const chatStore = new ChatStore();
