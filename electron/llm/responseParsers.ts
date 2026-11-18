/**
 * 三种 API 格式的响应解析（纯函数，零 electron 依赖）。
 *
 * 解析目标只有两个：
 * 1. 从响应 JSON 里取出助手文本（三种格式的结构完全不同）；
 * 2. 从错误响应里取一段可进日志的原始摘要（绝不直接当用户文案）。
 * 结构不认识时返回空结果，由调用层归一成 `invalid-response`，不抛异常。
 */
import type { ApiFormat } from "./types"

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : ""
}

/** Anthropic Messages：`content: [{ type: "text", text }]`，只拼接 text 块 */
function extractAnthropicText(payload: Record<string, unknown>): string {
  const content = payload.content
  if (!Array.isArray(content)) return ""
  return content
    .filter((part) => isPlainObject(part) && part.type === "text")
    .map((part) => asText((part as Record<string, unknown>).text))
    .join("")
}

/** Chat Completions：`choices[0].message.content`（字符串或分段数组），兜底 `choices[0].text` */
function extractChatCompletionsText(payload: Record<string, unknown>): string {
  const choices = payload.choices
  if (!Array.isArray(choices) || choices.length === 0) return ""
  const first = choices[0]
  if (!isPlainObject(first)) return ""

  const message = first.message
  if (isPlainObject(message)) {
    const content = message.content
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (!isPlainObject(part)) return ""
          return asText(part.text) || asText(part.content)
        })
        .join("")
    }
  }

  // 兼容部分网关返回的旧式纯文本字段
  return asText(first.text)
}

/** Responses：优先 `output_text`，否则遍历 `output[].content[].text` */
function extractResponsesText(payload: Record<string, unknown>): string {
  const shortcut = asText(payload.output_text)
  if (shortcut) return shortcut

  const output = payload.output
  if (!Array.isArray(output)) return ""

  const texts: string[] = []
  for (const item of output) {
    if (!isPlainObject(item)) continue
    const content = item.content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!isPlainObject(part)) continue
      const type = asText(part.type)
      if (type === "output_text" || type === "text") {
        const text = asText(part.text)
        if (text) texts.push(text)
      }
    }
  }
  return texts.join("\n")
}

/** 按格式取助手文本；取不到返回空串 */
export function extractCompletionText(
  apiFormat: ApiFormat,
  payload: unknown
): string {
  if (!isPlainObject(payload)) return ""
  switch (apiFormat) {
    case "anthropic-messages":
      return extractAnthropicText(payload)
    case "chat-completions":
      return extractChatCompletionsText(payload)
    case "responses":
      return extractResponsesText(payload)
    default:
      return ""
  }
}

/** 从响应对象/数组里挑模型 ID（`{data:[{id}]}` / `{models:[...]}` / 纯数组都认） */
export function extractModelIds(payload: unknown): string[] {
  const candidates: unknown[] = []

  // 条目带 `id` 时它就是唯一合法的模型 ID；`name` 只是显示名（如 `{id:"glm-4.6",name:"GLM 4.6"}`），
  // 一并返回会让用户选到无效 ID，所以只有缺 `id` 时才退回 `name` / `model`。
  const pushEntry = (entry: Record<string, unknown>): void => {
    if (typeof entry.id === "string" && entry.id.trim()) {
      candidates.push(entry.id)
      return
    }
    const fallback = asText(entry.name).trim() ? entry.name : entry.model
    candidates.push(fallback)
  }

  const pushFromArray = (value: unknown[]): void => {
    for (const entry of value) {
      if (typeof entry === "string") {
        candidates.push(entry)
      } else if (isPlainObject(entry)) {
        pushEntry(entry)
      }
    }
  }

  const pushFrom = (value: unknown): void => {
    if (Array.isArray(value)) {
      pushFromArray(value)
      return
    }
    if (!isPlainObject(value)) return
    pushEntry(value)
  }

  if (Array.isArray(payload)) {
    pushFromArray(payload)
  } else if (isPlainObject(payload)) {
    pushFrom(payload.data)
    pushFrom(payload.models)
  }

  const seen = new Set<string>()
  const models: string[] = []
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue
    const id = candidate.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    models.push(id)
  }
  return models
}

/** 截一段原始正文用于日志（单行、限长，避免日志被 HTML/长报文刷屏） */
export function pickSnippet(raw: string, max = 200): string {
  const text = typeof raw === "string" ? raw : ""
  const compact = text.replace(/\s+/g, " ").trim()
  return compact.length > max ? `${compact.slice(0, max)}…` : compact
}

/**
 * 从错误响应里取原始摘要（只进日志）：
 * 依次看 `error.message` / `error`（字符串）/ `message` / `detail`，都取不到就截原始正文。
 */
export function extractErrorDetail(payload: unknown, rawText: string): string {
  if (isPlainObject(payload)) {
    const error = payload.error
    if (typeof error === "string" && error.trim()) return pickSnippet(error)
    if (isPlainObject(error)) {
      for (const key of ["message", "msg", "detail", "type"]) {
        const value = asText(error[key])
        if (value.trim()) return pickSnippet(value)
      }
    }
    for (const key of ["message", "msg", "detail"]) {
      const value = asText(payload[key])
      if (value.trim()) return pickSnippet(value)
    }
  }
  return pickSnippet(rawText)
}

/** 响应体里是否带 `error` 段（有些网关用 200 返回错误对象） */
export function hasErrorPayload(payload: unknown): boolean {
  if (!isPlainObject(payload)) return false
  return payload.error !== undefined && payload.error !== null
}
