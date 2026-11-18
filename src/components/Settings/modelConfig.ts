/**
 * 设置页模型配置的纯函数与契约归一（JUN-49）。
 *
 * 契约真源：`{ provider: { baseUrl, apiFormat, apiKey, models[] }, bindings: { extractionModel,
 * solutionModel, debuggingModel } }`，字段名由 JUN-47（配置层）与 JUN-48（调用层）共用，
 * 三条 issue 不得各自改名。本文件只做渲染层读写前的归一与增删去重，不碰存储与请求。
 */
import type {
  ApiFormat,
  Config,
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
  key: keyof ModelBindings
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

/** 空绑定：列表为空时的合法值（配置层同样把空列表的绑定留空） */
export const EMPTY_BINDINGS: ModelBindings = {
  extractionModel: "",
  solutionModel: "",
  debuggingModel: ""
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

/**
 * 归一三个用途的绑定：每个值必须 ∈ models，否则回落为列表首项；
 * 列表为空时全部留空（由上层给出"先添加模型"的可见提示）。
 */
export function normalizeBindings(
  bindings: Partial<ModelBindings> | null | undefined,
  models: string[]
): ModelBindings {
  const fallback = models[0] ?? ""
  const pick = (value: unknown) =>
    typeof value === "string" && models.includes(value) ? value : fallback

  return {
    extractionModel: pick(bindings?.extractionModel),
    solutionModel: pick(bindings?.solutionModel),
    debuggingModel: pick(bindings?.debuggingModel)
  }
}

/**
 * 从 `getConfig()` 的返回值归一出设置页需要的两部分。
 *
 * JUN-47 落地前主进程仍返回旧结构（`apiKey` + 三个旧模型字段），这里做一次兜底：
 * 旧结构只继承 `apiKey`，不继承任何内置模型名（内置清单已按要求彻底删除）。
 */
export function normalizeProviderConfig(config: Config | null | undefined): {
  provider: ProviderConfig
  bindings: ModelBindings
} {
  const rawProvider = config?.provider
  const provider: ProviderConfig = {
    baseUrl:
      typeof rawProvider?.baseUrl === "string" ? rawProvider.baseUrl : "",
    apiFormat: normalizeApiFormat(rawProvider?.apiFormat),
    apiKey:
      typeof rawProvider?.apiKey === "string"
        ? rawProvider.apiKey
        : typeof config?.apiKey === "string"
          ? config.apiKey
          : "",
    models: normalizeModels(rawProvider?.models)
  }

  return {
    provider,
    bindings: normalizeBindings(config?.bindings, provider.models)
  }
}

/**
 * 解析"拉取模型列表"通道的返回值。
 *
 * 兼容调用层（JUN-48）的两种返回：`{ ok, models, error?, code? }`（实际实现）
 * 与直接返回 `string[]`。失败时 `error` 已由主进程按当前语言本地化，这里只负责抛出，
 * 让调用方拼到可见提示里；解析不出来时同样抛错，不静默当成空列表。
 */
export function parseListModels(result: unknown): string[] {
  if (Array.isArray(result)) return normalizeModels(result)

  if (result && typeof result === "object") {
    const payload = result as {
      ok?: boolean
      success?: boolean
      models?: unknown
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

    if (Array.isArray(payload.models)) return normalizeModels(payload.models)

    if (typeof payload.error === "string" && payload.error) {
      throw new Error(payload.error)
    }
  }

  throw new Error("unexpected list-models response")
}
