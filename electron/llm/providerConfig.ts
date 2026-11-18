/**
 * 配置归一 + 请求目标解析（纯函数，零 electron 依赖）。
 *
 * 调用层不信任磁盘上的 `config.json`：配置层（JUN-47）会做一次归一，
 * 这里再做一次防御性归一，保证"配置缺字段/写脏"时给出可见错误而不是崩溃。
 * 字段名以 issue 契约为准，不得改名。
 */
import {
  FALLBACK_API_FORMAT,
  isApiFormat,
  type ApiFormat,
  type ModelBindings,
  type ModelPurpose,
  type ProviderConfigIssue,
  type ProviderSettings,
  type ResolvedProviderConfig,
} from "./types"

/** 按用途取 `bindings` 的键名（唯一映射表，避免各处各写一份） */
const BINDING_KEY: Record<ModelPurpose, keyof ModelBindings> = {
  extraction: "extractionModel",
  solution: "solutionModel",
  debugging: "debuggingModel",
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * 把模型列表归一为"非空、去重、保序"的字符串数组。
 * 非法条目（数字、对象、空串）直接丢弃，不抛错。
 */
function normalizeModels(value: unknown): {
  models: string[]
  valid: boolean
} {
  if (!Array.isArray(value)) return { models: [], valid: value === undefined }
  const seen = new Set<string>()
  const models: string[] = []
  let dropped = 0
  for (const entry of value) {
    if (typeof entry !== "string") {
      dropped++
      continue
    }
    const id = entry.trim()
    if (!id) {
      dropped++
      continue
    }
    if (seen.has(id)) continue
    seen.add(id)
    models.push(id)
  }
  return { models, valid: dropped === 0 }
}

/** 归一 provider 段；缺失时返回空配置（由上层给出"先去设置"的可见提示） */
export function normalizeProvider(raw: unknown): {
  provider: ProviderSettings
  issues: ProviderConfigIssue[]
} {
  if (!isPlainObject(raw)) {
    return {
      provider: { baseUrl: "", apiFormat: FALLBACK_API_FORMAT, apiKey: "", models: [] },
      issues: ["provider-missing"],
    }
  }

  const issues: ProviderConfigIssue[] = []
  const baseUrl = asTrimmedString(raw.baseUrl)
  if (baseUrl && !isValidBaseUrl(baseUrl)) issues.push("baseUrl-invalid")

  let apiFormat: ApiFormat = FALLBACK_API_FORMAT
  if (isApiFormat(raw.apiFormat)) {
    apiFormat = raw.apiFormat
  } else {
    issues.push("apiFormat-invalid")
  }

  const { models, valid } = normalizeModels(raw.models)
  if (!valid) issues.push("models-invalid")

  return {
    provider: {
      baseUrl,
      apiFormat,
      apiKey: asTrimmedString(raw.apiKey),
      models,
    },
    issues,
  }
}

/** 归一 bindings 段；非对象/非字符串一律按空处理 */
export function normalizeBindings(raw: unknown): {
  bindings: ModelBindings
  valid: boolean
} {
  if (!isPlainObject(raw)) {
    return {
      bindings: { extractionModel: "", solutionModel: "", debuggingModel: "" },
      valid: raw === undefined,
    }
  }
  return {
    bindings: {
      extractionModel: asTrimmedString(raw.extractionModel),
      solutionModel: asTrimmedString(raw.solutionModel),
      debuggingModel: asTrimmedString(raw.debuggingModel),
    },
    valid: true,
  }
}

/**
 * 把磁盘上的配置（v3 结构）归一为 `{ provider, bindings, issues }`。
 * 传入任何 JSON 值都不会抛错；旧结构（`apiProvider` 那套）不会在这里被兼容，
 * 迁移由配置层负责。
 */
export function resolveProviderConfig(raw: unknown): ResolvedProviderConfig {
  const source = isPlainObject(raw) ? raw : {}
  const { provider, issues } = normalizeProvider(source.provider)
  const { bindings, valid } = normalizeBindings(source.bindings)
  if (!valid) issues.push("bindings-invalid")
  return { provider, bindings, issues }
}

/**
 * 渲染层"拉取模型列表"时可能带未保存的表单值。
 * 只接受字符串字段；类型不对的字段直接忽略（回落已保存的配置），不做裸断言。
 */
export function applyProviderOverrides(
  provider: ProviderSettings,
  overrides: unknown
): ProviderSettings {
  if (!isPlainObject(overrides)) return provider
  const merged: ProviderSettings = { ...provider }
  const baseUrl = asTrimmedString(overrides.baseUrl)
  if (baseUrl) merged.baseUrl = baseUrl
  const apiKey = asTrimmedString(overrides.apiKey)
  if (apiKey) merged.apiKey = apiKey
  if (isApiFormat(overrides.apiFormat)) merged.apiFormat = overrides.apiFormat
  return merged
}

/** baseUrl 必须是 http(s) 绝对地址；其余协议（file/ftp/data）一律拒绝 */
export function isValidBaseUrl(baseUrl: string): boolean {
  const trimmed = baseUrl.trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * 按 `apiFormat` 决定具体路径。规则（与 issue 契约一致）：
 * - 三种格式的请求目标 = `provider.baseUrl` + 格式对应的路径；
 * - `anthropic-messages` 固定 `/v1/messages`，baseUrl 已经带 `/v1` 时不重复拼；
 * - 模型列表固定 `{baseUrl}/models`（Anthropic 官方地址请把 `/v1` 写进 baseUrl）。
 * baseUrl 末尾的 `/` 会被吃掉，已经带完整路径时不会再拼一次。
 */
export function buildEndpoint(
  baseUrl: string,
  apiFormat: ApiFormat,
  kind: "completion" | "models"
): string {
  const root = baseUrl.trim().replace(/\/+$/, "")

  if (kind === "models") {
    return root.endsWith("/models") ? root : `${root}/models`
  }

  if (apiFormat === "anthropic-messages") {
    if (root.endsWith("/v1/messages")) return root
    if (root.endsWith("/v1")) return `${root}/messages`
    return `${root}/v1/messages`
  }

  const suffix =
    apiFormat === "chat-completions" ? "/chat/completions" : "/responses"
  return root.endsWith(suffix) ? root : `${root}${suffix}`
}

/**
 * 取某个用途要用的模型 ID。
 * 优先级：`bindings.<purpose>`（且确实在 models 里）→ `models[0]` → 该 binding 原值 → 空串。
 * 与配置层"指向不存在的模型时回落为列表首项"的口径一致。
 */
export function resolveModelForPurpose(
  provider: ProviderSettings,
  bindings: ModelBindings,
  purpose: ModelPurpose
): string {
  const key = BINDING_KEY[purpose]
  // 运行期防御：purpose 不在一一映射里时返回空串，由上层给"未选模型"的可见提示
  if (!key) return ""
  const bound = asTrimmedString(bindings[key])
  if (bound && provider.models.includes(bound)) return bound
  if (provider.models.length > 0) return provider.models[0]
  return bound
}

/** 该用途是否已有可用模型（用于调用前的快速判断） */
export function hasModelForPurpose(
  provider: ProviderSettings,
  bindings: ModelBindings,
  purpose: ModelPurpose
): boolean {
  return resolveModelForPurpose(provider, bindings, purpose) !== ""
}
