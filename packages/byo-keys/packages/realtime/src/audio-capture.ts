// =============================================================================
// Audio Capture Utility
// =============================================================================
// Browser-based microphone capture with PCM16 output suitable for 
// OpenAI Realtime and Gemini Live APIs.

import type { AudioCapture, AudioCaptureConfig, Unsubscribe } from './types';

// -----------------------------------------------------------------------------
// Audio Capture Implementation
// -----------------------------------------------------------------------------

export class BrowserAudioCapture implements AudioCapture {
  private config: Required<AudioCaptureConfig>;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  private _isCapturing = false;
  private _isPaused = false;
  
  private chunkListeners = new Set<(chunk: Int16Array) => void>();
  private volumeListeners = new Set<(level: number) => void>();
  
  constructor(config: AudioCaptureConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 24000, // OpenAI default
      channels: config.channels ?? 1,
      chunkSize: config.chunkSize ?? 4800, // 200ms at 24kHz
      echoCancellation: config.echoCancellation ?? true,
      noiseSuppression: config.noiseSuppression ?? true,
      autoGainControl: config.autoGainControl ?? true,
    };
  }
  
  get isCapturing(): boolean {
    return this._isCapturing && !this._isPaused;
  }
  
  async start(): Promise<void> {
    if (this._isCapturing) return;
    
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
        },
      });
      
      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
      });
      
      // Load the audio worklet processor
      await this.audioContext.audioWorklet.addModule(
        this.createWorkletURL()
      );
      
      // Create source from microphone
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      
      // Create worklet node for processing
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        'pcm-processor',
        {
          processorOptions: {
            chunkSize: this.config.chunkSize,
          },
        }
      );
      
      // Handle audio data from worklet
      this.workletNode.port.onmessage = (event) => {
        if (this._isPaused) return;
        
        const { type, data } = event.data;
        
        if (type === 'audio') {
          const int16Data = new Int16Array(data);
          this.chunkListeners.forEach(cb => cb(int16Data));
        } else if (type === 'volume') {
          this.volumeListeners.forEach(cb => cb(data));
        }
      };
      
      // Connect the audio graph
      this.source.connect(this.workletNode);
      // Don't connect to destination (we don't want to hear ourselves)
      
      this._isCapturing = true;
      this._isPaused = false;
      
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }
  
  stop(): void {
    this.cleanup();
    this._isCapturing = false;
    this._isPaused = false;
  }
  
  pause(): void {
    this._isPaused = true;
  }
  
  resume(): void {
    this._isPaused = false;
  }
  
  onAudioChunk(callback: (chunk: Int16Array) => void): Unsubscribe {
    this.chunkListeners.add(callback);
    return () => this.chunkListeners.delete(callback);
  }
  
  onVolumeLevel(callback: (level: number) => void): Unsubscribe {
    this.volumeListeners.add(callback);
    return () => this.volumeListeners.delete(callback);
  }
  
  private cleanup(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
  
  /**
   * Create a blob URL for the AudioWorklet processor
   */
  private createWorkletURL(): string {
    const processorCode = `
      class PCMProcessor extends AudioWorkletProcessor {
        constructor(options) {
          super();
          this.chunkSize = options.processorOptions?.chunkSize || 4800;
          this.buffer = new Float32Array(this.chunkSize);
          this.bufferIndex = 0;
        }
        
        process(inputs) {
          const input = inputs[0];
          if (!input || !input[0]) return true;
          
          const samples = input[0];
          
          // Calculate volume level (RMS)
          let sum = 0;
          for (let i = 0; i < samples.length; i++) {
            sum += samples[i] * samples[i];
          }
          const rms = Math.sqrt(sum / samples.length);
          this.port.postMessage({ type: 'volume', data: rms });
          
          // Buffer samples
          for (let i = 0; i < samples.length; i++) {
            this.buffer[this.bufferIndex++] = samples[i];
            
            if (this.bufferIndex >= this.chunkSize) {
              // Convert to Int16
              const int16 = new Int16Array(this.chunkSize);
              for (let j = 0; j < this.chunkSize; j++) {
                const s = Math.max(-1, Math.min(1, this.buffer[j]));
                int16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              
              // Send to main thread
              this.port.postMessage({ 
                type: 'audio', 
                data: int16.buffer 
              }, [int16.buffer]);
              
              // Reset buffer
              this.buffer = new Float32Array(this.chunkSize);
              this.bufferIndex = 0;
            }
          }
          
          return true;
        }
      }
      
      registerProcessor('pcm-processor', PCMProcessor);
    `;
    
    const blob = new Blob([processorCode], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

export function createAudioCapture(config?: AudioCaptureConfig): AudioCapture {
  return new BrowserAudioCapture(config);
}

// -----------------------------------------------------------------------------
// Simple Alternative (using ScriptProcessorNode - deprecated but more compatible)
// -----------------------------------------------------------------------------

export class LegacyAudioCapture implements AudioCapture {
  private config: Required<AudioCaptureConfig>;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  private _isCapturing = false;
  private _isPaused = false;
  
  private chunkListeners = new Set<(chunk: Int16Array) => void>();
  private volumeListeners = new Set<(level: number) => void>();
  
  private buffer: Float32Array;
  private bufferIndex = 0;
  
  constructor(config: AudioCaptureConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 24000,
      channels: config.channels ?? 1,
      chunkSize: config.chunkSize ?? 4800,
      echoCancellation: config.echoCancellation ?? true,
      noiseSuppression: config.noiseSuppression ?? true,
      autoGainControl: config.autoGainControl ?? true,
    };
    this.buffer = new Float32Array(this.config.chunkSize);
  }
  
  get isCapturing(): boolean {
    return this._isCapturing && !this._isPaused;
  }
  
  async start(): Promise<void> {
    if (this._isCapturing) return;
    
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: this.config.echoCancellation,
        noiseSuppression: this.config.noiseSuppression,
        autoGainControl: this.config.autoGainControl,
      },
    });
    
    this.audioContext = new AudioContext();
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    
    // ScriptProcessorNode (deprecated but widely supported)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (event) => {
      if (this._isPaused) return;
      
      const input = event.inputBuffer.getChannelData(0);
      
      // Resample if needed
      const resampled = this.resample(input, this.audioContext!.sampleRate, this.config.sampleRate);
      
      // Calculate volume
      let sum = 0;
      for (let i = 0; i < resampled.length; i++) {
        sum += resampled[i] * resampled[i];
      }
      const rms = Math.sqrt(sum / resampled.length);
      this.volumeListeners.forEach(cb => cb(rms));
      
      // Buffer and emit chunks
      for (let i = 0; i < resampled.length; i++) {
        this.buffer[this.bufferIndex++] = resampled[i];
        
        if (this.bufferIndex >= this.config.chunkSize) {
          const int16 = this.floatToInt16(this.buffer);
          this.chunkListeners.forEach(cb => cb(int16));
          
          this.buffer = new Float32Array(this.config.chunkSize);
          this.bufferIndex = 0;
        }
      }
    };
    
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    
    this._isCapturing = true;
    this._isPaused = false;
  }
  
  stop(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this._isCapturing = false;
    this._isPaused = false;
  }
  
  pause(): void {
    this._isPaused = true;
  }
  
  resume(): void {
    this._isPaused = false;
  }
  
  onAudioChunk(callback: (chunk: Int16Array) => void): Unsubscribe {
    this.chunkListeners.add(callback);
    return () => this.chunkListeners.delete(callback);
  }
  
  onVolumeLevel(callback: (level: number) => void): Unsubscribe {
    this.volumeListeners.add(callback);
    return () => this.volumeListeners.delete(callback);
  }
  
  private floatToInt16(float32: Float32Array): Int16Array {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }
  
  private resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return input;
    
    const ratio = fromRate / toRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const t = srcIndex - srcIndexFloor;
      
      output[i] = input[srcIndexFloor] * (1 - t) + input[srcIndexCeil] * t;
    }
    
    return output;
  }
}

export function createLegacyAudioCapture(config?: AudioCaptureConfig): AudioCapture {
  return new LegacyAudioCapture(config);
}
