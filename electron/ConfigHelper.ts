// ConfigHelper.ts
import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import { EventEmitter } from "events"
import { OpenAI } from "openai"
import {
  APIProvider,
  DEFAULT_PROVIDER,
  DEFAULT_MODELS,
  sanitizeModelSelection,
} from "../shared/aiModels";

export interface CandidateProfile {
  name?: string;
  resume?: string;  // Full resume text
  jobDescription?: string; // Target role/job description
}

interface Config {
  apiKey: string;
  apiProvider: APIProvider;  // Added provider selection
  extractionModel: string;
  solutionModel: string;
  debuggingModel: string;
  answerModel: string;  // Model for AI answer suggestions in conversations
  speechRecognitionModel: string;  // Speech recognition model (Whisper for OpenAI)
  language: string;
  opacity: number;
  candidateProfile?: CandidateProfile;  // Candidate profile for personalized AI suggestions
}

export class ConfigHelper extends EventEmitter {
  private configPath: string;
  private defaultConfig: Config = {
    apiKey: "",
    apiProvider: DEFAULT_PROVIDER,
    extractionModel: DEFAULT_MODELS[DEFAULT_PROVIDER].extractionModel,
    solutionModel: DEFAULT_MODELS[DEFAULT_PROVIDER].solutionModel,
    debuggingModel: DEFAULT_MODELS[DEFAULT_PROVIDER].debuggingModel,
    answerModel: DEFAULT_MODELS[DEFAULT_PROVIDER].answerModel,
    speechRecognitionModel:
      DEFAULT_MODELS.openai.speechRecognitionModel || "whisper-1",
    language: "python",
    opacity: 1.0,
    candidateProfile: {
      name: "",
      resume: "",
      jobDescription: ""
    }
  };

  constructor() {
    super();
    // Use the app's user data directory to store the config
    try {
      this.configPath = path.join(app.getPath('userData'), 'config.json');
      console.log('Config path:', this.configPath);
    } catch (err) {
      console.warn('Could not access user data path, using fallback');
      this.configPath = path.join(process.cwd(), 'config.json');
    }
    
    // Ensure the initial config file exists
    this.ensureConfigExists();
  }

  /**
   * Ensure config file exists
   */
  private ensureConfigExists(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.saveConfig(this.defaultConfig);
      }
    } catch (err) {
      console.error("Error ensuring config exists:", err);
    }
  }

  /**
   * Validate and sanitize model selection to ensure only allowed models are used.
   * Delegates to shared model configuration for single source of truth.
   */
  public loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(configData);
        
        // Ensure apiProvider is a valid value
        if (config.apiProvider !== "openai" && config.apiProvider !== "gemini"  && config.apiProvider !== "anthropic") {
          config.apiProvider = DEFAULT_PROVIDER; // Default to shared provider if invalid
        }
        
        // Sanitize model selections to ensure only allowed models are used
        if (config.extractionModel) {
          config.extractionModel = sanitizeModelSelection(
            config.extractionModel,
            config.apiProvider,
            "extractionModel"
          );
        }
        if (config.solutionModel) {
          config.solutionModel = sanitizeModelSelection(
            config.solutionModel,
            config.apiProvider,
            "solutionModel"
          );
        }
        if (config.debuggingModel) {
          config.debuggingModel = sanitizeModelSelection(
            config.debuggingModel,
            config.apiProvider,
            "debuggingModel"
          );
        }
        if (config.answerModel) {
          config.answerModel = sanitizeModelSelection(
            config.answerModel,
            config.apiProvider,
            "answerModel"
          );
        }
        
        // Ensure speechRecognitionModel is valid
        if (config.speechRecognitionModel) {
          if (config.apiProvider === "openai" && config.speechRecognitionModel !== "whisper-1") {
            config.speechRecognitionModel = "whisper-1";
          } else if (config.apiProvider === "gemini") {
            const allowedGeminiSpeechModels = [
              "gemini-1.5-flash",
              "gemini-1.5-pro",
              "gemini-3-flash-preview",
              "gemini-3-pro-preview",
              "gemini-2.0-flash-exp"
            ];
            if (!allowedGeminiSpeechModels.includes(config.speechRecognitionModel)) {
              config.speechRecognitionModel = DEFAULT_MODELS.gemini.speechRecognitionModel || "gemini-3-flash-preview";
            }
          }
        } else if (!config.speechRecognitionModel) {
          config.speechRecognitionModel = this.defaultConfig.speechRecognitionModel;
        }
        
        return {
          ...this.defaultConfig,
          ...config
        };
      }
      
      // If no config exists, create a default one
      this.saveConfig(this.defaultConfig);
      return this.defaultConfig;
    } catch (err) {
      console.error("Error loading config:", err);
      return this.defaultConfig;
    }
  }

  /**
   * Save configuration to disk
   */
  public saveConfig(config: Config): void {
    try {
      // Ensure the directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      // Write the config file
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (err) {
      console.error("Error saving config:", err);
    }
  }

  /**
   * Update specific configuration values
   */
  public updateConfig(updates: Partial<Config>): Config {
    try {
      const currentConfig = this.loadConfig();
      let provider: APIProvider = updates.apiProvider || currentConfig.apiProvider;
      
      // Auto-detect provider based on API key format if a new key is provided
      if (updates.apiKey && !updates.apiProvider) {
        // If API key starts with "sk-", it's likely an OpenAI key
        if (updates.apiKey.trim().startsWith('sk-')) {
          provider = "openai";
          console.log("Auto-detected OpenAI API key format");
        } else if (updates.apiKey.trim().startsWith('sk-ant-')) {
          provider = "anthropic";
          console.log("Auto-detected Anthropic API key format");
        } else {
          provider = "gemini";
          console.log("Using Gemini API key format (default)");
        }
        
        // Update the provider in the updates object
        updates.apiProvider = provider;
      }
      
      // If provider is changing, reset models to the default for that provider
      if (updates.apiProvider && updates.apiProvider !== currentConfig.apiProvider) {
        const defaults = DEFAULT_MODELS[updates.apiProvider];
        updates.extractionModel = defaults.extractionModel;
        updates.solutionModel = defaults.solutionModel;
        updates.debuggingModel = defaults.debuggingModel;
        updates.answerModel = defaults.answerModel;
        // Speech recognition supported for OpenAI and Gemini
        if (defaults.speechRecognitionModel) {
          updates.speechRecognitionModel = defaults.speechRecognitionModel;
        }
      }
      
      // Validate speech recognition model
      if (updates.speechRecognitionModel) {
        if (provider === "openai" && updates.speechRecognitionModel !== "whisper-1") {
          console.warn(`Invalid speech recognition model: ${updates.speechRecognitionModel}. Only whisper-1 is supported for OpenAI.`);
          updates.speechRecognitionModel = "whisper-1";
        } else if (provider === "gemini") {
          // Validate Gemini models that support audio understanding
          const allowedGeminiSpeechModels = [
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-3-flash-preview",
            "gemini-3-pro-preview",
            "gemini-2.0-flash-exp"
          ];
          if (!allowedGeminiSpeechModels.includes(updates.speechRecognitionModel)) {
            const defaultModel = DEFAULT_MODELS[provider].speechRecognitionModel || "gemini-3-flash-preview";
            console.warn(`Invalid Gemini speech recognition model: ${updates.speechRecognitionModel}. Using default: ${defaultModel}`);
            updates.speechRecognitionModel = defaultModel;
          }
        }
      }
      
      // Sanitize model selections in the updates
      if (updates.extractionModel) {
        updates.extractionModel = sanitizeModelSelection(
          updates.extractionModel,
          provider,
          "extractionModel"
        );
      }
      if (updates.solutionModel) {
        updates.solutionModel = sanitizeModelSelection(
          updates.solutionModel,
          provider,
          "solutionModel"
        );
      }
      if (updates.debuggingModel) {
        updates.debuggingModel = sanitizeModelSelection(
          updates.debuggingModel,
          provider,
          "debuggingModel"
        );
      }
      if (updates.answerModel) {
        updates.answerModel = sanitizeModelSelection(
          updates.answerModel,
          provider,
          "answerModel"
        );
      }
      
      const newConfig = { ...currentConfig, ...updates };
      this.saveConfig(newConfig);
      
      // Only emit update event for changes other than opacity
      // This prevents re-initializing the AI client when only opacity changes
      if (updates.apiKey !== undefined || updates.apiProvider !== undefined || 
          updates.extractionModel !== undefined || updates.solutionModel !== undefined || 
          updates.debuggingModel !== undefined || updates.answerModel !== undefined ||
          updates.speechRecognitionModel !== undefined || 
          updates.language !== undefined) {
        this.emit('config-updated', newConfig);
      }
      
      return newConfig;
    } catch (error) {
      console.error('Error updating config:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Check if the API key is configured
   */
  public hasApiKey(): boolean {
    const config = this.loadConfig();
    return !!config.apiKey && config.apiKey.trim().length > 0;
  }
  
  /**
   * Validate the API key format
   */
  public isValidApiKeyFormat(apiKey: string, provider?: "openai" | "gemini" | "anthropic" ): boolean {
    // If provider is not specified, attempt to auto-detect
    if (!provider) {
      if (apiKey.trim().startsWith('sk-')) {
        if (apiKey.trim().startsWith('sk-ant-')) {
          provider = "anthropic";
        } else {
          provider = "openai";
        }
      } else {
        provider = "gemini";
      }
    }
    
    if (provider === "openai") {
      // Basic format validation for OpenAI API keys
      return /^sk-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
    } else if (provider === "gemini") {
      // Basic format validation for Gemini API keys (usually alphanumeric with no specific prefix)
      return apiKey.trim().length >= 10; // Assuming Gemini keys are at least 10 chars
    } else if (provider === "anthropic") {
      // Basic format validation for Anthropic API keys
      return /^sk-ant-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
    }
    
    return false;
  }
  
  /**
   * Get the stored opacity value
   */
  public getOpacity(): number {
    const config = this.loadConfig();
    return config.opacity !== undefined ? config.opacity : 1.0;
  }

  /**
   * Set the window opacity value
   */
  public setOpacity(opacity: number): void {
    // Ensure opacity is between 0.1 and 1.0
    const validOpacity = Math.min(1.0, Math.max(0.1, opacity));
    this.updateConfig({ opacity: validOpacity });
  }  
  
  /**
   * Get the preferred programming language
   */
  public getLanguage(): string {
    const config = this.loadConfig();
    return config.language || "python";
  }

  /**
   * Set the preferred programming language
   */
  public setLanguage(language: string): void {
    this.updateConfig({ language });
  }
  
  /**
   * Test API key with the selected provider
   */
  public async testApiKey(apiKey: string, provider?: "openai" | "gemini" | "anthropic"): Promise<{valid: boolean, error?: string}> {
    // Auto-detect provider based on key format if not specified
    if (!provider) {
      if (apiKey.trim().startsWith('sk-')) {
        if (apiKey.trim().startsWith('sk-ant-')) {
          provider = "anthropic";
          console.log("Auto-detected Anthropic API key format for testing");
        } else {
          provider = "openai";
          console.log("Auto-detected OpenAI API key format for testing");
        }
      } else {
        provider = "gemini";
        console.log("Using Gemini API key format for testing (default)");
      }
    }
    
    if (provider === "openai") {
      return this.testOpenAIKey(apiKey);
    } else if (provider === "gemini") {
      return this.testGeminiKey(apiKey);
    } else if (provider === "anthropic") {
      return this.testAnthropicKey(apiKey);
    }
    
    return { valid: false, error: "Unknown API provider" };
  }
  
  /**
   * Test OpenAI API key
   */
  private async testOpenAIKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      const openai = new OpenAI({ apiKey });
      // Make a simple API call to test the key
      await openai.models.list();
      return { valid: true };
    } catch (error: any) {
      console.error('OpenAI API key test failed:', error);
      
      // Determine the specific error type for better error messages
      let errorMessage = 'Unknown error validating OpenAI API key';
      
      if (error.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI key and try again.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded. Your OpenAI API key has reached its request limit or has insufficient quota.';
      } else if (error.status === 500) {
        errorMessage = 'OpenAI server error. Please try again later.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }
  
  /**
   * Test Gemini API key
   * Note: This is a simplified implementation since we don't have the actual Gemini client
   */
  private async testGeminiKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // For now, we'll just do a basic check to ensure the key exists and has valid format
      // In production, you would connect to the Gemini API and validate the key
      if (apiKey && apiKey.trim().length >= 20) {
        // Here you would actually validate the key with a Gemini API call
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Gemini API key format.' };
    } catch (error: any) {
      console.error('Gemini API key test failed:', error);
      let errorMessage = 'Unknown error validating Gemini API key';
      
      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Test Anthropic API key
   * Note: This is a simplified implementation since we don't have the actual Anthropic client
   */
  private async testAnthropicKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // For now, we'll just do a basic check to ensure the key exists and has valid format
      // In production, you would connect to the Anthropic API and validate the key
      if (apiKey && /^sk-ant-[a-zA-Z0-9]{32,}$/.test(apiKey.trim())) {
        // Here you would actually validate the key with an Anthropic API call
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Anthropic API key format.' };
    } catch (error: any) {
      console.error('Anthropic API key test failed:', error);
      let errorMessage = 'Unknown error validating Anthropic API key';
      
      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }
}

// Export a singleton instance
export const configHelper = new ConfigHelper();
