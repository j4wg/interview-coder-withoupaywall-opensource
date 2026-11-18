/**
 * 三种 API 格式的请求构造（纯函数，零 electron 依赖）。
 *
 * 每个格式单独一个函数，差异只在这里出现：
 * - 路径：`/v1/messages` / `/chat/completions` / `/responses`
 * - 鉴权：Anthropic 用 `x-api-key` + `anthropic-version`，另两种用 `Authorization: Bearer`
 * - system 位置：Anthropic 顶层 `system`、Chat Completions 的 system 消息、Responses 的 `instructions`
 * - 图片形态：base64 image block / `image_url` data URL / `input_image`
 */
import {
  type ApiFormat,
  type LlmImage,
  type LlmTextRequest,
  type ProviderSettings,
} from "./types"
import { buildEndpoint } from "./providerConfig"

/** Anthropic 要求显式声明版本头 */
export const ANTHROPIC_VERSION = "2023-06-01"

const DEFAULT_MAX_TOKENS = 4000
const DEFAULT_TEMPERATURE = 0.2

export interface BuiltRequest {
  url: string
  method: "POST"
  headers: Record<string, string>
  body: Record<string, unknown>
}

export interface BuiltModelListRequest {
  url: string
  method: "GET"
  headers: Record<string, string>
}

function mimeOf(image: LlmImage): string {
  const mime = typeof image?.mimeType === "string" ? image.mimeType.trim() : ""
  return mime || "image/png"
}

function dataUrlOf(image: LlmImage): string {
  return `data:${mimeOf(image)};base64,${image?.data ?? ""}`
}

function normalizeImages(images: LlmImage[] | undefined): LlmImage[] {
  if (!Array.isArray(images)) return []
  return images.filter(
    (image) =>
      !!image &&
      typeof image.data === "string" &&
      image.data.trim().length > 0
  )
}

/** 鉴权头按格式走；返回值里不含 `content-type`，由调用处补 */
function authHeaders(
  apiFormat: ApiFormat,
  apiKey: string
): Record<string, string> {
  if (apiFormat === "anthropic-messages") {
    return {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    }
  }
  return { authorization: `Bearer ${apiKey}` }
}

/** Anthropic：顶层 system + user 消息里的 text/image block */
function buildAnthropicBody(
  request: LlmTextRequest
): Record<string, unknown> {
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: request.user },
  ]
  for (const image of normalizeImages(request.images)) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mimeOf(image),
        data: image.data,
      },
    })
  }

  const body: Record<string, unknown> = {
    model: request.model,
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: request.temperature ?? DEFAULT_TEMPERATURE,
    messages: [{ role: "user", content }],
  }
  const system = (request.system ?? "").trim()
  if (system) body.system = system
  return body
}

/** Chat Completions：system 消息 + user 消息（无图时 content 用纯字符串，兼容性最好） */
function buildChatCompletionsBody(
  request: LlmTextRequest
): Record<string, unknown> {
  const images = normalizeImages(request.images)
  const messages: Array<Record<string, unknown>> = []
  const system = (request.system ?? "").trim()
  if (system) messages.push({ role: "system", content: system })

  if (images.length === 0) {
    messages.push({ role: "user", content: request.user })
  } else {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: request.user },
        ...images.map((image) => ({
          type: "image_url",
          image_url: { url: dataUrlOf(image) },
        })),
      ],
    })
  }

  return {
    model: request.model,
    messages,
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: request.temperature ?? DEFAULT_TEMPERATURE,
  }
}

/** Responses：instructions + input（数组形式，input_text / input_image） */
function buildResponsesBody(request: LlmTextRequest): Record<string, unknown> {
  const content: Array<Record<string, unknown>> = [
    { type: "input_text", text: request.user },
  ]
  for (const image of normalizeImages(request.images)) {
    content.push({ type: "input_image", image_url: dataUrlOf(image) })
  }

  const body: Record<string, unknown> = {
    model: request.model,
    input: [{ role: "user", content }],
    max_output_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: request.temperature ?? DEFAULT_TEMPERATURE,
  }
  const instructions = (request.system ?? "").trim()
  if (instructions) body.instructions = instructions
  return body
}

/** 构造一次文本补全请求（方法固定 POST） */
export function buildCompletionRequest(
  provider: ProviderSettings,
  request: LlmTextRequest
): BuiltRequest {
  const body =
    provider.apiFormat === "anthropic-messages"
      ? buildAnthropicBody(request)
      : provider.apiFormat === "chat-completions"
        ? buildChatCompletionsBody(request)
        : buildResponsesBody(request)

  return {
    url: buildEndpoint(provider.baseUrl, provider.apiFormat, "completion"),
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...authHeaders(provider.apiFormat, provider.apiKey),
    },
    body,
  }
}

/**
 * 构造模型列表请求：`GET {baseUrl}/models`。
 * 鉴权头按 `apiFormat` 走（Anthropic 用 x-api-key + anthropic-version）。
 */
export function buildModelListRequest(
  provider: ProviderSettings
): BuiltModelListRequest {
  return {
    url: buildEndpoint(provider.baseUrl, provider.apiFormat, "models"),
    method: "GET",
    headers: {
      accept: "application/json",
      ...authHeaders(provider.apiFormat, provider.apiKey),
    },
  }
}
