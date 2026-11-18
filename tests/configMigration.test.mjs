// `configMigrations.ts` 单测（配置契约 v3）：纯函数，直接跑 tsc 产物（`dist-electron`）。
//
// 覆盖本 issue 验收里的迁移部分：
//   ① 全新安装默认值（provider 为空 / models: [] / bindings 为空 / configVersion: 3）
//   ② 旧配置迁移后 apiKey 保留 + 旧模型名被丢弃 + configVersion: 3
//   ③ 迁移一次性（迁移后手改字段重启不覆盖）
// 另加：幂等、未知键保留、入参不被修改、版本已满足时零改动。
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
    `缺少编译产物 ${distFile}，请先执行 \`npx tsc -p electron/tsconfig.json\` 或 \`npx tsc -p tsconfig.electron.json\``
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
  "provider",
  "uiLanguage"
]

test("① 默认值：provider 为空、models: []、bindings 为空、configVersion: 3", () => {
  assert.equal(CURRENT_CONFIG_VERSION, 3)
  assert.deepEqual(DEFAULT_CONFIG_DATA.provider, {
    baseUrl: "",
    apiFormat: DEFAULT_API_FORMAT,
    apiKey: "",
    models: []
  })
  assert.deepEqual(DEFAULT_CONFIG_DATA.bindings, {
    extractionModel: "",
    solutionModel: "",
    debuggingModel: ""
  })
  assert.equal(DEFAULT_CONFIG_DATA.uiLanguage, "system")
  assert.equal(DEFAULT_CONFIG_DATA.language, "java")
  assert.equal(DEFAULT_CONFIG_DATA.opacity, 1.0)
  assert.equal(DEFAULT_CONFIG_DATA.configVersion, 3)

  // 无 config.json 时迁移函数给出同一份默认值
  const fresh = migrateConfigData(undefined)
  assert.equal(fresh.migrated, true)
  assert.deepEqual(fresh.config, DEFAULT_CONFIG_DATA)
})

test("② 旧配置（apiProvider + 三个模型）迁移：apiKey 保留、旧模型名丢弃、configVersion=3", () => {
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
  // apiKey 必须保留（迁入 provider.apiKey）
  assert.equal(config.provider.apiKey, "sk-legacy-key")
  // 模型列表与绑定置空，旧内置模型名一个都不留
  assert.deepEqual(config.provider.models, [])
  assert.deepEqual(config.bindings, {
    extractionModel: "",
    solutionModel: "",
    debuggingModel: ""
  })
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
  assert.equal(config.provider.apiKey, "")
  assert.deepEqual(config.provider.models, [])
  assert.equal(config.configVersion, 3)
})

test("② 缺 language 的旧配置：回默认 java；旧 apiKey 迁入 provider", () => {
  const { config } = migrateConfigData({ apiKey: "a-key", apiProvider: "gemini" })
  assert.equal(config.language, "java")
  assert.equal(config.uiLanguage, "system")
  assert.equal(config.provider.apiKey, "a-key")
})

test("③ 迁移一次性：迁移后手改字段再启动不被覆盖", () => {
  const first = migrateConfigData({
    apiKey: "sk-legacy-key",
    apiProvider: "openai",
    extractionModel: "gpt-4o",
    configVersion: 2
  })
  assert.equal(first.migrated, true)

  // 用户在新设置页手改：加回 python、填 baseUrl、加模型、改绑定
  const userEdited = {
    ...first.config,
    provider: {
      ...first.config.provider,
      baseUrl: "https://api.example.com/v1",
      models: ["glm-4.6v-flash", "qwen-vl-max"]
    },
    bindings: {
      extractionModel: "glm-4.6v-flash",
      solutionModel: "qwen-vl-max",
      debuggingModel: "qwen-vl-max"
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
    provider: { baseUrl: "https://x/v1", apiFormat: "chat-completions", apiKey: "k", models: ["m1"] },
    bindings: { extractionModel: "ghost", solutionModel: "m1", debuggingModel: "m1" },
    uiLanguage: "en",
    language: "csharp",
    opacity: 0.5,
    configVersion: 3
  }
  const { config, migrated } = migrateConfigData(raw)
  assert.equal(migrated, false)
  assert.deepEqual(config, raw)
})

test("非法 JSON / 非对象输入 → 回落完整默认配置（不抛错）", () => {
  for (const invalid of [null, "{not json", "", [], 42, true]) {
    const { config, migrated } = migrateConfigData(invalid)
    assert.equal(migrated, true)
    assert.deepEqual(config, DEFAULT_CONFIG_DATA)
  }
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

test("normalizeConfigData 也能读懂旧扁平 apiKey（手工拷回旧文件不丢 Key）", () => {
  const normalized = normalizeConfigData({ apiKey: "sk-manual", language: "java" })
  assert.equal(normalized.provider.apiKey, "sk-manual")
  assert.deepEqual(normalized.provider.models, [])
  assert.equal(normalized.configVersion, 3)
})
