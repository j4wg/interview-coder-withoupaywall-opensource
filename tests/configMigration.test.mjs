// `configMigrations.ts` 单测（配置契约 v3 · 多套 provider 并存）：纯函数，直接跑 tsc 产物。
//
// 覆盖本 issue 验收里的迁移部分：
//   ① 全新安装默认值（providers: [] / bindings 全空 / configVersion: 3）
//   ② 旧配置迁移后 apiKey 保留 + 旧模型名被丢弃 + configVersion: 3
//   ③ 迁移一次性（迁移后手改字段重启不覆盖）
// 另加：幂等、未知键保留、入参不被修改、版本已满足时零改动、未发布的单套形状兼容。
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
  CURRENT_CONFIG_VERSION,
  DEFAULT_API_FORMAT,
  DEFAULT_CONFIG_DATA,
  LEGACY_CONFIG_KEYS,
  LEGACY_MODEL_KEYS,
  migrateConfigData,
  normalizeConfigData
} = require(distFile)

const V3_TOP_LEVEL_KEYS = [
  "bindings",
  "configVersion",
  "language",
  "opacity",
  "providers",
  "uiLanguage"
]

const EMPTY_BINDINGS = {
  extractionModel: { providerId: "", modelId: "" },
  solutionModel: { providerId: "", modelId: "" },
  debuggingModel: { providerId: "", modelId: "" }
}

test("① 默认值：providers 为空数组、bindings 全空、configVersion: 3", () => {
  assert.equal(CURRENT_CONFIG_VERSION, 3)
  assert.deepEqual(DEFAULT_CONFIG_DATA.providers, [])
  assert.deepEqual(DEFAULT_CONFIG_DATA.bindings, EMPTY_BINDINGS)
  assert.equal(DEFAULT_CONFIG_DATA.uiLanguage, "system")
  assert.equal(DEFAULT_CONFIG_DATA.language, "java")
  assert.equal(DEFAULT_CONFIG_DATA.opacity, 1.0)
  assert.equal(DEFAULT_CONFIG_DATA.configVersion, 3)
  assert.deepEqual(Object.keys(DEFAULT_CONFIG_DATA).sort(), V3_TOP_LEVEL_KEYS)

  // 无 config.json / 非对象输入时迁移函数给出同一份默认值
  for (const invalid of [undefined, null, "{not json", "", [], 42, true]) {
    const fresh = migrateConfigData(invalid)
    assert.equal(fresh.migrated, true)
    assert.deepEqual(fresh.config, DEFAULT_CONFIG_DATA)
  }
})

test("② 旧配置（apiProvider + 三个内置模型）迁移：apiKey 保留、旧模型名丢弃、configVersion=3", () => {
  const legacy = {
    apiKey: "sk-legacy-key",
    apiProvider: "openai",
    extractionModel: "gpt-4o",
    solutionModel: "gemini-2.0-flash",
    debuggingModel: "claude-3-7-sonnet-20250219",
    language: "python",
    opacity: 0.8,
    uiLanguage: "zh",
    configVersion: 2
  }

  const { config, migrated, droppedLegacyKeys } = migrateConfigData(legacy)

  assert.equal(migrated, true)
  // 迁成 providers 数组里的一条：apiKey 必须保留，models 与 bindings 置空
  assert.equal(Array.isArray(config.providers), true)
  assert.equal(config.providers.length, 1)
  assert.deepEqual(config.providers[0], {
    id: "p_auto1",
    name: "",
    baseUrl: "",
    apiFormat: DEFAULT_API_FORMAT,
    apiKey: "sk-legacy-key",
    models: []
  })
  assert.deepEqual(config.bindings, EMPTY_BINDINGS)

  // 旧的内置模型名一个都不留
  const serialized = JSON.stringify(config)
  for (const banned of ["gpt-4o", "gemini-2.0-flash", "claude-3-7-sonnet-20250219"]) {
    assert.equal(serialized.includes(banned), false, `迁移结果仍含旧模型名 ${banned}`)
  }
  for (const key of LEGACY_CONFIG_KEYS) {
    assert.equal(key in config, false, `迁移结果仍含旧键 ${key}`)
  }
  // 其余语义键保持
  assert.equal(config.language, "python")
  assert.equal(config.uiLanguage, "zh")
  assert.equal(config.opacity, 0.8)
  assert.equal(config.configVersion, 3)
  // 顶层键集合 = v3 六个键（没有旧键残留、没有多余默认键）
  assert.deepEqual(Object.keys(config).sort(), V3_TOP_LEVEL_KEYS)
  // 同一次迁移会报告被丢弃的旧模型选择键（apiKey 是继承保留的，不在其中）
  assert.deepEqual(droppedLegacyKeys.sort(), [...LEGACY_MODEL_KEYS].sort())
})

test("② 更早的配置（只有 language: python，无 configVersion）迁移后语言保持既有语义", () => {
  const { config } = migrateConfigData({ language: "python" })
  assert.equal(config.language, "python")
  assert.deepEqual(config.providers, [])
  assert.deepEqual(config.bindings, EMPTY_BINDINGS)
  assert.equal(config.configVersion, 3)
})

test("② 缺 language 的旧配置：回默认 java；只有 apiKey 也保留（一条 provider）", () => {
  const { config } = migrateConfigData({ apiKey: "a-key", apiProvider: "gemini" })
  assert.equal(config.language, "java")
  assert.equal(config.uiLanguage, "system")
  assert.equal(config.providers.length, 1)
  assert.equal(config.providers[0].apiKey, "a-key")
  assert.deepEqual(config.providers[0].models, [])
})

test("② 迁移不保留旧的内置模型清单：三种旧模型名 → models 恒为空数组", () => {
  for (const legacyModel of ["gpt-4o", "gemini-2.0-flash", "claude-3-7-sonnet-20250219"]) {
    const { config } = migrateConfigData({
      apiKey: "k",
      apiProvider: "openai",
      extractionModel: legacyModel,
      solutionModel: legacyModel,
      debuggingModel: legacyModel,
      configVersion: 2
    })
    assert.deepEqual(config.providers[0].models, [])
    assert.equal(JSON.stringify(config).includes(legacyModel), false)
  }
})

test("③ 迁移一次性：迁移后手改字段再启动不被覆盖", () => {
  const first = migrateConfigData({
    apiKey: "sk-legacy-key",
    apiProvider: "openai",
    extractionModel: "gpt-4o",
    configVersion: 2
  })
  assert.equal(first.migrated, true)

  // 用户在新设置页手改：加第二套 provider、填 baseUrl、加模型、跨 provider 绑定
  const userEdited = {
    ...first.config,
    providers: [
      {
        ...first.config.providers[0],
        name: "公司 GLM",
        baseUrl: "https://api.example.com/v1",
        apiFormat: "chat-completions",
        models: ["glm-4.6v-flash", "qwen-vl-max"]
      },
      {
        id: "p_000002",
        name: "个人 OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiFormat: "responses",
        apiKey: "sk-personal",
        models: ["gpt-5"]
      }
    ],
    bindings: {
      extractionModel: { providerId: first.config.providers[0].id, modelId: "glm-4.6v-flash" },
      solutionModel: { providerId: "p_000002", modelId: "gpt-5" },
      debuggingModel: { providerId: "p_000002", modelId: "gpt-5" }
    },
    language: "python"
  }

  const second = migrateConfigData(userEdited)
  assert.equal(second.migrated, false)
  assert.deepEqual(second.config, userEdited)
  assert.deepEqual(second.droppedLegacyKeys, [])
})

test("③ 幂等：对迁移结果再跑一次零改动", () => {
  const legacy = { apiKey: "sk-xxx", apiProvider: "anthropic", language: "python" }
  const first = migrateConfigData(legacy)
  const second = migrateConfigData(first.config)
  assert.equal(second.migrated, false)
  assert.deepEqual(second.config, first.config)
})

test("③ configVersion 已 ≥3 时完全不改动（含用户手改的非法绑定）", () => {
  const raw = {
    providers: [
      { id: "p_1", name: "A", baseUrl: "https://x/v1", apiFormat: "chat-completions", apiKey: "k", models: ["m1"] },
      { id: "p_2", name: "B", baseUrl: "https://y/v1", apiFormat: "responses", apiKey: "k2", models: ["m2"] }
    ],
    bindings: {
      extractionModel: { providerId: "p_1", modelId: "ghost" },
      solutionModel: { providerId: "p_2", modelId: "m2" },
      debuggingModel: { providerId: "p_1", modelId: "m1" }
    },
    uiLanguage: "en",
    language: "csharp",
    opacity: 0.5,
    configVersion: 3
  }
  const { config, migrated } = migrateConfigData(raw)
  assert.equal(migrated, false)
  assert.deepEqual(config, raw)
})

test("未知键原样保留（前向兼容）", () => {
  const { config } = migrateConfigData({
    language: "python",
    futureFlag: { nested: true },
    configVersion: 1
  })
  assert.deepEqual(config.futureFlag, { nested: true })
})

test("不修改入参（纯函数）", () => {
  const raw = {
    apiKey: "sk-xxx",
    apiProvider: "openai",
    configVersion: 1
  }
  const snapshot = JSON.parse(JSON.stringify(raw))
  migrateConfigData(raw)
  assert.deepEqual(raw, snapshot)
})

test("单套 v3 形状（provider 对象 + 字符串绑定）在内存里等价于一条 provider，不丢数据", () => {
  const single = {
    provider: {
      baseUrl: "https://api.example.com/v1",
      apiFormat: "anthropic-messages",
      apiKey: "sk-single",
      models: ["glm-4.6v-flash", "qwen-vl-max"]
    },
    bindings: {
      extractionModel: "glm-4.6v-flash",
      solutionModel: "qwen-vl-max",
      debuggingModel: "ghost"
    },
    uiLanguage: "zh",
    language: "java",
    opacity: 1,
    configVersion: 3
  }

  const normalized = normalizeConfigData(single)
  assert.equal(normalized.providers.length, 1)
  assert.equal(normalized.providers[0].id, "p_auto1")
  assert.equal(normalized.providers[0].baseUrl, "https://api.example.com/v1")
  assert.equal(normalized.providers[0].apiKey, "sk-single")
  assert.deepEqual(normalized.providers[0].models, ["glm-4.6v-flash", "qwen-vl-max"])
  assert.deepEqual(normalized.bindings, {
    extractionModel: { providerId: "p_auto1", modelId: "glm-4.6v-flash" },
    solutionModel: { providerId: "p_auto1", modelId: "qwen-vl-max" },
    debuggingModel: { providerId: "", modelId: "" }
  })
  // 归一化不会把旧结构写回（migration 对 version>=3 零改动）
  const migrated = migrateConfigData(single)
  assert.equal(migrated.migrated, false)
  assert.deepEqual(migrated.config, single)
})

test("normalizeConfigData 不把旧扁平 apiKey 塞进 providers（迁移负责保留 Key）", () => {
  const normalized = normalizeConfigData({ apiKey: "sk-manual", language: "java" })
  assert.deepEqual(normalized.providers, [])
  assert.equal(normalized.configVersion, 3)
  // 但迁移会保留
  const migrated = migrateConfigData({ apiKey: "sk-manual", language: "java" })
  assert.equal(migrated.config.providers[0].apiKey, "sk-manual")
})
