/**
 * 模型返回的题面 JSON 解析与字段校验（纯函数模块）。
 *
 * 单独成文件的原因：中文 prompt 下模型极易把字段名翻译成本地化名字（`问题描述` 之类），
 * 那种 JSON 依然能 `JSON.parse` 成功，只会变成一个没有预期键的对象——下游拿到空值却不报错。
 * 这段校验是"中文态整链可跑通"的关键防线，必须可被 `node --test` 直接覆盖，
 * 因此不 import electron、不依赖任何运行时全局状态。
 */

/** 日志/错误里回显的原始返回最大长度，避免把整个模型输出灌进日志与界面 */
export const RAW_SNIPPET_LIMIT = 300

/** 解析题面必须返回的英文字段名；这些键被模型翻译即视作解析失败 */
export const REQUIRED_PROBLEM_FIELDS = [
  "problem_statement",
  "constraints",
  "example_input",
  "example_output",
] as const

/** 解析题面成功后的结构。值统一规整为字符串，下游 prompt 与渲染层都按字符串消费。 */
export interface ExtractedProblemInfo {
  problem_statement: string
  constraints: string
  example_input: string
  example_output: string
}

export type ProblemParseResult =
  | { status: "ok"; value: ExtractedProblemInfo }
  | {
      /** parse = 不是合法 JSON；notObject = JSON 但不是对象；fields = 缺英文字段名 */
      status: "parse" | "notObject" | "fields"
      missing?: string[]
      keys?: string[]
      error?: string
      snippet: string
    }

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function rawSnippet(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, RAW_SNIPPET_LIMIT)
}

/**
 * 从模型返回里取出 JSON 文本：容忍 ```json 围栏、以及 JSON 前后的解释性文字。
 * 中文 prompt 下模型更容易加一句"好的，以下是结果"，这里统一剥掉。
 */
export function extractJsonText(raw: string): string {
  const stripped = raw.replace(/```json|```/gi, "").trim()
  const start = stripped.indexOf("{")
  const end = stripped.lastIndexOf("}")
  if (start === -1 || end === -1 || end < start) return stripped
  return stripped.slice(start, end + 1)
}

/** 字段值兜底：模型偶尔返回数组/对象而非字符串，统一规整，不抛错也不静默丢数据 */
function normalizeFieldValue(value: unknown): string {
  if (typeof value === "string") return value
  if (value === undefined || value === null) return ""
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join("\n")
  }
  if (isPlainObject(value)) return JSON.stringify(value, null, 2)
  return String(value)
}

/**
 * 统一解析 + 字段校验。
 * 只有四个英文字段名全部存在才返回成功；任何一部分缺失都返回可判定、可记日志的失败类型。
 */
export function parseProblemInfo(raw: string): ProblemParseResult {
  if (!raw || !raw.trim()) {
    return { status: "parse", error: "empty response", snippet: "" }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonText(raw))
  } catch (error) {
    return {
      status: "parse",
      error: error instanceof Error ? error.message : String(error),
      snippet: rawSnippet(raw),
    }
  }

  if (!isPlainObject(parsed)) {
    return { status: "notObject", snippet: rawSnippet(raw) }
  }

  const keys = Object.keys(parsed)
  const missing = REQUIRED_PROBLEM_FIELDS.filter(
    (field) => !Object.prototype.hasOwnProperty.call(parsed, field)
  )
  if (missing.length > 0) {
    return {
      status: "fields",
      missing: [...missing],
      keys,
      snippet: rawSnippet(raw),
    }
  }

  return {
    status: "ok",
    value: {
      problem_statement: normalizeFieldValue(parsed.problem_statement),
      constraints: normalizeFieldValue(parsed.constraints),
      example_input: normalizeFieldValue(parsed.example_input),
      example_output: normalizeFieldValue(parsed.example_output),
    },
  }
}
