// `configFile.ts` 文件级单测：用临时目录真实读写，覆盖本 issue 验收的
//   ① 全新安装（无 config.json → 写默认值，v3 多套结构）
//   ② 旧配置落盘迁移（apiKey 保留进 providers[0] / 旧模型名丢弃 / configVersion: 3）
//   ③ 迁移一次性（迁移后手改字段，重启不覆盖：文件内容逐字节不变）
//   ④ 非法 JSON → 备份 config.invalid-*.json + 写默认值 + 不崩溃
// 另加：读失败（路径是目录）、写失败（父路径是文件）、归一化只影响内存不覆盖文件、
//       未发布的单套 v3 形状（provider 对象）读入后数据不丢。
//
// 运行：`npm test`（pretest 先执行 `tsc -p tsconfig.electron.json` 生成产物）。
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const distFile = path.resolve(here, "../dist-electron/configFile.js")

if (!fs.existsSync(distFile)) {
  throw new Error(
    `缺少编译产物 ${distFile}，请先执行 \`npx tsc -p tsconfig.electron.json\``
  )
}

const { loadConfigFile, writeConfigFileAtomic } = require(distFile)
const { DEFAULT_CONFIG_DATA } = require(
  path.resolve(here, "../dist-electron/configMigrations.js")
)

const EMPTY_BINDINGS = {
  extractionModel: { providerId: "", modelId: "" },
  solutionModel: { providerId: "", modelId: "" },
  debuggingModel: { providerId: "", modelId: "" }
}

/** 每个用例一个独立临时目录，避免互相污染 */
function makeTmpDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "interview-config-"))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
const backupFiles = (dir) =>
  fs.readdirSync(dir).filter((name) => name.startsWith("config.invalid-"))

test("① 全新安装：无 config.json → 落盘完整默认配置（v3，providers 为空数组）", (t) => {
  const dir = makeTmpDir(t)
  const configPath = path.join(dir, "config.json")

  const result = loadConfigFile(configPath)

  assert.equal(result.readFailed, false)
  assert.equal(result.writeFailed, false)
  assert.equal(result.created, true)
  assert.equal(result.migrated, false)
  assert.deepEqual(result.config, DEFAULT_CONFIG_DATA)

  // 文件真的写出来了，且内容与默认值一致
  assert.equal(fs.existsSync(configPath), true)
  const onDisk = readJson(configPath)
  assert.deepEqual(onDisk, DEFAULT_CONFIG_DATA)
  assert.deepEqual(onDisk.providers, [])
  assert.deepEqual(onDisk.bindings, EMPTY_BINDINGS)
  assert.equal(onDisk.configVersion, 3)

  // 再读一次：不再创建、不再迁移
  const again = loadConfigFile(configPath)
  assert.equal(again.created, false)
  assert.equal(again.migrated, false)
  assert.deepEqual(again.config, DEFAULT_CONFIG_DATA)
})

test("② 旧配置落盘迁移：apiKey 保留进 providers[0]、旧模型名丢弃、configVersion: 3", (t) => {
  const dir = makeTmpDir(t)
  const configPath = path.join(dir, "config.json")
  const legacy = {
    apiKey: "sk-legacy-key",
    apiProvider: "anthropic",
    extractionModel: "claude-3-7-sonnet-20250219",
    solutionModel: "gpt-4o",
    debuggingModel: "gemini-2.0-flash",
    language: "python",
    opacity: 0.8,
    uiLanguage: "zh",
    configVersion: 2
  }
  fs.writeFileSync(configPath, JSON.stringify(legacy, null, 2))

  const result = loadConfigFile(configPath)

  assert.equal(result.migrated, true)
  assert.equal(result.writeFailed, false)
  assert.equal(result.config.providers.length, 1)
  assert.equal(result.config.providers[0].apiKey, "sk-legacy-key")
  assert.deepEqual(result.config.providers[0].models, [])
  assert.deepEqual(result.config.bindings, EMPTY_BINDINGS)
  assert.equal(result.config.configVersion, 3)
  assert.equal(result.droppedLegacyKeys.length, 4)

  // 落盘结果同样是 v3，旧顶层键与旧模型名一个都不剩
  const onDisk = readJson(configPath)
  assert.deepEqual(onDisk, result.config)
  for (const legacyKey of ["apiProvider", "extractionModel", "solutionModel", "debuggingModel"]) {
    // 注意：三个 *Model 名字在 v3 里是 bindings 的子键，只断言“不再是顶层键”
    assert.equal(legacyKey in onDisk, false, `磁盘上仍有旧顶层键 ${legacyKey}`)
  }
  const serialized = JSON.stringify(onDisk)
  assert.equal(serialized.includes("apiProvider"), false)
  assert.equal(serialized.includes("gpt-4o"), false)
  assert.equal(serialized.includes("claude-3"), false)
  assert.equal(serialized.includes("gemini-2.0-flash"), false)
})

test("③ 迁移一次性：迁移后手改字段，重启（再次读取）不覆盖文件", (t) => {
  const dir = makeTmpDir(t)
  const configPath = path.join(dir, "config.json")
  fs.writeFileSync(
    configPath,
    JSON.stringify({ apiKey: "sk-legacy", apiProvider: "openai", configVersion: 2 })
  )

  const afterMigration = loadConfigFile(configPath)
  assert.equal(afterMigration.migrated, true)

  // 用户在新设置页手改：加第二套 provider、填 baseUrl、加模型、跨 provider 绑定
  const providerAId = afterMigration.config.providers[0].id
  const userEdited = {
    ...afterMigration.config,
    providers: [
      {
        ...afterMigration.config.providers[0],
        name: "公司 GLM",
        baseUrl: "https://api.example.com/v1",
        apiFormat: "chat-completions",
        models: ["glm-4.6v-flash"]
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
      extractionModel: { providerId: providerAId, modelId: "glm-4.6v-flash" },
      solutionModel: { providerId: "p_000002", modelId: "gpt-5" },
      debuggingModel: { providerId: "p_000002", modelId: "gpt-5" }
    },
    language: "python"
  }
  fs.writeFileSync(configPath, JSON.stringify(userEdited, null, 2))
  const before = fs.readFileSync(configPath, "utf8")

  const afterRestart = loadConfigFile(configPath)

  assert.equal(afterRestart.migrated, false)
  assert.deepEqual(afterRestart.config, userEdited)
  // 文件逐字节不变：没有被迁移再次覆盖
  assert.equal(fs.readFileSync(configPath, "utf8"), before)
  assert.deepEqual(backupFiles(dir), [])
})

test("④ 非法 JSON：备份 config.invalid-*.json + 写默认值 + 不崩溃", (t) => {
  const dir = makeTmpDir(t)
  const configPath = path.join(dir, "config.json")
  const broken = '{ "apiKey": "sk-xxx", '
  fs.writeFileSync(configPath, broken)

  const result = loadConfigFile(configPath)

  // 不抛错，回落默认值
  assert.deepEqual(result.config, DEFAULT_CONFIG_DATA)
  assert.equal(result.writeFailed, false)
  assert.ok(result.invalidBackupPath, "应给出备份路径")

  // 备份文件存在且内容就是损坏原文
  const backups = backupFiles(dir)
  assert.equal(backups.length, 1)
  assert.equal(path.basename(result.invalidBackupPath), backups[0])
  assert.equal(fs.readFileSync(result.invalidBackupPath, "utf8"), broken)

  // 主文件已被重写为合法默认配置
  assert.deepEqual(readJson(configPath), DEFAULT_CONFIG_DATA)
})

test("④ 根不是 JSON 对象（数组 / 标量）：同样备份并写默认值", (t) => {
  for (const payload of ["[]", "42", "null", '"text"']) {
    const dir = makeTmpDir(t)
    const configPath = path.join(dir, "config.json")
    fs.writeFileSync(configPath, payload)

    const result = loadConfigFile(configPath)

    assert.deepEqual(result.config, DEFAULT_CONFIG_DATA)
    assert.ok(result.invalidBackupPath, `payload=${payload} 应给出备份路径`)
    assert.equal(backupFiles(dir).length, 1, `payload=${payload} 应生成一个备份`)
    assert.deepEqual(readJson(configPath), DEFAULT_CONFIG_DATA)
  }
})

test("读失败：配置路径是目录 → readFailed=true、返回默认值、不抛错", (t) => {
  const dir = makeTmpDir(t)
  const configPath = path.join(dir, "config.json")
  fs.mkdirSync(configPath)

  const result = loadConfigFile(configPath)

  assert.equal(result.readFailed, true)
  assert.equal(result.writeFailed, false)
  assert.deepEqual(result.config, DEFAULT_CONFIG_DATA)
  assert.ok(result.error)
})

test("读/写失败：父路径是文件 → readFailed=true、writeConfigFileAtomic=false、仍返回可用默认值", (t) => {
  const dir = makeTmpDir(t)
  const blocker = path.join(dir, "blocker")
  fs.writeFileSync(blocker, "not a directory")
  const configPath = path.join(blocker, "config.json")

  const result = loadConfigFile(configPath)

  assert.equal(result.readFailed, true)
  assert.equal(result.writeFailed, false)
  assert.deepEqual(result.config, DEFAULT_CONFIG_DATA)

  // 原子写本身也返回 false，不抛错、不留临时文件
  assert.equal(writeConfigFileAtomic(configPath, DEFAULT_CONFIG_DATA), false)
  assert.equal(fs.existsSync(`${configPath}.tmp`), false)
})

test("归一化只影响内存：非法 apiFormat / 悬空绑定不覆盖用户文件", (t) => {
  const dir = makeTmpDir(t)
  const configPath = path.join(dir, "config.json")
  const userConfig = {
    providers: [
      { id: "p_1", name: "A", baseUrl: "https://x/v1", apiFormat: "bogus", apiKey: "k", models: ["m1", "m2"] },
      { id: "p_2", name: "B", baseUrl: "https://y/v1", apiFormat: "responses", apiKey: "k2", models: ["m3"] }
    ],
    bindings: {
      extractionModel: { providerId: "p_1", modelId: "ghost" },
      solutionModel: { providerId: "p_2", modelId: "m3" },
      debuggingModel: { providerId: "p_ghost", modelId: "m1" }
    },
    uiLanguage: "system",
    language: "java",
    opacity: 1.0,
    configVersion: 3
  }
  const text = JSON.stringify(userConfig, null, 2)
  fs.writeFileSync(configPath, text)

  const result = loadConfigFile(configPath)

  assert.equal(result.migrated, false)
  assert.equal(result.config.providers[0].apiFormat, "responses")
  assert.deepEqual(result.config.bindings, {
    extractionModel: { providerId: "", modelId: "" },
    solutionModel: { providerId: "p_2", modelId: "m3" },
    debuggingModel: { providerId: "", modelId: "" }
  })
  assert.deepEqual(result.normalizedKeys.sort(), ["bindings", "providers"])
  // 文件保持用户原样（归一化不写回，避免"重启覆盖用户手改"）
  assert.equal(fs.readFileSync(configPath, "utf8"), text)
})

test("未发布的单套 v3 形状（provider 对象）读入后数据不丢、也不改写文件", (t) => {
  const dir = makeTmpDir(t)
  const configPath = path.join(dir, "config.json")
  const single = {
    provider: {
      baseUrl: "https://api.example.com/v1",
      apiFormat: "anthropic-messages",
      apiKey: "sk-single",
      models: ["glm-4.6v-flash"]
    },
    bindings: {
      extractionModel: "glm-4.6v-flash",
      solutionModel: "glm-4.6v-flash",
      debuggingModel: "glm-4.6v-flash"
    },
    uiLanguage: "system",
    language: "java",
    opacity: 1.0,
    configVersion: 3
  }
  const text = JSON.stringify(single, null, 2)
  fs.writeFileSync(configPath, text)

  const result = loadConfigFile(configPath)

  // version 已满足 → 不触发迁移、不写盘
  assert.equal(result.migrated, false)
  assert.equal(fs.readFileSync(configPath, "utf8"), text)
  // 内存里等价于一条 provider，三个绑定都指向它
  assert.equal(result.config.providers.length, 1)
  assert.equal(result.config.providers[0].apiKey, "sk-single")
  assert.deepEqual(result.config.providers[0].models, ["glm-4.6v-flash"])
  const providerId = result.config.providers[0].id
  assert.deepEqual(result.config.bindings, {
    extractionModel: { providerId, modelId: "glm-4.6v-flash" },
    solutionModel: { providerId, modelId: "glm-4.6v-flash" },
    debuggingModel: { providerId, modelId: "glm-4.6v-flash" }
  })
})
