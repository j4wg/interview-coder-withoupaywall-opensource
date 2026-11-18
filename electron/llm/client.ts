/**
 * 调用客户端：三种 API 格式统一入口 + 错误归一 + 模型列表拉取。
 *
 * 约束（与 issue 验收一致）：
 * - 不依赖任何供应商 SDK，只用全局 `fetch`，三种格式走同一套 HTTP 流程；
 * - 本模块**从不抛异常**：网络错误 / 超时 / 401 / 429 / 5xx / 非 JSON 正文
 *   一律归一成带本地化文案的 `LlmFailure` / `ModelListFailure`；
 * - 不 import electron，`node --test` 可以直接对着本地 mock server 跑。
 */
import { t } from "../i18n"
import type { Locale } from "../i18n/types"
import { llmErrorMessage } from "./messages"
import {
  buildCompletionRequest,
  buildModelListRequest,
} from "./requestBuilders"
import {
  resolveTargetForPurpose,
  isValidBaseUrl,
} from "./providerConfig"
import {
  extractCompletionText,
  extractErrorDetail,
  extractModelIds,
  hasErrorPayload,
  pickSnippet,
} from "./responseParsers"
import {
  type LlmErrorCode,
  type LlmFailure,
  type LlmResult,
  type LlmTextRequest,
  type ModelBindings,
  type ModelListResult,
  type ModelPurpose,
  type ProviderConfig,
} from "./types"

/** 补全请求默认超时：与改动前 SDK 的 60s 一致 */
export const DEFAULT_TIMEOUT_MS = 60_000
/** 模型列表是轻量请求，超时给短一些，避免设置页"拉取"按钮长时间转圈 */
export const DEFAULT_MODEL_LIST_TIMEOUT_MS = 20_000

const pt = (
  locale: Locale,
  key: string,
  vars?: Record<string, string>
): string => t("processing", locale, key, vars)

function failure(
  locale: Locale,
  code: LlmErrorCode,
  extra?: { status?: number; detail?: string; vars?: Record<string, string> }
): LlmFailure {
  return {
    kind: "failure",
    ok: false,
    code,
    message: llmErrorMessage(locale, code, extra?.vars),
    status: extra?.status,
    detail: extra?.detail,
  }
}

/**
 * 连接级配置检查：baseUrl / apiKey 是否就绪。
 * 多套配置下每套各自持有 baseUrl/apiKey，只校验本次选中那一套。
 */
export function connectionSetupError(
  provider: ProviderConfig,
  locale: Locale
): LlmFailure | null {
  if (!provider.baseUrl) return failure(locale, "base-url-missing")
  if (!isValidBaseUrl(provider.baseUrl)) return failure(locale, "base-url-invalid")
  if (!provider.apiKey) return failure(locale, "api-key-missing")
  return null
}

/**
 * 调用前的配置检查：该用途是否绑定了「存在的 provider + 该 provider 下的模型」，
 * 以及那一套配置的连接信息是否完整。
 * 绑定缺失/悬空 → `binding-missing`（提示重新选择模型），不崩溃。
 */
export function providerSetupError(
  providers: readonly ProviderConfig[],
  bindings: ModelBindings,
  purpose: ModelPurpose,
  locale: Locale
): LlmFailure | null {
  const target = resolveTargetForPurpose({ providers, bindings }, purpose)
  if (!target) return failure(locale, "binding-missing")
  return connectionSetupError(target.provider, locale)
}

interface HttpResponse {
  status: number
  payload: unknown
  rawText: string
  jsonParsed: boolean
}

/**
 * 发请求并读取正文；错误一律归一成 LlmFailure（超时 / 断网 / 被取消）。
 * 不负责按状态码映射业务错误——那是 `mapHttpFailure` 的事。
 */
async function performRequest(opts: {
  url: string
  method: "GET" | "POST"
  headers: Record<string, string>
  body?: Record<string, unknown>
  locale: Locale
  timeoutMs: number
  signal?: AbortSignal
}): Promise<{ kind: "response"; response: HttpResponse } | LlmFailure> {
  const { url, method, headers, body, locale, timeoutMs, signal } = opts
  const seconds = String(Math.max(1, Math.round(timeoutMs / 1000)))

  if (signal?.aborted) return failure(locale, "aborted")

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const forwardAbort = (): void => controller.abort()
  signal?.addEventListener("abort", forwardAbort)

  const startedAt = Date.now()
  console.log(pt(locale, "processing.log.llm.request", { method, url, seconds }))

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    const rawText = await response.text()
    let jsonParsed = true
    let payload: unknown = null
    if (rawText.trim()) {
      try {
        payload = JSON.parse(rawText)
      } catch {
        jsonParsed = false
      }
    }

    console.log(
      pt(locale, "processing.log.llm.response", {
        status: String(response.status),
        ms: String(Date.now() - startedAt),
      })
    )

    return {
      kind: "response",
      response: { status: response.status, payload, rawText, jsonParsed },
    }
  } catch (error) {
    // 用户取消优先于超时判断：两个都会让 fetch 抛 AbortError
    if (signal?.aborted) return failure(locale, "aborted")
    if (timedOut) {
      const timeoutFailure = failure(locale, "timeout", {
        vars: { seconds },
      })
      console.error(
        pt(locale, "processing.log.llm.failed", {
          code: timeoutFailure.code,
          status: "-",
          detail: `${seconds}s`,
        })
      )
      return timeoutFailure
    }
    const networkFailure = failure(locale, "network", {
      detail: String((error as { message?: string })?.message ?? error),
    })
    console.error(
      pt(locale, "processing.log.llm.failed", {
        code: networkFailure.code,
        status: "-",
        detail: networkFailure.detail ?? "",
      })
    )
    return networkFailure
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", forwardAbort)
  }
}

/** 状态码 → 归一错误码（顺序有意义：先 5xx，再具体 4xx） */
function codeForStatus(status: number): LlmErrorCode {
  if (status === 401 || status === 403) return "auth"
  if (status === 429) return "rate-limit"
  if (status === 413) return "too-large"
  if (status >= 500) return "server"
  if (status >= 400) return "bad-request"
  return "unknown"
}

/** 非 2xx 响应 → 本地化失败（原始报文只进 detail/日志） */
function mapHttpFailure(
  response: HttpResponse,
  locale: Locale
): LlmFailure {
  const code = codeForStatus(response.status)
  const detail = extractErrorDetail(response.payload, response.rawText)
  const result = failure(locale, code, {
    status: response.status,
    detail,
    vars: { status: String(response.status) },
  })
  console.error(
    pt(locale, "processing.log.llm.failed", {
      code: result.code,
      status: String(response.status),
      detail,
    })
  )
  return result
}

/**
 * 按用途发一次补全请求：provider 与模型 ID 由 `bindings.<purpose>` 的
 * `{ providerId, modelId }` 决定（允许三个用途指向不同 provider）。
 * 这是三类业务请求（解析题面 / 生成方案 / debug）共用的唯一出口。
 */
export async function completeForPurpose(opts: {
  purpose: ModelPurpose
  providers: readonly ProviderConfig[]
  bindings: ModelBindings
  system?: string
  user: string
  images?: LlmTextRequest["images"]
  maxTokens?: number
  temperature?: number
  locale: Locale
  signal?: AbortSignal
  timeoutMs?: number
}): Promise<LlmResult> {
  const target = resolveTargetForPurpose(
    { providers: opts.providers, bindings: opts.bindings },
    opts.purpose
  )
  if (!target) {
    const setup = failure(opts.locale, "binding-missing")
    console.error(pt(opts.locale, "processing.log.llm.failed", {
      code: setup.code,
      status: "-",
      detail: setup.message,
    }))
    return setup
  }

  return completeText({
    provider: target.provider,
    request: {
      model: target.modelId,
      system: opts.system,
      user: opts.user,
      images: opts.images,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
      signal: opts.signal,
      timeoutMs: opts.timeoutMs,
    },
    purpose: opts.purpose,
    locale: opts.locale,
  })
}

/** 发一次补全请求（模型由调用方显式给出）；三种格式在这里合流 */
export async function completeText(opts: {
  provider: ProviderConfig
  request: LlmTextRequest
  locale: Locale
  purpose?: ModelPurpose
}): Promise<LlmResult> {
  const { provider, request, locale } = opts

  if (!request.model) return failure(locale, "model-missing")
  const setup = connectionSetupError(provider, locale)
  if (setup) return setup

  const built = buildCompletionRequest(provider, request)
  console.log(
    pt(locale, "processing.log.llm.call", {
      provider: provider.name || provider.id || "-",
      format: provider.apiFormat,
      purpose: opts.purpose ?? "-",
      model: request.model,
    })
  )

  const sent = await performRequest({
    url: built.url,
    method: built.method,
    headers: built.headers,
    body: built.body,
    locale,
    timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: request.signal,
  })
  if (sent.kind === "failure") return sent

  const response = sent.response
  if (response.status < 200 || response.status >= 300) {
    return mapHttpFailure(response, locale)
  }
  if (!response.jsonParsed) {
    const detail = pickSnippet(response.rawText)
    console.error(
      pt(locale, "processing.log.llm.failed", {
        code: "invalid-response",
        status: String(response.status),
        detail,
      })
    )
    return failure(locale, "invalid-response", { status: response.status, detail })
  }
  if (hasErrorPayload(response.payload)) {
    const detail = extractErrorDetail(response.payload, response.rawText)
    console.error(
      pt(locale, "processing.log.llm.failed", {
        code: "invalid-response",
        status: String(response.status),
        detail,
      })
    )
    return failure(locale, "invalid-response", { status: response.status, detail })
  }

  const text = extractCompletionText(provider.apiFormat, response.payload).trim()
  if (!text) {
    const detail = extractErrorDetail(response.payload, response.rawText)
    console.error(
      pt(locale, "processing.log.llm.failed", {
        code: "empty-response",
        status: String(response.status),
        detail,
      })
    )
    return failure(locale, "empty-response", { status: response.status, detail })
  }

  return { kind: "success", ok: true, text, status: response.status }
}

/**
 * 拉取模型列表：`GET {baseUrl}/models`（用传入那一套配置的 baseUrl / apiFormat / apiKey）。
 * 失败时返回空列表 + 本地化错误文案（绝不抛异常），
 * 因此设置页可以继续手工填写模型 ID。
 */
export async function listModels(opts: {
  provider: ProviderConfig
  locale: Locale
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<ModelListResult> {
  const { provider, locale } = opts
  const setup = connectionSetupError(provider, locale)
  if (setup) {
    console.error(
      pt(locale, "processing.log.llm.modelsFailed", {
        code: setup.code,
        status: "-",
        detail: setup.message,
      })
    )
    return {
      kind: "failure",
      ok: false,
      models: [],
      code: setup.code,
      message: setup.message,
      detail: setup.detail,
      providerId: provider.id,
    }
  }

  const built = buildModelListRequest(provider)
  const sent = await performRequest({
    url: built.url,
    method: built.method,
    headers: built.headers,
    locale,
    timeoutMs: opts.timeoutMs ?? DEFAULT_MODEL_LIST_TIMEOUT_MS,
    signal: opts.signal,
  })
  if (sent.kind === "failure") {
    console.error(
      pt(locale, "processing.log.llm.modelsFailed", {
        code: sent.code,
        status: sent.status === undefined ? "-" : String(sent.status),
        detail: sent.detail ?? "",
      })
    )
    return {
      kind: "failure",
      ok: false,
      models: [],
      code: sent.code,
      message: sent.message,
      status: sent.status,
      detail: sent.detail,
      providerId: provider.id,
    }
  }

  const response = sent.response
  if (response.status < 200 || response.status >= 300) {
    const httpFailure = mapHttpFailure(response, locale)
    console.error(
      pt(locale, "processing.log.llm.modelsFailed", {
        code: httpFailure.code,
        status: String(response.status),
        detail: httpFailure.detail ?? "",
      })
    )
    return {
      kind: "failure",
      ok: false,
      models: [],
      code: httpFailure.code,
      message: httpFailure.message,
      status: response.status,
      detail: httpFailure.detail,
      providerId: provider.id,
    }
  }
  if (!response.jsonParsed) {
    const detail = pickSnippet(response.rawText)
    console.error(
      pt(locale, "processing.log.llm.modelsFailed", {
        code: "invalid-response",
        status: String(response.status),
        detail,
      })
    )
    return {
      kind: "failure",
      ok: false,
      models: [],
      code: "invalid-response",
      message: llmErrorMessage(locale, "invalid-response"),
      status: response.status,
      detail,
      providerId: provider.id,
    }
  }

  // 有些网关用 200 返回 `{ error: {...} }`；不拦下来会静默返回空列表，
  // 用户看不到任何提示，违反"拉取失败要给当前语言可见提示"。
  if (hasErrorPayload(response.payload)) {
    const detail = extractErrorDetail(response.payload, response.rawText)
    console.error(
      pt(locale, "processing.log.llm.modelsFailed", {
        code: "invalid-response",
        status: String(response.status),
        detail,
      })
    )
    return {
      kind: "failure",
      ok: false,
      models: [],
      code: "invalid-response",
      message: llmErrorMessage(locale, "invalid-response"),
      status: response.status,
      detail,
      providerId: provider.id,
    }
  }

  const models = extractModelIds(response.payload)
  console.log(pt(locale, "processing.log.llm.modelsFetched", { count: String(models.length) }))
  return { kind: "success", ok: true, models, providerId: provider.id }
}
