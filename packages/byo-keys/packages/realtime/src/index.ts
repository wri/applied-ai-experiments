// =============================================================================
// @byo-keys/realtime - Real-time Voice Sessions
// =============================================================================
// WebSocket-based voice conversation sessions for OpenAI Realtime and Gemini Live APIs.

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type {
  RealtimeSessionConfig,
  RealtimeProviderOptions,
  RealtimeSession,
  RealtimeEvent,
  RealtimeEventListener,
  SessionState,
  SessionStatus,
  RealtimeUsage,
  RealtimeTool,
  AudioFormat,
  TurnDetectionConfig,
  Unsubscribe,
  
  // Audio types
  AudioCapture,
  AudioCaptureConfig,
  AudioPlayback,
  AudioPlaybackConfig,
  
  // Event types
  SessionConnectedEvent,
  SessionDisconnectedEvent,
  SessionErrorEvent,
  AudioInputStartedEvent,
  AudioInputEndedEvent,
  TranscriptDeltaEvent,
  TranscriptDoneEvent,
  ResponseStartedEvent,
  ResponseAudioDeltaEvent,
  ResponseAudioDoneEvent,
  ResponseTextDeltaEvent,
  ResponseTextDoneEvent,
  ResponseDoneEvent,
  ToolCallEvent,
  ToolCallDoneEvent,
  InterruptedEvent,
} from './types';

// -----------------------------------------------------------------------------
// Base Classes
// -----------------------------------------------------------------------------

export { BaseRealtimeSession, RealtimeEventEmitter } from './session';

// -----------------------------------------------------------------------------
// OpenAI Realtime
// -----------------------------------------------------------------------------

export { 
  OpenAIRealtimeSession, 
  openaiRealtime,
  type OpenAIRealtimeOptions,
} from './openai-realtime';

// -----------------------------------------------------------------------------
// Gemini Live
// -----------------------------------------------------------------------------

export { 
  GeminiLiveSession, 
  geminiLive,
  type GeminiRealtimeOptions,
  GEMINI_VOICES,
  type GeminiVoice,
} from './gemini-live';

// -----------------------------------------------------------------------------
// Audio Utilities
// -----------------------------------------------------------------------------

export {
  BrowserAudioCapture,
  LegacyAudioCapture,
  createAudioCapture,
  createLegacyAudioCapture,
} from './audio-capture';

export {
  BrowserAudioPlayback,
  StreamingAudioPlayer,
  createAudioPlayback,
  createStreamingPlayer,
} from './audio-playback';

// -----------------------------------------------------------------------------
// Convenience Re-exports
// -----------------------------------------------------------------------------

/**
 * Available realtime-capable providers
 */
export const REALTIME_PROVIDERS = {
  openai: {
    name: 'OpenAI Realtime',
    models: ['gpt-4o-realtime-preview-2024-12-17'],
    voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    sampleRate: 24000,
    supportsCORS: false,
  },
  gemini: {
    name: 'Gemini Live',
    models: ['gemini-2.0-flash-exp'],
    voices: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'],
    sampleRate: 16000,
    supportsCORS: true,
  },
} as const;

export type RealtimeProviderType = keyof typeof REALTIME_PROVIDERS;
