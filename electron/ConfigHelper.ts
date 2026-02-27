// ConfigHelper.ts
import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import { EventEmitter } from "events"
import { OpenAI } from "openai"

// API URL constants for Chinese AI providers
const API_URLS = {
  deepseek: 'https://api.deepseek.com',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  bailian: 'https://coding.dashscope.aliyuncs.com/v1'  // Coding Plan 专属 URL
} as const;

interface Config {
  apiKey: string;  // Legacy: used for OpenAI/Gemini/Anthropic
  apiProvider: "openai" | "gemini" | "anthropic" | "deepseek" | "zhipu" | "bailian";
  extractionModel: string;
  solutionModel: string;
  debuggingModel: string;
  language: string;
  opacity: number;
  // Separate API keys for each provider
  openaiApiKey?: string;
  geminiApiKey?: string;
  anthropicApiKey?: string;
  deepseekApiKey?: string;
  zhipuApiKey?: string;
  bailianApiKey?: string;
}

export class ConfigHelper extends EventEmitter {
  private configPath: string;
  private defaultConfig: Config = {
    apiKey: "",
    apiProvider: "gemini", // Default to Gemini
    extractionModel: "gemini-2.0-flash", // Default to Flash for faster responses
    solutionModel: "gemini-2.0-flash",
    debuggingModel: "gemini-2.0-flash",
    language: "python",
    opacity: 1.0
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
   * Validate and sanitize model selection to ensure only allowed models are used
   */
  private sanitizeModelSelection(model: string, provider: "openai" | "gemini" | "anthropic" | "deepseek" | "zhipu" | "bailian"): string {
    if (provider === "openai") {
      // Only allow gpt-4o and gpt-4o-mini for OpenAI
      const allowedModels = ['gpt-4o', 'gpt-4o-mini'];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid OpenAI model specified: ${model}. Using default model: gpt-4o`);
        return 'gpt-4o';
      }
      return model;
    } else if (provider === "gemini")  {
      // Only allow gemini-1.5-pro and gemini-2.0-flash for Gemini
      const allowedModels = ['gemini-1.5-pro', 'gemini-2.0-flash'];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid Gemini model specified: ${model}. Using default model: gemini-2.0-flash`);
        return 'gemini-2.0-flash';
      }
      return model;
    } else if (provider === "anthropic") {
      // Only allow Claude models
      const allowedModels = ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid Anthropic model specified: ${model}. Using default model: claude-3-7-sonnet-20250219`);
        return 'claude-3-7-sonnet-20250219';
      }
      return model;
    } else if (provider === "deepseek") {
      // Deepseek models - OpenAI compatible API
      const allowedModels = ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid Deepseek model specified: ${model}. Using default model: deepseek-chat`);
        return 'deepseek-chat';
      }
      return model;
    } else if (provider === "zhipu") {
      // Zhipu/GLM models (including GLM-4.5 and GLM-5 series)
      const allowedModels = [
        'glm-4v-flash', 'glm-4v-plus',           // Vision models
        'glm-4-flash', 'glm-4-plus', 'glm-4-long', // GLM-4 text models
        'glm-4.5', 'glm-4.5-air', 'glm-4.5-airx', // GLM-4.5 series
        'glm-5', 'glm-5-plus'                     // GLM-5 series (latest)
      ];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid Zhipu model specified: ${model}. Using default model: glm-4v-flash`);
        return 'glm-4v-flash';
      }
      return model;
    } else if (provider === "bailian") {
      // Alibaba Bailian Coding Plan models
      const allowedModels = [
        // Coding Plan Pro 推荐模型 (支持图片理解)
        'qwen3.5-plus', 'kimi-k2.5',
        // Coding Plan Pro 其他模型
        'glm-5', 'MiniMax-M2.5', 'glm-4.7',
        'qwen3-max-2026-01-23', 'qwen3-coder-next', 'qwen3-coder-plus',
        // 兼容旧版本的普通百炼模型 (以防用户切换)
        'qwen-vl-max', 'qwen-vl-plus', 'qwen3-vl-plus', 'qwen3-vl-flash',
        'qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen3-max',
        'qwq-plus'
      ];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid Bailian model specified: ${model}. Using default model: qwen3.5-plus`);
        return 'qwen3.5-plus';
      }
      return model;
    }
    // Default fallback
    return model;
  }

  public loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(configData);
        
        // Ensure apiProvider is a valid value
        const validProviders = ["openai", "gemini", "anthropic", "deepseek", "zhipu", "bailian"];
        if (!validProviders.includes(config.apiProvider)) {
          config.apiProvider = "gemini"; // Default to Gemini if invalid
        }
        
        // Sanitize model selections to ensure only allowed models are used
        if (config.extractionModel) {
          config.extractionModel = this.sanitizeModelSelection(config.extractionModel, config.apiProvider);
        }
        if (config.solutionModel) {
          config.solutionModel = this.sanitizeModelSelection(config.solutionModel, config.apiProvider);
        }
        if (config.debuggingModel) {
          config.debuggingModel = this.sanitizeModelSelection(config.debuggingModel, config.apiProvider);
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
      let provider = updates.apiProvider || currentConfig.apiProvider;
      
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
        if (updates.apiProvider === "openai") {
          updates.extractionModel = "gpt-4o";
          updates.solutionModel = "gpt-4o";
          updates.debuggingModel = "gpt-4o";
        } else if (updates.apiProvider === "anthropic") {
          updates.extractionModel = "claude-3-7-sonnet-20250219";
          updates.solutionModel = "claude-3-7-sonnet-20250219";
          updates.debuggingModel = "claude-3-7-sonnet-20250219";
        } else if (updates.apiProvider === "deepseek") {
          updates.extractionModel = "deepseek-chat";
          updates.solutionModel = "deepseek-chat";
          updates.debuggingModel = "deepseek-chat";
        } else if (updates.apiProvider === "zhipu") {
          updates.extractionModel = "glm-4v-flash";
          updates.solutionModel = "glm-4v-flash";
          updates.debuggingModel = "glm-4v-flash";
        } else if (updates.apiProvider === "bailian") {
          updates.extractionModel = "qwen-vl-plus";
          updates.solutionModel = "qwen-plus";
          updates.debuggingModel = "qwen-vl-plus";
        } else {
          updates.extractionModel = "gemini-2.0-flash";
          updates.solutionModel = "gemini-2.0-flash";
          updates.debuggingModel = "gemini-2.0-flash";
        }
      }
      
      // Sanitize model selections in the updates
      if (updates.extractionModel) {
        updates.extractionModel = this.sanitizeModelSelection(updates.extractionModel, provider);
      }
      if (updates.solutionModel) {
        updates.solutionModel = this.sanitizeModelSelection(updates.solutionModel, provider);
      }
      if (updates.debuggingModel) {
        updates.debuggingModel = this.sanitizeModelSelection(updates.debuggingModel, provider);
      }

      // Save API key to the provider-specific field
      if (updates.apiKey !== undefined) {
        const targetProvider = updates.apiProvider || currentConfig.apiProvider;
        if (targetProvider === "openai") {
          updates.openaiApiKey = updates.apiKey;
        } else if (targetProvider === "gemini") {
          updates.geminiApiKey = updates.apiKey;
        } else if (targetProvider === "anthropic") {
          updates.anthropicApiKey = updates.apiKey;
        } else if (targetProvider === "deepseek") {
          updates.deepseekApiKey = updates.apiKey;
        } else if (targetProvider === "zhipu") {
          updates.zhipuApiKey = updates.apiKey;
        } else if (targetProvider === "bailian") {
          updates.bailianApiKey = updates.apiKey;
        }
      }

      const newConfig = { ...currentConfig, ...updates };
      this.saveConfig(newConfig);

      // Only emit update event for changes other than opacity
      // This prevents re-initializing the AI client when only opacity changes
      if (updates.apiKey !== undefined || updates.apiProvider !== undefined ||
          updates.extractionModel !== undefined || updates.solutionModel !== undefined ||
          updates.debuggingModel !== undefined || updates.language !== undefined) {
        this.emit('config-updated', newConfig);
      }

      return newConfig;
    } catch (error) {
      console.error('Error updating config:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Get the API key for the current provider
   */
  public getApiKeyForProvider(provider?: string): string {
    const config = this.loadConfig();
    const targetProvider = provider || config.apiProvider;

    // First check provider-specific keys
    if (targetProvider === "openai" && config.openaiApiKey) {
      return config.openaiApiKey;
    } else if (targetProvider === "gemini" && config.geminiApiKey) {
      return config.geminiApiKey;
    } else if (targetProvider === "anthropic" && config.anthropicApiKey) {
      return config.anthropicApiKey;
    } else if (targetProvider === "deepseek" && config.deepseekApiKey) {
      return config.deepseekApiKey;
    } else if (targetProvider === "zhipu" && config.zhipuApiKey) {
      return config.zhipuApiKey;
    } else if (targetProvider === "bailian" && config.bailianApiKey) {
      return config.bailianApiKey;
    }

    // Fallback to legacy apiKey field
    return config.apiKey || "";
  }

  /**
   * Check if the API key is configured for the current provider
   */
  public hasApiKey(): boolean {
    const apiKey = this.getApiKeyForProvider();
    return !!apiKey && apiKey.trim().length > 0;
  }
  
  /**
   * Validate the API key format
   */
  public isValidApiKeyFormat(apiKey: string, provider?: "openai" | "gemini" | "anthropic" | "deepseek" | "zhipu" | "bailian"): boolean {
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
      return apiKey.trim().length >= 10;
    } else if (provider === "anthropic") {
      // Basic format validation for Anthropic API keys
      return /^sk-ant-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
    } else if (provider === "deepseek") {
      // Deepseek API keys typically start with "sk-"
      return apiKey.trim().length >= 10;
    } else if (provider === "zhipu") {
      // Zhipu/GLM API keys - format varies, just check length
      return apiKey.trim().length >= 10;
    } else if (provider === "bailian") {
      // Alibaba Bailian API keys - format varies, just check length
      return apiKey.trim().length >= 10;
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
  public async testApiKey(apiKey: string, provider?: "openai" | "gemini" | "anthropic" | "deepseek" | "zhipu" | "bailian"): Promise<{valid: boolean, error?: string}> {
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
    } else if (provider === "deepseek") {
      return this.testDeepseekKey(apiKey);
    } else if (provider === "zhipu") {
      return this.testZhipuKey(apiKey);
    } else if (provider === "bailian") {
      return this.testBailianKey(apiKey);
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

  /**
   * Test Deepseek API key
   * Deepseek uses OpenAI-compatible API
   */
  private async testDeepseekKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // Deepseek uses OpenAI-compatible API with different base URL
      const openai = new OpenAI({
        apiKey,
        baseURL: API_URLS.deepseek
      });
      // Make a simple API call to test the key
      await openai.models.list();
      return { valid: true };
    } catch (error: any) {
      console.error('Deepseek API key test failed:', error);

      let errorMessage = 'Unknown error validating Deepseek API key';

      if (error.status === 401) {
        errorMessage = 'Invalid API key. Please check your Deepseek key and try again.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded. Your Deepseek API key has reached its request limit.';
      } else if (error.status === 500) {
        errorMessage = 'Deepseek server error. Please try again later.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Test Zhipu/GLM API key
   * Zhipu uses OpenAI-compatible API
   */
  private async testZhipuKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // Zhipu uses OpenAI-compatible API with different base URL
      const openai = new OpenAI({
        apiKey,
        baseURL: API_URLS.zhipu
      });
      // Make a simple API call to test the key
      await openai.models.list();
      return { valid: true };
    } catch (error: any) {
      console.error('Zhipu API key test failed:', error);

      let errorMessage = 'Unknown error validating Zhipu API key';

      if (error.status === 401) {
        errorMessage = 'Invalid API key. Please check your Zhipu key and try again.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded. Your Zhipu API key has reached its request limit.';
      } else if (error.status === 500) {
        errorMessage = 'Zhipu server error. Please try again later.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Test Alibaba Bailian API key
   * Bailian uses OpenAI-compatible API
   */
  private async testBailianKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // Bailian uses OpenAI-compatible API with different base URL
      const openai = new OpenAI({
        apiKey,
        baseURL: API_URLS.bailian
      });
      // Make a simple API call to test the key
      await openai.models.list();
      return { valid: true };
    } catch (error: any) {
      console.error('Bailian API key test failed:', error);

      let errorMessage = 'Unknown error validating Bailian API key';

      if (error.status === 401) {
        errorMessage = 'Invalid API key. Please check your Bailian/DashScope key and try again.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded. Your Bailian API key has reached its request limit.';
      } else if (error.status === 500) {
        errorMessage = 'Bailian server error. Please try again later.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      return { valid: false, error: errorMessage };
    }
  }
}

// Export a singleton instance
export const configHelper = new ConfigHelper();
