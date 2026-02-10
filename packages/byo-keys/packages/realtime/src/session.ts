// =============================================================================
// Base Realtime Session
// =============================================================================

import type {
  RealtimeSession,
  RealtimeSessionConfig,
  RealtimeProviderOptions,
  RealtimeEvent,
  RealtimeEventListener,
  SessionStatus,
  SessionState,
  Unsubscribe,
} from './types';

// -----------------------------------------------------------------------------
// Event Emitter
// -----------------------------------------------------------------------------

export class RealtimeEventEmitter {
  private listeners = new Set<RealtimeEventListener>();
  
  subscribe(listener: RealtimeEventListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  emit(event: RealtimeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in realtime event listener:', error);
      }
    });
  }
  
  clear(): void {
    this.listeners.clear();
  }
}

// -----------------------------------------------------------------------------
// Base Session Implementation
// -----------------------------------------------------------------------------

export abstract class BaseRealtimeSession implements RealtimeSession {
  abstract readonly providerId: string;
  
  protected ws: WebSocket | null = null;
  protected apiKey: string | null = null;
  protected config: RealtimeSessionConfig;
  protected options: RealtimeProviderOptions;
  protected emitter = new RealtimeEventEmitter();
  protected reconnectAttempts = 0;
  
  protected _status: SessionStatus = { state: 'disconnected' };
  
  constructor(
    config: RealtimeSessionConfig,
    options: RealtimeProviderOptions = {}
  ) {
    this.config = config;
    this.options = {
      autoReconnect: false,
      maxReconnectAttempts: 3,
      reconnectDelayMs: 1000,
      ...options,
    };
    
    if (options.apiKey) {
      this.apiKey = options.apiKey;
    }
  }
  
  get status(): SessionStatus {
    return { ...this._status };
  }
  
  /**
   * Set the API key (if not provided in constructor)
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }
  
  /**
   * Get the WebSocket URL for the provider
   */
  protected abstract getWebSocketUrl(): string;
  
  /**
   * Get protocol-specific headers/subprotocols
   */
  protected abstract getConnectionParams(): {
    protocols?: string[];
    headers?: Record<string, string>;
  };
  
  /**
   * Handle incoming WebSocket messages
   */
  protected abstract handleMessage(data: string): void;
  
  /**
   * Send initial configuration after connection
   */
  protected abstract sendInitialConfig(): void;
  
  /**
   * Format audio data for sending
   */
  protected abstract formatAudioForSend(audio: Int16Array | string): string;
  
  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------
  
  async connect(): Promise<void> {
    if (this._status.state === 'connected' || this._status.state === 'connecting') {
      return;
    }
    
    if (!this.apiKey && this.requiresApiKey()) {
      throw new Error(`${this.providerId} requires an API key`);
    }
    
    this.setState('connecting');
    
    return new Promise((resolve, reject) => {
      try {
        const url = this.options.wsUrl ?? this.getWebSocketUrl();
        const { protocols } = this.getConnectionParams();
        
        this.ws = new WebSocket(url, protocols);
        
        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.sendInitialConfig();
          // Don't resolve yet - wait for session confirmation from provider
        };
        
        this.ws.onmessage = (event) => {
          try {
            this.handleMessage(event.data);
            
            // Resolve on first successful message indicating connection
            if (this._status.state === 'connecting') {
              this.setState('connected');
              this._status.connectedAt = new Date();
              resolve();
            }
          } catch (error) {
            console.error('Error handling message:', error);
          }
        };
        
        this.ws.onerror = (event) => {
          const error = 'WebSocket error';
          this.setState('error', error);
          this.emitter.emit({ type: 'session:error', error });
          reject(new Error(error));
        };
        
        this.ws.onclose = (event) => {
          const wasConnected = this._status.state === 'connected';
          this.setState('disconnected');
          this.emitter.emit({ 
            type: 'session:disconnected', 
            reason: event.reason || 'Connection closed' 
          });
          
          // Attempt reconnection if enabled
          if (wasConnected && this.options.autoReconnect) {
            this.attemptReconnect();
          }
        };
        
        // Timeout for connection
        setTimeout(() => {
          if (this._status.state === 'connecting') {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);
        
      } catch (error) {
        this.setState('error', error instanceof Error ? error.message : 'Connection failed');
        reject(error);
      }
    });
  }
  
  disconnect(): void {
    this.options.autoReconnect = false; // Prevent reconnection
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setState('disconnected');
  }
  
  protected attemptReconnect(): void {
    if (this.reconnectAttempts >= (this.options.maxReconnectAttempts ?? 3)) {
      this.emitter.emit({ 
        type: 'session:error', 
        error: 'Max reconnection attempts reached' 
      });
      return;
    }
    
    this.reconnectAttempts++;
    const delay = (this.options.reconnectDelayMs ?? 1000) * this.reconnectAttempts;
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }
  
  protected setState(state: SessionState, error?: string): void {
    this._status = {
      ...this._status,
      state,
      error: error ?? undefined,
    };
  }
  
  protected requiresApiKey(): boolean {
    return true;
  }
  
  // ---------------------------------------------------------------------------
  // Audio & Message Sending
  // ---------------------------------------------------------------------------
  
  sendAudio(audio: Int16Array | string): void {
    if (this._status.state !== 'connected' || !this.ws) {
      throw new Error('Not connected');
    }
    
    const message = this.formatAudioForSend(audio);
    this.ws.send(message);
  }
  
  abstract sendText(text: string): void;
  abstract commitAudio(): void;
  abstract interrupt(): void;
  abstract submitToolResult(callId: string, result: string): void;
  abstract updateConfig(config: Partial<RealtimeSessionConfig>): void;
  
  // ---------------------------------------------------------------------------
  // Event Subscription
  // ---------------------------------------------------------------------------
  
  subscribe(listener: RealtimeEventListener): Unsubscribe {
    return this.emitter.subscribe(listener);
  }
  
  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  
  /**
   * Convert Int16Array to base64
   */
  protected int16ToBase64(audio: Int16Array): string {
    const bytes = new Uint8Array(audio.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  /**
   * Convert base64 to Int16Array
   */
  protected base64ToInt16(base64: string): Int16Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }
  
  /**
   * Send a JSON message over WebSocket
   */
  protected send(message: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
