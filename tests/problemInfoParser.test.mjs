// `electron/problemInfoParser.ts` 单测：零新依赖，直接跑 tsc 产物（`dist-electron`）。
// 覆盖点：正常路径 + 三类错误路径（非法 JSON / 非对象 / 字段名被翻译）+ 边界值。
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const distFile = path.resolve(here, "../dist-electron/problemInfoParser.js")

if (!fs.existsSync(distFile)) {
  throw new Error(
    `缺少编译产物 ${distFile}，请先执行 \`npx tsc -p electron/tsconfig.json\``
  )
}

const { parseProblemInfo, extractJsonText, REQUIRED_PROBLEM_FIELDS } = require(distFile)

const validJson = JSON.stringify({
  problem_statement: "两数之和",
  constraints: "2 <= n <= 100",
  example_input: "[2,7,11,15], 9",
  example_output: "[0,1]",
})

test("正常路径：四个英文字段齐全时解析成功", () => {
  const result = parseProblemInfo(validJson)
  assert.equal(result.status, "ok")
  assert.equal(result.value.problem_statement, "两数之和")
  assert.equal(result.value.example_output, "[0,1]")
  assert.deepEqual(Object.keys(result.value), [...REQUIRED_PROBLEM_FIELDS])
})

test("正常路径：容忍 ```json 围栏与前后解释性文字", () => {
  const raw = "好的，以下是解析结果：\n```json\n" + validJson + "\n```\n希望有帮助。"
  const result = parseProblemInfo(raw)
  assert.equal(result.status, "ok")
  assert.equal(result.value.problem_statement, "两数之和")
})

test("错误路径 1：非法 JSON 返回 parse，而不是抛出", () => {
  const result = parseProblemInfo("{ problem_statement: 两数之和 ")
  assert.equal(result.status, "parse")
  assert.ok(result.error)
  assert.ok(result.snippet.length > 0)
})

test("错误路径 2：合法 JSON 但不是对象（数组 / 字符串 / null）", () => {
  for (const raw of ["[]", '"text"', "null", "42"]) {
    const result = parseProblemInfo(raw)
    assert.notEqual(result.status, "ok", `不应接受 ${raw}`)
  }
  assert.equal(parseProblemInfo("[]").status, "notObject")
  assert.equal(parseProblemInfo('"text"').status, "notObject")
  assert.equal(parseProblemInfo("null").status, "notObject")
})

test("错误路径 3：字段名被模型翻译成中文时判定 fields 并列出实际字段名", () => {
  const raw = JSON.stringify({
    问题描述: "两数之和",
    约束条件: "2 <= n <= 100",
    示例输入: "[2,7,11,15], 9",
    示例输出: "[0,1]",
  })
  const result = parseProblemInfo(raw)
  assert.equal(result.status, "fields")
  assert.deepEqual(result.missing, [...REQUIRED_PROBLEM_FIELDS])
  assert.ok(result.keys.includes("问题描述"))
})

test("错误路径 3b：只缺一个字段时只报这一个", () => {
  const raw = JSON.stringify({
    problem_statement: "两数之和",
    constraints: "2 <= n <= 100",
    example_input: "[2,7,11,15], 9",
  })
  const result = parseProblemInfo(raw)
  assert.equal(result.status, "fields")
  assert.deepEqual(result.missing, ["example_output"])
})

test("边界值：空串与纯空白返回 parse", () => {
  assert.equal(parseProblemInfo("").status, "parse")
  assert.equal(parseProblemInfo("   \n\t ").status, "parse")
})

test("边界值：字段存在但值为 null/数组/数字时规整为字符串，不丢字段", () => {
  const raw = JSON.stringify({
    problem_statement: "两数之和",
    constraints: null,
    example_input: ["a", "b"],
    example_output: 123,
  })
  const result = parseProblemInfo(raw)
  assert.equal(result.status, "ok")
  assert.equal(result.value.constraints, "")
  assert.equal(result.value.example_input, "a\nb")
  assert.equal(result.value.example_output, "123")
})

test("边界值：截断的原始返回不会把整段响应写进日志字段", () => {
  const long = JSON.stringify({ problem_statement: "x".repeat(5000) })
  const result = parseProblemInfo(long.slice(0, 20))
  assert.notEqual(result.status, "ok")
  assert.ok(result.snippet.length <= 300)
})

test("extractJsonText：无花括号时原样返回，不抛错", () => {
  assert.equal(extractJsonText("no json here"), "no json here")
  assert.equal(extractJsonText("```\n{}\n```"), "{}")
})
