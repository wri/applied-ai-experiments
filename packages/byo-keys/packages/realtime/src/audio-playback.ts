// =============================================================================
// Audio Playback Utility
// =============================================================================
// Browser-based audio playback for PCM16 data from voice APIs.

import type { AudioPlayback, AudioPlaybackConfig, Unsubscribe } from './types';

// -----------------------------------------------------------------------------
// Audio Playback Implementation
// -----------------------------------------------------------------------------

export class BrowserAudioPlayback implements AudioPlayback {
  private config: Required<AudioPlaybackConfig>;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  
  private queue: Float32Array[] = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private scheduledTime = 0;
  
  private _isPlaying = false;
  private _isPaused = false;
  private _position = 0;
  
  constructor(config: AudioPlaybackConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 24000, // OpenAI default
      channels: config.channels ?? 1,
      bufferAheadMs: config.bufferAheadMs ?? 100,
    };
  }
  
  get isPlaying(): boolean {
    return this._isPlaying && !this._isPaused;
  }
  
  get position(): number {
    return this._position;
  }
  
  async initialize(): Promise<void> {
    // AudioContext must be created from a user gesture
    if (!this.audioContext) {
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
      });
      
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      
      // Resume if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    }
  }
  
  enqueue(audio: Int16Array | string): void {
    if (!this.audioContext) {
      throw new Error('Audio playback not initialized. Call initialize() first.');
    }
    
    // Convert to Float32
    const float32 = this.toFloat32(audio);
    this.queue.push(float32);
    
    // Start playback if not already playing
    if (!this._isPlaying) {
      this.startPlayback();
    } else {
      this.scheduleNext();
    }
  }
  
  stop(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource.disconnect();
      this.currentSource = null;
    }
    
    this.queue = [];
    this._isPlaying = false;
    this._isPaused = false;
    this._position = 0;
    this.scheduledTime = 0;
  }
  
  pause(): void {
    if (this.audioContext && this._isPlaying) {
      this.audioContext.suspend();
      this._isPaused = true;
    }
  }
  
  resume(): void {
    if (this.audioContext && this._isPaused) {
      this.audioContext.resume();
      this._isPaused = false;
    }
  }
  
  /**
   * Set the playback volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
  
  private startPlayback(): void {
    if (!this.audioContext || !this.gainNode) return;
    
    this._isPlaying = true;
    this.scheduledTime = this.audioContext.currentTime;
    this.scheduleNext();
  }
  
  private scheduleNext(): void {
    if (!this.audioContext || !this.gainNode || this.queue.length === 0) {
      if (this.queue.length === 0) {
        this._isPlaying = false;
      }
      return;
    }
    
    const samples = this.queue.shift()!;
    
    // Create audio buffer
    const buffer = this.audioContext.createBuffer(
      this.config.channels,
      samples.length,
      this.config.sampleRate
    );
    
    buffer.getChannelData(0).set(samples);
    
    // Create source
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);
    
    // Schedule playback
    const startTime = Math.max(
      this.audioContext.currentTime,
      this.scheduledTime
    );
    
    source.start(startTime);
    this.currentSource = source;
    
    // Update scheduled time for next chunk
    const duration = samples.length / this.config.sampleRate;
    this.scheduledTime = startTime + duration;
    
    // Update position
    this._position += samples.length;
    
    // Schedule next chunk when this one ends
    source.onended = () => {
      if (this._isPlaying && !this._isPaused) {
        this.scheduleNext();
      }
    };
  }
  
  private toFloat32(audio: Int16Array | string): Float32Array {
    let int16: Int16Array;
    
    if (typeof audio === 'string') {
      // Decode base64
      const binary = atob(audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      int16 = new Int16Array(bytes.buffer);
    } else {
      int16 = audio;
    }
    
    // Convert Int16 to Float32
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    
    return float32;
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function createAudioPlayback(config?: AudioPlaybackConfig): AudioPlayback {
  return new BrowserAudioPlayback(config);
}

// -----------------------------------------------------------------------------
// Streaming Audio Player (more advanced, handles jitter better)
// -----------------------------------------------------------------------------

export class StreamingAudioPlayer {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  
  private _isInitialized = false;
  private _isPlaying = false;
  
  private sampleRate: number;
  
  constructor(sampleRate: number = 24000) {
    this.sampleRate = sampleRate;
  }
  
  get isInitialized(): boolean {
    return this._isInitialized;
  }
  
  get isPlaying(): boolean {
    return this._isPlaying;
  }
  
  async initialize(): Promise<void> {
    if (this._isInitialized) return;
    
    this.audioContext = new AudioContext({
      sampleRate: this.sampleRate,
    });
    
    // Create and load worklet
    await this.audioContext.audioWorklet.addModule(
      this.createWorkletURL()
    );
    
    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      'streaming-player',
      {
        processorOptions: {
          bufferSize: this.sampleRate * 2, // 2 seconds buffer
        },
      }
    );
    
    this.gainNode = this.audioContext.createGain();
    
    this.workletNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    
    // Handle messages from worklet
    this.workletNode.port.onmessage = (event) => {
      if (event.data.type === 'stateChange') {
        this._isPlaying = event.data.isPlaying;
      }
    };
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    this._isInitialized = true;
  }
  
  /**
   * Add audio data to the playback buffer
   */
  addAudio(audio: Int16Array | string): void {
    if (!this.workletNode) {
      throw new Error('Player not initialized');
    }
    
    let int16: Int16Array;
    
    if (typeof audio === 'string') {
      const binary = atob(audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      int16 = new Int16Array(bytes.buffer);
    } else {
      int16 = audio;
    }
    
    // Send to worklet
    this.workletNode.port.postMessage({
      type: 'audio',
      data: int16.buffer,
    }, [int16.buffer]);
  }
  
  /**
   * Clear the buffer and stop playback
   */
  clear(): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'clear' });
    }
    this._isPlaying = false;
  }
  
  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this._isInitialized = false;
    this._isPlaying = false;
  }
  
  private createWorkletURL(): string {
    const code = `
      class StreamingPlayer extends AudioWorkletProcessor {
        constructor(options) {
          super();
          
          this.bufferSize = options.processorOptions?.bufferSize || 48000;
          this.buffer = new Float32Array(this.bufferSize);
          this.writeIndex = 0;
          this.readIndex = 0;
          this.samplesAvailable = 0;
          
          this.port.onmessage = (event) => {
            if (event.data.type === 'audio') {
              this.addAudio(new Int16Array(event.data.data));
            } else if (event.data.type === 'clear') {
              this.clear();
            }
          };
        }
        
        addAudio(int16) {
          for (let i = 0; i < int16.length; i++) {
            if (this.samplesAvailable < this.bufferSize) {
              this.buffer[this.writeIndex] = int16[i] / 32768;
              this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
              this.samplesAvailable++;
            }
          }
        }
        
        clear() {
          this.writeIndex = 0;
          this.readIndex = 0;
          this.samplesAvailable = 0;
        }
        
        process(inputs, outputs) {
          const output = outputs[0][0];
          
          const wasPlaying = this.samplesAvailable > 0;
          
          for (let i = 0; i < output.length; i++) {
            if (this.samplesAvailable > 0) {
              output[i] = this.buffer[this.readIndex];
              this.readIndex = (this.readIndex + 1) % this.bufferSize;
              this.samplesAvailable--;
            } else {
              output[i] = 0;
            }
          }
          
          const isPlaying = this.samplesAvailable > 0;
          if (wasPlaying !== isPlaying) {
            this.port.postMessage({ type: 'stateChange', isPlaying });
          }
          
          return true;
        }
      }
      
      registerProcessor('streaming-player', StreamingPlayer);
    `;
    
    const blob = new Blob([code], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  }
}

export function createStreamingPlayer(sampleRate?: number): StreamingAudioPlayer {
  return new StreamingAudioPlayer(sampleRate);
}
