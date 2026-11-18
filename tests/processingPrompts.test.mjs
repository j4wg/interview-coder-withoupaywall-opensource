// `electron/i18n/prompts.ts` 单测：零新依赖，直接跑 tsc 产物（`dist-electron`）。
// 运行：npm test —— pretest 先执行 `tsc -p tsconfig.electron.json` 生成产物。
// 覆盖点：
//   1. 中英两态的 prompt 确实来自不同文案表（语言切换生效）；
//   2. 中文 prompt 显式要求"只返回 JSON + 字段名保持英文原样 + 不得翻译"（下游 JSON.parse 的前提）；
//   3. 代码/标识符不翻译的硬约束在中英两态都在；
//   4. 题目字段缺失时的兜底（边界值：空串、空白串、undefined）；
//   5. 编程语言与界面语言正交：中文 prompt + Java 同时成立。
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const distFile = path.resolve(here, "../dist-electron/i18n/prompts.js")

if (!fs.existsSync(distFile)) {
  throw new Error(
    `缺少编译产物 ${distFile}，请先执行 \`npx tsc -p tsconfig.electron.json\``
  )
}

const {
  buildExtractionPrompt,
  buildSolutionPrompt,
  buildSolutionSystemPrompt,
  buildDebugPrompt,
  buildDebugSystemPrompt,
} = require(distFile)

const FIELD_NAMES = [
  "problem_statement",
  "constraints",
  "example_input",
  "example_output",
]

const problem = {
  problem_statement: "给定一个整数数组，返回两数之和的下标",
  constraints: "2 <= nums.length <= 10^4",
  example_input: "nums = [2,7,11,15], target = 9",
  example_output: "[0,1]",
}

test("解析题面：中文态用中文指令，英文态用英文指令", () => {
  const zh = buildExtractionPrompt("zh", { language: "java" })
  const en = buildExtractionPrompt("en", { language: "java" })

  assert.match(zh.system, /你是一名编程题面解析器/)
  assert.match(en.system, /coding challenge interpreter/)
  assert.notEqual(zh.system, en.system)
  assert.notEqual(zh.user, en.user)
  // 编程语言不因界面语言变化
  assert.match(zh.user, /java/)
  assert.match(en.user, /java/)
})

test("解析题面：两态都显式要求只返回 JSON，且字段名固定英文不得翻译", () => {
  for (const locale of ["zh", "en"]) {
    const { system } = buildExtractionPrompt(locale, { language: "python" })
    for (const field of FIELD_NAMES) {
      assert.ok(system.includes(field), `${locale} 缺少字段名 ${field}`)
    }
    assert.match(system, /JSON/)
  }

  const zhSystem = buildExtractionPrompt("zh", { language: "java" }).system
  assert.match(zhSystem, /只返回/)
  assert.match(zhSystem, /不得翻译/)
  assert.ok(!/问题描述\s*[:：]/.test(zhSystem), "字段名示例里不应出现中文字段名")
})

test("方案生成：中文态要求中文讲解，英文态要求英文讲解", () => {
  const zh = buildSolutionPrompt("zh", { language: "java", problem })
  const en = buildSolutionPrompt("en", { language: "java", problem })

  assert.match(zh, /简体中文/)
  assert.match(zh, /思路 \(Thoughts\)/)
  assert.match(zh, /时间复杂度 \(Time Complexity\)/)
  assert.match(en, /written in English/)
  assert.match(en, /1\. Code:/)
  assert.match(en, /2\. Thoughts:/)
})

test("方案生成：中文界面 + Java 编程语言可同时成立（两者正交）", () => {
  const zh = buildSolutionPrompt("zh", { language: "java", problem })
  assert.match(zh, /编程语言：java/)
  assert.match(zh, /简体中文/)
  // 代码块不翻译这条硬约束必须存在
  assert.match(zh, /代码块/)
  assert.match(zh, /不翻译/)
})

test("方案生成：题目字段缺失/空白时走本语言的兜底文案（边界值）", () => {
  const zh = buildSolutionPrompt("zh", {
    language: "java",
    problem: { problem_statement: "  ", constraints: undefined, example_input: "", example_output: null },
  })
  const en = buildSolutionPrompt("en", {
    language: "java",
    problem: {},
  })

  assert.match(zh, /未提供具体约束。/)
  assert.match(zh, /未提供示例输入。/)
  assert.match(zh, /未提供示例输出。/)
  assert.match(en, /No specific constraints provided\./)
  assert.match(en, /No example input provided\./)
  assert.match(en, /No example output provided\./)
  // undefined 的题目对象也不能抛错
  assert.doesNotThrow(() => buildSolutionPrompt("zh", { language: "go", problem: undefined }))
})

test("debug：中英两态都要求固定分节结构，中文态的标题是中文", () => {
  const zhSystem = buildDebugSystemPrompt("zh")
  const enSystem = buildDebugSystemPrompt("en")
  for (const heading of ["### 发现的问题", "### 具体改进与修正", "### 可做的优化"]) {
    assert.ok(zhSystem.includes(heading), `中文 debug 缺少标题 ${heading}`)
  }
  for (const heading of ["### Issues Identified", "### Specific Improvements and Corrections"]) {
    assert.ok(enSystem.includes(heading), `英文 debug 缺少标题 ${heading}`)
  }

  const zhUser = buildDebugPrompt("zh", { language: "java", problem })
  const enUser = buildDebugPrompt("en", { language: "java", problem })
  assert.match(zhUser, /我正在用 java 解决这道题/)
  assert.match(zhUser, /给定一个整数数组/)
  assert.match(enUser, /I'm solving this coding problem/)
})

test("debug：题目描述缺失时用本语言占位，不抛错（边界值）", () => {
  const zhUser = buildDebugPrompt("zh", { language: "java", problem: {} })
  const enUser = buildDebugPrompt("en", { language: "java", problem: {} })
  assert.match(zhUser, /（题目描述缺失）/)
  assert.match(enUser, /\(problem statement missing\)/)
})

test("system 文案与 user 文案都不含未替换的占位符残留", () => {
  const zhSolution = buildSolutionPrompt("zh", { language: "java", problem })
  const enSolution = buildSolutionPrompt("en", { language: "java", problem })
  const zhDebug = buildDebugPrompt("zh", { language: "java", problem })
  const enDebug = buildDebugPrompt("en", { language: "java", problem })
  const zhExtract = buildExtractionPrompt("zh", { language: "java" })
  const enExtract = buildExtractionPrompt("en", { language: "java" })
  const zhSystem = buildSolutionSystemPrompt("zh")
  const enSystem = buildSolutionSystemPrompt("en")
  const zhDebugSystem = buildDebugSystemPrompt("zh")
  const enDebugSystem = buildDebugSystemPrompt("en")

  const all = [
    zhSolution, enSolution, zhDebug, enDebug,
    zhExtract.system, zhExtract.user, enExtract.system, enExtract.user,
    zhSystem, enSystem, zhDebugSystem, enDebugSystem,
  ]
  for (const text of all) {
    assert.ok(typeof text === "string" && text.length > 0)
    assert.ok(!/\{\{\s*\w+\s*\}\}/.test(text), `占位符未替换：${text.slice(0, 80)}`)
  }
})
