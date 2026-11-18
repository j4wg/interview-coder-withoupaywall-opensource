// ConfigHelper.ts — 配置层（v3）：结构定义、默认值、读写、校验/归一、一次性迁移。
//
// 结构契约见 `./configMigrations.ts`（纯数据 + 纯函数）；文件级动作（创建/备份/原子写）
// 见 `./configFile.ts`；本类只做"把两者接到 electron 上"：路径解析、日志、事件、运行期兜底。
//
// 多套 provider 并存（需求方 2026-11-18 口径）：
// - `providers: [{ id, name, baseUrl, apiFormat, apiKey, models[] }]`，`id` 创建后不可变；
// - `bindings` 三项各为 `{ providerId, modelId }`，允许跨 provider；
// - 引用不存在的 provider/model → 归一为置空（`{ providerId: "", modelId: "" }`），
//   由设置页提示"该用途需要重新选择模型"，不崩溃、不留悬空引用；
// - 没有 `activeProviderId`：界面按 provider 卡片列表呈现。
import path from "node:path"
import { app } from "electron"
import { EventEmitter } from "events"
import axios from "axios"
import {
  CURRENT_CONFIG_VERSION,
  DEFAULT_CONFIG_DATA,
  addProviderConfig,
  emptyBinding,
  findBindingUses,
  mergeConfigUpdate,
  normalizeConfigData,
  removeProviderConfig,
  resolveBinding,
  updateProviderConfig,
  type ApiFormat,
  type BindingKey,
  type ConfigData,
  type ModelBinding,
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
  /** @deprecated 已迁入 `providers[].apiKey`，v3 运行期恒为 undefined */
  apiKey?: string
  /** @deprecated 已由 `providers[].apiFormat` 取代，v3 运行期恒为 undefined */
  apiProvider?: string
  /** @deprecated 已迁入 `bindings.extractionModel`，v3 运行期恒为 undefined */
  extractionModel?: string
  /** @deprecated 已迁入 `bindings.solutionModel`，v3 运行期恒为 undefined */
  solutionModel?: string
  /** @deprecated 已迁入 `bindings.debuggingModel`，v3 运行期恒为 undefined */
  debuggingModel?: string
}

/** `updateConfig` 接受的旧键：一律忽略，只用来给调用方一条告警 */
const LEGACY_UPDATE_KEYS = [
  "apiKey",
  "apiProvider",
  "provider",
  "activeProviderId",
  "extractionModel",
  "solutionModel",
  "debuggingModel"
] as const

/** 新增 provider 时允许传入的字段（`id` 由配置层生成，`name` 可后改） */
export type ProviderInput = Partial<Omit<ProviderConfig, "id">> & {
  id?: string
}

/** 新增一套 provider 的返回 */
export interface AddProviderOutcome {
  config: Config
  /** 新 provider 的 id；id 撞车时为 "" 且 `added=false` */
  providerId: string
  added: boolean
}

/** 更新一套 provider 的返回 */
export interface UpdateProviderOutcome {
  config: Config
  /** provider 存在且 patch 已被接受；不存在时为 false */
  updated: boolean
  /** 结果是否真的不同；`updated && !changed` 表示 patch 里没有可应用的字段 */
  changed: boolean
  /** 因模型列表变化被置空的用途，上层据此提示重新选择模型 */
  clearedBindings: BindingKey[]
}

/** 删除一套 provider 的返回 */
export interface RemoveProviderOutcome {
  config: Config
  removed: boolean
  /** 因删除被置空的用途，上层据此提示重新选择模型 */
  clearedBindings: BindingKey[]
}

/** 部分更新的返回（`updateConfig` / `update-config` IPC） */
export interface UpdateConfigOutcome {
  config: Config
  /** 因 `providers` 整体替换（含"删卡片 + 保存"）被置空的用途，上层据此提示重新选择模型 */
  clearedBindings: BindingKey[]
}

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
   * `bindings ⊆ providers[].models`（含跨 provider 的引用完整性）、`apiFormat` 枚举、
   * `baseUrl` 空值等不变量在这里保证。
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
   * 落盘并在"影响调用层"的字段变化时广播 `config-updated`。
   * opacity / uiLanguage 的变化不触发，避免 ProcessingHelper 无谓重建客户端。
   */
  private persist(
    previous: Config,
    next: ConfigData,
    options: { emitUiLanguageChanged?: boolean } = {}
  ): Config {
    const persisted = this.saveConfig(next);

    // 界面语言真正变化且已落盘时才广播，渲染层据此重渲染；主进程不缓存语言，后续日志立即跟随
    const uiLanguageChanged = next.uiLanguage !== previous.uiLanguage;
    if (persisted && options.emitUiLanguageChanged && uiLanguageChanged) {
      this.emit("ui-language-changed", this.getUiLocale());
    }

    const providersChanged =
      JSON.stringify(next.providers) !== JSON.stringify(previous.providers);
    const bindingsChanged =
      JSON.stringify(next.bindings) !== JSON.stringify(previous.bindings);
    const languageChanged = next.language !== previous.language;
    if (persisted && (providersChanged || bindingsChanged || languageChanged)) {
      this.emit('config-updated', next);
    }

    return next;
  }

  /**
   * 更新部分配置（设置页保存走这里）。
   *
   * - `providers` 给出数组时整体替换（传 `[]` 即清空）；非数组视为未提供；
   * - `bindings` 按用途逐项覆盖合并，之后按新的 provider 列表重新校验；
   * - 旧字段（`apiKey` / `apiProvider` / `provider` / `*Model` / `activeProviderId`）
   *   与 `configVersion` 一律忽略、不落盘，保证 `config.json` 不会回退到旧结构；
   * - 未知键忽略。
   *
   * 返回 `{ config, clearedBindings }`：整体替换 `providers` 时被删 provider / 被删模型
   * 会让相关用途失效，`clearedBindings` 列出这些用途，上层必须据此提示
   * "该用途需要重新选择模型"（不能静默置空）。
   *
   * 入参来自渲染层（外部 JSON），因此声明为 `unknown`，由纯函数内核统一解析与兜底。
   */
  public updateConfig(updates: unknown): UpdateConfigOutcome {
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

      // 合并 + 归一（引用完整性、opacity 夹到 [0,1]、apiFormat 枚举）
      const merged = mergeConfigUpdate(currentConfig, sanitized);
      const config = this.persist(currentConfig, merged.config, {
        emitUiLanguageChanged: true
      });
      return { config, clearedBindings: merged.clearedBindings };
    } catch (error) {
      console.error(this.t("main.config.updateFailed", { message: String(error) }));
      return { config: this.defaultConfig, clearedBindings: [] };
    }
  }

  /**
   * Check if the API key is configured（多套并存时：任一套填了 Key 即为已配置）
   */
  public hasApiKey(): boolean {
    const config = this.loadConfig();
    return config.providers.some(
      (provider) => provider.apiKey.trim().length > 0
    );
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

  /** 全部 provider（深拷贝：模型列表是数组，避免调用方改到内存态） */
  public getProviders(): ProviderConfig[] {
    return this.loadConfig().providers.map((provider) => ({
      ...provider,
      models: [...provider.models]
    }));
  }

  /** 按 id 取一套 provider；不存在返回 undefined（不抛错） */
  public getProvider(providerId: string): ProviderConfig | undefined {
    const provider = this.loadConfig().providers.find(
      (item) => item.id === providerId
    );
    return provider ? { ...provider, models: [...provider.models] } : undefined;
  }

  /**
   * 某套 provider 的模型列表；provider 不存在时返回空数组。
   * 需要"全部模型"时对 `getProviders()` 逐个取。
   */
  public getModels(providerId: string): string[] {
    return this.getProvider(providerId)?.models ?? [];
  }

  /** 三个用途的绑定（拷贝） */
  public getBindings(): ModelBindings {
    const bindings = this.loadConfig().bindings;
    return {
      extractionModel: { ...bindings.extractionModel },
      solutionModel: { ...bindings.solutionModel },
      debuggingModel: { ...bindings.debuggingModel }
    };
  }

  /** 单个用途的绑定；未绑定时返回 `{ providerId: "", modelId: "" }` */
  public getBinding(use: BindingKey): ModelBinding {
    const binding = this.loadConfig().bindings[use];
    return binding ? { ...binding } : emptyBinding();
  }

  /**
   * 解析某个用途实际要用的 provider + 模型 ID；未绑定或引用非法时返回 null。
   * 调用层据此选 baseUrl / apiFormat / apiKey，并给用户"先选择模型"的提示。
   */
  public resolveModelBinding(
    use: BindingKey
  ): { provider: ProviderConfig; modelId: string } | null {
    const config = this.loadConfig();
    return resolveBinding(config.bindings[use], config.providers);
  }

  /**
   * 设置某个用途的绑定。非法 `{ providerId, modelId }` 会被归一为置空（返回值里如实体现），
   * 上层据此提示"该用途需要重新选择模型"。
   */
  public setBinding(use: BindingKey, binding: unknown): Config {
    return this.updateConfig({ bindings: { [use]: binding } }).config;
  }

  /** 新增一套 provider：id 由配置层生成并返回，界面后续只改 `name` 等字段 */
  public addProvider(input: ProviderInput = {}): AddProviderOutcome {
    try {
      const current = this.loadConfig();
      const result = addProviderConfig(current, input);
      if (!result.added) {
        return { config: current, providerId: "", added: false };
      }
      const config = this.persist(current, result.config);
      return { config, providerId: result.providerId, added: true };
    } catch (error) {
      console.error(this.t("main.config.updateFailed", { message: String(error) }));
      return { config: this.defaultConfig, providerId: "", added: false };
    }
  }

  /**
   * 更新一套 provider（`id` 不可变，patch 里的 `id` 会被忽略）。
   * `models` 整体替换；指向被删模型/被清空列表的用途会被置空并出现在 `clearedBindings`。
   * patch 里的 `undefined` 表示"这次不改"（Electron IPC 会保留这种键），不会清空字段。
   */
  public updateProvider(
    providerId: string,
    patch: Partial<ProviderInput>
  ): UpdateProviderOutcome {
    try {
      const current = this.loadConfig();
      const result = updateProviderConfig(current, providerId, patch);
      if (!result.updated) {
        return { config: current, updated: false, changed: false, clearedBindings: [] };
      }
      const config = this.persist(current, result.config);
      if (result.clearedBindings.length > 0) {
        console.warn(
          this.t("main.config.bindingCleared", {
            providerId,
            uses: result.clearedBindings.join(', ')
          })
        );
      }
      return {
        config,
        updated: true,
        changed: result.changed,
        clearedBindings: result.clearedBindings
      };
    } catch (error) {
      console.error(this.t("main.config.updateFailed", { message: String(error) }));
      return { config: this.defaultConfig, updated: false, changed: false, clearedBindings: [] };
    }
  }

  /**
   * 删除一套 provider。被它引用的绑定在同一事务里置空（不留悬空引用），
   * `clearedBindings` 告诉上层该提示哪几个用途重新选择模型。
   * 想先让用户确认，可用 `getBindingUses(providerId)`。
   */
  public removeProvider(providerId: string): RemoveProviderOutcome {
    try {
      const current = this.loadConfig();
      const result = removeProviderConfig(current, providerId);
      if (!result.removed) {
        return { config: current, removed: false, clearedBindings: [] };
      }
      const config = this.persist(current, result.config);
      if (result.clearedBindings.length > 0) {
        console.warn(
          this.t("main.config.bindingCleared", {
            providerId,
            uses: result.clearedBindings.join(', ')
          })
        );
      }
      return { config, removed: true, clearedBindings: result.clearedBindings };
    } catch (error) {
      console.error(this.t("main.config.updateFailed", { message: String(error) }));
      return { config: this.defaultConfig, removed: false, clearedBindings: [] };
    }
  }

  /** 哪些用途正引用这套 provider（删除前确认用） */
  public getBindingUses(providerId: string): BindingKey[] {
    return findBindingUses(this.loadConfig().bindings, providerId);
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
   * 实测某套 provider 的 Base URL + API Key 是否可用：`GET {baseUrl}/models`，
   * 2xx 即视为有效。三种格式共用同一路径，只有鉴权头不同。
   *
   * @param apiKey 覆盖用（设置页"测试"按钮通常把当前输入框里的 Key 传进来）
   * @param providerId 要测哪一套；缺省取列表第一套（兼容尚未传 id 的旧调用）
   */
  public async testApiKey(
    apiKey?: string,
    providerId?: string
  ): Promise<{
    valid: boolean;
    error?: string;
    status?: number;
  }> {
    const providers = this.getProviders();
    const provider = providerId
      ? providers.find((item) => item.id === providerId)
      : providers[0];

    if (!provider) {
      return { valid: false, error: this.t("main.config.keyTest.noProvider") };
    }

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
