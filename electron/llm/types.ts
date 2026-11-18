/**
 * 调用层类型（唯一真源）。
 *
 * 本文件不 import electron、不碰磁盘、不发起网络请求，
 * 可被 `node --test` 直接引用（`dist-electron/llm/types.js`）。
 *
 * 字段名与 `config.json` 的契约严格一致（JUN-48 / JUN-47 / JUN-49 共用）：
 * `provider.baseUrl` / `provider.apiFormat` / `provider.apiKey` / `provider.models`
 * 与 `bindings.extractionModel` / `solutionModel` / `debuggingModel`，任何一方不得改名。
 */

/** 三种 API 格式，取值与 `provider.apiFormat` 完全一致 */
export type ApiFormat = "anthropic-messages" | "chat-completions" | "responses"

/** 三种用途，与 `bindings` 的三个键一一对应 */
export type ModelPurpose = "extraction" | "solution" | "debugging"

/** 运行期校验用的枚举白名单 */
export const API_FORMATS: readonly ApiFormat[] = [
  "anthropic-messages",
  "chat-completions",
  "responses",
] as const

/**
 * 缺失/非法 `apiFormat` 时的归一值。
 * 取 chat-completions：兼容网关最通用的一种；真正的归一由配置层（JUN-47）负责，
 * 调用层这里只保证"配置再脏也不崩"。
 */
export const FALLBACK_API_FORMAT: ApiFormat = "chat-completions"

/** 判断任意输入是否合法 API 格式（外部 JSON 走这里，不做裸类型断言） */
export function isApiFormat(value: unknown): value is ApiFormat {
  return (
    typeof value === "string" &&
    (API_FORMATS as readonly string[]).includes(value)
  )
}

/** `provider` 段（与 config.json 同构） */
export interface ProviderSettings {
  baseUrl: string
  apiFormat: ApiFormat
  apiKey: string
  /** 模型 ID 字符串列表，不含显示名/别名 */
  models: string[]
}

/** `bindings` 段（与 config.json 同构） */
export interface ModelBindings {
  extractionModel: string
  solutionModel: string
  debuggingModel: string
}

/** 配置归一后的结果；`issues` 只用于记日志，不阻塞调用 */
export interface ResolvedProviderConfig {
  provider: ProviderSettings
  bindings: ModelBindings
  issues: ProviderConfigIssue[]
}

/** 配置归一过程中发现的问题（已归一，仅用于日志/测试断言） */
export type ProviderConfigIssue =
  | "provider-missing"
  | "baseUrl-invalid"
  | "apiFormat-invalid"
  | "models-invalid"
  | "bindings-invalid"

/** 一张待发送的截图；`data` 是纯 base64，不含 `data:` 前缀 */
export interface LlmImage {
  mimeType: string
  data: string
}

/** 一次文本补全请求（三种格式共用；差异由 requestBuilders 落地） */
export interface LlmTextRequest {
  model: string
  system?: string
  user: string
  images?: LlmImage[]
  maxTokens?: number
  temperature?: number
  /** 调用方取消（用户取消当前请求） */
  signal?: AbortSignal
  /** 单次请求超时，默认 60 秒 */
  timeoutMs?: number
}

/**
 * 归一后的错误码。
 * 前端只按 code 分流（例如 auth 触发"检查 API Key"提示），文案一律走 `message`。
 */
export type LlmErrorCode =
  | "base-url-missing"
  | "base-url-invalid"
  | "api-key-missing"
  | "model-missing"
  | "network"
  | "timeout"
  | "auth"
  | "rate-limit"
  | "server"
  | "bad-request"
  | "too-large"
  | "invalid-response"
  | "empty-response"
  | "aborted"
  | "unknown"

export interface LlmFailure {
  kind: "failure"
  ok: false
  code: LlmErrorCode
  /** 已按当前界面语言本地化的用户可见文案 */
  message: string
  /** HTTP 状态码（网络错误/超时/配置错误时没有） */
  status?: number
  /** 原始错误摘要，只进日志，不直接展示给用户 */
  detail?: string
}

export interface LlmSuccess {
  kind: "success"
  ok: true
  text: string
  status: number
}

export type LlmResult = LlmSuccess | LlmFailure

export interface ModelListSuccess {
  kind: "success"
  ok: true
  models: string[]
}

export interface ModelListFailure {
  kind: "failure"
  ok: false
  models: []
  code: LlmErrorCode
  message: string
  status?: number
  detail?: string
}

export type ModelListResult = ModelListSuccess | ModelListFailure

/** 这些错误码都表示"设置没配好"，界面应引导去填设置而不是重试 */
export const CONFIG_ERROR_CODES: readonly LlmErrorCode[] = [
  "base-url-missing",
  "base-url-invalid",
  "api-key-missing",
  "model-missing",
] as const

export function isConfigErrorCode(code: LlmErrorCode): boolean {
  return (CONFIG_ERROR_CODES as readonly string[]).includes(code)
}

/** 这些错误码表示 API Key 不可用，界面沿用原有的"API Key 无效"提示 */
export function isApiKeyErrorCode(code: LlmErrorCode): boolean {
  return code === "api-key-missing" || code === "auth"
}
