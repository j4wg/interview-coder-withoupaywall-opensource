/**
 * 方案返回的结构化解析（纯函数模块）。
 *
 * 为什么要单独成文件：中文 prompt 要求的分节标题是"思路 (Thoughts) / 时间复杂度 (Time Complexity)"，
 * 只按英文标签匹配会静默地拿不到 thoughts 与复杂度，界面就退回兜底文案——那种失败不报错、极难发现。
 * 因此中英两套标签都必须被覆盖，且这段逻辑要能被 `node --test` 直接跑到。
 *
 * 本文件不 import electron、不依赖全局状态；兜底文案由调用方按当前界面语言传入。
 */

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
 * 匹配形如 `2. 思路 (Thoughts)：` 的标题：可选序号、可选加粗、可选括号内英文别名、中英文冒号。
 */
export function sectionHeader(labels: string[]): string {
  const alternation = labels.map(escapeRegExp).join("|")
  return `(?:\\d+[.、)]?\\s*)?[*#\\s]{0,2}(?:${alternation})\\s*(?:\\([^)\\n]{0,40}\\))?[*#\\s]{0,2}[:：]?`
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

function normalizeComplexity(value: string): string {
  if (!/O\([^)]+\)/i.test(value)) {
    return `O(n) - ${value}`
  }
  if (!value.includes("-") && !value.includes("because")) {
    const notationMatch = value.match(/O\([^)]+\)/i)
    if (notationMatch) {
      const notation = notationMatch[0]
      const rest = value.replace(notation, "").trim()
      return rest ? `${notation} - ${rest}` : notation
    }
  }
  return value
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
 * 解析方案返回。抽不到的项走调用方传入的、当前界面语言的兜底文案。
 */
export function parseSolutionResponse(
  raw: string,
  fallbacks: SolutionFallbacks
): ParsedSolution {
  const text = typeof raw === "string" ? raw : ""
  const thoughts = extractThoughts(text)
  const time = extractTimeComplexity(text)
  const space = extractSpaceComplexity(text)

  return {
    code: extractCode(text),
    thoughts: thoughts.length > 0 ? thoughts : [fallbacks.thoughts],
    time_complexity: time ? normalizeComplexity(time) : fallbacks.timeComplexity,
    space_complexity: space ? normalizeComplexity(space) : fallbacks.spaceComplexity,
  }
}
