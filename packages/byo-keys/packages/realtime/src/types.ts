// =============================================================================
// @byo-keys/realtime - Types for Real-time Voice Sessions
// =============================================================================

// -----------------------------------------------------------------------------
// Session Configuration
// -----------------------------------------------------------------------------

export interface RealtimeSessionConfig {
  /** Model to use for the session */
  model: string;
  
  /** Voice for audio responses */
  voice?: string;
  
  /** System instructions */
  instructions?: string;
  
  /** Input audio format */
  inputAudioFormat?: AudioFormat;
  
  /** Output audio format */
  outputAudioFormat?: AudioFormat;
  
  /** Enable voice activity detection */
  vadEnabled?: boolean;
  
  /** VAD sensitivity threshold (0-1) */
  vadThreshold?: number;
  
  /** Silence duration (ms) before end of speech */
  silenceDurationMs?: number;
  
  /** Enable automatic turn detection */
  turnDetection?: TurnDetectionConfig | null;
  
  /** Available tools/functions */
  tools?: RealtimeTool[];
  
  /** Temperature for responses */
  temperature?: number;
  
  /** Maximum response tokens */
  maxResponseTokens?: number | 'inf';
}

export type AudioFormat = 
  | 'pcm16'      // 16-bit PCM
  | 'g711_ulaw'  // G.711 µ-law
  | 'g711_alaw'; // G.711 A-law

export interface TurnDetectionConfig {
  type: 'server_vad';
  threshold?: number;
  prefixPaddingMs?: number;
  silenceDurationMs?: number;
}

export interface RealtimeTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Session State
// -----------------------------------------------------------------------------

export type SessionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface SessionStatus {
  state: SessionState;
  error?: string;
  connectedAt?: Date;
  sessionId?: string;
}

// -----------------------------------------------------------------------------
// Session Events
// -----------------------------------------------------------------------------

export type RealtimeEvent = 
  | SessionConnectedEvent
  | SessionDisconnectedEvent
  | SessionErrorEvent
  | AudioInputStartedEvent
  | AudioInputEndedEvent
  | TranscriptDeltaEvent
  | TranscriptDoneEvent
  | ResponseStartedEvent
  | ResponseAudioDeltaEvent
  | ResponseAudioDoneEvent
  | ResponseTextDeltaEvent
  | ResponseTextDoneEvent
  | ResponseDoneEvent
  | ToolCallEvent
  | ToolCallDoneEvent
  | InterruptedEvent;

export interface SessionConnectedEvent {
  type: 'session:connected';
  sessionId: string;
}

export interface SessionDisconnectedEvent {
  type: 'session:disconnected';
  reason?: string;
}

export interface SessionErrorEvent {
  type: 'session:error';
  error: string;
  code?: string;
}

export interface AudioInputStartedEvent {
  type: 'audio:input_started';
}

export interface AudioInputEndedEvent {
  type: 'audio:input_ended';
}

export interface TranscriptDeltaEvent {
  type: 'transcript:delta';
  role: 'user' | 'assistant';
  delta: string;
}

export interface TranscriptDoneEvent {
  type: 'transcript:done';
  role: 'user' | 'assistant';
  text: string;
}

export interface ResponseStartedEvent {
  type: 'response:started';
  responseId: string;
}

export interface ResponseAudioDeltaEvent {
  type: 'response:audio_delta';
  /** Base64-encoded audio data */
  audio: string;
}

export interface ResponseAudioDoneEvent {
  type: 'response:audio_done';
}

export interface ResponseTextDeltaEvent {
  type: 'response:text_delta';
  delta: string;
}

export interface ResponseTextDoneEvent {
  type: 'response:text_done';
  text: string;
}

export interface ResponseDoneEvent {
  type: 'response:done';
  responseId: string;
  usage?: RealtimeUsage;
}

export interface ToolCallEvent {
  type: 'tool:call';
  callId: string;
  name: string;
  arguments: string;
}

export interface ToolCallDoneEvent {
  type: 'tool:call_done';
  callId: string;
}

export interface InterruptedEvent {
  type: 'interrupted';
}

export interface RealtimeUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// -----------------------------------------------------------------------------
// Event Listener
// -----------------------------------------------------------------------------

export type RealtimeEventListener = (event: RealtimeEvent) => void;

export type Unsubscribe = () => void;

// -----------------------------------------------------------------------------
// Realtime Session Interface
// -----------------------------------------------------------------------------

export interface RealtimeSession {
  /** Current session status */
  readonly status: SessionStatus;
  
  /** Provider ID */
  readonly providerId: string;
  
  /**
   * Connect to the realtime service
   */
  connect(): Promise<void>;
  
  /**
   * Disconnect from the service
   */
  disconnect(): void;
  
  /**
   * Send audio data to the session
   * @param audio - Audio data (Int16Array for PCM16, or base64 string)
   */
  sendAudio(audio: Int16Array | string): void;
  
  /**
   * Send a text message (for text-based interaction)
   */
  sendText(text: string): void;
  
  /**
   * Commit the current audio buffer (signal end of user turn)
   */
  commitAudio(): void;
  
  /**
   * Interrupt the current response
   */
  interrupt(): void;
  
  /**
   * Submit a tool call result
   */
  submitToolResult(callId: string, result: string): void;
  
  /**
   * Update session configuration
   */
  updateConfig(config: Partial<RealtimeSessionConfig>): void;
  
  /**
   * Subscribe to session events
   */
  subscribe(listener: RealtimeEventListener): Unsubscribe;
}

// -----------------------------------------------------------------------------
// Provider Options
// -----------------------------------------------------------------------------

export interface RealtimeProviderOptions {
  /** API key (optional - can be set later) */
  apiKey?: string;
  
  /** WebSocket URL override */
  wsUrl?: string;
  
  /** Proxy URL for WebSocket connection */
  proxyUrl?: string;
  
  /** Custom headers */
  headers?: Record<string, string>;
  
  /** Reconnect on disconnect */
  autoReconnect?: boolean;
  
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  
  /** Reconnection delay (ms) */
  reconnectDelayMs?: number;
}

// -----------------------------------------------------------------------------
// Audio Capture Types
// -----------------------------------------------------------------------------

export interface AudioCaptureConfig {
  /** Sample rate (default: 24000 for OpenAI, 16000 for Gemini) */
  sampleRate?: number;
  
  /** Number of channels (default: 1 for mono) */
  channels?: number;
  
  /** Chunk size in samples */
  chunkSize?: number;
  
  /** Enable echo cancellation */
  echoCancellation?: boolean;
  
  /** Enable noise suppression */
  noiseSuppression?: boolean;
  
  /** Enable auto gain control */
  autoGainControl?: boolean;
}

export interface AudioCapture {
  /** Start capturing audio from microphone */
  start(): Promise<void>;
  
  /** Stop capturing */
  stop(): void;
  
  /** Pause capturing (keeps stream open) */
  pause(): void;
  
  /** Resume capturing */
  resume(): void;
  
  /** Whether currently capturing */
  readonly isCapturing: boolean;
  
  /** Subscribe to audio chunks */
  onAudioChunk(callback: (chunk: Int16Array) => void): Unsubscribe;
  
  /** Subscribe to volume level changes */
  onVolumeLevel(callback: (level: number) => void): Unsubscribe;
}

// -----------------------------------------------------------------------------
// Audio Playback Types
// -----------------------------------------------------------------------------

export interface AudioPlaybackConfig {
  /** Sample rate of incoming audio */
  sampleRate?: number;
  
  /** Number of channels */
  channels?: number;
  
  /** Buffer ahead duration (ms) */
  bufferAheadMs?: number;
}

export interface AudioPlayback {
  /** Initialize the audio context (must be called from user gesture) */
  initialize(): Promise<void>;
  
  /** Add audio data to the playback queue */
  enqueue(audio: Int16Array | string): void;
  
  /** Stop playback and clear queue */
  stop(): void;
  
  /** Pause playback */
  pause(): void;
  
  /** Resume playback */
  resume(): void;
  
  /** Whether currently playing */
  readonly isPlaying: boolean;
  
  /** Current playback position (samples) */
  readonly position: number;
}
