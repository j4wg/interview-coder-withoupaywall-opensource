// `configMigrations.ts` 归一化（校验）单测：覆盖本 issue 验收的 ⑤⑥⑦ 与字段级边界。
//   ⑤ bindings 指向不存在的模型 ID → 归一为列表首项
//   ⑥ models 为空 → bindings 留空且不抛错
//   ⑦ apiFormat 非法值 → 归一为默认值且不崩溃
// 另加 baseUrl / apiKey / models / language / opacity / uiLanguage 的归一与去重。
//
// 运行：`npm test`（pretest 先执行 `tsc -p tsconfig.electron.json` 生成产物）。
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const distFile = path.resolve(here, "../dist-electron/configMigrations.js")

if (!fs.existsSync(distFile)) {
  throw new Error(
    `缺少编译产物 ${distFile}，请先执行 \`npx tsc -p tsconfig.electron.json\``
  )
}

const {
  API_FORMATS,
  DEFAULT_API_FORMAT,
  diffNormalizedKeys,
  normalizeBindings,
  normalizeConfigData,
  normalizeProviderConfig,
  normalizeStringList
} = require(distFile)

/** 只带 provider 的最小 v3 配置 */
const withProvider = (provider, extra = {}) => ({
  provider: { baseUrl: "", apiFormat: "responses", apiKey: "", models: [], ...provider },
  bindings: { extractionModel: "", solutionModel: "", debuggingModel: "" },
  uiLanguage: "system",
  language: "java",
  opacity: 1.0,
  configVersion: 3,
  ...extra
})

test("⑤ bindings 指向不存在的模型 ID → 三项都归一为列表首项", () => {
  const normalized = normalizeConfigData(
    withProvider(
      { models: ["glm-4.6v-flash", "qwen-vl-max"] },
      {
        bindings: {
          extractionModel: "does-not-exist",
          solutionModel: "qwen-vl-max",
          debuggingModel: "gpt-4o"
        }
      }
    )
  )

  assert.equal(normalized.bindings.extractionModel, "glm-4.6v-flash")
  assert.equal(normalized.bindings.solutionModel, "qwen-vl-max")
  assert.equal(normalized.bindings.debuggingModel, "glm-4.6v-flash")
  // 模型列表本身不被改动
  assert.deepEqual(normalized.provider.models, ["glm-4.6v-flash", "qwen-vl-max"])
})

test("⑤ 绑定缺失 / 非字符串 / 带空白 → 一律归一为列表首项", () => {
  for (const bindings of [
    {},
    { extractionModel: 42 },
    { extractionModel: null },
    { extractionModel: "   " },
    undefined
  ]) {
    const normalized = normalizeConfigData(
      withProvider({ models: ["only-model"] }, { bindings })
    )
    assert.deepEqual(normalized.bindings, {
      extractionModel: "only-model",
      solutionModel: "only-model",
      debuggingModel: "only-model"
    })
  }
})

test("⑤ 绑定值带首尾空白时按 trim 后匹配", () => {
  const normalized = normalizeConfigData(
    withProvider(
      { models: ["m1", "m2"] },
      { bindings: { extractionModel: "  m2  ", solutionModel: "m1", debuggingModel: "m1" } }
    )
  )
  assert.equal(normalized.bindings.extractionModel, "m2")
})

test("⑥ models 为空 → bindings 全部留空且不抛错", () => {
  const normalized = normalizeConfigData(
    withProvider(
      { models: [] },
      { bindings: { extractionModel: "ghost", solutionModel: "ghost", debuggingModel: "ghost" } }
    )
  )
  assert.deepEqual(normalized.bindings, {
    extractionModel: "",
    solutionModel: "",
    debuggingModel: ""
  })
  assert.deepEqual(normalized.provider.models, [])
  // 纯函数版本同样不抛错
  assert.deepEqual(normalizeBindings({ extractionModel: "x" }, []), {
    extractionModel: "",
    solutionModel: "",
    debuggingModel: ""
  })
})

test("⑥ models 非数组 / 元素非法 → 视为空列表", () => {
  for (const models of [undefined, null, "m1", 42, {}, [1, 2], [null], [""], ["   "]]) {
    const normalized = normalizeConfigData(withProvider({ models }))
    assert.deepEqual(normalized.provider.models, [], `models=${JSON.stringify(models)}`)
    assert.deepEqual(normalized.bindings, {
      extractionModel: "",
      solutionModel: "",
      debuggingModel: ""
    })
  }
})

test("⑦ apiFormat 非法值 → 归一为默认值（不崩溃）", () => {
  assert.equal(DEFAULT_API_FORMAT, "responses")
  for (const apiFormat of ["", "Responses", "openai", "chat", 42, null, undefined, ["responses"]]) {
    const normalized = normalizeConfigData(withProvider({ apiFormat }))
    assert.equal(normalized.provider.apiFormat, DEFAULT_API_FORMAT)
  }
  // 三个合法值原样保留
  for (const apiFormat of API_FORMATS) {
    assert.equal(
      normalizeConfigData(withProvider({ apiFormat })).provider.apiFormat,
      apiFormat
    )
  }
})

test("⑦ provider 整个缺失 / 非对象 → 回落默认 provider", () => {
  for (const provider of [undefined, null, "x", 42, []]) {
    const normalized = normalizeConfigData({ provider })
    assert.deepEqual(normalized.provider, {
      baseUrl: "",
      apiFormat: DEFAULT_API_FORMAT,
      apiKey: "",
      models: []
    })
  }
})

test("字段级归一：baseUrl 去空白与末尾斜杠、apiKey 去空白", () => {
  const provider = normalizeProviderConfig({
    baseUrl: "  https://api.example.com/v1///  ",
    apiKey: "  sk-abc  ",
    apiFormat: "anthropic-messages",
    models: [" m1 "]
  })
  assert.equal(provider.baseUrl, "https://api.example.com/v1")
  assert.equal(provider.apiKey, "sk-abc")
  assert.equal(provider.apiFormat, "anthropic-messages")
  assert.deepEqual(provider.models, ["m1"])

  // 非字符串 baseUrl / apiKey → 空串（上层据此提示"先配置服务地址"）
  const empty = normalizeProviderConfig({ baseUrl: 42, apiKey: null })
  assert.equal(empty.baseUrl, "")
  assert.equal(empty.apiKey, "")
})

test("字段级归一：models 去重、去空白、保持顺序", () => {
  assert.deepEqual(
    normalizeStringList([" glm-4.6v-flash ", "qwen-vl-max", "glm-4.6v-flash", "", "  "]),
    ["glm-4.6v-flash", "qwen-vl-max"]
  )
})

test("字段级归一：language 缺省 java，uiLanguage 非法回落 system，opacity 夹到 [0,1]", () => {
  assert.equal(normalizeConfigData({ language: "  " }).language, "java")
  assert.equal(normalizeConfigData({ language: 42 }).language, "java")
  assert.equal(normalizeConfigData({ language: "csharp" }).language, "csharp")

  assert.equal(normalizeConfigData({ uiLanguage: "ja" }).uiLanguage, "system")
  assert.equal(normalizeConfigData({ uiLanguage: "zh" }).uiLanguage, "zh")

  assert.equal(normalizeConfigData({ opacity: 2 }).opacity, 1)
  assert.equal(normalizeConfigData({ opacity: -1 }).opacity, 0)
  assert.equal(normalizeConfigData({ opacity: 0.4 }).opacity, 0.4)
  assert.equal(normalizeConfigData({ opacity: Number.NaN }).opacity, 1.0)
  assert.equal(normalizeConfigData({ opacity: "0.5" }).opacity, 1.0)
})

test("configVersion 缺失 → 当前版本；非法 JSON 输入 → 默认配置", () => {
  assert.equal(normalizeConfigData({}).configVersion, 3)
  assert.equal(normalizeConfigData({ configVersion: 2 }).configVersion, 2)
  for (const invalid of [null, [], "x", 42]) {
    const normalized = normalizeConfigData(invalid)
    assert.deepEqual(normalized.provider.models, [])
    assert.equal(normalized.configVersion, 3)
  }
})

test("diffNormalizedKeys：如实报告被归一的顶层键（供日志与取证）", () => {
  const raw = {
    provider: { baseUrl: "https://x/v1", apiFormat: "bogus", apiKey: "k", models: ["m1"] },
    bindings: { extractionModel: "ghost", solutionModel: "m1", debuggingModel: "m1" },
    uiLanguage: "system",
    language: "java",
    opacity: 1.0,
    configVersion: 3
  }
  const normalized = normalizeConfigData(raw)
  assert.deepEqual(diffNormalizedKeys(raw, normalized).sort(), ["bindings", "provider"])

  // 已合法的配置零改动
  assert.deepEqual(diffNormalizedKeys(normalized, normalizeConfigData(normalized)), [])
})

test("updateConfig 内核：同一次更新里新加的模型可以直接被绑定（顺序回归）", () => {
  const { mergeConfigUpdate } = require(distFile)
  const current = normalizeConfigData({})

  const updated = mergeConfigUpdate(current, {
    provider: {
      baseUrl: "https://api.example.com/v1/",
      apiFormat: "chat-completions",
      apiKey: "  test-key  ",
      models: ["glm-4.6v-flash", "qwen-vl-max", "glm-4.6v-flash"]
    },
    bindings: { extractionModel: "ghost", solutionModel: "qwen-vl-max" },
    language: "python"
  })

  assert.deepEqual(updated.provider.models, ["glm-4.6v-flash", "qwen-vl-max"])
  assert.equal(updated.provider.baseUrl, "https://api.example.com/v1")
  assert.equal(updated.provider.apiKey, "test-key")
  assert.equal(updated.bindings.extractionModel, "glm-4.6v-flash")
  assert.equal(updated.bindings.solutionModel, "qwen-vl-max")
  assert.equal(updated.bindings.debuggingModel, "glm-4.6v-flash")
  assert.equal(updated.language, "python")
  assert.equal(updated.configVersion, 3)
})

test("updateConfig 内核：移除被绑定的模型 → 绑定回落列表首项；列表清空 → 绑定留空", () => {
  const { mergeConfigUpdate } = require(distFile)
  const current = normalizeConfigData({
    provider: { baseUrl: "https://x/v1", apiFormat: "responses", apiKey: "k", models: ["m1", "m2"] },
    bindings: { extractionModel: "m1", solutionModel: "m2", debuggingModel: "m2" }
  })

  const removed = mergeConfigUpdate(current, { provider: { models: ["m2"] } })
  assert.deepEqual(removed.bindings, {
    extractionModel: "m2",
    solutionModel: "m2",
    debuggingModel: "m2"
  })

  const cleared = mergeConfigUpdate(removed, { provider: { models: [] } })
  assert.deepEqual(cleared.bindings, {
    extractionModel: "",
    solutionModel: "",
    debuggingModel: ""
  })
})

test("updateConfig 内核：旧字段与 configVersion 一律忽略，v3 结构不回退", () => {
  const { mergeConfigUpdate } = require(distFile)
  const current = normalizeConfigData({
    provider: { baseUrl: "https://x/v1", apiFormat: "responses", apiKey: "keep", models: ["m1"] },
    bindings: { extractionModel: "m1", solutionModel: "m1", debuggingModel: "m1" }
  })

  const updated = mergeConfigUpdate(current, {
    apiKey: "legacy-key",
    apiProvider: "openai",
    extractionModel: "ghost",
    solutionModel: "ghost",
    debuggingModel: "ghost",
    configVersion: 2,
    opacity: 0.5
  })

  assert.equal(updated.provider.apiKey, "keep")
  assert.deepEqual(updated.bindings, {
    extractionModel: "m1",
    solutionModel: "m1",
    debuggingModel: "m1"
  })
  assert.equal(updated.configVersion, 3)
  assert.equal(updated.opacity, 0.5)
  assert.deepEqual(Object.keys(updated).sort(), [
    "bindings",
    "configVersion",
    "language",
    "opacity",
    "provider",
    "uiLanguage"
  ])
})

test("updateConfig 内核：非对象 / 非法 provider 传入不抛错", () => {
  const { mergeConfigUpdate } = require(distFile)
  const current = normalizeConfigData({})
  for (const updates of [null, undefined, 42, "x", [], { provider: "x" }, { provider: 42 }]) {
    const updated = mergeConfigUpdate(current, updates)
    assert.equal(updated.configVersion, 3)
    assert.deepEqual(updated.provider.models, [])
    assert.equal(updated.provider.apiFormat, DEFAULT_API_FORMAT)
  }
})
