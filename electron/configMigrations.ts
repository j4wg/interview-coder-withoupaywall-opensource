/**
 * 配置契约 v3 的唯一真源（纯数据 + 纯函数）。
 *
 * 本文件不 import electron、不碰磁盘，可被 `node --test` 直接 require；
 * 文件级动作（创建默认文件、备份损坏文件、原子写盘）在 `./configFile.ts`。
 *
 * 结构（configVersion = 3，多套 provider 并存）：
 * ```
 * {
 *   providers: [
 *     { id, name, baseUrl, apiFormat, apiKey, models: [<模型 ID>] }
 *   ],
 *   bindings: {
 *     extractionModel: { providerId, modelId },
 *     solutionModel:   { providerId, modelId },
 *     debuggingModel:  { providerId, modelId }
 *   },
 *   uiLanguage, language, opacity, configVersion: 3
 * }
 * ```
 *
 * 口径要点：
 * - `providers[].id` 稳定不可变（重命名只改 `name`）；`name` 是界面区分多套的显示名。
 * - 每套 provider 各自持有 `baseUrl` / `apiFormat` / `apiKey` / `models`，互不共用。
 * - `bindings` 每项必须同时命中"存在的 provider"和"该 provider 下存在的 model"，
 *   否则归一为 `{ providerId: "", modelId: "" }`（置空，由上层提示重新选择），
 *   不崩溃、不保留悬空引用。
 * - 不存在 `activeProviderId`：界面按 provider 卡片列表呈现。
 *
 * 迁移口径：
 * - 触发条件：`typeof configVersion !== "number" || configVersion < 3`。
 * - 旧配置的扁平 `apiKey` 继承进迁移后那条 provider（不丢 Key）；旧的内置模型选择
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

/** 旧结构（v2 及更早）里的配置键；迁移时不再写入顶层（`apiKey` 迁入 provider） */
export const LEGACY_CONFIG_KEYS = [
  "apiKey",
  "apiProvider",
  "extractionModel",
  "solutionModel",
  "debuggingModel",
  /** 未发布的单套 v3 形状；数组口径下整体丢弃，数据已由 `providers` 承载 */
  "provider",
  /** 单套时代讨论过、最终不采用的活动 provider 指针 */
  "activeProviderId"
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
  "providers",
  "bindings",
  "uiLanguage",
  "language",
  "opacity",
  "configVersion"
] as const

export type BindingKey = (typeof BINDING_KEYS)[number]

/** 服务商配置：一套通用表单，不区分供应商 */
export interface ProviderConfig {
  /**
   * 稳定标识（创建后不可变，重命名只改 `name`）。
   * 形如 `p_1a2b3c`；手工写坏的配置文件在这里会补一个确定的 `p_auto<n>`。
   */
  id: string
  /** 界面显示名（如「公司 GLM」「个人 OpenAI」）；可为空串，由界面给占位文案 */
  name: string
  /** 服务地址（含版本路径，如 https://api.example.com/v1）；空串 = 用户尚未配置 */
  baseUrl: string
  apiFormat: ApiFormat
  apiKey: string
  /** 模型 ID 列表（只存 ID，不存显示名/别名） */
  models: string[]
}

/** 某个用途的绑定：provider 与 model 必须同时存在且相互匹配 */
export interface ModelBinding {
  providerId: string
  modelId: string
}

/** 三个用途各自指向"某套 provider 里的某个模型"，允许跨 provider */
export type ModelBindings = Record<BindingKey, ModelBinding>

/** 空绑定的唯一表示（`providerId` 与 `modelId` 同时为空） */
export function emptyBinding(): ModelBinding {
  return { providerId: "", modelId: "" }
}

/** 是否为"未绑定" */
export function isBindingEmpty(binding: ModelBinding): boolean {
  return binding.providerId.length === 0 && binding.modelId.length === 0
}

/** 三个用途全部未绑定 */
export function emptyBindings(): ModelBindings {
  return {
    extractionModel: emptyBinding(),
    solutionModel: emptyBinding(),
    debuggingModel: emptyBinding()
  }
}

/** 配置数据的完整形态（与 `ConfigHelper.Config` 逐字段一致，外加运行期兼容桥） */
export interface ConfigData {
  providers: ProviderConfig[]
  bindings: ModelBindings
  uiLanguage: UiLanguageSetting
  language: string
  opacity: number
  configVersion: number
}

/** 全新安装 / 损坏文件时写入的完整默认配置（无 provider，等待用户添加） */
export const DEFAULT_CONFIG_DATA: Readonly<ConfigData> = {
  providers: [],
  bindings: emptyBindings(),
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

/** provider id：非空字符串去空白后即为合法 id；否则视为缺失 */
export function normalizeProviderId(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
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

/**
 * 为缺失/重复 id 的 provider 生成一个**确定的**后备 id。
 * 用同一份文件反复读配置会得到同一个 id，不会每次启动都变。
 */
export function uniqueProviderId(existing: Iterable<string>): string {
  const seen = new Set(existing)
  let n = 1
  while (seen.has(`p_auto${n}`)) n += 1
  return `p_auto${n}`
}

/**
 * 新建 provider 时生成 id（`p_` + 6 位十六进制）。撞车时重试，仍撞车则退回确定序号。
 * `random` 可注入，便于单测拿到确定的 id。
 */
export function createProviderId(
  existing: Iterable<string>,
  random: () => number = Math.random
): string {
  const seen = new Set(existing)
  for (let attempt = 0; attempt < 50; attempt += 1) {
    // 夹到 [0, 1)：注入的 random 返回 1 时也不会产生 7 位 id
    const unit = Math.min(0.999999, Math.max(0, random()))
    const candidate = `p_${Math.floor(unit * 0x1000000)
      .toString(16)
      .padStart(6, "0")}`
    if (!seen.has(candidate)) return candidate
  }
  return uniqueProviderId(seen)
}

/** 单套 provider 归一：逐字段校验，非法字段回默认值；id 缺失时用 `fallbackId` */
export function normalizeProviderConfig(
  raw: unknown,
  fallbackId = ""
): ProviderConfig {
  const source = isPlainObject(raw) ? raw : {}
  return {
    id: normalizeProviderId(source.id) || fallbackId,
    name: typeof source.name === "string" ? source.name.trim() : "",
    baseUrl: normalizeBaseUrl(source.baseUrl),
    apiFormat: isApiFormat(source.apiFormat)
      ? source.apiFormat
      : DEFAULT_API_FORMAT,
    apiKey: typeof source.apiKey === "string" ? source.apiKey.trim() : "",
    models: normalizeStringList(source.models)
  }
}

/**
 * provider 列表归一（多套并存）：
 * - 非数组 → 空列表；
 * - 数组里的非对象条目丢弃（不崩溃）；
 * - id 缺失或与前面重复 → 补一个确定的 `p_auto<n>`，既不丢条目也不产生重复 id。
 */
export function normalizeProviders(raw: unknown): ProviderConfig[] {
  if (!Array.isArray(raw)) return []
  const providers: ProviderConfig[] = []
  const usedIds = new Set<string>()
  for (const item of raw) {
    if (!isPlainObject(item)) continue
    const requestedId = normalizeProviderId(item.id)
    const id =
      requestedId.length > 0 && !usedIds.has(requestedId)
        ? requestedId
        : uniqueProviderId(usedIds)
    usedIds.add(id)
    // 显式带 id 覆盖条目里的 id：重复/非法 id 必须被替换掉，不能靠 fallback 保留
    providers.push(normalizeProviderConfig({ ...item, id }, id))
  }
  return providers
}

/** 按 id 查 provider（只做查找，不做归一） */
export function findProvider(
  providers: readonly ProviderConfig[],
  providerId: unknown
): ProviderConfig | undefined {
  const id = normalizeProviderId(providerId)
  if (id.length === 0) return undefined
  return providers.find((provider) => provider.id === id)
}

/**
 * 单用途绑定归一。
 *
 * - 必须同时给出 `providerId` 与 `modelId`，且 provider 存在、model 在该 provider 的
 *   `models` 里 → 原样保留（trim 后）；
 * - 任何一项不满足 → `{ providerId: "", modelId: "" }`（置空，上层据此提示重新选择）；
 * - 兼容未发布的单套 v3 形状：只有**一套** provider 时，字符串绑定按该 provider 的
 *   模型列表解析；多套并存时字符串绑定一律置空（避免猜错 provider）。
 */
export function normalizeBinding(
  raw: unknown,
  providers: readonly ProviderConfig[]
): ModelBinding {
  if (typeof raw === "string" && providers.length === 1) {
    const modelId = raw.trim()
    return modelId.length > 0 && providers[0].models.includes(modelId)
      ? { providerId: providers[0].id, modelId }
      : emptyBinding()
  }
  if (!isPlainObject(raw)) return emptyBinding()

  const providerId = normalizeProviderId(raw.providerId)
  const modelId = typeof raw.modelId === "string" ? raw.modelId.trim() : ""
  if (providerId.length === 0 || modelId.length === 0) return emptyBinding()

  const provider = providers.find((item) => item.id === providerId)
  if (!provider || !provider.models.includes(modelId)) return emptyBinding()
  return { providerId, modelId }
}

/** 三个用途的绑定归一：逐项走 `normalizeBinding`，不抛错 */
export function normalizeBindings(
  raw: unknown,
  providers: readonly ProviderConfig[]
): ModelBindings {
  const source = isPlainObject(raw) ? raw : {}
  const bindings = {} as ModelBindings
  for (const key of BINDING_KEYS) {
    bindings[key] = normalizeBinding(source[key], providers)
  }
  return bindings
}

/** 哪些用途引用了指定 provider（删除前提示、删除后告知用） */
export function findBindingUses(
  bindings: ModelBindings,
  providerId: unknown
): BindingKey[] {
  const id = normalizeProviderId(providerId)
  if (id.length === 0) return []
  return BINDING_KEYS.filter((key) => bindings[key].providerId === id)
}

/**
 * 把绑定解析成可直接发起请求的 `{ provider, modelId }`；未绑定或指向非法时返回 null。
 * 调用层（JUN-48）据此决定用哪套 baseUrl / apiFormat / apiKey。
 */
export function resolveBinding(
  binding: ModelBinding,
  providers: readonly ProviderConfig[]
): { provider: ProviderConfig; modelId: string } | null {
  if (isBindingEmpty(binding)) return null
  const provider = providers.find((item) => item.id === binding.providerId)
  if (!provider || !provider.models.includes(binding.modelId)) return null
  return { provider, modelId: binding.modelId }
}

/**
 * 读配置时的全量归一：任何外部 JSON 都先过这里，不抛错、不做裸类型断言。
 *
 * 兼容：未发布的单套 v3 形状（顶层 `provider` 对象）在**内存里**等价于一条 provider，
 * 归一化不写回文件，用户下次保存设置时自然迁成数组。
 */
export function normalizeConfigData(raw: unknown): ConfigData {
  if (!isPlainObject(raw)) {
    return {
      providers: [],
      bindings: emptyBindings(),
      uiLanguage: DEFAULT_CONFIG_DATA.uiLanguage,
      language: DEFAULT_CONFIG_DATA.language,
      opacity: DEFAULT_CONFIG_DATA.opacity,
      configVersion: CURRENT_CONFIG_VERSION
    }
  }

  const providers = normalizeProviders(
    Array.isArray(raw.providers)
      ? raw.providers
      : isPlainObject(raw.provider)
        ? [raw.provider]
        : []
  )

  return {
    providers,
    bindings: normalizeBindings(raw.bindings, providers),
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

/** 部分更新（`updateConfig` 内核）的结果 */
export interface MergeConfigUpdateResult {
  config: ConfigData
  /** 因 `providers` 整体替换而失效（置空）的用途，上层据此提示重新选择模型 */
  clearedBindings: BindingKey[]
}

/**
 * 把一个"部分更新"合并进现有配置（`updateConfig` 的纯函数内核，便于单测）。
 *
 * - `providers`：只有给出**数组**时才整体替换（传 `[]` 即清空）；非数组视为未提供，
 *   避免一次畸形更新把用户的多套配置清空。替换后按新列表重新校验绑定。
 * - `bindings`：按用途逐项覆盖合并；传 `{ providerId: "", modelId: "" }` 即置空该用途。
 *   绑定对照**更新后**的 provider 列表校验，因此同一次更新里新加的模型可以直接被绑定。
 * - `uiLanguage` / `language` / `opacity` 只在显式给出时改；
 * - 旧字段（`apiKey` / `apiProvider` / `provider` / `*Model`）、`activeProviderId` 与
 *   `configVersion` 一律忽略，保证配置文件不会回退到旧结构；
 * - 结果再过一次 `normalizeConfigData`，引用完整性不变量恒成立。
 *
 * 返回值始终带 `clearedBindings`：整体替换 `providers`（含"删掉一张卡片后保存"）时，
 * 被删除的 provider / 被删掉的模型会让相关用途失效，上层必须据此提示
 * "该用途需要重新选择模型"，不能静默置空。
 */
export function mergeConfigUpdate(
  current: ConfigData,
  updates: unknown
): MergeConfigUpdateResult {
  const base = normalizeConfigData(current)
  const source = isPlainObject(updates) ? updates : {}

  const providers = Array.isArray(source.providers)
    ? normalizeProviders(source.providers)
    : normalizeProviders(base.providers)

  const mergedBindings: Record<string, unknown> = {}
  for (const key of BINDING_KEYS) {
    mergedBindings[key] = base.bindings[key]
  }
  if (isPlainObject(source.bindings)) {
    for (const key of BINDING_KEYS) {
      if (source.bindings[key] !== undefined) {
        mergedBindings[key] = source.bindings[key]
      }
    }
  }

  const config = normalizeConfigData({
    providers,
    bindings: mergedBindings,
    uiLanguage:
      source.uiLanguage !== undefined
        ? normalizeUiLanguage(source.uiLanguage)
        : base.uiLanguage,
    language:
      source.language !== undefined
        ? normalizeLanguage(source.language)
        : base.language,
    opacity:
      source.opacity !== undefined
        ? normalizeOpacity(source.opacity)
        : base.opacity,
    configVersion: CURRENT_CONFIG_VERSION
  })

  return {
    config,
    clearedBindings: clearedBindingKeys(base.bindings, config.bindings)
  }
}

/** 新增一套 provider 的结果 */
export interface AddProviderResult {
  config: ConfigData
  /** 新 provider 的 id；`added=false` 时为空串 */
  providerId: string
  added: boolean
}

/**
 * 新增一套 provider（纯函数）。`options.id` 缺省时生成 `p_xxxxxx`；
 * id 已存在则不新增（`added=false`），由调用方换个 id 或改为更新。
 */
export function addProviderConfig(
  current: ConfigData,
  input: unknown,
  options: { id?: string; random?: () => number } = {}
): AddProviderResult {
  const base = normalizeConfigData(current)
  const source = isPlainObject(input) ? input : {}
  const requestedId =
    normalizeProviderId(options.id) || normalizeProviderId(source.id)
  const providerId =
    requestedId.length > 0
      ? requestedId
      : createProviderId(
          base.providers.map((provider) => provider.id),
          options.random
        )

  if (base.providers.some((provider) => provider.id === providerId)) {
    return { config: base, providerId: "", added: false }
  }

  const provider = normalizeProviderConfig({ ...source, id: providerId }, providerId)
  return {
    config: normalizeConfigData({
      ...base,
      providers: [...base.providers, provider]
    }),
    providerId,
    added: true
  }
}

/** 更新一套 provider 的结果 */
export interface UpdateProviderResult {
  config: ConfigData
  /** provider 存在且 patch 已被接受（会落盘）；不存在时为 false */
  updated: boolean
  /**
   * 结果与更新前是否真的不同。`updated && !changed` 表示 patch 里没有任何
   * 可应用的字段（全是 `undefined`、或只带了不可变的 `id`），上层不应提示"已保存"。
   */
  changed: boolean
  /** 因模型列表变化而被置空的用途（上层据此提示"该用途需要重新选择模型"） */
  clearedBindings: BindingKey[]
}

/**
 * 更新一套 provider（纯函数）。
 *
 * - `id` 不可变：patch 里带的 `id` 一律忽略（重命名只改 `name`）；
 * - `undefined` 表示"这次不改这个字段"，不是"清空"：Electron IPC 走 structured clone，
 *   会原样保留 `{ apiKey: undefined }` 这类键，若当成清空就会把用户的 Key / 显示名 / 模型列表
 *   静默抹掉，因此必须跳过；要清空请显式传 `""` / `[]`；
 * - `models` 给出时整体替换（增删模型都走这里），随后重新校验三个绑定，
 *   指向被删模型/被清空列表的用途会被置空并出现在 `clearedBindings` 里。
 */
export function updateProviderConfig(
  current: ConfigData,
  providerId: unknown,
  patch: unknown
): UpdateProviderResult {
  const base = normalizeConfigData(current)
  const id = normalizeProviderId(providerId)
  const target = base.providers.find((provider) => provider.id === id)
  if (!target) {
    return { config: base, updated: false, changed: false, clearedBindings: [] }
  }

  const source = isPlainObject(patch) ? patch : {}
  const merged: Record<string, unknown> = { ...target }
  for (const [key, value] of Object.entries(source)) {
    // id 不可变；undefined 表示"这次不改"（structured clone 会保留该键）
    if (key === "id" || value === undefined) continue
    merged[key] = value
  }

  const provider = normalizeProviderConfig(merged, target.id)
  const config = normalizeConfigData({
    ...base,
    providers: base.providers.map((item) =>
      item.id === target.id ? provider : item
    )
  })

  return {
    config,
    updated: true,
    changed: JSON.stringify(provider) !== JSON.stringify(target),
    clearedBindings: clearedBindingKeys(base.bindings, config.bindings)
  }
}

/** 删除一套 provider 的结果 */
export interface RemoveProviderResult {
  config: ConfigData
  removed: boolean
  /** 因删除该 provider 而被置空的用途（必须提示用户重新选择模型） */
  clearedBindings: BindingKey[]
}

/**
 * 删除一套 provider（纯函数）。
 *
 * 同一份配置里被它引用的绑定会**一并置空**（同一事务，不留悬空引用）；
 * `clearedBindings` 告诉上层该提示哪几个用途"需要重新选择模型"。
 * 界面若想先确认，可用 `findBindingUses(config.bindings, providerId)`。
 */
export function removeProviderConfig(
  current: ConfigData,
  providerId: unknown
): RemoveProviderResult {
  const base = normalizeConfigData(current)
  const id = normalizeProviderId(providerId)
  const exists = base.providers.some((provider) => provider.id === id)
  if (!exists || id.length === 0) {
    return { config: base, removed: false, clearedBindings: [] }
  }

  const clearedBindings = findBindingUses(base.bindings, id)
  const config = normalizeConfigData({
    ...base,
    providers: base.providers.filter((provider) => provider.id !== id)
  })

  return { config, removed: true, clearedBindings }
}

/** 对比前后绑定，找出被置空的用途 */
function clearedBindingKeys(
  before: ModelBindings,
  after: ModelBindings
): BindingKey[] {
  return BINDING_KEYS.filter(
    (key) => !isBindingEmpty(before[key]) && isBindingEmpty(after[key])
  )
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
        providers: [],
        bindings: emptyBindings(),
        uiLanguage: DEFAULT_CONFIG_DATA.uiLanguage,
        language: DEFAULT_CONFIG_DATA.language,
        opacity: DEFAULT_CONFIG_DATA.opacity,
        configVersion: CURRENT_CONFIG_VERSION
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

  const providers = providersFromLegacy(raw)

  // 已知键在前、未知键追加在后，保证 diff 稳定可读。
  // 旧平面 apiKey 已进 providers[0].apiKey；旧模型名不在 providers 里，故 bindings 自然为空。
  const config: Record<string, unknown> = {
    providers,
    bindings: normalizeBindings(raw.bindings, providers),
    uiLanguage: normalizeUiLanguage(raw.uiLanguage),
    language: normalizeLanguage(raw.language),
    opacity: normalizeOpacity(raw.opacity),
    configVersion: CURRENT_CONFIG_VERSION,
    ...unknownKeys
  }

  return { config, migrated: true, droppedLegacyKeys }
}

/**
 * 旧结构 → provider 列表：
 * - 已经是 `providers` 数组（部分迁移过的文件）→ 原样归一；
 * - 未发布的单套 v3 形状（`provider` 对象）→ 一条 provider，`apiKey` 兜底继承；
 * - 只有扁平 `apiKey` 的 v2 配置 → 一条只带 Key 的 provider（models 为空，
 *   等用户在新设置页补 Base URL / API 格式 / 模型）；没有 Key 的旧配置 → 空列表。
 */
function providersFromLegacy(raw: Record<string, unknown>): ProviderConfig[] {
  if (Array.isArray(raw.providers)) {
    return normalizeProviders(raw.providers)
  }

  const flatApiKey =
    typeof raw.apiKey === "string" ? raw.apiKey.trim() : ""

  if (isPlainObject(raw.provider)) {
    const provider = normalizeProviderConfig(raw.provider, uniqueProviderId([]))
    return [
      {
        ...provider,
        apiKey: provider.apiKey || flatApiKey
      }
    ]
  }

  if (flatApiKey.length === 0) return []
  const id = uniqueProviderId([])
  return [
    {
      id,
      name: "",
      baseUrl: "",
      apiFormat: DEFAULT_API_FORMAT,
      apiKey: flatApiKey,
      models: []
    }
  ]
}
