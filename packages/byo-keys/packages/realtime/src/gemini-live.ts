// =============================================================================
// Google Gemini Live API Session
// =============================================================================
// Implements the Gemini Live API for real-time multimodal conversations.
// Docs: https://ai.google.dev/api/multimodal-live

import { BaseRealtimeSession } from './session';
import type {
  RealtimeSessionConfig,
  RealtimeProviderOptions,
} from './types';

// -----------------------------------------------------------------------------
// Gemini Live Message Types
// -----------------------------------------------------------------------------

interface GeminiClientMessage {
  setup?: GeminiSetupMessage;
  clientContent?: GeminiClientContent;
  realtimeInput?: GeminiRealtimeInput;
  toolResponse?: GeminiToolResponse;
}

interface GeminiSetupMessage {
  model: string;
  generationConfig?: {
    responseModalities?: ('TEXT' | 'AUDIO')[];
    speechConfig?: {
      voiceConfig?: {
        prebuiltVoiceConfig?: {
          voiceName: string;
        };
      };
    };
    temperature?: number;
    maxOutputTokens?: number;
  };
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  tools?: Array<{
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>;
  }>;
}

interface GeminiClientContent {
  turns: Array<{
    role: 'user' | 'model';
    parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    >;
  }>;
  turnComplete: boolean;
}

interface GeminiRealtimeInput {
  mediaChunks: Array<{
    mimeType: string;
    data: string;
  }>;
}

interface GeminiToolResponse {
  functionResponses: Array<{
    id: string;
    name: string;
    response: { result: unknown };
  }>;
}

interface GeminiServerMessage {
  setupComplete?: Record<string, never>;
  serverContent?: {
    modelTurn?: {
      parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
        | { functionCall: { id: string; name: string; args: Record<string, unknown> } }
      >;
    };
    turnComplete?: boolean;
    interrupted?: boolean;
  };
  toolCall?: {
    functionCalls: Array<{
      id: string;
      name: string;
      args: Record<string, unknown>;
    }>;
  };
  toolCallCancellation?: {
    ids: string[];
  };
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// -----------------------------------------------------------------------------
// Gemini Provider Options
// -----------------------------------------------------------------------------

export interface GeminiRealtimeOptions extends RealtimeProviderOptions {
  /** Google AI API key */
  apiKey?: string;
  
  /** API version */
  apiVersion?: string;
}

// -----------------------------------------------------------------------------
// Gemini Voice Names
// -----------------------------------------------------------------------------

export const GEMINI_VOICES = [
  'Puck',
  'Charon', 
  'Kore',
  'Fenrir',
  'Aoede',
] as const;

export type GeminiVoice = typeof GEMINI_VOICES[number];

// -----------------------------------------------------------------------------
// Gemini Live Session
// -----------------------------------------------------------------------------

export class GeminiLiveSession extends BaseRealtimeSession {
  readonly providerId = 'gemini';
  
  private geminiOptions: GeminiRealtimeOptions;
  private responseBuffer: string[] = [];
  private currentFunctionCalls: Map<string, { name: string; args: Record<string, unknown> }> = new Map();
  
  constructor(
    config: RealtimeSessionConfig,
    options: GeminiRealtimeOptions = {}
  ) {
    super(config, options);
    this.geminiOptions = {
      apiVersion: 'v1alpha',
      ...options,
    };
  }
  
  protected getWebSocketUrl(): string {
    const apiVersion = this.geminiOptions.apiVersion || 'v1alpha';
    const model = this.config.model || 'gemini-2.0-flash-exp';
    return `wss://generativelanguage.googleapis.com/${apiVersion}/models/${model}:streamGenerateContent?key=${this.apiKey}`;
  }
  
  protected getConnectionParams(): { protocols?: string[]; headers?: Record<string, string> } {
    return {}; // Gemini uses API key in URL
  }
  
  protected sendInitialConfig(): void {
    const setup: GeminiSetupMessage = {
      model: `models/${this.config.model || 'gemini-2.0-flash-exp'}`,
      generationConfig: {
        responseModalities: ['TEXT', 'AUDIO'],
        temperature: this.config.temperature,
        maxOutputTokens: typeof this.config.maxResponseTokens === 'number' 
          ? this.config.maxResponseTokens 
          : undefined,
      },
    };
    
    // Voice configuration
    if (this.config.voice) {
      setup.generationConfig!.speechConfig = {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.config.voice,
          },
        },
      };
    }
    
    // System instruction
    if (this.config.instructions) {
      setup.systemInstruction = {
        parts: [{ text: this.config.instructions }],
      };
    }
    
    // Tools
    if (this.config.tools?.length) {
      setup.tools = [{
        functionDeclarations: this.config.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      }];
    }
    
    this.send({ setup });
  }
  
  protected handleMessage(data: string): void {
    const message: GeminiServerMessage = JSON.parse(data);
    
    // Setup complete
    if (message.setupComplete !== undefined) {
      this._status.sessionId = crypto.randomUUID();
      this.emitter.emit({ 
        type: 'session:connected', 
        sessionId: this._status.sessionId 
      });
      return;
    }
    
    // Server content (model responses)
    if (message.serverContent) {
      const content = message.serverContent;
      
      if (content.interrupted) {
        this.emitter.emit({ type: 'interrupted' });
        return;
      }
      
      if (content.modelTurn?.parts) {
        for (const part of content.modelTurn.parts) {
          if ('text' in part) {
            this.emitter.emit({
              type: 'response:text_delta',
              delta: part.text,
            });
            this.responseBuffer.push(part.text);
          }
          
          if ('inlineData' in part && part.inlineData.mimeType.startsWith('audio/')) {
            this.emitter.emit({
              type: 'response:audio_delta',
              audio: part.inlineData.data,
            });
          }
          
          if ('functionCall' in part) {
            this.currentFunctionCalls.set(part.functionCall.id, {
              name: part.functionCall.name,
              args: part.functionCall.args,
            });
            this.emitter.emit({
              type: 'tool:call',
              callId: part.functionCall.id,
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args),
            });
          }
        }
      }
      
      if (content.turnComplete) {
        if (this.responseBuffer.length > 0) {
          this.emitter.emit({
            type: 'response:text_done',
            text: this.responseBuffer.join(''),
          });
          this.responseBuffer = [];
        }
        
        this.emitter.emit({
          type: 'response:done',
          responseId: crypto.randomUUID(),
        });
      }
    }
    
    // Tool calls
    if (message.toolCall) {
      for (const call of message.toolCall.functionCalls) {
        this.currentFunctionCalls.set(call.id, {
          name: call.name,
          args: call.args,
        });
        this.emitter.emit({
          type: 'tool:call',
          callId: call.id,
          name: call.name,
          arguments: JSON.stringify(call.args),
        });
      }
    }
    
    // Tool call cancellation
    if (message.toolCallCancellation) {
      for (const id of message.toolCallCancellation.ids) {
        this.currentFunctionCalls.delete(id);
      }
    }
    
    // Usage metadata
    if (message.usageMetadata) {
      this.emitter.emit({
        type: 'response:done',
        responseId: '',
        usage: {
          inputTokens: message.usageMetadata.promptTokenCount,
          outputTokens: message.usageMetadata.candidatesTokenCount,
          totalTokens: message.usageMetadata.totalTokenCount,
        },
      });
    }
  }
  
  protected formatAudioForSend(audio: Int16Array | string): string {
    const base64 = typeof audio === 'string' ? audio : this.int16ToBase64(audio);
    
    return JSON.stringify({
      realtimeInput: {
        mediaChunks: [{
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        }],
      },
    } as GeminiClientMessage);
  }
  
  sendText(text: string): void {
    if (this._status.state !== 'connected') {
      throw new Error('Not connected');
    }
    
    this.send({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text }],
        }],
        turnComplete: true,
      },
    } as GeminiClientMessage);
  }
  
  /**
   * Send an image for vision analysis
   */
  sendImage(base64Data: string, mimeType: string = 'image/jpeg'): void {
    if (this._status.state !== 'connected') {
      throw new Error('Not connected');
    }
    
    this.send({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{
            inlineData: {
              mimeType,
              data: base64Data,
            },
          }],
        }],
        turnComplete: true,
      },
    } as GeminiClientMessage);
  }
  
  /**
   * Send text and image together
   */
  sendTextAndImage(text: string, imageBase64: string, imageMimeType: string = 'image/jpeg'): void {
    if (this._status.state !== 'connected') {
      throw new Error('Not connected');
    }
    
    this.send({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [
            { text },
            {
              inlineData: {
                mimeType: imageMimeType,
                data: imageBase64,
              },
            },
          ],
        }],
        turnComplete: true,
      },
    } as GeminiClientMessage);
  }
  
  commitAudio(): void {
    // Gemini doesn't require explicit commit - turn detection is automatic
    // But we can send an empty turn to signal completion
    if (this._status.state !== 'connected') {
      throw new Error('Not connected');
    }
    
    this.send({
      clientContent: {
        turns: [],
        turnComplete: true,
      },
    } as GeminiClientMessage);
  }
  
  interrupt(): void {
    // Gemini handles interruption via new audio input
    // Send an empty message to signal interruption intent
    this.emitter.emit({ type: 'interrupted' });
  }
  
  submitToolResult(callId: string, result: string): void {
    if (this._status.state !== 'connected') {
      throw new Error('Not connected');
    }
    
    const call = this.currentFunctionCalls.get(callId);
    if (!call) {
      throw new Error(`Unknown function call: ${callId}`);
    }
    
    let parsedResult: unknown;
    try {
      parsedResult = JSON.parse(result);
    } catch {
      parsedResult = { result };
    }
    
    this.send({
      toolResponse: {
        functionResponses: [{
          id: callId,
          name: call.name,
          response: { result: parsedResult },
        }],
      },
    } as GeminiClientMessage);
    
    this.currentFunctionCalls.delete(callId);
    this.emitter.emit({ type: 'tool:call_done', callId });
  }
  
  updateConfig(config: Partial<RealtimeSessionConfig>): void {
    // Gemini doesn't support mid-session config updates
    // Store for next connection
    this.config = { ...this.config, ...config };
    console.warn('Gemini Live does not support mid-session config updates. Changes will apply on reconnect.');
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function geminiLive(
  config: RealtimeSessionConfig,
  options?: GeminiRealtimeOptions
): GeminiLiveSession {
  return new GeminiLiveSession(config, options);
}
