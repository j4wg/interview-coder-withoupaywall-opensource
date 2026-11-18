// `configMigrations.ts` 归一化（校验）单测：多套 provider 并存 + 跨 provider 绑定。
//
// 覆盖本 issue 验收的 ⑤⑥⑦ 与多套口径的引用完整性：
//   ⑤ bindings 指向不存在的 provider / model → 置空（不保留悬空引用）
//   ⑥ providers 为空 / models 为空 → bindings 留空且不抛错
//   ⑦ apiFormat 非法值 → 归一为默认值且不崩溃
// 另加：字段级归一、provider id 稳定性、跨 provider 绑定、增删改 provider 的引用处理。
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
  DEFAULT_CONFIG_DATA,
  addProviderConfig,
  createProviderId,
  diffNormalizedKeys,
  emptyBinding,
  findBindingUses,
  findProvider,
  isBindingEmpty,
  mergeConfigUpdate,
  normalizeBinding,
  normalizeBindings,
  normalizeConfigData,
  normalizeProviderConfig,
  normalizeProviders,
  normalizeStringList,
  removeProviderConfig,
  resolveBinding,
  updateProviderConfig
} = require(distFile)

const PROVIDER_A = {
  id: "p_000001",
  name: "公司 GLM",
  baseUrl: "https://api.example.com/v1",
  apiFormat: "chat-completions",
  apiKey: "sk-a",
  models: ["glm-4.6v-flash", "qwen-vl-max"]
}

const PROVIDER_B = {
  id: "p_000002",
  name: "个人 OpenAI",
  baseUrl: "https://api.openai.com/v1",
  apiFormat: "responses",
  apiKey: "sk-b",
  models: ["gpt-5"]
}

/** 只带 providers 的最小 v3 配置 */
const withProviders = (providers, extra = {}) => ({
  providers,
  bindings: {},
  uiLanguage: "system",
  language: "java",
  opacity: 1.0,
  configVersion: 3,
  ...extra
})

const bind = (providerId, modelId) => ({ providerId, modelId })
const EMPTY = emptyBinding()

test("多套 provider 并存：各自字段互不共用、各自模型列表独立", () => {
  const normalized = normalizeConfigData(
    withProviders([PROVIDER_A, PROVIDER_B], {
      bindings: {
        extractionModel: bind("p_000001", "glm-4.6v-flash"),
        solutionModel: bind("p_000002", "gpt-5"),
        debuggingModel: bind("p_000002", "gpt-5")
      }
    })
  )

  assert.equal(normalized.providers.length, 2)
  assert.deepEqual(normalized.providers[0], PROVIDER_A)
  assert.deepEqual(normalized.providers[1], PROVIDER_B)
  // 跨 provider 绑定必须原样保留（题面解析用 A 家，方案/调试用 B 家）
  assert.deepEqual(normalized.bindings, {
    extractionModel: bind("p_000001", "glm-4.6v-flash"),
    solutionModel: bind("p_000002", "gpt-5"),
    debuggingModel: bind("p_000002", "gpt-5")
  })
})

test("⑤ bindings 指向不存在的 provider → 置空（不崩溃、不保留悬空引用）", () => {
  const normalized = normalizeConfigData(
    withProviders([PROVIDER_A, PROVIDER_B], {
      bindings: {
        extractionModel: bind("p_ghost", "glm-4.6v-flash"),
        solutionModel: bind("p_ghost", "gpt-5"),
        debuggingModel: bind("p_000001", "glm-4.6v-flash")
      }
    })
  )

  assert.deepEqual(normalized.bindings.extractionModel, EMPTY)
  assert.deepEqual(normalized.bindings.solutionModel, EMPTY)
  // 合法的那一项不受影响
  assert.deepEqual(normalized.bindings.debuggingModel, bind("p_000001", "glm-4.6v-flash"))
  // provider 列表本身不被改动
  assert.equal(normalized.providers.length, 2)
})

test("⑤ bindings 指向 provider 存在但模型不存在 → 置空", () => {
  const normalized = normalizeConfigData(
    withProviders([PROVIDER_A], {
      bindings: {
        extractionModel: bind("p_000001", "does-not-exist"),
        solutionModel: bind("p_000001", "qwen-vl-max"),
        debuggingModel: bind("p_000001", "   ")
      }
    })
  )
  assert.deepEqual(normalized.bindings, {
    extractionModel: EMPTY,
    solutionModel: bind("p_000001", "qwen-vl-max"),
    debuggingModel: EMPTY
  })
})

test("⑤ 模型属于另一个 provider（交叉引用）→ 置空，不会猜着换 provider", () => {
  const normalized = normalizeConfigData(
    withProviders([PROVIDER_A, PROVIDER_B], {
      bindings: {
        // gpt-5 只在 B 里，却绑到 A
        extractionModel: bind("p_000001", "gpt-5"),
        solutionModel: bind("p_000002", "glm-4.6v-flash"),
        debuggingModel: bind("p_000002", "gpt-5")
      }
    })
  )
  assert.deepEqual(normalized.bindings.extractionModel, EMPTY)
  assert.deepEqual(normalized.bindings.solutionModel, EMPTY)
  assert.deepEqual(normalized.bindings.debuggingModel, bind("p_000002", "gpt-5"))
})

test("⑤ 绑定缺失 / 非对象 / 非字符串字段 / 带空白 → 归一为置空或 trim 后匹配", () => {
  for (const bindings of [
    {},
    { extractionModel: 42 },
    { extractionModel: null },
    { extractionModel: { providerId: "p_000001" } },
    { extractionModel: { modelId: "glm-4.6v-flash" } },
    { extractionModel: { providerId: 42, modelId: 42 } }
  ]) {
    const normalized = normalizeConfigData(
      withProviders([PROVIDER_A, PROVIDER_B], { bindings })
    )
    assert.deepEqual(normalized.bindings, {
      extractionModel: EMPTY,
      solutionModel: EMPTY,
      debuggingModel: EMPTY
    })
  }

  // 多套并存时字符串绑定不猜 provider → 置空
  const stringBinding = normalizeConfigData(
    withProviders([PROVIDER_A, PROVIDER_B], {
      bindings: { extractionModel: "glm-4.6v-flash" }
    })
  )
  assert.deepEqual(stringBinding.bindings.extractionModel, EMPTY)

  // 只有一套 provider 时兼容未发布的单套形状：字符串绑定按该 provider 解析
  const singleString = normalizeConfigData(
    withProviders([PROVIDER_A], {
      bindings: { extractionModel: "glm-4.6v-flash" }
    })
  )
  assert.deepEqual(singleString.bindings.extractionModel, bind("p_000001", "glm-4.6v-flash"))

  const trimmed = normalizeConfigData(
    withProviders([PROVIDER_A], {
      bindings: {
        extractionModel: { providerId: "  p_000001  ", modelId: "  qwen-vl-max  " },
        solutionModel: bind("p_000001", "glm-4.6v-flash"),
        debuggingModel: bind("p_000001", "glm-4.6v-flash")
      }
    })
  )
  assert.deepEqual(trimmed.bindings.extractionModel, bind("p_000001", "qwen-vl-max"))
})

test("⑥ 没有 provider / models 为空 → bindings 留空且不抛错", () => {
  for (const providers of [
    [],
    [{ ...PROVIDER_A, models: [] }],
    [{ ...PROVIDER_A, models: [] }, { ...PROVIDER_B, models: [] }]
  ]) {
    const normalized = normalizeConfigData(
      withProviders(providers, {
        bindings: {
          extractionModel: bind("p_000001", "ghost"),
          solutionModel: bind("p_000002", "ghost"),
          debuggingModel: "ghost"
        }
      })
    )
    assert.deepEqual(normalized.bindings, {
      extractionModel: EMPTY,
      solutionModel: EMPTY,
      debuggingModel: EMPTY
    })
  }

  // 纯函数版本同样不抛错
  assert.deepEqual(normalizeBindings({ extractionModel: bind("p_1", "x") }, []), {
    extractionModel: EMPTY,
    solutionModel: EMPTY,
    debuggingModel: EMPTY
  })
})

test("⑥ providers 非数组 → 空列表；数组里的非对象条目丢弃", () => {
  for (const providers of [undefined, null, "p1", 42, {}, "[]"]) {
    assert.deepEqual(normalizeProviders(providers), [], `providers=${JSON.stringify(providers)}`)
    const normalized = normalizeConfigData(withProviders(providers))
    assert.deepEqual(normalized.providers, [])
    assert.deepEqual(normalized.bindings, {
      extractionModel: EMPTY,
      solutionModel: EMPTY,
      debuggingModel: EMPTY
    })
  }

  assert.deepEqual(normalizeProviders([null, 42, "x", PROVIDER_A, []]), [PROVIDER_A])
})

test("provider id 稳定：缺失/重复 id 补确定的 p_auto<n>，不丢条目", () => {
  const normalized = normalizeProviders([
    { name: "no-id", baseUrl: "https://a/v1", models: ["m1"] },
    { id: "p_same", name: "dup-1", models: ["m1"] },
    { id: "p_same", name: "dup-2", models: ["m1"] },
    { id: "   ", name: "blank", models: [] }
  ])

  assert.deepEqual(
    normalized.map((provider) => provider.id),
    ["p_auto1", "p_same", "p_auto2", "p_auto3"]
  )
  // 同一份输入反复归一得到同一组 id（不随重启变化）
  assert.deepEqual(
    normalizeProviders([
      { name: "no-id", baseUrl: "https://a/v1", models: ["m1"] },
      { id: "p_same", name: "dup-1", models: ["m1"] },
      { id: "p_same", name: "dup-2", models: ["m1"] },
      { id: "   ", name: "blank", models: [] }
    ]).map((provider) => provider.id),
    ["p_auto1", "p_same", "p_auto2", "p_auto3"]
  )
  // 补出来的 id 可以被正常绑定
  const rebound = normalizeConfigData(
    withProviders(normalized, {
      bindings: { extractionModel: bind("p_auto1", "m1") }
    })
  )
  assert.deepEqual(rebound.bindings.extractionModel, bind("p_auto1", "m1"))
})

test("createProviderId：确定性、不撞车、返回 p_ 前缀六位十六进制", () => {
  assert.equal(createProviderId([], () => 0), "p_000000")
  assert.equal(createProviderId([], () => 0.999999), "p_ffffef")
  assert.equal(createProviderId([], () => 1), "p_ffffef")
  // 撞车时重新抽
  let calls = 0
  const id = createProviderId(["p_000001"], () => {
    calls += 1
    return calls === 1 ? 0x000001 / 0x1000000 : 0x000002 / 0x1000000
  })
  assert.equal(id, "p_000002")
  // 连续撞满 50 次后退回确定序号
  assert.equal(createProviderId(["p_000001"], () => 0x000001 / 0x1000000), "p_auto1")
})

test("⑦ apiFormat 非法值 → 归一为默认值（不崩溃）", () => {
  assert.equal(DEFAULT_API_FORMAT, "responses")
  for (const apiFormat of ["", "Responses", "openai", "chat", 42, null, undefined, ["responses"]]) {
    const normalized = normalizeConfigData(
      withProviders([{ ...PROVIDER_A, apiFormat }])
    )
    assert.equal(normalized.providers[0].apiFormat, DEFAULT_API_FORMAT)
  }
  // 三个合法值原样保留（三种 API 格式都要真正可用）
  for (const apiFormat of API_FORMATS) {
    const normalized = normalizeConfigData(
      withProviders([{ ...PROVIDER_A, apiFormat }])
    )
    assert.equal(normalized.providers[0].apiFormat, apiFormat)
  }
})

test("⑦ provider 条目非对象 / 整个 providers 缺失 → 不抛错", () => {
  assert.deepEqual(
    normalizeProviderConfig(undefined, "p_x"),
    { id: "p_x", name: "", baseUrl: "", apiFormat: DEFAULT_API_FORMAT, apiKey: "", models: [] }
  )
  const normalized = normalizeConfigData({})
  assert.deepEqual(normalized.providers, [])
  assert.deepEqual(normalized.bindings, {
    extractionModel: EMPTY,
    solutionModel: EMPTY,
    debuggingModel: EMPTY
  })
})

test("字段级归一：baseUrl 去空白与末尾斜杠、apiKey/name 去空白、models 去重保序", () => {
  const provider = normalizeProviderConfig({
    id: "  p_x  ",
    name: "  公司 GLM  ",
    baseUrl: "  https://api.example.com/v1///  ",
    apiKey: "  sk-abc  ",
    apiFormat: "anthropic-messages",
    models: [" m1 ", "m2", "m1", "", "  "]
  })
  assert.equal(provider.id, "p_x")
  assert.equal(provider.name, "公司 GLM")
  assert.equal(provider.baseUrl, "https://api.example.com/v1")
  assert.equal(provider.apiKey, "sk-abc")
  assert.equal(provider.apiFormat, "anthropic-messages")
  assert.deepEqual(provider.models, ["m1", "m2"])

  // 非字符串 baseUrl / apiKey / name → 空串（上层据此提示"先配置服务地址"）
  const empty = normalizeProviderConfig({ baseUrl: 42, apiKey: null, name: 42 })
  assert.equal(empty.baseUrl, "")
  assert.equal(empty.apiKey, "")
  assert.equal(empty.name, "")

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

test("configVersion 缺失 → 当前版本；非对象输入 → 默认配置", () => {
  assert.equal(normalizeConfigData({}).configVersion, 3)
  assert.equal(normalizeConfigData({ configVersion: 2 }).configVersion, 2)
  for (const invalid of [null, [], "x", 42]) {
    const normalized = normalizeConfigData(invalid)
    assert.deepEqual(normalized.providers, [])
    assert.equal(normalized.configVersion, 3)
    assert.deepEqual(normalized.bindings, {
      extractionModel: EMPTY,
      solutionModel: EMPTY,
      debuggingModel: EMPTY
    })
  }
})

test("findBindingUses / resolveBinding：引用查询与调用层解析", () => {
  const bindings = {
    extractionModel: bind("p_000001", "glm-4.6v-flash"),
    solutionModel: bind("p_000002", "gpt-5"),
    debuggingModel: bind("p_000001", "qwen-vl-max")
  }
  assert.deepEqual(findBindingUses(bindings, "p_000001"), [
    "extractionModel",
    "debuggingModel"
  ])
  assert.deepEqual(findBindingUses(bindings, "p_ghost"), [])
  assert.deepEqual(findBindingUses(bindings, ""), [])

  const resolved = resolveBinding(bindings.solutionModel, [PROVIDER_A, PROVIDER_B])
  assert.equal(resolved.modelId, "gpt-5")
  assert.equal(resolved.provider.id, "p_000002")
  assert.equal(resolved.provider.baseUrl, "https://api.openai.com/v1")
  assert.equal(resolved.provider.apiFormat, "responses")
  // 未绑定 / 悬空引用 → null
  assert.equal(resolveBinding(EMPTY, [PROVIDER_A]), null)
  assert.equal(resolveBinding(bind("p_000001", "gpt-5"), [PROVIDER_A, PROVIDER_B]), null)
  assert.equal(isBindingEmpty(EMPTY), true)
})

test("findProvider：按 id 查找，空白/不存在不打错", () => {
  assert.equal(findProvider([PROVIDER_A], "p_000001").name, "公司 GLM")
  assert.equal(findProvider([PROVIDER_A], "  p_000001  ").id, "p_000001")
  assert.equal(findProvider([PROVIDER_A], "p_ghost"), undefined)
  assert.equal(findProvider([PROVIDER_A], ""), undefined)
  assert.equal(findProvider([PROVIDER_A], undefined), undefined)
})

test("diffNormalizedKeys：如实报告被归一的顶层键（供日志与取证）", () => {
  const raw = {
    providers: [{ ...PROVIDER_A, apiFormat: "bogus" }],
    bindings: {
      extractionModel: bind("p_000001", "ghost"),
      solutionModel: bind("p_000001", "glm-4.6v-flash"),
      debuggingModel: bind("p_000001", "glm-4.6v-flash")
    },
    uiLanguage: "system",
    language: "java",
    opacity: 1.0,
    configVersion: 3
  }
  const normalized = normalizeConfigData(raw)
  assert.deepEqual(diffNormalizedKeys(raw, normalized).sort(), ["bindings", "providers"])

  // 已合法的配置零改动
  assert.deepEqual(diffNormalizedKeys(normalized, normalizeConfigData(normalized)), [])
})

test("updateConfig 内核：providers 整体替换 + 同一次更新里新加的模型可跨 provider 绑定", () => {
  const current = normalizeConfigData({})

  const updated = mergeConfigUpdate(current, {
    providers: [
      { ...PROVIDER_A, baseUrl: "https://api.example.com/v1/", name: "  公司 GLM  " },
      PROVIDER_B
    ],
    bindings: {
      extractionModel: bind("p_000001", "qwen-vl-max"),
      solutionModel: bind("p_000002", "gpt-5")
    },
    language: "python"
  })

  assert.deepEqual(updated.providers.map((provider) => provider.id), ["p_000001", "p_000002"])
  assert.equal(updated.providers[0].baseUrl, "https://api.example.com/v1")
  assert.equal(updated.providers[0].name, "公司 GLM")
  assert.deepEqual(updated.bindings, {
    extractionModel: bind("p_000001", "qwen-vl-max"),
    solutionModel: bind("p_000002", "gpt-5"),
    debuggingModel: EMPTY
  })
  assert.equal(updated.language, "python")
  assert.equal(updated.configVersion, 3)
})

test("updateConfig 内核：bindings 逐键合并；显式空绑定可清空单个用途", () => {
  const current = normalizeConfigData({
    providers: [PROVIDER_A, PROVIDER_B],
    bindings: {
      extractionModel: bind("p_000001", "glm-4.6v-flash"),
      solutionModel: bind("p_000002", "gpt-5"),
      debuggingModel: bind("p_000002", "gpt-5")
    }
  })

  const updated = mergeConfigUpdate(current, {
    bindings: { debuggingModel: EMPTY }
  })
  assert.deepEqual(updated.bindings, {
    extractionModel: bind("p_000001", "glm-4.6v-flash"),
    solutionModel: bind("p_000002", "gpt-5"),
    debuggingModel: EMPTY
  })
})

test("updateConfig 内核：providers 非数组视为未提供（畸形更新不会清空多套配置）", () => {
  const current = normalizeConfigData({
    providers: [PROVIDER_A, PROVIDER_B],
    bindings: { extractionModel: bind("p_000001", "glm-4.6v-flash") }
  })

  for (const providers of ["x", 42, null, { id: "p_1" }]) {
    const updated = mergeConfigUpdate(current, { providers })
    assert.deepEqual(updated.providers, [PROVIDER_A, PROVIDER_B])
    assert.deepEqual(updated.bindings.extractionModel, bind("p_000001", "glm-4.6v-flash"))
  }

  // 显式空数组才是清空
  const cleared = mergeConfigUpdate(current, { providers: [] })
  assert.deepEqual(cleared.providers, [])
  assert.deepEqual(cleared.bindings.extractionModel, EMPTY)
})

test("updateConfig 内核：旧字段与 configVersion 一律忽略，v3 结构不回退", () => {
  const current = normalizeConfigData({
    providers: [PROVIDER_A],
    bindings: { extractionModel: bind("p_000001", "glm-4.6v-flash") }
  })

  const updated = mergeConfigUpdate(current, {
    apiKey: "legacy-key",
    apiProvider: "openai",
    provider: { baseUrl: "https://legacy/v1", models: ["gpt-4o"] },
    activeProviderId: "p_000001",
    extractionModel: "ghost",
    solutionModel: "ghost",
    debuggingModel: "ghost",
    configVersion: 2,
    opacity: 0.5
  })

  assert.deepEqual(updated.providers, [PROVIDER_A])
  assert.deepEqual(updated.bindings, {
    extractionModel: bind("p_000001", "glm-4.6v-flash"),
    solutionModel: EMPTY,
    debuggingModel: EMPTY
  })
  assert.equal(updated.configVersion, 3)
  assert.equal(updated.opacity, 0.5)
  assert.deepEqual(Object.keys(updated).sort(), [
    "bindings",
    "configVersion",
    "language",
    "opacity",
    "providers",
    "uiLanguage"
  ])
})

test("updateConfig 内核：非对象 / 非法输入不抛错", () => {
  const current = normalizeConfigData({ providers: [PROVIDER_A] })
  for (const updates of [null, undefined, 42, "x", [], { bindings: "x" }, { providers: "x" }]) {
    const updated = mergeConfigUpdate(current, updates)
    assert.equal(updated.configVersion, 3)
    assert.deepEqual(updated.providers, [PROVIDER_A])
  }
})

test("addProviderConfig：生成稳定 id、字段归一、id 撞车不新增", () => {
  const current = normalizeConfigData({})

  const added = addProviderConfig(
    current,
    { id: "p_000009", name: " 公司 GLM ", baseUrl: "https://api.example.com/v1/", models: ["m1", "m1"] },
    { random: () => 0 }
  )
  assert.equal(added.added, true)
  assert.equal(added.providerId, "p_000009")
  assert.deepEqual(added.config.providers[0], {
    id: "p_000009",
    name: "公司 GLM",
    baseUrl: "https://api.example.com/v1",
    apiFormat: DEFAULT_API_FORMAT,
    apiKey: "",
    models: ["m1"]
  })

  // 自动生成 id
  const auto = addProviderConfig(added.config, { name: "个人" }, { random: () => 0.5 })
  assert.equal(auto.added, true)
  assert.equal(auto.providerId, "p_800000")
  assert.deepEqual(auto.config.providers.map((p) => p.id), ["p_000009", "p_800000"])

  // 撞车 → 不新增、不改动现有配置
  const collide = addProviderConfig(auto.config, { name: "dup" }, { id: "p_000009" })
  assert.equal(collide.added, false)
  assert.equal(collide.providerId, "")
  assert.deepEqual(collide.config.providers, auto.config.providers)

  // 非法入参不抛错
  for (const input of [null, undefined, 42, "x", []]) {
    const result = addProviderConfig(normalizeConfigData({}), input, { random: () => 0 })
    assert.equal(result.added, true)
    assert.equal(result.config.providers.length, 1)
  }
})

test("updateProviderConfig：id 不可变、models 整体替换、被删模型的绑定置空并报告", () => {
  const current = normalizeConfigData({
    providers: [PROVIDER_A, PROVIDER_B],
    bindings: {
      extractionModel: bind("p_000001", "glm-4.6v-flash"),
      solutionModel: bind("p_000002", "gpt-5"),
      debuggingModel: bind("p_000001", "qwen-vl-max")
    }
  })

  const renamed = updateProviderConfig(current, "p_000001", {
    id: "p_hacked",
    name: "  公司 GLM 2  ",
    baseUrl: "https://api.example.com/v2///"
  })
  assert.equal(renamed.updated, true)
  assert.deepEqual(renamed.clearedBindings, [])
  const provider = renamed.config.providers.find((item) => item.id === "p_000001")
  assert.equal(provider.name, "公司 GLM 2")
  assert.equal(provider.baseUrl, "https://api.example.com/v2")
  // id 没被 patch 改掉，也没生成新 provider
  assert.equal(renamed.config.providers.length, 2)
  assert.equal(renamed.config.providers.some((item) => item.id === "p_hacked"), false)

  // 删掉被绑定的模型 → 两个用途置空并被报告
  const modelsRemoved = updateProviderConfig(renamed.config, "p_000001", {
    models: ["new-model"]
  })
  assert.deepEqual(modelsRemoved.clearedBindings, ["extractionModel", "debuggingModel"])
  assert.deepEqual(modelsRemoved.config.bindings, {
    extractionModel: EMPTY,
    solutionModel: bind("p_000002", "gpt-5"),
    debuggingModel: EMPTY
  })
  assert.deepEqual(modelsRemoved.config.providers[0].models, ["new-model"])

  // 清空模型列表 → 同样置空
  const cleared = updateProviderConfig(modelsRemoved.config, "p_000001", { models: [] })
  assert.deepEqual(cleared.config.providers[0].models, [])

  // 不存在的 provider → 不改动
  const missing = updateProviderConfig(current, "p_ghost", { name: "x" })
  assert.equal(missing.updated, false)
  assert.deepEqual(missing.config.providers, current.providers)
  assert.deepEqual(missing.clearedBindings, [])
})

test("removeProviderConfig：删除 provider 同时解除其绑定，其他绑定不动", () => {
  const current = normalizeConfigData({
    providers: [PROVIDER_A, PROVIDER_B],
    bindings: {
      extractionModel: bind("p_000001", "glm-4.6v-flash"),
      solutionModel: bind("p_000002", "gpt-5"),
      debuggingModel: bind("p_000001", "qwen-vl-max")
    }
  })

  const removed = removeProviderConfig(current, "p_000001")
  assert.equal(removed.removed, true)
  assert.deepEqual(removed.clearedBindings, ["extractionModel", "debuggingModel"])
  assert.deepEqual(removed.config.providers, [PROVIDER_B])
  // 不留悬空引用：被删 provider 的绑定全部置空，另一家的保留
  assert.deepEqual(removed.config.bindings, {
    extractionModel: EMPTY,
    solutionModel: bind("p_000002", "gpt-5"),
    debuggingModel: EMPTY
  })

  // 未知 / 空 id → 不改动
  for (const id of ["p_ghost", "", "   "]) {
    const missing = removeProviderConfig(current, id)
    assert.equal(missing.removed, false)
    assert.deepEqual(missing.clearedBindings, [])
    assert.deepEqual(missing.config.providers, current.providers)
  }
})
