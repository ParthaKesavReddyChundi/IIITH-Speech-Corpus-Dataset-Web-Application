"use client";

/**
 * Audio Recorder Utility
 * Wraps MediaRecorder and Web Audio API for recording and waveform visualization.
 */

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  
  // To track recording duration
  private startTime: number = 0;
  
  // For RMS calculation to detect silence
  private scriptProcessor: ScriptProcessorNode | null = null;
  private rmsValues: number[] = [];

  constructor() {}

  /**
   * Request microphone permissions and initialize audio graph
   */
  async initialize(): Promise<AnalyserNode> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      // We also set up a script processor to calculate RMS (Root Mean Square)
      // to detect completely silent recordings.
      // Note: ScriptProcessorNode is deprecated in favor of AudioWorklet,
      // but it's much simpler for a basic RMS check and still widely supported.
      this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
      this.scriptProcessor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < input.length; i++) {
          sum += input[i] * input[i];
        }
        const rms = Math.sqrt(sum / input.length);
        this.rmsValues.push(rms);
      };

      source.connect(this.analyser);
      this.analyser.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      return this.analyser;
    } catch (error) {
      console.error("Microphone initialization failed:", error);
      throw error; // Will be handled by the UI
    }
  }

  /**
   * Start recording
   */
  start(): void {
    if (!this.stream) throw new Error("Recorder not initialized");

    this.chunks = [];
    this.rmsValues = [];
    
    // Determine the best MIME type supported by the browser
    const mimeTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4", // Safari
      "audio/ogg;codecs=opus",
    ];
    
    let selectedMimeType = "";
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedMimeType = type;
        break;
      }
    }

    if (!selectedMimeType) {
      throw new Error("No supported audio MIME type found in this browser.");
    }

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: selectedMimeType });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(100); // Collect data every 100ms
  }

  /**
   * Stop recording and return the resulting Blob and metadata
   */
  stop(): Promise<{ blob: Blob; durationSeconds: number; isSilent: boolean }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("Recorder not started"));
        return;
      }

      const durationSeconds = (Date.now() - this.startTime) / 1000;

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType });
        
        // Calculate average RMS to check for silence
        // If average RMS is below a very low threshold (e.g. 0.005), it's likely silent
        const avgRms = this.rmsValues.length > 0 
          ? this.rmsValues.reduce((a, b) => a + b, 0) / this.rmsValues.length 
          : 0;
          
        const isSilent = avgRms < 0.005;

        // Cleanup
        this.cleanup();

        resolve({ blob, durationSeconds, isSilent });
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Release all resources
   */
  cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.mediaRecorder = null;
  }
}
