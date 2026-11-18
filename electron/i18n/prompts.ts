/**
 * 三类模型 prompt 的唯一组装出口。
 *
 * 设计口径见 `docs/i18n-design.md` 决策 5：AI 中文只落在 prompt 层。
 * `ProcessingHelper` 里不再手写任何 prompt 字符串，也不按供应商分支各写一份——
 * 三家供应商共用同一份文案，只有"system 是否支持"的接线差异。
 *
 * 约束（中英两版同时生效，见各文案表）：
 * 1. 解释性文字跟随界面语言（中文态一律简体中文）；
 * 2. 代码块、标识符、函数/类名、API 名、库名、原始错误信息不翻译；
 * 3. 解析题面的 JSON 字段名固定英文（problem_statement / constraints / example_input / example_output）。
 */
import { t } from "./index"
import type { Locale } from "./types"

/** prompt 只需要题目信息的这几个字段，故意不 import 业务模块，避免 i18n 反向依赖。 */
export interface PromptProblemInfo {
  problem_statement?: string
  constraints?: string
  example_input?: string
  example_output?: string
}

const NS = "processing"

function message(locale: Locale, key: string, vars?: Record<string, string>): string {
  return t(NS, locale, key, vars)
}

/** 空值兜底：模型可能返回空串，这里统一补成对应语言的占位文案 */
function orFallback(value: string | undefined, locale: Locale, key: string): string {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : message(locale, key)
}

/**
 * 截图解析题面。
 *
 * OpenAI 走 system + user 两条消息；Gemini / Anthropic 没有独立的 system 位，
 * 把 `system` 与 `user` 按同一顺序拼成一条消息即可（拼接在调用处完成，文案本身只此一份）。
 */
export function buildExtractionPrompt(
  locale: Locale,
  v: { language: string }
): { system: string; user: string } {
  return {
    system: message(locale, "processing.prompt.extract.system"),
    user: message(locale, "processing.prompt.extract.user", { language: v.language }),
  }
}

/** 方案生成的 system 文案（仅 OpenAI 有独立 system 位；其余供应商拼在 user 前） */
export function buildSolutionSystemPrompt(locale: Locale): string {
  return message(locale, "processing.prompt.solution.system")
}

/** 方案生成的 user 文案（题目四要素 + 分节格式 + 语言硬约束） */
export function buildSolutionPrompt(
  locale: Locale,
  v: { language: string; problem: PromptProblemInfo }
): string {
  const problem = v.problem ?? {}
  return message(locale, "processing.prompt.solution.user", {
    language: v.language,
    problem_statement: orFallback(
      problem.problem_statement,
      locale,
      "processing.prompt.solution.problem.missing"
    ),
    constraints: orFallback(
      problem.constraints,
      locale,
      "processing.prompt.solution.constraints.missing"
    ),
    example_input: orFallback(
      problem.example_input,
      locale,
      "processing.prompt.solution.exampleInput.missing"
    ),
    example_output: orFallback(
      problem.example_output,
      locale,
      "processing.prompt.solution.exampleOutput.missing"
    ),
  })
}

/** debug / 纠错的 system 文案（结构与小节标题都写在这里，便于下游按标题解析） */
export function buildDebugSystemPrompt(locale: Locale): string {
  return message(locale, "processing.prompt.debug.system")
}

/** debug / 纠错的 user 文案（带上题目描述与编程语言） */
export function buildDebugPrompt(
  locale: Locale,
  v: { language: string; problem: PromptProblemInfo }
): string {
  return message(locale, "processing.prompt.debug.user", {
    language: v.language,
    problem_statement: orFallback(
      v.problem?.problem_statement,
      locale,
      "processing.prompt.debug.problem.missing"
    ),
  })
}
