/**
 * 设置页配置的纯函数与契约归一（配置 v3：多套 provider 并存）。
 *
 * 契约真源：`{ providers: [{ id, name, baseUrl, apiFormat, apiKey, models[] }],
 * bindings: { extractionModel: { providerId, modelId }, … } }`，
 * 字段名由 JUN-47（配置层）与 JUN-48（调用层）共用，三方不得各自改名。
 * 本文件只做渲染层读写前的归一、增删去重与绑定校验，不碰存储与请求。
 */
import type {
  ApiFormat,
  BindingKey,
  Config,
  ModelBinding,
  ModelBindings,
  ProviderConfig
} from "../../types/electron"

/** API 格式三选一：顺序与设计稿下拉一致 */
export const API_FORMAT_OPTIONS: Array<{
  value: ApiFormat
  labelKey: string
}> = [
  {
    value: "anthropic-messages",
    labelKey: "ui.settings.apiFormat.anthropicMessages"
  },
  {
    value: "chat-completions",
    labelKey: "ui.settings.apiFormat.chatCompletions"
  },
  { value: "responses", labelKey: "ui.settings.apiFormat.responses" }
]

/** 设计稿默认选中项：Responses (/responses) */
export const DEFAULT_API_FORMAT: ApiFormat = "responses"

/** 三个用途字段与文案 key：控件按此顺序渲染 */
export const BINDING_FIELDS: Array<{
  key: BindingKey
  titleKey: string
  descriptionKey: string
}> = [
  {
    key: "extractionModel",
    titleKey: "ui.settings.models.extraction.title",
    descriptionKey: "ui.settings.models.extraction.description"
  },
  {
    key: "solutionModel",
    titleKey: "ui.settings.models.solution.title",
    descriptionKey: "ui.settings.models.solution.description"
  },
  {
    key: "debuggingModel",
    titleKey: "ui.settings.models.debugging.title",
    descriptionKey: "ui.settings.models.debugging.description"
  }
]

/** 未绑定的唯一表示（与配置层 `emptyBinding()` 一致） */
export function emptyBinding(): ModelBinding {
  return { providerId: "", modelId: "" }
}

/** 三个用途全部未绑定 */
export function emptyBindings(): ModelBindings {
  return {
    extractionModel: emptyBinding(),
    solutionModel: emptyBinding(),
    debuggingModel: emptyBinding()
  }
}

/** 绑定是否为"未绑定" */
export function isBindingEmpty(binding: ModelBinding): boolean {
  return !binding.providerId && !binding.modelId
}

/**
 * 生成一套新 provider 的稳定 id：`p_` + 6 位十六进制，撞车时重试。
 * 与配置层 `createProviderId` 同形；渲染层先算好 id，绑定才能在保存前指向它。
 */
export function createProviderId(existing: readonly string[]): string {
  const used = new Set(existing)
  for (let attempt = 0; attempt < 50; attempt++) {
    const suffix = Math.floor(Math.random() * 0x1000000)
      .toString(16)
      .padStart(6, "0")
    const id = `p_${suffix}`
    if (!used.has(id)) return id
  }
  return `p_auto${used.size + 1}`
}

/** 新建一套空 provider（界面点「添加配置」时用） */
export function createEmptyProvider(existingIds: readonly string[]): ProviderConfig {
  return {
    id: createProviderId(existingIds),
    name: "",
    baseUrl: "",
    apiFormat: DEFAULT_API_FORMAT,
    apiKey: "",
    models: []
  }
}

/** 把任意输入归一成合法 API 格式，非法值回落默认项（不抛错） */
export function normalizeApiFormat(value: unknown): ApiFormat {
  return API_FORMAT_OPTIONS.some((option) => option.value === value)
    ? (value as ApiFormat)
    : DEFAULT_API_FORMAT
}

/**
 * 把任意输入归一成模型 ID 列表：去掉非字符串、空串与首尾空白，按首次出现顺序去重。
 * 模型 ID 大小写敏感（`GLM-4` 与 `glm-4` 视为不同 ID），只做 trim 不做大小写折叠。
 */
export function normalizeModels(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const id = item.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

/** 追加一个模型 ID（已存在则原样返回，天然去重） */
export function addModel(models: string[], id: string): string[] {
  return normalizeModels([...models, id])
}

/** 删除一个模型 ID */
export function removeModel(models: string[], id: string): string[] {
  return models.filter((model) => model !== id)
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * 把 `getConfig()` 返回的 `providers` 归一成设置页可编辑的卡片列表。
 * - 非对象 / 缺 id 的条目丢弃（与配置层一致，id 是稳定标识）；
 * - id 重复时保留第一条；
 * - 字符串字段 trim，`models` 去重，`apiFormat` 非法回落默认项。
 */
export function normalizeProviders(value: unknown): ProviderConfig[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const providers: ProviderConfig[] = []
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue
    const raw = entry as Record<string, unknown>
    const id = asString(raw.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    providers.push({
      id,
      name: asString(raw.name),
      baseUrl: asString(raw.baseUrl),
      apiFormat: normalizeApiFormat(raw.apiFormat),
      apiKey: asString(raw.apiKey),
      models: normalizeModels(raw.models)
    })
  }
  return providers
}

/**
 * 校验并归一三个用途的绑定：
 * 每个绑定必须同时命中"存在的 provider"和"该 provider 下存在的 model"，
 * 否则置空（由上层提示重新选择），绝不留悬空引用。
 */
export function normalizeBindings(
  bindings: unknown,
  providers: readonly ProviderConfig[]
): ModelBindings {
  const result = emptyBindings()
  if (typeof bindings !== "object" || bindings === null) return result
  const raw = bindings as Record<string, unknown>

  for (const field of BINDING_FIELDS) {
    const entry = raw[field.key]
    if (typeof entry !== "object" || entry === null) continue
    const binding = entry as Record<string, unknown>
    const providerId = asString(binding.providerId)
    const modelId = asString(binding.modelId)
    if (!providerId || !modelId) continue
    const provider = providers.find((item) => item.id === providerId)
    if (!provider || !provider.models.includes(modelId)) continue
    result[field.key] = { providerId, modelId }
  }
  return result
}

/**
 * 从 `getConfig()` 的返回值归一出设置页需要的两部分。
 * v3 之前的旧结构（扁平 `apiKey` / `provider` / 字符串绑定）由主进程一次性迁移，
 * 这里不再兼容，只保证"字段缺失也不崩"。
 */
export function normalizeConfig(config: Config | null | undefined): {
  providers: ProviderConfig[]
  bindings: ModelBindings
} {
  const providers = normalizeProviders(config?.providers)
  return {
    providers,
    bindings: normalizeBindings(config?.bindings, providers)
  }
}

/**
 * 保存前把卡片列表收敛成可提交的 `providers`：
 * trim 字符串、去重模型、剔除 id 为空的脏数据（不会发生，防御性保留）。
 */
export function normalizeProviderDrafts(
  providers: readonly ProviderConfig[]
): ProviderConfig[] {
  return normalizeProviders(providers)
}

/** 判断绑定是否仍指向存在的 provider 与模型（UI 在每次编辑后自检） */
export function isBindingValid(
  binding: ModelBinding,
  providers: readonly ProviderConfig[]
): boolean {
  if (!binding.providerId || !binding.modelId) return false
  const provider = providers.find((item) => item.id === binding.providerId)
  return Boolean(provider && provider.models.includes(binding.modelId))
}

/**
 * 解析"拉取模型列表"通道的返回值。
 *
 * 兼容调用层（JUN-48）的两种返回：`{ ok, models, providerId?, error?, code? }`（实际实现）
 * 与直接返回 `string[]`。失败时 `error` 已由主进程按当前语言本地化，这里只负责抛出，
 * 让调用方拼到可见提示里；解析不出来时同样抛错，不静默当成空列表。
 */
export function parseListModels(result: unknown): {
  models: string[]
  providerId: string
} {
  if (Array.isArray(result)) {
    return { models: normalizeModels(result), providerId: "" }
  }

  if (result && typeof result === "object") {
    const payload = result as {
      ok?: boolean
      success?: boolean
      models?: unknown
      providerId?: unknown
      error?: unknown
    }

    // 失败标记优先于 models：{ ok: false, models: [] } 不能被当成"接口没有返回模型"
    if (payload.ok === false || payload.success === false) {
      throw new Error(
        typeof payload.error === "string" && payload.error
          ? payload.error
          : "list-models failed"
      )
    }

    if (Array.isArray(payload.models)) {
      return {
        models: normalizeModels(payload.models),
        providerId: asString(payload.providerId)
      }
    }

    if (typeof payload.error === "string" && payload.error) {
      throw new Error(payload.error)
    }
  }

  throw new Error("unexpected list-models response")
}

/** 去掉首尾空白与尾部斜杠（与配置层 `normalizeBaseUrl` 同口径，保存前先归一以便比对） */
export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "")
}

/** baseUrl 必须是 http(s) 绝对地址；空串由调用方决定是否允许（未配置） */
export function isValidBaseUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/** 判断两个绑定是否逐项相同（避免 setState 自激） */
export function bindingsEqual(a: ModelBindings, b: ModelBindings): boolean {
  return BINDING_FIELDS.every(
    (field) =>
      a[field.key].providerId === b[field.key].providerId &&
      a[field.key].modelId === b[field.key].modelId
  )
}

/** 判断两组 provider 卡片是否逐项相同（保存后校验是否真的落盘） */
export function providersEqual(
  a: readonly ProviderConfig[],
  b: readonly ProviderConfig[]
): boolean {
  if (a.length !== b.length) return false
  return a.every((left, index) => {
    const right = b[index]
    return (
      left.id === right.id &&
      left.name === right.name &&
      left.baseUrl === right.baseUrl &&
      left.apiFormat === right.apiFormat &&
      left.apiKey === right.apiKey &&
      left.models.length === right.models.length &&
      left.models.every((model, i) => model === right.models[i])
    )
  })
}
