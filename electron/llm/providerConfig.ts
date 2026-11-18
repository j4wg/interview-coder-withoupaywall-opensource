/**
 * 配置归一 + 请求目标解析（纯函数，零 electron 依赖）。
 *
 * 调用层不信任磁盘上的 `config.json`：配置层（JUN-47）会做一次归一，
 * 这里再做一次防御性归一，保证"配置缺字段/写脏"时给出可见错误而不是崩溃。
 * 字段名以 issue 契约为准，不得改名。
 *
 * 多套配置并存的硬约束（口径变更 2026-11-18）：
 * - `providers[]` 每项有稳定 `id`，重命名只改 `name`；
 * - `bindings` 三项都是 `{ providerId, modelId }`，允许跨 provider；
 * - 引用不存在的 provider / 模型一律归一为 `null`，绝不留悬空引用；
 * - 删除被引用的 provider 前先用 `detachProviderBindings` 解除绑定。
 */
import {
  FALLBACK_API_FORMAT,
  isApiFormat,
  type ApiFormat,
  type ModelBinding,
  type ModelBindings,
  type ModelPurpose,
  type ProviderConfig,
  type ProviderConfigIssue,
  type ResolvedProviderConfig,
} from "./types"

/** 三种用途 → `bindings` 键名（唯一映射表，避免各处各写一份） */
const BINDING_KEY: Record<ModelPurpose, keyof ModelBindings> = {
  extraction: "extractionModel",
  solution: "solutionModel",
  debugging: "debuggingModel",
}

/** 三种用途的固定顺序（遍历配置、拼提示文案时都用它，避免键序漂移） */
export const MODEL_PURPOSES: readonly ModelPurpose[] = [
  "extraction",
  "solution",
  "debugging",
] as const

/** 某个用途对应的 `bindings` 键名 */
export function bindingKeyForPurpose(purpose: ModelPurpose): keyof ModelBindings {
  return BINDING_KEY[purpose]
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

/**
 * 归一 `providers` 数组。
 * - 非法项（非对象 / 缺 id）直接丢弃并记 issue；
 * - `id` 重复时保留第一项，后续同类项丢弃（id 是稳定标识，不允许两套配置共用）；
 * - 每项各自持有 baseUrl / apiFormat / apiKey / models，互不共用。
 */
export function normalizeProviders(raw: unknown): {
  providers: ProviderConfig[]
  issues: ProviderConfigIssue[]
} {
  if (!Array.isArray(raw)) {
    return { providers: [], issues: ["providers-missing"] }
  }

  const issues: ProviderConfigIssue[] = []
  const providers: ProviderConfig[] = []
  const seenIds = new Set<string>()

  for (const entry of raw) {
    if (!isPlainObject(entry)) {
      issues.push("provider-invalid")
      continue
    }
    const id = asTrimmedString(entry.id)
    if (!id) {
      issues.push("provider-invalid")
      continue
    }
    if (seenIds.has(id)) {
      issues.push("provider-id-duplicate")
      continue
    }
    seenIds.add(id)

    const name = asTrimmedString(entry.name)
    if (!name) issues.push("provider-name-missing")

    const baseUrl = asTrimmedString(entry.baseUrl)
    if (baseUrl && !isValidBaseUrl(baseUrl)) issues.push("baseUrl-invalid")

    let apiFormat: ApiFormat = FALLBACK_API_FORMAT
    if (isApiFormat(entry.apiFormat)) {
      apiFormat = entry.apiFormat
    } else {
      issues.push("apiFormat-invalid")
    }

    const { models, valid } = normalizeModels(entry.models)
    if (!valid) issues.push("models-invalid")

    providers.push({
      id,
      name,
      baseUrl,
      apiFormat,
      apiKey: asTrimmedString(entry.apiKey),
      models,
    })
  }

  return { providers, issues }
}

/** 按 id 找一套配置；找不到返回 `undefined` */
export function findProvider(
  providers: readonly ProviderConfig[],
  providerId: string
): ProviderConfig | undefined {
  const id = asTrimmedString(providerId)
  if (!id) return undefined
  return providers.find((provider) => provider.id === id)
}

/**
 * 归一单个绑定：必须是 `{ providerId, modelId }` 且指向真实存在的 provider/模型。
 * 任何一环不成立都返回 `null`（置空），并给出对应 issue。
 */
function normalizeBinding(
  raw: unknown,
  providers: readonly ProviderConfig[]
): {
  binding: ModelBinding | null
  issues: ProviderConfigIssue[]
} {
  if (!isPlainObject(raw)) return { binding: null, issues: ["bindings-invalid"] }

  const providerId = asTrimmedString(raw.providerId)
  const modelId = asTrimmedString(raw.modelId)
  if (!providerId || !modelId) {
    return { binding: null, issues: ["bindings-invalid"] }
  }

  const provider = findProvider(providers, providerId)
  if (!provider) {
    return { binding: null, issues: ["binding-provider-missing"] }
  }
  if (!provider.models.includes(modelId)) {
    return { binding: null, issues: ["binding-model-missing"] }
  }
  return { binding: { providerId, modelId }, issues: [] }
}

/**
 * 归一 `bindings` 段。
 * 输入为 `undefined` 视为"尚未配置"（合法空态，不记 issue）；
 * 其余非法值、悬空引用按"置空 + 记 issue"处理，绝不留悬空引用。
 */
export function normalizeBindings(
  raw: unknown,
  providers: readonly ProviderConfig[]
): {
  bindings: ModelBindings
  issues: ProviderConfigIssue[]
} {
  const empty: ModelBindings = {
    extractionModel: null,
    solutionModel: null,
    debuggingModel: null,
  }
  if (raw === undefined) return { bindings: empty, issues: [] }
  if (!isPlainObject(raw)) return { bindings: empty, issues: ["bindings-invalid"] }

  const bindings: ModelBindings = { ...empty }
  const issues: ProviderConfigIssue[] = []

  for (const purpose of MODEL_PURPOSES) {
    const key = BINDING_KEY[purpose]
    const rawBinding = raw[key]
    // 键存在但值为 null 是合法的"未绑定"
    if (rawBinding === undefined || rawBinding === null) continue
    const normalized = normalizeBinding(rawBinding, providers)
    bindings[key] = normalized.binding
    issues.push(...normalized.issues)
  }

  return { bindings, issues }
}

/**
 * 把磁盘上的配置归一为 `{ providers, bindings, issues }`。
 * 传入任何 JSON 值都不会抛错；旧单套结构（`provider` + 模型名字符串）不会在这里被兼容，
 * 迁移由配置层（JUN-47）负责。
 */
export function resolveProviderConfig(raw: unknown): ResolvedProviderConfig {
  const source = isPlainObject(raw) ? raw : {}
  const { providers, issues } = normalizeProviders(source.providers)
  const normalizedBindings = normalizeBindings(source.bindings, providers)
  return {
    providers,
    bindings: normalizedBindings.bindings,
    issues: [...issues, ...normalizedBindings.issues],
  }
}

/** 取某个用途的绑定（先校验 provider 与模型仍然存在，避免外部传入未归一的 bindings） */
export function resolveBindingForPurpose(
  providers: readonly ProviderConfig[],
  bindings: ModelBindings,
  purpose: ModelPurpose
): ModelBinding | null {
  const key = BINDING_KEY[purpose]
  if (!key) return null
  const normalized = normalizeBinding(bindings[key], providers)
  return normalized.binding
}

/**
 * 取某个用途最终的请求目标：provider + 模型 ID。
 * 绑定不完整 / 指向已删除的 provider / 模型不在该 provider 的列表里 → `null`，
 * 由调用层给出"该用途需要重新选择模型"的可见提示。
 */
export function resolveTargetForPurpose(
  config: {
    providers: readonly ProviderConfig[]
    bindings: ModelBindings
  },
  purpose: ModelPurpose
): { provider: ProviderConfig; modelId: string } | null {
  const binding = resolveBindingForPurpose(
    config.providers,
    config.bindings,
    purpose
  )
  if (!binding) return null
  const provider = findProvider(config.providers, binding.providerId)
  if (!provider) return null
  return { provider, modelId: binding.modelId }
}

/**
 * 删除 provider 前解除绑定：把指向该 provider 的用途全部置空。
 * 返回新的 bindings 与被解除的用途列表，供界面提示"该用途需要重新选择模型"。
 * 不会修改传入对象（纯函数）。
 */
export function detachProviderBindings(
  bindings: ModelBindings,
  providerId: string
): { bindings: ModelBindings; detached: ModelPurpose[] } {
  const id = asTrimmedString(providerId)
  const next: ModelBindings = { ...bindings }
  const detached: ModelPurpose[] = []
  if (!id) return { bindings: next, detached }

  for (const purpose of MODEL_PURPOSES) {
    const key = BINDING_KEY[purpose]
    const binding = next[key]
    if (binding && binding.providerId === id) {
      next[key] = null
      detached.push(purpose)
    }
  }
  return { bindings: next, detached }
}

/**
 * 渲染层"拉取模型列表"时可能带未保存的表单值。
 * 只接受字符串字段与合法枚举；类型不对的字段直接忽略（回落已保存的配置），不做裸断言。
 * `id` / `models` 不经表单覆盖：id 稳定不可变，模型列表由拉取结果决定。
 */
export function applyProviderOverrides(
  provider: ProviderConfig,
  overrides: unknown
): ProviderConfig {
  if (!isPlainObject(overrides)) return provider
  const merged: ProviderConfig = { ...provider }
  const name = asTrimmedString(overrides.name)
  if (name) merged.name = name
  const baseUrl = asTrimmedString(overrides.baseUrl)
  if (baseUrl) merged.baseUrl = baseUrl
  const apiKey = asTrimmedString(overrides.apiKey)
  if (apiKey) merged.apiKey = apiKey
  if (isApiFormat(overrides.apiFormat)) merged.apiFormat = overrides.apiFormat
  return merged
}

/**
 * 用渲染层表单值构造一套（可能尚未保存的）配置。
 * 缺字段一律给安全默认值，真正的"能不能发请求"由调用层的连接检查给出可见提示。
 */
export function providerFromOverrides(
  overrides: unknown,
  fallbackId = ""
): ProviderConfig {
  if (!isPlainObject(overrides)) {
    return {
      id: asTrimmedString(fallbackId),
      name: "",
      baseUrl: "",
      apiFormat: FALLBACK_API_FORMAT,
      apiKey: "",
      models: [],
    }
  }
  return {
    id:
      asTrimmedString(overrides.providerId) ||
      asTrimmedString(overrides.id) ||
      asTrimmedString(fallbackId),
    name: asTrimmedString(overrides.name),
    baseUrl: asTrimmedString(overrides.baseUrl),
    apiFormat: isApiFormat(overrides.apiFormat)
      ? overrides.apiFormat
      : FALLBACK_API_FORMAT,
    apiKey: asTrimmedString(overrides.apiKey),
    models: [],
  }
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
