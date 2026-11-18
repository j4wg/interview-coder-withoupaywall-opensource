/**
 * 调用层类型（唯一真源）。
 *
 * 本文件不 import electron、不碰磁盘、不发起网络请求，
 * 可被 `node --test` 直接引用（`dist-electron/llm/types.js`）。
 *
 * 字段名与 `config.json` 的契约严格一致（JUN-48 / JUN-47 / JUN-49 共用）：
 * `providers[]` 里的 `id` / `name` / `baseUrl` / `apiFormat` / `apiKey` / `models`，
 * 以及 `bindings.extractionModel` / `solutionModel` / `debuggingModel` 的
 * `{ providerId, modelId }`，任何一方不得改名。
 *
 * 多套配置并存：`bindings` 的三项各自指向某个 provider 下的某个模型，允许跨 provider。
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

/** `providers[]` 的一项（与 config.json 同构） */
export interface ProviderConfig {
  /** 稳定标识：创建后不可变，重命名只改 `name` */
  id: string
  /** 界面上的显示名，用于区分多套配置（如「公司 GLM」「个人 OpenAI」） */
  name: string
  baseUrl: string
  apiFormat: ApiFormat
  apiKey: string
  /** 模型 ID 字符串列表，不含显示名/别名 */
  models: string[]
}

/** 一个用途绑定的目标：某个 provider 下的某个模型（允许跨 provider） */
export interface ModelBinding {
  providerId: string
  modelId: string
}

/** `bindings` 段（与 config.json 同构）；`null` 表示该用途尚未绑定 */
export interface ModelBindings {
  extractionModel: ModelBinding | null
  solutionModel: ModelBinding | null
  debuggingModel: ModelBinding | null
}

/** 归一后的绑定目标：provider 一定存在、模型一定在该 provider 的 models 里 */
export interface ResolvedBinding {
  provider: ProviderConfig
  modelId: string
}

/** 配置归一后的结果；`issues` 只用于记日志，不阻塞调用 */
export interface ResolvedProviderConfig {
  providers: ProviderConfig[]
  bindings: ModelBindings
  issues: ProviderConfigIssue[]
}

/**
 * 配置归一过程中发现的问题（已归一，仅用于日志/测试断言）：
 * - `providers-missing`：顶层没有 `providers` 数组（旧单套结构未迁移也算）；
 * - `provider-invalid`：数组项不是对象，或缺少非空字符串 `id`；
 * - `binding-provider-missing` / `binding-model-missing`：绑定指向不存在的 provider / 模型，
 *   已归一为 `null`，不会留下悬空引用。
 */
export type ProviderConfigIssue =
  | "providers-missing"
  | "provider-invalid"
  | "provider-id-duplicate"
  | "provider-name-missing"
  | "baseUrl-invalid"
  | "apiFormat-invalid"
  | "models-invalid"
  | "bindings-invalid"
  | "binding-provider-missing"
  | "binding-model-missing"

/** 渲染层「拉取模型列表」时可带未保存的表单值 */
export interface ProviderOverrides {
  /** 指定要给哪一套配置拉取；新卡片（尚未保存）也用它携带 id */
  providerId?: string
  name?: string
  baseUrl?: string
  apiFormat?: ApiFormat
  apiKey?: string
}

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
  | "provider-missing"
  | "binding-missing"
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
  /** 这次拉取实际使用的配置 id（新卡片可能为空串），便于界面回填到对应卡片 */
  providerId: string
}

export interface ModelListFailure {
  kind: "failure"
  ok: false
  models: []
  code: LlmErrorCode
  message: string
  status?: number
  detail?: string
  providerId?: string
}

export type ModelListResult = ModelListSuccess | ModelListFailure

/** 这些错误码都表示"设置没配好"，界面应引导去填设置而不是重试 */
export const CONFIG_ERROR_CODES: readonly LlmErrorCode[] = [
  "base-url-missing",
  "base-url-invalid",
  "api-key-missing",
  "provider-missing",
  "binding-missing",
  "model-missing",
] as const

export function isConfigErrorCode(code: LlmErrorCode): boolean {
  return (CONFIG_ERROR_CODES as readonly string[]).includes(code)
}

/** 这些错误码表示 API Key 不可用，界面沿用原有的"API Key 无效"提示 */
export function isApiKeyErrorCode(code: LlmErrorCode): boolean {
  return code === "api-key-missing" || code === "auth"
}
