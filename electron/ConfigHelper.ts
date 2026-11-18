// ConfigHelper.ts — 配置层（v3）：结构定义、默认值、读写、校验/归一、一次性迁移。
//
// 结构契约见 `./configMigrations.ts`（纯数据 + 纯函数）；文件级动作（创建/备份/原子写）
// 见 `./configFile.ts`；本类只做"把两者接到 electron 上"：路径解析、日志、事件、运行期兜底。
import path from "node:path"
import { app } from "electron"
import { EventEmitter } from "events"
import axios from "axios"
import {
  CURRENT_CONFIG_VERSION,
  DEFAULT_CONFIG_DATA,
  mergeConfigUpdate,
  normalizeConfigData,
  type ApiFormat,
  type ConfigData,
  type ModelBindings,
  type ProviderConfig
} from "./configMigrations"
import {
  defaultConfigData,
  loadConfigFile,
  writeConfigFileAtomic,
  type LoadConfigFileResult
} from "./configFile"
import { createTranslator } from "./i18n/index"
import { resolveLocale } from "./i18n/resolveLocale"
import type { Locale, UiLanguageSetting } from "./i18n/types"

/**
 * 运行期配置对象：v3 结构 + 旧字段的**只读兼容桥**。
 *
 * `apiKey` / `apiProvider` / `extractionModel` / `solutionModel` / `debuggingModel`
 * 是 v2 及更早的结构。v3 起不再读写它们（`saveConfig` / `updateConfig` 会丢弃），
 * 声明在此仅为让尚未迁移的调用方（`ProcessingHelper` 的调用层）继续通过类型检查——
 * 调用层 issue 落地后应删除这一段，并同步删除 `ProcessingHelper` 中对旧字段的读取。
 *
 * @deprecated 兼容桥，勿在新代码中读写。
 */
export interface Config extends ConfigData {
  /** @deprecated 已迁入 `provider.apiKey`，v3 运行期恒为 undefined */
  apiKey?: string
  /** @deprecated 已由 `provider.apiFormat` 取代，v3 运行期恒为 undefined */
  apiProvider?: string
  /** @deprecated 已迁入 `bindings.extractionModel`，v3 运行期恒为 undefined */
  extractionModel?: string
  /** @deprecated 已迁入 `bindings.solutionModel`，v3 运行期恒为 undefined */
  solutionModel?: string
  /** @deprecated 已迁入 `bindings.debuggingModel`，v3 运行期恒为 undefined */
  debuggingModel?: string
}

/** `updateConfig` 接受的键：v3 结构 + 兼容桥字段（后者一律忽略） */
const LEGACY_UPDATE_KEYS = [
  "apiKey",
  "apiProvider",
  "extractionModel",
  "solutionModel",
  "debuggingModel"
] as const

export class ConfigHelper extends EventEmitter {
  private configPath: string;
  private defaultConfig: Config = normalizeConfigData(DEFAULT_CONFIG_DATA);
  /** 写盘失败/读盘失败时的内存落地态：本次运行继续可用，下次启动重试（幂等） */
  private inMemoryConfig: Config | null = null;
  /** 非法 uiLanguage 只告警一次，避免每次读配置都刷屏 */
  private warnedInvalidUiLanguage = false;
  /** 旧字段被传进 updateConfig 时的提示只打一次（避免设置页每次保存都刷屏） */
  private warnedLegacyUpdate = false;

  constructor() {
    super();
    // Use the app's user data directory to store the config
    try {
      this.configPath = path.join(app.getPath('userData'), 'config.json');
    } catch (err) {
      console.warn('Could not access user data path, using fallback');
      this.configPath = path.join(process.cwd(), 'config.json');
    }

    // 启动即完成：创建默认文件 / 备份损坏文件 / 一次性迁移（失败则回落内存态）
    this.boot();
    console.log(this.t("main.config.path", { path: this.configPath }));
  }

  /** 当前界面语言的翻译函数：与 mainT 同源（createTranslator + getUiLocale），但不引入循环依赖 */
  private t(key: string, vars?: Record<string, string>): string {
    const { locale } = this.getUiLocale();
    return createTranslator('main', locale)(key, vars);
  }

  /** 启动期一次性处理：读取、迁移、损坏备份都在这里落地并记录当前语言的日志 */
  private boot(): void {
    const result = loadConfigFile(this.configPath);
    // 读/写失败时先固定内存态，避免下面的日志调用（getUiLocale → loadConfig）再写一遍盘
    if (result.readFailed || result.writeFailed) {
      this.inMemoryConfig = result.config;
    }
    this.logLoadResult(result);
  }

  /** 把一次加载结果里值得让用户知道的事说清楚（当前语言） */
  private logLoadResult(result: LoadConfigFileResult): void {
    if (result.invalidBackupPath) {
      console.error(
        this.t("main.config.invalidBackedUp", { path: result.invalidBackupPath })
      );
      if (result.error) {
        console.error(this.t("main.config.invalidReason", { message: result.error }));
      }
    }
    if (result.migrated) {
      console.log(
        this.t("main.config.migrated", { version: String(CURRENT_CONFIG_VERSION) })
      );
      if (result.droppedLegacyKeys.length > 0) {
        console.log(
          this.t("main.config.legacyModelsDropped", {
            keys: result.droppedLegacyKeys.join(', ')
          })
        );
      }
    }
    if (result.normalizedKeys.length > 0) {
      console.warn(
        this.t("main.config.normalized", { keys: result.normalizedKeys.join(', ') })
      );
    }
    if (result.readFailed) {
      console.error(
        this.t("main.config.readFailed", { message: result.error || '' })
      );
    }
    if (result.writeFailed) {
      console.error(
        this.t("main.config.writeFailed", { message: result.error || '' })
      );
    }
  }

  /** 外部 JSON 的 uiLanguage 归一（非法值只告警一次） */
  private normalizeUiLanguageSetting(value: unknown): UiLanguageSetting {
    if (value === "system" || value === "zh" || value === "en") {
      return value;
    }
    if (!this.warnedInvalidUiLanguage) {
      this.warnedInvalidUiLanguage = true;
      console.warn(
        this.t("main.config.invalidUiLanguage", { value: JSON.stringify(value) ?? String(value) })
      );
    }
    return "system";
  }

  /** 读取系统语言信号；ready 前可能为空串，交由 resolveLocale 的回落链处理 */
  private readAppLocale(): string | null {
    try {
      return app.getLocale();
    } catch (err) {
      console.warn(this.t("main.config.localeUnavailable"), err);
      return null;
    }
  }

  /**
   * 读取配置。每次调用都读盘（外部改了文件也立刻生效），并做全量归一：
   * `bindings ⊆ models`、`apiFormat` 枚举、`baseUrl` 空值等不变量在这里保证。
   */
  public loadConfig(): Config {
    // 写盘失败时的内存态优先：保证目录只读时界面与语言仍可用
    if (this.inMemoryConfig) {
      return normalizeConfigData(this.inMemoryConfig);
    }

    try {
      const result = loadConfigFile(this.configPath);
      if (result.readFailed || result.writeFailed) {
        this.inMemoryConfig = result.config;
      }
      // 启动后正常路径不会再有迁移/损坏；真发生了（如外部删文件）也要给出日志
      if (result.migrated || result.invalidBackupPath) {
        this.logLoadResult(result);
      }
      return result.config;
    } catch (err) {
      console.error(this.t("main.config.readFailed", { message: String(err) }));
      return defaultConfigData();
    }
  }

  /**
   * Save configuration to disk（写盘前统一归一，落盘的永远是合法 v3 结构）
   * @returns 是否成功落盘；失败时本次运行改用内存态，下次启动重试
   */
  public saveConfig(config: Config): boolean {
    const normalized = normalizeConfigData(config);
    const written = writeConfigFileAtomic(this.configPath, normalized);
    if (written) {
      this.inMemoryConfig = null;
      return true;
    }
    console.error(this.t("main.config.writeFailed", { message: '' }));
    this.inMemoryConfig = normalized;
    return false;
  }

  /**
   * 更新部分配置。
   *
   * - `provider` / `bindings` 按字段浅合并后再归一（`bindings ⊆ models` 恒成立）；
   * - 旧字段（`apiKey` / `apiProvider` / `*Model`）与 `configVersion` 一律忽略、不落盘，
   *   保证 `config.json` 不会回退到 v2 结构；
   * - 未知键忽略。
   */
  public updateConfig(updates: Partial<Config>): Config {
    try {
      const currentConfig = this.loadConfig();
      const source: Record<string, unknown> =
        typeof updates === "object" && updates !== null
          ? (updates as Record<string, unknown>)
          : {};

      const ignoredLegacyKeys = LEGACY_UPDATE_KEYS.filter(
        (key) => source[key] !== undefined
      );
      if (ignoredLegacyKeys.length > 0 && !this.warnedLegacyUpdate) {
        this.warnedLegacyUpdate = true;
        console.warn(
          this.t("main.config.legacyUpdateIgnored", {
            keys: ignoredLegacyKeys.join(', ')
          })
        );
      }

      // 非法 uiLanguage 在这里告警并归一，其余字段交给纯函数内核
      const sanitized: Record<string, unknown> = { ...source };
      if (source.uiLanguage !== undefined) {
        sanitized.uiLanguage = this.normalizeUiLanguageSetting(source.uiLanguage);
      }

      // 合并 + 归一（bindings ⊆ models、opacity 夹到 [0,1]、apiFormat 枚举）
      const normalized: ConfigData = mergeConfigUpdate(currentConfig, sanitized);
      const persisted = this.saveConfig(normalized);

      // 界面语言真正变化且已落盘时才广播，渲染层据此重渲染；主进程不缓存语言，后续日志立即跟随
      const uiLanguageChanged =
        normalized.uiLanguage !== currentConfig.uiLanguage;
      if (persisted && uiLanguageChanged) {
        this.emit("ui-language-changed", this.getUiLocale());
      }

      // 只有影响调用层的字段变化才通知（ProcessingHelper 据此重建客户端）；
      // opacity / uiLanguage 变化不触发，避免无谓重建
      const providerChanged =
        JSON.stringify(normalized.provider) !== JSON.stringify(currentConfig.provider);
      const bindingsChanged =
        JSON.stringify(normalized.bindings) !== JSON.stringify(currentConfig.bindings);
      const languageChanged = normalized.language !== currentConfig.language;
      if (
        persisted &&
        (providerChanged || bindingsChanged || languageChanged)
      ) {
        this.emit('config-updated', normalized);
      }

      return normalized;
    } catch (error) {
      console.error(this.t("main.config.updateFailed", { message: String(error) }));
      return this.defaultConfig;
    }
  }

  /**
   * Check if the API key is configured
   */
  public hasApiKey(): boolean {
    const config = this.loadConfig();
    return !!config.provider.apiKey && config.provider.apiKey.trim().length > 0;
  }

  /**
   * API Key 格式校验：只做与供应商无关的通用检查（非空、无空白字符）。
   * 具体能否用由 `testApiKey` 打服务地址验证——v3 不再按厂商前缀猜测。
   */
  public isValidApiKeyFormat(apiKey: string): boolean {
    if (typeof apiKey !== "string") return false;
    const trimmed = apiKey.trim();
    return trimmed.length > 0 && !/\s/.test(trimmed);
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
   * 取某个用途当前绑定的模型 ID。
   * `models` 为空或绑定非法时返回空串，由上层给出"先配置模型"的可见提示。
   */
  public getBoundModel(use: keyof ModelBindings): string {
    const config = this.loadConfig();
    return config.bindings[use] || "";
  }

  /**
   * 当前模型列表（只读副本，元素为模型 ID 字符串）
   */
  public getModels(): string[] {
    return [...this.loadConfig().provider.models];
  }

  /**
   * 当前 API 格式与 Base URL（调用层按此分发）
   */
  public getProvider(): ProviderConfig {
    const config = this.loadConfig();
    return {
      ...config.provider,
      models: [...config.provider.models]
    };
  }

  /**
   * 按 API 格式组装鉴权头：Anthropic Messages 用 `x-api-key` + `anthropic-version`，
   * 其余两种用 `Authorization: Bearer`。
   */
  private buildAuthHeaders(
    apiFormat: ApiFormat,
    apiKey: string
  ): Record<string, string> {
    if (apiFormat === "anthropic-messages") {
      return {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      };
    }
    return { Authorization: `Bearer ${apiKey}` };
  }

  /**
   * 实测当前 Base URL + API Key 是否可用：`GET {baseUrl}/models`，2xx 即视为有效。
   *
   * 三种格式共用同一路径，只有鉴权头不同；拉取模型列表与"测试连通性"是同一个端点，
   * 因此本方法也给设置页的"测试"按钮用。（模型列表的完整 IPC 由调用层 issue 提供。）
   */
  public async testApiKey(apiKey?: string): Promise<{
    valid: boolean;
    error?: string;
    status?: number;
  }> {
    const provider = this.getProvider();
    const key =
      typeof apiKey === "string" && apiKey.trim().length > 0
        ? apiKey.trim()
        : provider.apiKey;

    if (!provider.baseUrl) {
      return { valid: false, error: this.t("main.config.keyTest.missingBaseUrl") };
    }
    if (!key) {
      return { valid: false, error: this.t("main.error.apiKeyFormat") };
    }

    const url = `${provider.baseUrl}/models`;
    try {
      await axios.get(url, {
        headers: this.buildAuthHeaders(provider.apiFormat, key),
        timeout: 10000
      });
      return { valid: true };
    } catch (error: unknown) {
      const status =
        axios.isAxiosError(error) && error.response
          ? error.response.status
          : undefined;
      if (status === 401 || status === 403) {
        return {
          valid: false,
          status,
          error: this.t("main.config.keyTest.invalidKey", { status: String(status) })
        };
      }
      if (status === 429) {
        return { valid: false, status, error: this.t("main.config.keyTest.rateLimited") };
      }
      if (status !== undefined && status >= 500) {
        return {
          valid: false,
          status,
          error: this.t("main.config.keyTest.serverError", { status: String(status) })
        };
      }
      if (status !== undefined) {
        return {
          valid: false,
          status,
          error: this.t("main.config.keyTest.httpError", { status: String(status) })
        };
      }
      return {
        valid: false,
        error: this.t("main.config.keyTest.networkError", {
          message: error instanceof Error ? error.message : String(error)
        })
      };
    }
  }
}

// Export a singleton instance
export const configHelper = new ConfigHelper();
