// =============================================================================
// OpenAI Realtime API Session
// =============================================================================
// Implements the OpenAI Realtime API for voice conversations.
// Docs: https://platform.openai.com/docs/guides/realtime

import { BaseRealtimeSession } from './session';
import type {
  RealtimeSessionConfig,
  RealtimeProviderOptions,
  RealtimeEvent,
} from './types';

// -----------------------------------------------------------------------------
// OpenAI Realtime Message Types
// -----------------------------------------------------------------------------

// Client -> Server events
type OpenAIClientEvent = 
  | { type: 'session.update'; session: OpenAISessionConfig }
  | { type: 'input_audio_buffer.append'; audio: string }
  | { type: 'input_audio_buffer.commit' }
  | { type: 'input_audio_buffer.clear' }
  | { type: 'conversation.item.create'; item: OpenAIConversationItem }
  | { type: 'conversation.item.truncate'; item_id: string; content_index: number; audio_end_ms: number }
  | { type: 'conversation.item.delete'; item_id: string }
  | { type: 'response.create'; response?: Partial<OpenAIResponseConfig> }
  | { type: 'response.cancel' };

// Server -> Client events  
interface OpenAIServerEvent {
  type: string;
  event_id?: string;
  [key: string]: unknown;
}

interface OpenAISessionConfig {
  modalities?: ('text' | 'audio')[];
  instructions?: string;
  voice?: string;
  input_audio_format?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  output_audio_format?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  input_audio_transcription?: { model: string } | null;
  turn_detection?: {
    type: 'server_vad';
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  } | null;
  tools?: Array<{
    type: 'function';
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; name: string };
  temperature?: number;
  max_response_output_tokens?: number | 'inf';
}

interface OpenAIConversationItem {
  type: 'message' | 'function_call' | 'function_call_output';
  role?: 'user' | 'assistant' | 'system';
  content?: Array<{
    type: 'input_text' | 'input_audio' | 'text' | 'audio';
    text?: string;
    audio?: string;
  }>;
  call_id?: string;
  name?: string;
  arguments?: string;
  output?: string;
}

interface OpenAIResponseConfig {
  modalities?: ('text' | 'audio')[];
  instructions?: string;
  voice?: string;
  output_audio_format?: string;
  tools?: Array<unknown>;
  tool_choice?: string;
  temperature?: number;
  max_output_tokens?: number | 'inf';
}

// -----------------------------------------------------------------------------
// OpenAI Provider Options
// -----------------------------------------------------------------------------

export interface OpenAIRealtimeOptions extends RealtimeProviderOptions {
  /** OpenAI API key */
  apiKey?: string;
  
  /** Enable input audio transcription */
  enableTranscription?: boolean;
  
  /** Transcription model (default: whisper-1) */
  transcriptionModel?: string;
}

// -----------------------------------------------------------------------------
// OpenAI Realtime Session
// -----------------------------------------------------------------------------

export class OpenAIRealtimeSession extends BaseRealtimeSession {
  readonly providerId = 'openai';
  
  private openaiOptions: OpenAIRealtimeOptions;
  private responseId: string | null = null;
  
  constructor(
    config: RealtimeSessionConfig,
    options: OpenAIRealtimeOptions = {}
  ) {
    super(config, options);
    this.openaiOptions = {
      enableTranscription: true,
      transcriptionModel: 'whisper-1',
      ...options,
    };
  }
  
  protected getWebSocketUrl(): string {
    const model = this.config.model || 'gpt-4o-realtime-preview-2024-12-17';
    return `wss://api.openai.com/v1/realtime?model=${model}`;
  }
  
  protected getConnectionParams(): { protocols?: string[]; headers?: Record<string, string> } {
    return {
      protocols: [
        'realtime',
        `openai-insecure-api-key.${this.apiKey}`,
        'openai-beta.realtime-v1',
      ],
    };
  }
  
  protected sendInitialConfig(): void {
    const sessionConfig: OpenAISessionConfig = {
      modalities: ['text', 'audio'],
      voice: this.config.voice || 'alloy',
      instructions: this.config.instructions,
      input_audio_format: this.config.inputAudioFormat || 'pcm16',
      output_audio_format: this.config.outputAudioFormat || 'pcm16',
      temperature: this.config.temperature,
      max_response_output_tokens: this.config.maxResponseTokens,
    };
    
    // Turn detection
    if (this.config.turnDetection === null) {
      sessionConfig.turn_detection = null;
    } else if (this.config.vadEnabled !== false) {
      sessionConfig.turn_detection = {
        type: 'server_vad',
        threshold: this.config.vadThreshold ?? 0.5,
        silence_duration_ms: this.config.silenceDurationMs ?? 500,
      };
    }
    
    // Transcription
    if (this.openaiOptions.enableTranscription) {
      sessionConfig.input_audio_transcription = {
        model: this.openaiOptions.transcriptionModel || 'whisper-1',
      };
    }
    
    // Tools
    if (this.config.tools?.length) {
      sessionConfig.tools = this.config.tools.map(tool => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
    }
    
    this.send({
      type: 'session.update',
      session: sessionConfig,
    });
  }
  
  protected handleMessage(data: string): void {
    const event: OpenAIServerEvent = JSON.parse(data);
    
    switch (event.type) {
      case 'session.created':
        this._status.sessionId = event.session?.id as string;
        this.emitter.emit({ 
          type: 'session:connected', 
          sessionId: this._status.sessionId || '' 
        });
        break;
        
      case 'session.updated':
        // Session configuration updated
        break;
        
      case 'input_audio_buffer.speech_started':
        this.emitter.emit({ type: 'audio:input_started' });
        break;
        
      case 'input_audio_buffer.speech_stopped':
        this.emitter.emit({ type: 'audio:input_ended' });
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        this.emitter.emit({
          type: 'transcript:done',
          role: 'user',
          text: event.transcript as string,
        });
        break;
        
      case 'response.created':
        this.responseId = event.response?.id as string;
        this.emitter.emit({ 
          type: 'response:started', 
          responseId: this.responseId 
        });
        break;
        
      case 'response.audio.delta':
        this.emitter.emit({
          type: 'response:audio_delta',
          audio: event.delta as string,
        });
        break;
        
      case 'response.audio.done':
        this.emitter.emit({ type: 'response:audio_done' });
        break;
        
      case 'response.audio_transcript.delta':
        this.emitter.emit({
          type: 'transcript:delta',
          role: 'assistant',
          delta: event.delta as string,
        });
        break;
        
      case 'response.audio_transcript.done':
        this.emitter.emit({
          type: 'transcript:done',
          role: 'assistant',
          text: event.transcript as string,
        });
        break;
        
      case 'response.text.delta':
        this.emitter.emit({
          type: 'response:text_delta',
          delta: event.delta as string,
        });
        break;
        
      case 'response.text.done':
        this.emitter.emit({
          type: 'response:text_done',
          text: event.text as string,
        });
        break;
        
      case 'response.function_call_arguments.done':
        this.emitter.emit({
          type: 'tool:call',
          callId: event.call_id as string,
          name: event.name as string,
          arguments: event.arguments as string,
        });
        break;
        
      case 'response.done':
        const usage = event.response?.usage as Record<string, number> | undefined;
        this.emitter.emit({
          type: 'response:done',
          responseId: this.responseId || '',
          usage: usage ? {
            inputTokens: usage.input_tokens || 0,
            outputTokens: usage.output_tokens || 0,
            totalTokens: usage.total_tokens || 0,
          } : undefined,
        });
        this.responseId = null;
        break;
        
      case 'error':
        this.emitter.emit({
          type: 'session:error',
          error: (event.error as { message: string })?.message || 'Unknown error',
          code: (event.error as { code: string })?.code,
        });
        break;
        
      case 'rate_limits.updated':
        // Rate limit info - could expose this
        break;
    }
  }
  
  protected formatAudioForSend(audio: Int16Array | string): string {
    const base64 = typeof audio === 'string' ? audio : this.int16ToBase64(audio);
    return JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: base64,
    });
  }
  
  sendText(text: string): void {
    if (this._status.state !== 'connected') {
      throw new Error('Not connected');
    }
    
    // Create a user message item
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    
    // Trigger response
    this.send({ type: 'response.create' });
  }
  
  commitAudio(): void {
    if (this._status.state !== 'connected') {
      throw new Error('Not connected');
    }
    
    this.send({ type: 'input_audio_buffer.commit' });
  }
  
  interrupt(): void {
    if (this._status.state !== 'connected') {
      throw new Error('Not connected');
    }
    
    this.send({ type: 'response.cancel' });
    this.emitter.emit({ type: 'interrupted' });
  }
  
  submitToolResult(callId: string, result: string): void {
    if (this._status.state !== 'connected') {
      throw new Error('Not connected');
    }
    
    // Add function output to conversation
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: result,
      },
    });
    
    this.emitter.emit({ type: 'tool:call_done', callId });
    
    // Trigger continuation
    this.send({ type: 'response.create' });
  }
  
  updateConfig(config: Partial<RealtimeSessionConfig>): void {
    if (this._status.state !== 'connected') {
      throw new Error('Not connected');
    }
    
    this.config = { ...this.config, ...config };
    
    const sessionUpdate: Partial<OpenAISessionConfig> = {};
    
    if (config.voice) sessionUpdate.voice = config.voice;
    if (config.instructions) sessionUpdate.instructions = config.instructions;
    if (config.temperature !== undefined) sessionUpdate.temperature = config.temperature;
    if (config.maxResponseTokens !== undefined) {
      sessionUpdate.max_response_output_tokens = config.maxResponseTokens;
    }
    
    if (config.turnDetection === null) {
      sessionUpdate.turn_detection = null;
    } else if (config.vadEnabled !== undefined || config.vadThreshold !== undefined) {
      sessionUpdate.turn_detection = {
        type: 'server_vad',
        threshold: config.vadThreshold ?? this.config.vadThreshold ?? 0.5,
        silence_duration_ms: config.silenceDurationMs ?? this.config.silenceDurationMs ?? 500,
      };
    }
    
    this.send({
      type: 'session.update',
      session: sessionUpdate,
    });
  }
  
  /**
   * Clear the input audio buffer
   */
  clearAudioBuffer(): void {
    if (this._status.state !== 'connected') {
      throw new Error('Not connected');
    }
    
    this.send({ type: 'input_audio_buffer.clear' });
  }
  
  /**
   * Manually trigger a response (useful with turn_detection: null)
   */
  createResponse(config?: Partial<OpenAIResponseConfig>): void {
    if (this._status.state !== 'connected') {
      throw new Error('Not connected');
    }
    
    this.send({ 
      type: 'response.create',
      response: config,
    });
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function openaiRealtime(
  config: RealtimeSessionConfig,
  options?: OpenAIRealtimeOptions
): OpenAIRealtimeSession {
  return new OpenAIRealtimeSession(config, options);
}
