/**
 * 配置契约 v3 的唯一真源（纯数据 + 纯函数）。
 *
 * 本文件不 import electron、不碰磁盘，可被 `node --test` 直接 require；
 * 文件级动作（创建默认文件、备份损坏文件、原子写盘）在 `./configFile.ts`。
 *
 * 结构（configVersion = 3）：
 * ```
 * {
 *   provider: { baseUrl, apiFormat, apiKey, models: [<模型 ID>] },
 *   bindings: { extractionModel, solutionModel, debuggingModel },
 *   uiLanguage, language, opacity, configVersion: 3
 * }
 * ```
 *
 * 迁移口径：
 * - 触发条件：`typeof configVersion !== "number" || configVersion < 3`。
 * - `provider.apiKey` 继承旧配置的 `apiKey`（不丢 Key）；旧的内置模型选择
 *   （`apiProvider` / 三个 `*Model` 键）整体丢弃，`models` 与 `bindings` 置空，
 *   由用户在新设置页重新配置。
 * - 已知 v3 键与旧键之外的自定义键原样保留（前向兼容）。
 * - 版本已满足时完全不改动，因此用户手改任何字段后重启不会被覆盖（一次性）。
 */
import type { UiLanguageSetting } from "./i18n/types"

/** 三种 API 格式（与设置页三选一、调用层分发共用同一组字面量） */
export type ApiFormat = "anthropic-messages" | "chat-completions" | "responses"

/** 全部合法 API 格式，顺序即设置页展示顺序 */
export const API_FORMATS: readonly ApiFormat[] = [
  "anthropic-messages",
  "chat-completions",
  "responses"
]

/** 界面上的默认选项（与设置页截图一致：Responses） */
export const DEFAULT_API_FORMAT: ApiFormat = "responses"

/** 迁移标记的当前版本 */
export const CURRENT_CONFIG_VERSION = 3

/** 编程语言默认值（需求方口径：默认 java） */
export const DEFAULT_LANGUAGE = "java"

/** 三个用途的绑定键（顺序即读取/校验顺序） */
export const BINDING_KEYS = [
  "extractionModel",
  "solutionModel",
  "debuggingModel"
] as const

/** 旧结构（v2 及更早）里的配置键；迁移时不再写入顶层（`apiKey` 迁入 `provider.apiKey`） */
export const LEGACY_CONFIG_KEYS = [
  "apiKey",
  "apiProvider",
  "extractionModel",
  "solutionModel",
  "debuggingModel"
] as const

/** 旧的内置模型选择键；迁移时丢弃（不含 `apiKey`，它会被继承保留） */
export const LEGACY_MODEL_KEYS = [
  "apiProvider",
  "extractionModel",
  "solutionModel",
  "debuggingModel"
] as const

/** v3 的顶层键；迁移时由新结构整体覆盖 */
export const CONFIG_V3_KEYS = [
  "provider",
  "bindings",
  "uiLanguage",
  "language",
  "opacity",
  "configVersion"
] as const

export type BindingKey = (typeof BINDING_KEYS)[number]

/** 服务商配置：一套通用表单，不区分供应商 */
export interface ProviderConfig {
  /** 服务地址（含版本路径，如 https://api.example.com/v1）；空串 = 用户尚未配置 */
  baseUrl: string
  apiFormat: ApiFormat
  apiKey: string
  /** 模型 ID 列表（只存 ID，不存显示名/别名） */
  models: string[]
}

/** 三个用途各自指向 provider.models 中的一项 */
export type ModelBindings = Record<BindingKey, string>

/** 配置数据的完整形态（与 `ConfigHelper.Config` 逐字段一致，外加运行期兼容桥） */
export interface ConfigData {
  provider: ProviderConfig
  bindings: ModelBindings
  uiLanguage: UiLanguageSetting
  language: string
  opacity: number
  configVersion: number
}

/** 全新安装 / 损坏文件时写入的完整默认配置 */
export const DEFAULT_CONFIG_DATA: Readonly<ConfigData> = {
  provider: {
    baseUrl: "",
    apiFormat: DEFAULT_API_FORMAT,
    apiKey: "",
    models: []
  },
  bindings: {
    extractionModel: "",
    solutionModel: "",
    debuggingModel: ""
  },
  uiLanguage: "system",
  language: DEFAULT_LANGUAGE,
  opacity: 1.0,
  configVersion: CURRENT_CONFIG_VERSION
}

/** 普通对象判定：排除 null、数组、以及 JSON.parse 出来的标量 */
export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** 是否为合法 API 格式 */
export function isApiFormat(value: unknown): value is ApiFormat {
  return (
    value === "anthropic-messages" ||
    value === "chat-completions" ||
    value === "responses"
  )
}

/** 非法/缺失的界面语言归一化为跟随系统 */
export function normalizeUiLanguage(value: unknown): UiLanguageSetting {
  return value === "system" || value === "zh" || value === "en"
    ? value
    : "system"
}

/** 编程语言：非空字符串原样保留（保持既有语义），否则回默认 java */
export function normalizeLanguage(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim()
  }
  return DEFAULT_LANGUAGE
}

/** 不透明度：取 [0, 1] 内的有限数，非法值回默认 1.0（0 是合法的隐藏态） */
export function normalizeOpacity(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1.0
  return Math.min(1, Math.max(0, value))
}

/** 服务地址：去首尾空白与末尾斜杠；非字符串视为空（上层据此提示"先配置服务地址"） */
export function normalizeBaseUrl(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim().replace(/\/+$/, "")
}

/**
 * 模型 ID 列表：只保留非空字符串，去首尾空白、去重（保持原顺序）。
 * 非数组、元素非字符串一律丢弃，不抛错。
 */
export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const models: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const id = item.trim()
    if (id.length === 0 || seen.has(id)) continue
    seen.add(id)
    models.push(id)
  }
  return models
}

/** 服务商配置归一：逐字段校验，非法字段回默认值 */
export function normalizeProviderConfig(raw: unknown): ProviderConfig {
  if (!isPlainObject(raw)) {
    return { ...DEFAULT_CONFIG_DATA.provider, models: [] }
  }
  return {
    baseUrl: normalizeBaseUrl(raw.baseUrl),
    apiFormat: isApiFormat(raw.apiFormat)
      ? raw.apiFormat
      : DEFAULT_API_FORMAT,
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey.trim() : "",
    models: normalizeStringList(raw.models)
  }
}

/**
 * 三用途绑定归一：每项必须 ∈ models，否则回落列表首项；列表为空则全部留空（不抛错）。
 * 上层据此给出"先配置模型"的可见提示。
 */
export function normalizeBindings(
  raw: unknown,
  models: readonly string[]
): ModelBindings {
  const fallback = models.length > 0 ? models[0] : ""
  const source = isPlainObject(raw) ? raw : {}
  const bindings = {} as ModelBindings
  for (const key of BINDING_KEYS) {
    const value = source[key]
    bindings[key] =
      typeof value === "string" && models.includes(value.trim())
        ? value.trim()
        : fallback
  }
  return bindings
}

/**
 * 读配置时的全量归一：任何外部 JSON 都先过这里，不抛错、不做裸类型断言。
 * 旧结构的扁平 `apiKey` 在 provider 缺失时也会被继承，避免手工拷回旧文件时丢 Key。
 */
export function normalizeConfigData(raw: unknown): ConfigData {
  if (!isPlainObject(raw)) {
    return {
      ...DEFAULT_CONFIG_DATA,
      provider: { ...DEFAULT_CONFIG_DATA.provider, models: [] },
      bindings: { ...DEFAULT_CONFIG_DATA.bindings }
    }
  }

  const providerRaw = isPlainObject(raw.provider)
    ? raw.provider
    : { apiKey: typeof raw.apiKey === "string" ? raw.apiKey : undefined }
  const provider = normalizeProviderConfig(providerRaw)

  return {
    provider,
    bindings: normalizeBindings(raw.bindings, provider.models),
    uiLanguage: normalizeUiLanguage(raw.uiLanguage),
    language: normalizeLanguage(raw.language),
    opacity: normalizeOpacity(raw.opacity),
    configVersion:
      typeof raw.configVersion === "number"
        ? raw.configVersion
        : CURRENT_CONFIG_VERSION
  }
}

/**
 * 与 `normalizeConfigData` 配合使用：列出归一化改动了哪些顶层键（供日志与单测取证）。
 * 只比较 v3 的已知顶层键，未知键不参与（归一化不会改动它们）。
 */
export function diffNormalizedKeys(
  raw: unknown,
  normalized: ConfigData
): string[] {
  if (!isPlainObject(raw)) return []
  const changed: string[] = []
  for (const key of CONFIG_V3_KEYS) {
    const before = JSON.stringify(raw[key] ?? null)
    const after = JSON.stringify(
      (normalized as unknown as Record<string, unknown>)[key] ?? null
    )
    if (before !== after) changed.push(key)
  }
  return changed
}

/**
 * 把一个"部分更新"合并进现有配置（`updateConfig` 的纯函数内核，便于单测）。
 *
 * - `provider` / `bindings` 按字段浅合并；绑定对照**更新后**的模型列表校验，
 *   因此同一次更新里新加的模型可以直接被绑定；
 * - `uiLanguage` / `language` / `opacity` 只在显式给出时改；
 * - 旧字段（`apiKey` / `apiProvider` / `*Model`）与 `configVersion` 一律忽略，
 *   保证配置文件不会回退到 v2 结构；
 * - 结果再过一次 `normalizeConfigData`，`bindings subset models` 等不变量恒成立。
 */
export function mergeConfigUpdate(
  current: ConfigData,
  updates: unknown
): ConfigData {
  const source = isPlainObject(updates) ? updates : {}

  const provider = isPlainObject(source.provider)
    ? normalizeProviderConfig({ ...current.provider, ...source.provider })
    : { ...current.provider, models: [...current.provider.models] }

  const bindings = isPlainObject(source.bindings)
    ? normalizeBindings(
        { ...current.bindings, ...source.bindings },
        provider.models
      )
    : normalizeBindings(current.bindings, provider.models)

  return normalizeConfigData({
    provider,
    bindings,
    uiLanguage:
      source.uiLanguage !== undefined
        ? normalizeUiLanguage(source.uiLanguage)
        : current.uiLanguage,
    language:
      source.language !== undefined
        ? normalizeLanguage(source.language)
        : current.language,
    opacity:
      source.opacity !== undefined
        ? normalizeOpacity(source.opacity)
        : current.opacity,
    configVersion: CURRENT_CONFIG_VERSION
  })
}

/**
 * 迁移已解析的配置数据到 v3。
 *
 * @param raw `JSON.parse` 的结果，或任何无法解析的原始值
 * @returns `config` 为应落盘的数据；`migrated` 表示本次是否发生了覆盖；
 *          `droppedLegacyKeys` 为被丢弃的旧键（用于输出说明日志）
 */
export function migrateConfigData(raw: unknown): {
  config: Record<string, unknown>
  migrated: boolean
  droppedLegacyKeys: string[]
} {
  // 非普通对象（非法 JSON、空文件、数组、标量）一律回落完整默认配置
  if (!isPlainObject(raw)) {
    return {
      config: {
        ...DEFAULT_CONFIG_DATA,
        provider: { ...DEFAULT_CONFIG_DATA.provider, models: [] },
        bindings: { ...DEFAULT_CONFIG_DATA.bindings }
      },
      migrated: true,
      droppedLegacyKeys: []
    }
  }

  const version = raw.configVersion
  if (typeof version === "number" && version >= CURRENT_CONFIG_VERSION) {
    // 一次性：版本已满足，用户手改的任何字段都不会被再次覆盖
    return { config: { ...raw }, migrated: false, droppedLegacyKeys: [] }
  }

  // 旧 Key 优先于 provider.apiKey（v3 之前的文件只有扁平 apiKey）
  const inheritedApiKey =
    typeof raw.apiKey === "string"
      ? raw.apiKey
      : isPlainObject(raw.provider) && typeof raw.provider.apiKey === "string"
        ? raw.provider.apiKey
        : ""

  // 只报告"确实被丢弃"的旧模型选择键；apiKey 是继承保留的，不算丢弃
  const droppedLegacyKeys: string[] = LEGACY_MODEL_KEYS.filter(
    (key) => raw[key] !== undefined
  )
  const knownKeys = new Set<string>([
    ...LEGACY_CONFIG_KEYS,
    ...CONFIG_V3_KEYS
  ])
  const unknownKeys: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!knownKeys.has(key)) unknownKeys[key] = value
  }

  // 已知键在前、未知键追加在后，保证 diff 稳定可读
  const config: Record<string, unknown> = {
    provider: {
      baseUrl: "",
      apiFormat: DEFAULT_API_FORMAT,
      apiKey: inheritedApiKey,
      models: []
    },
    bindings: {
      extractionModel: "",
      solutionModel: "",
      debuggingModel: ""
    },
    uiLanguage: normalizeUiLanguage(raw.uiLanguage),
    language: normalizeLanguage(raw.language),
    opacity: normalizeOpacity(raw.opacity),
    configVersion: CURRENT_CONFIG_VERSION,
    ...unknownKeys
  }

  return { config, migrated: true, droppedLegacyKeys }
}
