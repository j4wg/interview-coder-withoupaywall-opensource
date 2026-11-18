// ConfigHelper.ts
import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import { EventEmitter } from "events"
import { OpenAI } from "openai"
import {
  CURRENT_CONFIG_VERSION,
  DEFAULT_CONFIG_DATA,
  migrateConfigData
} from "./configMigrations"
import { resolveLocale } from "./i18n/resolveLocale"
import type { Locale, UiLanguageSetting } from "./i18n/types"

interface Config {
  apiKey: string;
  apiProvider: "openai" | "gemini" | "anthropic";  // Added provider selection
  extractionModel: string;
  solutionModel: string;
  debuggingModel: string;
  language: string;
  opacity: number;
  uiLanguage: UiLanguageSetting;
  configVersion: number;
}

export class ConfigHelper extends EventEmitter {
  private configPath: string;
  private defaultConfig: Config = { ...DEFAULT_CONFIG_DATA };
  /** 写盘失败时的内存落地态：本次运行继续可用，configVersion 未落盘，下次启动重试 */
  private inMemoryConfig: Config | null = null;
  /** 非法 uiLanguage 只告警一次，避免每次读配置都刷屏 */
  private warnedInvalidUiLanguage = false;

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
    // 构造时执行一次性迁移（设计文档 5.1：ensureConfigExists 之后）
    this.applyMigrations();
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
   * 一次性迁移：`configVersion < 2` 时只覆盖 uiLanguage/language/configVersion 三个键。
   * 损坏文件先备份为 `config.invalid-<ISO>.json` 再写默认值；写盘失败不阻塞启动，下次启动重试（幂等）。
   */
  private applyMigrations(): void {
    let rawText: string;
    try {
      rawText = fs.readFileSync(this.configPath, "utf8");
    } catch (err) {
      // 文件不可读（目录只读 / 文件不存在）：本次运行用内存默认值，下次启动重试
      console.error("Error reading config for migration, using in-memory defaults:", err);
      this.inMemoryConfig = { ...this.defaultConfig };
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      this.backupInvalidConfig();
      console.error("Config file is not valid JSON, backed up and rewriting defaults:", err);
      this.saveConfig({ ...this.defaultConfig });
      return;
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      this.backupInvalidConfig();
      console.error("Config file does not contain a JSON object, backed up and rewriting defaults");
      this.saveConfig({ ...this.defaultConfig });
      return;
    }

    const { config, migrated } = migrateConfigData(parsed);
    if (!migrated) return;

    // 只落迁移函数输出的三个覆盖键 + 原有键，不在这里补默认值（defaultConfig 的补全在 loadConfig）
    const persisted = this.saveConfig(config as unknown as Config);
    if (persisted) {
      console.log(
        `Config migrated to version ${CURRENT_CONFIG_VERSION}: uiLanguage="system", language="java"`
      );
    }
  }

  /** 尽力把损坏的配置备份到同目录，失败只记日志、不阻塞启动 */
  private backupInvalidConfig(): void {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(
      path.dirname(this.configPath),
      `config.invalid-${stamp}.json`
    );
    try {
      fs.copyFileSync(this.configPath, backupPath);
      console.error("Backed up invalid config to:", backupPath);
    } catch (err) {
      console.error("Failed to back up invalid config:", err);
    }
  }

  /** 非法/缺失的 uiLanguage 归一化为 "system"，并只告警一次 */
  private normalizeUiLanguageSetting(value: unknown): UiLanguageSetting {
    if (value === "system" || value === "zh" || value === "en") {
      return value;
    }
    if (!this.warnedInvalidUiLanguage) {
      this.warnedInvalidUiLanguage = true;
      console.warn(
        `Invalid uiLanguage setting: ${JSON.stringify(value)}. Falling back to "system".`
      );
    }
    return "system";
  }

  /** 用默认值补齐缺失键（运行期不依赖迁移是否执行成功） */
  private withDefaults(config: Partial<Config>): Config {
    const merged: Config = { ...this.defaultConfig, ...config };
    merged.uiLanguage = this.normalizeUiLanguageSetting(merged.uiLanguage);
    if (typeof merged.configVersion !== "number") {
      merged.configVersion = CURRENT_CONFIG_VERSION;
    }
    return merged;
  }

  /** 读取系统语言信号；ready 前可能为空串，交由 resolveLocale 的回落链处理 */
  private readAppLocale(): string | null {
    try {
      return app.getLocale();
    } catch (err) {
      console.warn("Could not read app locale, falling back to Intl:", err);
      return null;
    }
  }

  /**
   * Validate and sanitize model selection to ensure only allowed models are used
   */
  private sanitizeModelSelection(model: string, provider: "openai" | "gemini" | "anthropic"): string {
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
        return 'gemini-2.0-flash'; // Changed default to flash
      }
      return model;
    }  else if (provider === "anthropic") {
      // Only allow Claude models
      const allowedModels = ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'];
      if (!allowedModels.includes(model)) {
        console.warn(`Invalid Anthropic model specified: ${model}. Using default model: claude-3-7-sonnet-20250219`);
        return 'claude-3-7-sonnet-20250219';
      }
      return model;
    }
    // Default fallback
    return model;
  }

  public loadConfig(): Config {
    try {
      // 写盘失败时的内存态优先：保证目录只读时界面与语言仍可用
      if (this.inMemoryConfig) {
        return this.withDefaults({ ...this.inMemoryConfig });
      }

      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const parsed: unknown = JSON.parse(configData);

        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          console.error("Config file does not contain a JSON object, using defaults");
          return { ...this.defaultConfig };
        }

        // 外部 JSON 走逐字段校验后组装，不做裸类型断言
        const source = parsed as Record<string, unknown>;

        // Ensure apiProvider is a valid value
        const apiProvider =
          source.apiProvider === "openai" ||
          source.apiProvider === "gemini" ||
          source.apiProvider === "anthropic"
            ? source.apiProvider
            : "gemini"; // Default to Gemini if invalid

        // Sanitize model selections to ensure only allowed models are used
        const config: Partial<Config> = {
          apiProvider,
          ...(typeof source.apiKey === "string" ? { apiKey: source.apiKey } : {}),
          ...(typeof source.extractionModel === "string"
            ? { extractionModel: this.sanitizeModelSelection(source.extractionModel, apiProvider) }
            : {}),
          ...(typeof source.solutionModel === "string"
            ? { solutionModel: this.sanitizeModelSelection(source.solutionModel, apiProvider) }
            : {}),
          ...(typeof source.debuggingModel === "string"
            ? { debuggingModel: this.sanitizeModelSelection(source.debuggingModel, apiProvider) }
            : {}),
          ...(typeof source.language === "string" ? { language: source.language } : {}),
          ...(typeof source.opacity === "number" ? { opacity: source.opacity } : {}),
          ...(source.uiLanguage !== undefined
            ? { uiLanguage: this.normalizeUiLanguageSetting(source.uiLanguage) }
            : {}),
          ...(typeof source.configVersion === "number"
            ? { configVersion: source.configVersion }
            : {})
        };

        return this.withDefaults(config);
      }
      
      // If no config exists, create a default one
      const defaults = { ...this.defaultConfig };
      this.saveConfig(defaults);
      return defaults;
    } catch (err) {
      console.error("Error loading config:", err);
      return { ...this.defaultConfig };
    }
  }

  /**
   * Save configuration to disk
   * 原子写：同目录临时文件 + rename，避免进程被杀时留下半截 JSON。
   * @returns 是否成功落盘；失败时本次运行改用内存态，configVersion 未落盘，下次启动重试迁移
   */
  public saveConfig(config: Config): boolean {
    const tmpPath = `${this.configPath}.tmp`;
    try {
      // Ensure the directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      // Write the config file
      fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2));
      fs.renameSync(tmpPath, this.configPath);
      this.inMemoryConfig = null;
      return true;
    } catch (err) {
      console.error("Error saving config:", err);
      // 写盘失败不阻塞启动：内存态继续可用，下次启动重试（幂等）
      this.inMemoryConfig = { ...this.defaultConfig, ...config };
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {
        // 清理临时文件失败不影响启动
      }
      return false;
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

      // 界面语言白名单：非法枚举忽略并 warn；configVersion 是主进程独占的迁移标记，一律忽略
      const sanitizedUpdates: Partial<Config> = { ...updates };
      delete sanitizedUpdates.configVersion;
      if (sanitizedUpdates.uiLanguage !== undefined) {
        if (
          sanitizedUpdates.uiLanguage !== "system" &&
          sanitizedUpdates.uiLanguage !== "zh" &&
          sanitizedUpdates.uiLanguage !== "en"
        ) {
          console.warn(
            `Invalid uiLanguage setting: ${JSON.stringify(sanitizedUpdates.uiLanguage)}. Ignoring.`
          );
          delete sanitizedUpdates.uiLanguage;
        }
      }
      
      const newConfig: Config = { ...currentConfig, ...sanitizedUpdates };
      const persisted = this.saveConfig(newConfig);

      // 界面语言真正变化且已落盘时才广播，渲染层据此重渲染；主进程不缓存语言，后续日志立即跟随
      const uiLanguageChanged =
        sanitizedUpdates.uiLanguage !== undefined &&
        sanitizedUpdates.uiLanguage !== currentConfig.uiLanguage;
      if (persisted && uiLanguageChanged) {
        this.emit("ui-language-changed", this.getUiLocale());
      }
      
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
   * 取当前生效的界面语言。每次调用都即时解析（不缓存），因此改设置后主进程日志立即跟随。
   */
  public getUiLocale(): { setting: UiLanguageSetting; locale: Locale } {
    const setting = this.loadConfig().uiLanguage;
    return { setting, locale: resolveLocale(setting, this.readAppLocale()) };
  }

  /**
   * Get the preferred programming language
   */
  public getLanguage(): string {
    const config = this.loadConfig();
    return config.language || this.defaultConfig.language;
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
