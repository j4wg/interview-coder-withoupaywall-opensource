/**
 * 方案返回的结构化解析（纯函数模块）。
 *
 * 为什么要单独成文件：中文 prompt 要求的分节标题是"思路 (Thoughts) / 时间复杂度 (Time Complexity)"，
 * 只按英文标签匹配会静默地拿不到 thoughts 与复杂度，界面就退回兜底文案——那种失败不报错、极难发现。
 * 因此中英两套标签都必须被覆盖，且这段逻辑要能被 `node --test` 直接跑到。
 *
 * 本文件不 import electron、不依赖全局状态；兜底文案与排版分隔符都由调用方按当前界面语言传入。
 */
import type { Locale } from "./i18n/types"

/** 分节标题：中英两版 prompt 的标题都在这里，解析必须两种都认 */
const THOUGHTS_LABELS = [
  "思路",
  "关键思路",
  "解题思路",
  "Thoughts",
  "Key Insights",
  "Reasoning",
  "Approach",
]
const TIME_LABELS = ["时间复杂度", "Time complexity"]
const SPACE_LABELS = ["空间复杂度", "Space complexity"]

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * 匹配分节标题：可选序号、可选加粗、可选/全角括号内的英文别名、中英文冒号。
 *
 * 必须同时吃半角 `(Thoughts)` 与全角 `（Thoughts）`：中文 prompt 下模型极常输出
 * `**思路（Thoughts）**` / `时间复杂度（Time Complexity）：`，只认半角括号时整段别名会
 * 残留在正文里（`（Thoughts）**` 直接漏进界面）。同理 `【思路】` 这类包裹也一并认。
 */
export function sectionHeader(labels: string[]): string {
  const alternation = labels.map(escapeRegExp).join("|")
  // 优先匹配带包裹符号的形式，否则 `【思路】` 会从标签处匹配、把 `【` 留在正文
  const label = `(?:[【\\[]\\s*(?:${alternation})\\s*[】\\]]|(?:${alternation}))`
  return (
    `(?:\\d+\\s*[.、)]\\s*)?` + // 可选序号：`1.` / `1、` / `1)`
    `[*#\\s]{0,4}` + // 可选加粗/标题符号
    label +
    `\\s*` +
    `(?:[（(][^）)\\n]{0,40}[）)])?` + // 可选括号内英文别名，半角与全角都认
    `\\s*` +
    `[*#\\s]{0,4}` + // 加粗/标题符号收尾
    `[:：]?` // 中英文冒号
  )
}

export interface SolutionFallbacks {
  thoughts: string
  timeComplexity: string
  spaceComplexity: string
}

export interface ParsedSolution {
  code: string
  thoughts: string[]
  time_complexity: string
  space_complexity: string
}

/** 从返回里抽出第一个代码块；没有代码块时把整段响应当代码（与改动前一致） */
function extractCode(raw: string): string {
  const match = raw.match(/```(?:\w+)?\s*([\s\S]*?)```/)
  return match ? match[1].trim() : raw
}

function extractThoughts(raw: string): string[] {
  const thoughtsRegex = new RegExp(
    `${sectionHeader(THOUGHTS_LABELS)}([\\s\\S]*?)(?=${sectionHeader(TIME_LABELS)}|$)`,
    "i"
  )
  const match = raw.match(thoughtsRegex)
  if (!match || !match[1]) return []

  // 按项目符号或序号抽取要点
  const bulletPoints = match[1].match(/(?:^|\n)\s*(?:[-*•]|\d+\.)\s*(.*)/g)
  if (bulletPoints) {
    return bulletPoints
      .map((point) => point.replace(/^\s*(?:[-*•]|\d+\.)\s*/, "").trim())
      .filter(Boolean)
  }

  // 没有项目符号时按行拆分，去掉空行
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * 复杂度排版：把 `O(n)` 与解释文字用当前语言的分隔符连起来。
 * 中文态不能用英文破折号——`O(n) - ，因为一次遍历` 里破折号会直接贴在全角逗号前。
 */
function normalizeComplexity(value: string, locale: Locale): string {
  const text = typeof value === "string" ? value.trim() : ""
  if (!text) return text

  const separator = locale === "zh" ? "，" : " - "
  const notationMatch = text.match(/O\([^)]+\)/i)

  // 缺 O() 标记：补上前缀，避免界面只显示一句解释
  if (!notationMatch) {
    return `O(n)${separator}${text}`
  }

  // 已经自带解释连接词（英文破折号/because、中文"因为"）时原样保留，避免二次拼接
  if (/[-–—]|because|因为/i.test(text)) {
    return text
  }

  const notation = notationMatch[0]
  // 去掉标记后紧跟的分隔标点，否则中文会拼出 `O(n)，，因为…`
  const rest = text
    .replace(notation, "")
    .trim()
    .replace(/^[\s\-–—:：,，、;；]+/, "")
  return rest ? `${notation}${separator}${rest}` : notation
}

function extractTimeComplexity(raw: string): string | null {
  const pattern = new RegExp(
    `${sectionHeader(TIME_LABELS)}\\s*([\\s\\S]*?)` +
      `(?=\\n\\s*(?:${sectionHeader(SPACE_LABELS)})|\\n\\s*\\n|$)`,
    "i"
  )
  const match = raw.match(pattern)
  return match && match[1] ? match[1].trim() : null
}

function extractSpaceComplexity(raw: string): string | null {
  const pattern = new RegExp(
    `${sectionHeader(SPACE_LABELS)}\\s*([\\s\\S]*?)(?=\\n\\s*\\n|$)`,
    "i"
  )
  const match = raw.match(pattern)
  return match && match[1] ? match[1].trim() : null
}

/**
 * 解析方案返回。抽不到的项走调用方传入的、当前界面语言的兜底文案；
 * `locale` 同时决定复杂度排版用中文全角标点还是英文破折号，必须由调用方按请求即时传入。
 */
export function parseSolutionResponse(
  raw: string,
  fallbacks: SolutionFallbacks,
  locale: Locale
): ParsedSolution {
  const text = typeof raw === "string" ? raw : ""
  // 兜底成英文排版，避免外部传入非法值时拼出半中半英的分隔符
  const activeLocale: Locale = locale === "zh" ? "zh" : "en"
  const thoughts = extractThoughts(text)
  const time = extractTimeComplexity(text)
  const space = extractSpaceComplexity(text)

  return {
    code: extractCode(text),
    thoughts: thoughts.length > 0 ? thoughts : [fallbacks.thoughts],
    time_complexity: time
      ? normalizeComplexity(time, activeLocale)
      : fallbacks.timeComplexity,
    space_complexity: space
      ? normalizeComplexity(space, activeLocale)
      : fallbacks.spaceComplexity,
  }
}
