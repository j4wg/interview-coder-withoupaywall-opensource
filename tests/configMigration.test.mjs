/**
 * `configMigrations.ts` 单测：覆盖设计文档 5.2 用例矩阵前 5 行 + 幂等 / 不修改入参 / 未知键保留。
 * 零新依赖，直接跑 tsc 产物（`dist-electron/**`）。
 * 运行：npm test（即 `node --test tests/`）
 */
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
  DEFAULT_CONFIG_DATA,
  migrateConfigData
} = require(distFile)

test("默认配置：uiLanguage=system、language=java、configVersion=2", () => {
  assert.equal(CURRENT_CONFIG_VERSION, 2)
  assert.equal(DEFAULT_CONFIG_DATA.uiLanguage, "system")
  assert.equal(DEFAULT_CONFIG_DATA.language, "java")
  assert.equal(DEFAULT_CONFIG_DATA.configVersion, 2)
})

test("矩阵 1：无 config.json（undefined）→ 生成默认配置", () => {
  const { config, migrated } = migrateConfigData(undefined)
  assert.equal(migrated, true)
  assert.deepEqual(config, { ...DEFAULT_CONFIG_DATA })
})

test("矩阵 2：旧文件无 configVersion → 只覆盖三个键，其余逐键保留", () => {
  const raw = {
    language: "python",
    apiKey: "sk-xxx",
    apiProvider: "openai",
    solutionModel: "gpt-4o",
    opacity: 0.8
  }
  const { config, migrated } = migrateConfigData(raw)

  assert.equal(migrated, true)
  assert.equal(config.uiLanguage, "system")
  assert.equal(config.language, "java")
  assert.equal(config.configVersion, 2)
  // 其余键原样保留
  assert.equal(config.apiKey, "sk-xxx")
  assert.equal(config.apiProvider, "openai")
  assert.equal(config.solutionModel, "gpt-4o")
  assert.equal(config.opacity, 0.8)
  // 覆盖范围之外不新增默认键（否则验收 #2 的 diff 会多出键）
  assert.deepEqual(
    Object.keys(config).sort(),
    ["apiKey", "apiProvider", "configVersion", "language", "opacity", "solutionModel", "uiLanguage"].sort()
  )
})

test("矩阵 3：旧文件 configVersion=1 → 与矩阵 2 一致地覆盖三个键", () => {
  const raw = {
    language: "csharp",
    apiKey: "sk-ant-abc",
    apiProvider: "anthropic",
    extractionModel: "claude-3-7-sonnet-20250219",
    solutionModel: "claude-3-7-sonnet-20250219",
    debuggingModel: "claude-3-7-sonnet-20250219",
    opacity: 0.5,
    uiLanguage: "en",
    configVersion: 1
  }
  const { config, migrated } = migrateConfigData(raw)

  assert.equal(migrated, true)
  assert.equal(config.uiLanguage, "system")
  assert.equal(config.language, "java")
  assert.equal(config.configVersion, 2)
  assert.equal(config.apiKey, "sk-ant-abc")
  assert.equal(config.apiProvider, "anthropic")
  assert.equal(config.extractionModel, "claude-3-7-sonnet-20250219")
  assert.equal(config.opacity, 0.5)
})

test("矩阵 4：configVersion=2 且用户已改过 → 完全不改动", () => {
  const raw = {
    language: "python",
    uiLanguage: "zh",
    configVersion: 2,
    apiKey: "sk-user"
  }
  const { config, migrated } = migrateConfigData(raw)

  assert.equal(migrated, false)
  assert.deepEqual(config, raw)
})

test("矩阵 5：非法 JSON / 空文件 / 非对象 → 回落完整默认配置", () => {
  // 非法 JSON 在 ConfigHelper 里由 JSON.parse 抛错分支处理；
  // 纯函数看到的是解析失败后传入的非对象值，这里逐一覆盖。
  for (const invalid of [null, "{not json", "", [], 42, true]) {
    const { config, migrated } = migrateConfigData(invalid)
    assert.equal(migrated, true)
    assert.deepEqual(config, { ...DEFAULT_CONFIG_DATA })
  }
})

test("幂等：对迁移结果再跑一次不再改动", () => {
  const raw = { language: "python", apiKey: "sk-xxx", opacity: 0.8 }
  const first = migrateConfigData(raw)
  const second = migrateConfigData(first.config)

  assert.equal(second.migrated, false)
  assert.deepEqual(second.config, first.config)
})

test("未知键原样保留", () => {
  const raw = { language: "python", futureFlag: { nested: true }, configVersion: 1 }
  const { config } = migrateConfigData(raw)
  assert.deepEqual(config.futureFlag, { nested: true })
})

test("不修改入参（纯函数）", () => {
  const raw = { language: "python", configVersion: 1, apiKey: "sk-xxx" }
  const snapshot = JSON.parse(JSON.stringify(raw))
  migrateConfigData(raw)
  assert.deepEqual(raw, snapshot)
})
