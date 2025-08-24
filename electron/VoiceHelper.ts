// VoiceHelper.ts
import { BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { configHelper } from "./ConfigHelper";
import { OpenAI } from "openai";
import log from "electron-log";

export interface IVoiceHelperDeps {
  getMainWindow: () => BrowserWindow | null;
  triggerProcessing: () => Promise<void>;
  sendEvent: (event: string, data?: any) => void;
}

export class VoiceHelper {
  private deps: IVoiceHelperDeps;
  private isListening: boolean = false;
  private mediaRecorder: any = null;
  private audioChunks: any[] = [];
  private openaiClient: OpenAI | null = null;
  private recordingTimeout: NodeJS.Timeout | null = null;
  private audioDir: string;

  // Voice detection settings
  private readonly CHUNK_DURATION = 5000; // 5 seconds per chunk
  private readonly SILENCE_THRESHOLD = 2000; // 2 seconds of silence to process
  private readonly MAX_RECORDING_TIME = 30000; // 30 seconds max per recording

  constructor(deps: IVoiceHelperDeps) {
    this.deps = deps;
    this.audioDir = path.join(__dirname, "..", "temp", "audio");
    this.ensureAudioDirectory();
    this.initializeOpenAI();

    // Listen for config changes to reinitialize OpenAI client
    configHelper.on("config-updated", () => {
      this.initializeOpenAI();
    });
  }

  private ensureAudioDirectory(): void {
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  private initializeOpenAI(): void {
    try {
      const config = configHelper.loadConfig();
      if (config.apiProvider === "openai" && config.apiKey) {
        this.openaiClient = new OpenAI({
          apiKey: config.apiKey,
          timeout: 60000,
          maxRetries: 2,
        });
        log.info("Voice: OpenAI client initialized for Whisper");
      } else {
        this.openaiClient = null;
        log.info("Voice: OpenAI not available for voice processing");
      }
    } catch (error) {
      log.error("Voice: Failed to initialize OpenAI client:", error);
      this.openaiClient = null;
    }
  }

  public async startListening(): Promise<void> {
    if (this.isListening) {
      log.info("Voice: Already listening");
      return;
    }

    if (!this.openaiClient) {
      throw new Error("OpenAI client not initialized for voice processing");
    }

    try {
      log.info("Voice: Starting listening mode");
      this.isListening = true;
      this.deps.sendEvent("voice-listening-started");

      // Start continuous audio processing
      await this.startContinuousRecording();
    } catch (error) {
      log.error("Voice: Error starting listening:", error);
      this.isListening = false;
      this.deps.sendEvent("voice-listening-error", error.message);
      throw error;
    }
  }

  public async stopListening(): Promise<void> {
    log.info("Voice: Stopping listening mode");
    this.isListening = false;

    // Clear any pending timeouts
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }

    try {
      // Stop media recorder if active
      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        // Create a promise to wait for the recorder to stop
        await new Promise<void>((resolve) => {
          if (this.mediaRecorder) {
            this.mediaRecorder.onstop = () => {
              log.info("Voice: MediaRecorder stopped successfully");
              resolve();
            };
            this.mediaRecorder.stop();
          } else {
            resolve();
          }

          // Timeout if stop takes too long
          setTimeout(() => {
            log.warn("Voice: MediaRecorder stop timeout, force resolving");
            resolve();
          }, 1000);
        });
      }

      // Clean up audio stream in the renderer process
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          await mainWindow.webContents.executeJavaScript(`
            if (window.__audioStream__) {
              window.__audioStream__.getTracks().forEach(track => track.stop());
              delete window.__audioStream__;
              console.log('Audio stream cleaned up');
            }
          `);
        } catch (error) {
          log.warn("Voice: Error cleaning up audio stream:", error);
        }
      }

      // Reset recorder reference
      this.mediaRecorder = null;

      // Send event only if we're not shutting down
      try {
        this.deps.sendEvent("voice-listening-stopped");
      } catch (error) {
        log.warn(
          "Voice: Error sending stopped event (app may be shutting down):",
          error
        );
      }

      log.info("Voice: Listening stopped and cleaned up successfully");
    } catch (error) {
      log.error("Voice: Error during stop listening cleanup:", error);
      throw error;
    }
  }

  private async startContinuousRecording(): Promise<void> {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    try {
      // Request microphone access through the main window
      const stream = await mainWindow.webContents.executeJavaScript(`
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            window.__audioStream__ = stream;
            return { success: true };
          })
          .catch(error => ({ success: false, error: error.message }))
      `);

      if (!stream.success) {
        throw new Error(`Microphone access denied: ${stream.error}`);
      }

      // Start recording loop
      this.scheduleNextRecording();
    } catch (error) {
      log.error("Voice: Error accessing microphone:", error);
      throw error;
    }
  }

  private scheduleNextRecording(): void {
    if (!this.isListening) return;

    this.recordingTimeout = setTimeout(async () => {
      try {
        await this.recordAndProcessChunk();
        this.scheduleNextRecording(); // Schedule next recording
      } catch (error) {
        log.error("Voice: Error in recording cycle:", error);
        // Continue listening despite errors
        this.scheduleNextRecording();
      }
    }, this.CHUNK_DURATION);
  }

  private async recordAndProcessChunk(): Promise<void> {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow || !this.isListening) return;

    try {
      // Record audio chunk
      const audioData = await this.recordAudioChunk();
      if (!audioData) return;

      // Save audio to file
      const audioPath = path.join(this.audioDir, `voice_${Date.now()}.wav`);
      await fs.promises.writeFile(audioPath, Buffer.from(audioData));

      // Transcribe with Whisper
      const transcription = await this.transcribeAudio(audioPath);

      // Clean up audio file
      await fs.promises.unlink(audioPath);

      if (transcription) {
        log.info("Voice: Transcribed:", transcription);
        await this.processTranscription(transcription);
      }
    } catch (error) {
      log.error("Voice: Error in recording/processing chunk:", error);
    }
  }

  private async recordAudioChunk(): Promise<ArrayBuffer | null> {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return null;

    return new Promise((resolve) => {
      const timeout = setTimeout(
        () => resolve(null),
        this.CHUNK_DURATION + 1000
      );

      mainWindow.webContents
        .executeJavaScript(
          `
        new Promise((resolve) => {
          const stream = window.__audioStream__;
          if (!stream) {
            resolve(null);
            return;
          }

          const mediaRecorder = new MediaRecorder(stream);
          const chunks = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          mediaRecorder.onstop = async () => {
            if (chunks.length > 0) {
              const blob = new Blob(chunks, { type: 'audio/wav' });
              const arrayBuffer = await blob.arrayBuffer();
              resolve(Array.from(new Uint8Array(arrayBuffer)));
            } else {
              resolve(null);
            }
          };

          mediaRecorder.start();
          setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, ${this.CHUNK_DURATION});
        })
      `
        )
        .then((result) => {
          clearTimeout(timeout);
          if (result && Array.isArray(result)) {
            resolve(new Uint8Array(result).buffer);
          } else {
            resolve(null);
          }
        })
        .catch(() => {
          clearTimeout(timeout);
          resolve(null);
        });
    });
  }

  private async transcribeAudio(audioPath: string): Promise<string | null> {
    if (!this.openaiClient) return null;

    try {
      const transcription = await this.openaiClient.audio.transcriptions.create(
        {
          file: fs.createReadStream(audioPath),
          model: "whisper-1",
          language: "en", // Can be made configurable
          response_format: "text",
        }
      );

      return transcription.trim();
    } catch (error) {
      log.error("Voice: Whisper transcription error:", error);
      return null;
    }
  }

  private async processTranscription(text: string): Promise<void> {
    // Detect if this looks like a coding question or follow-up
    const isCodingQuestion = this.detectCodingQuestion(text);

    if (isCodingQuestion) {
      log.info("Voice: Detected coding question, triggering processing");
      this.deps.sendEvent("voice-question-detected", { text });

      // Add a small delay then trigger processing
      setTimeout(async () => {
        try {
          await this.deps.triggerProcessing();
        } catch (error) {
          log.error("Voice: Error triggering processing:", error);
        }
      }, 1000);
    } else {
      log.info("Voice: Non-coding conversation detected, continuing to listen");
    }
  }

  private detectCodingQuestion(text: string): boolean {
    const codingKeywords = [
      // Question starters
      "how would you",
      "can you",
      "what would",
      "how do you",
      "could you",
      "implement",
      "write",
      "solve",
      "approach",
      "algorithm",

      // Coding concepts
      "function",
      "method",
      "class",
      "variable",
      "array",
      "string",
      "integer",
      "loop",
      "iteration",
      "recursion",
      "dynamic programming",
      "time complexity",
      "space complexity",
      "big o",
      "optimize",
      "efficient",

      // Data structures
      "linked list",
      "binary tree",
      "hash map",
      "hash table",
      "stack",
      "queue",
      "heap",
      "graph",
      "trie",

      // Common problem types
      "two sum",
      "reverse",
      "palindrome",
      "substring",
      "subarray",
      "matrix",
      "binary search",
      "merge",
      "sort",
      "traversal",

      // Follow-up indicators
      "what if",
      "how about",
      "can we",
      "what about edge cases",
      "optimize this",
      "different approach",
      "better solution",
      "time complexity",
      "space complexity",
    ];

    const lowerText = text.toLowerCase();

    // Check for coding keywords
    const hasKeywords = codingKeywords.some((keyword) =>
      lowerText.includes(keyword)
    );

    // Check for question patterns
    const hasQuestionPattern =
      /\b(how|what|can|could|would|will|implement|solve|write)\b.*\?/i.test(
        text
      );

    // Minimum length check (avoid triggering on short responses)
    const isLongEnough = text.length > 10;

    return isLongEnough && (hasKeywords || hasQuestionPattern);
  }

  public getStatus(): { isListening: boolean; hasOpenAI: boolean } {
    return {
      isListening: this.isListening,
      hasOpenAI: !!this.openaiClient,
    };
  }

  public async cleanup(): Promise<void> {
    log.info("Voice: Starting cleanup process");

    try {
      // Stop listening first
      await this.stopListening();

      // Clean up any remaining audio files
      try {
        const files = await fs.promises.readdir(this.audioDir);
        const audioFiles = files.filter((file) => file.endsWith(".wav"));

        if (audioFiles.length > 0) {
          log.info(`Voice: Cleaning up ${audioFiles.length} audio files`);
          for (const file of audioFiles) {
            try {
              await fs.promises.unlink(path.join(this.audioDir, file));
            } catch (fileError) {
              log.warn(
                `Voice: Could not delete audio file ${file}:`,
                fileError
              );
            }
          }
        }
      } catch (dirError) {
        log.warn(
          "Voice: Error reading audio directory during cleanup:",
          dirError
        );
      }

      // Reset all state
      this.isListening = false;
      this.mediaRecorder = null;
      this.recordingTimeout = null;

      log.info("Voice: Cleanup completed successfully");
    } catch (error) {
      log.error("Voice: Error during cleanup:", error);
      // Don't throw - we want cleanup to always complete
    }
  }
}
