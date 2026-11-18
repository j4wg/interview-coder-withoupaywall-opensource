// `resolveLocale.ts` 单测：零新依赖，直接跑 tsc 产物（`dist-electron`）。
// 运行：npm test —— pretest 先执行 `tsc -p tsconfig.electron.json` 生成产物，
// 再跑 package.json 里的 `node --test tests/<file>.test.mjs ...`（显式列出测试文件）；单独跑本文件需先编译。
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const distFile = path.resolve(here, "../dist-electron/i18n/resolveLocale.js")

if (!fs.existsSync(distFile)) {
  throw new Error(
    `缺少编译产物 ${distFile}，请先执行 \`npx tsc -p tsconfig.electron.json\``
  )
}

const { normalizeLocaleTag, resolveLocale } = require(distFile)

/** 当前机器的 Intl 兜底结果，用于断言「空 appLocale 时走 Intl」这条链路 */
const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale
const intlExpected = /^zh/i.test(intlLocale) ? "zh" : "en"

test("normalizeLocaleTag: zh 的各个变体归一为 zh", () => {
  assert.equal(normalizeLocaleTag("zh"), "zh")
  assert.equal(normalizeLocaleTag("zh-CN"), "zh")
  assert.equal(normalizeLocaleTag("zh-TW"), "zh")
  assert.equal(normalizeLocaleTag("zh-HK"), "zh")
  assert.equal(normalizeLocaleTag("zh_CN"), "zh")
  assert.equal(normalizeLocaleTag("ZH-cn"), "zh")
})

test("normalizeLocaleTag: 非中文归一为 en", () => {
  assert.equal(normalizeLocaleTag("en-US"), "en")
  assert.equal(normalizeLocaleTag("en"), "en")
  assert.equal(normalizeLocaleTag("fr-FR"), "en")
  assert.equal(normalizeLocaleTag("ja-JP"), "en")
})

test("normalizeLocaleTag: 空值、空串、空白归一为 en", () => {
  assert.equal(normalizeLocaleTag(""), "en")
  assert.equal(normalizeLocaleTag("   "), "en")
  assert.equal(normalizeLocaleTag(undefined), "en")
  assert.equal(normalizeLocaleTag(null), "en")
})

test("resolveLocale: 手动 zh / en 时以设置为准，忽略系统信号", () => {
  assert.equal(resolveLocale("zh", "en-US"), "zh")
  assert.equal(resolveLocale("zh", ""), "zh")
  assert.equal(resolveLocale("en", "zh-CN"), "en")
  assert.equal(resolveLocale("en", null), "en")
})

test("resolveLocale: system + 系统中文（zh-CN / zh-TW / zh-HK）→ zh", () => {
  assert.equal(resolveLocale("system", "zh-CN"), "zh")
  assert.equal(resolveLocale("system", "zh-TW"), "zh")
  assert.equal(resolveLocale("system", "zh-HK"), "zh")
})

test("resolveLocale: system + 系统英文 → en", () => {
  assert.equal(resolveLocale("system", "en-US"), "en")
  assert.equal(resolveLocale("system", "en-GB"), "en")
})

test("resolveLocale: app.getLocale() 为空时走 Intl 回落链，不抛错", () => {
  assert.equal(resolveLocale("system", ""), intlExpected)
  assert.equal(resolveLocale("system", "   "), intlExpected)
  assert.equal(resolveLocale("system", null), intlExpected)
  assert.equal(resolveLocale("system", undefined), intlExpected)
})

test("resolveLocale: 运行期出现非法设置值等同 system 处理，不抛错", () => {
  assert.equal(resolveLocale("fr", "zh-CN"), "zh")
  assert.equal(resolveLocale("fr", "en-US"), "en")
  assert.equal(resolveLocale("", "zh-CN"), "zh")
})
