/**
 * AudioRecorder - Handles audio recording using Web Audio API
 * Follows Single Responsibility Principle - only handles audio recording
 */
export interface IAudioRecorder {
  startRecording(): Promise<void>;
  stopRecording(): Promise<Blob>;
  getIsRecording(): boolean;
}

export class AudioRecorder implements IAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private isRecording: boolean = false;

  /**
   * Starts audio recording from the user's microphone
   * @throws Error if microphone access fails
   */
  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000, // Whisper prefers 16kHz
          channelCount: 1,   // Mono
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      
      this.stream = stream;
      this.audioChunks = [];
      
      // Use WebM format (works everywhere)
      const options = { mimeType: 'audio/webm;codecs=opus' };
      this.mediaRecorder = new MediaRecorder(stream, options);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('Failed to access microphone. Please check permissions.');
    }
  }

  /**
   * Stops recording and returns the audio blob
   * @returns Promise resolving to the recorded audio blob
   * @throws Error if not currently recording
   */
  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('Not currently recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.cleanup();
        resolve(audioBlob);
      };

      this.mediaRecorder.onerror = (error) => {
        this.cleanup();
        reject(new Error(`Recording error: ${error}`));
      };

      this.mediaRecorder.stop();
      this.isRecording = false;
    });
  }

  /**
   * Gets the current recording state
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Cleans up resources (stops tracks, clears state)
   */
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}
