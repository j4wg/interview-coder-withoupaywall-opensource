// `electron/llm/*` 的请求构造 / 配置归一 / 响应解析单测：零新依赖、不联网，
// 直接跑 `pretest` 生成的 `dist-electron/llm/*.js`。
//
// 覆盖（对应 JUN-48 验收里"三种格式各自的请求构造单测"）：
//   ① anthropic-messages 打到 /v1/messages、带 x-api-key 与 anthropic-version、body 含 model/max_tokens/messages
//   ② chat-completions 打到 /chat/completions、带 Authorization: Bearer、body 含 messages
//   ③ responses 打到 /responses、带 Authorization: Bearer、body 含 input
// 另含：baseUrl 拼接边界（/v1 不重复）、provider/bindings 归一、三种响应结构解析、模型 ID 提取。
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const llmDir = path.resolve(here, "../dist-electron/llm")

if (!fs.existsSync(path.join(llmDir, "requestBuilders.js"))) {
  throw new Error(
    `缺少编译产物 ${llmDir}，请先执行 \`npx tsc -p tsconfig.electron.json\``
  )
}

const { buildCompletionRequest, buildModelListRequest, ANTHROPIC_VERSION } =
  require(path.join(llmDir, "requestBuilders.js"))
const {
  resolveProviderConfig,
  applyProviderOverrides,
  buildEndpoint,
  resolveTargetForPurpose,
  resolveBindingForPurpose,
  detachProviderBindings,
  providerFromOverrides,
  findProvider,
  isValidBaseUrl,
} = require(path.join(llmDir, "providerConfig.js"))
const { detachedBindingNotice, modelPurposeLabel } = require(
  path.join(llmDir, "messages.js")
)
const {
  extractCompletionText,
  extractModelIds,
  extractErrorDetail,
  hasErrorPayload,
} = require(path.join(llmDir, "responseParsers.js"))

const providerOf = (apiFormat, baseUrl = "https://gw.example.com/v1") => ({
  id: "p_test",
  name: "测试配置",
  baseUrl,
  apiFormat,
  apiKey: "sk-test-key",
  models: ["model-a", "model-b", "model-c"],
})

/** 构造一个绑定对象（多套配置并存：每项都必须带 providerId） */
const bindingOf = (providerId, modelId) => ({ providerId, modelId })

const requestOf = (overrides = {}) => ({
  model: "model-a",
  system: "system prompt",
  user: "user prompt",
  images: [{ mimeType: "image/png", data: "QUJD" }],
  maxTokens: 1234,
  temperature: 0.3,
  ...overrides,
})

// ---------------------------------------------------------------- ① Anthropic Messages

test("① anthropic-messages：打到 /v1/messages，带 x-api-key + anthropic-version，body 含 model/max_tokens/messages", () => {
  const built = buildCompletionRequest(
    providerOf("anthropic-messages", "https://api.example.com/v1"),
    requestOf()
  )

  assert.equal(built.method, "POST")
  assert.equal(built.url, "https://api.example.com/v1/messages")
  assert.equal(built.headers["x-api-key"], "sk-test-key")
  assert.equal(built.headers["anthropic-version"], ANTHROPIC_VERSION)
  assert.equal(built.headers.authorization, undefined, "Anthropic 不应带 Bearer")

  assert.equal(built.body.model, "model-a")
  assert.equal(built.body.max_tokens, 1234)
  assert.equal(built.body.temperature, 0.3)
  assert.equal(built.body.system, "system prompt", "system 走 Anthropic 顶层字段")
  assert.ok(Array.isArray(built.body.messages))
  assert.equal(built.body.messages.length, 1)
  assert.equal(built.body.messages[0].role, "user")

  const [textBlock, imageBlock] = built.body.messages[0].content
  assert.deepEqual(textBlock, { type: "text", text: "user prompt" })
  assert.deepEqual(imageBlock, {
    type: "image",
    source: { type: "base64", media_type: "image/png", data: "QUJD" },
  })
})

test("① anthropic-messages：baseUrl 已带 /v1 时不重复拼接（边界值）", () => {
  const root = buildEndpoint("https://api.anthropic.com/", "anthropic-messages", "completion")
  const v1 = buildEndpoint("https://api.anthropic.com/v1", "anthropic-messages", "completion")
  const full = buildEndpoint(
    "https://api.anthropic.com/v1/messages",
    "anthropic-messages",
    "completion"
  )
  assert.equal(root, "https://api.anthropic.com/v1/messages")
  assert.equal(v1, "https://api.anthropic.com/v1/messages")
  assert.equal(full, "https://api.anthropic.com/v1/messages")
})

// ---------------------------------------------------------------- ② Chat Completions

test("② chat-completions：打到 /chat/completions，带 Authorization: Bearer，body 含 messages", () => {
  const built = buildCompletionRequest(
    providerOf("chat-completions", "https://gw.example.com/v1"),
    requestOf()
  )

  assert.equal(built.url, "https://gw.example.com/v1/chat/completions")
  assert.equal(built.headers.authorization, "Bearer sk-test-key")
  assert.equal(built.headers["x-api-key"], undefined)
  assert.equal(built.headers["anthropic-version"], undefined)

  assert.equal(built.body.model, "model-a")
  assert.ok(Array.isArray(built.body.messages))
  assert.equal(built.body.messages[0].role, "system")
  assert.equal(built.body.messages[0].content, "system prompt")
  assert.equal(built.body.messages[1].role, "user")

  const content = built.body.messages[1].content
  assert.equal(content[0].type, "text")
  assert.equal(content[1].type, "image_url")
  assert.match(content[1].image_url.url, /^data:image\/png;base64,QUJD$/)
})

test("② chat-completions：无 system、无图时 user content 用纯字符串（兼容性边界）", () => {
  const built = buildCompletionRequest(
    providerOf("chat-completions"),
    requestOf({ system: "   ", images: [] })
  )
  assert.equal(built.body.messages.length, 1)
  assert.equal(built.body.messages[0].content, "user prompt")
  assert.equal(built.body.system, undefined)
})

// ---------------------------------------------------------------- ③ Responses

test("③ responses：打到 /responses，带 Authorization: Bearer，body 含 input", () => {
  const built = buildCompletionRequest(
    providerOf("responses", "https://gw.example.com/v1"),
    requestOf()
  )

  assert.equal(built.url, "https://gw.example.com/v1/responses")
  assert.equal(built.headers.authorization, "Bearer sk-test-key")
  assert.equal(built.headers["x-api-key"], undefined)

  assert.equal(built.body.model, "model-a")
  assert.equal(built.body.instructions, "system prompt")
  assert.equal(built.body.max_output_tokens, 1234)
  assert.ok(Array.isArray(built.body.input))
  assert.equal(built.body.input[0].role, "user")
  assert.equal(built.body.input[0].content[0].type, "input_text")
  assert.equal(built.body.input[0].content[1].type, "input_image")
  assert.match(
    built.body.input[0].content[1].image_url,
    /^data:image\/png;base64,QUJD$/
  )
})

test("requests：已带完整路径的 baseUrl 不再重复拼接（三种格式 + 模型列表）", () => {
  const cases = [
    ["chat-completions", "https://gw.example.com/v1/chat/completions", "https://gw.example.com/v1/chat/completions"],
    ["responses", "https://gw.example.com/v1/responses", "https://gw.example.com/v1/responses"],
    ["anthropic-messages", "https://gw.example.com/v1/messages", "https://gw.example.com/v1/messages"],
  ]
  for (const [format, baseUrl, expected] of cases) {
    assert.equal(buildEndpoint(baseUrl, format, "completion"), expected)
  }
  assert.equal(
    buildEndpoint("https://gw.example.com/v1/", "chat-completions", "models"),
    "https://gw.example.com/v1/models"
  )
})

// ---------------------------------------------------------------- 模型列表请求

test("模型列表：GET {baseUrl}/models，鉴权头按格式走", () => {
  const anthropic = buildModelListRequest(
    providerOf("anthropic-messages", "https://api.anthropic.com/v1")
  )
  assert.equal(anthropic.method, "GET")
  assert.equal(anthropic.url, "https://api.anthropic.com/v1/models")
  assert.equal(anthropic.headers["x-api-key"], "sk-test-key")
  assert.equal(anthropic.headers["anthropic-version"], ANTHROPIC_VERSION)
  assert.equal(anthropic.headers.authorization, undefined)

  for (const format of ["chat-completions", "responses"]) {
    const built = buildModelListRequest(providerOf(format))
    assert.equal(built.url, "https://gw.example.com/v1/models")
    assert.equal(built.headers.authorization, "Bearer sk-test-key")
    assert.equal(built.headers["x-api-key"], undefined)
  }
})

// ---------------------------------------------------------------- 配置归一（多套 provider 并存）

const providersFixture = () => [
  {
    id: "p_glm",
    name: "公司 GLM",
    baseUrl: " https://glm.example.com/v1 ",
    apiFormat: "chat-completions",
    apiKey: " sk-glm ",
    models: ["glm-4.6v", "glm-5"],
  },
  {
    id: "p_openai",
    name: "个人 OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiFormat: "responses",
    apiKey: "sk-openai",
    models: ["gpt-5", "gpt-5-mini"],
  },
]

const crossProviderBindings = () => ({
  extractionModel: bindingOf("p_glm", "glm-4.6v"),
  solutionModel: bindingOf("p_openai", "gpt-5"),
  debuggingModel: bindingOf("p_glm", "glm-5"),
})

test("配置归一：providers 数组原样读出，id/name 保留，bindings 允许跨 provider", () => {
  const resolved = resolveProviderConfig({
    providers: providersFixture(),
    bindings: crossProviderBindings(),
  })

  assert.deepEqual(resolved.issues, [])
  assert.equal(resolved.providers.length, 2)
  assert.deepEqual(resolved.providers[0], {
    id: "p_glm",
    name: "公司 GLM",
    baseUrl: "https://glm.example.com/v1",
    apiFormat: "chat-completions",
    apiKey: "sk-glm",
    models: ["glm-4.6v", "glm-5"],
  })
  assert.equal(resolved.providers[1].name, "个人 OpenAI")

  const extraction = resolveTargetForPurpose(resolved, "extraction")
  const solution = resolveTargetForPurpose(resolved, "solution")
  const debugging = resolveTargetForPurpose(resolved, "debugging")
  assert.equal(extraction.provider.id, "p_glm")
  assert.equal(extraction.modelId, "glm-4.6v")
  assert.equal(solution.provider.id, "p_openai", "允许跨 provider")
  assert.equal(solution.modelId, "gpt-5")
  assert.equal(debugging.provider.id, "p_glm")
  assert.equal(debugging.modelId, "glm-5")
})

test("配置归一：非法 providers / 重复 id / 脏字段都不抛错，给定 issues", () => {
  for (const raw of [
    {},
    { provider: { baseUrl: "https://old.example.com" } },
    { providers: "nope" },
    { apiKey: "sk-old", apiProvider: "openai", extractionModel: "gpt-x" },
  ]) {
    const resolved = resolveProviderConfig(raw)
    assert.deepEqual(resolved.providers, [], "旧单套结构未被兼容（迁移归 JUN-47）")
    assert.ok(resolved.issues.includes("providers-missing"))
    assert.equal(resolved.bindings.extractionModel, null)
  }

  // 最小合法项（只给 id）：保留并给安全默认值，不抛错
  const minimal = resolveProviderConfig({ providers: [{ id: "p" }] })
  assert.equal(minimal.providers.length, 1)
  assert.equal(minimal.providers[0].apiFormat, "chat-completions")
  assert.ok(minimal.issues.includes("provider-name-missing"))

  const dirty = resolveProviderConfig({
    providers: [
      null,
      { name: "没有 id" },
      {
        id: " p_1 ",
        baseUrl: "not-a-url",
        apiFormat: "grpc",
        apiKey: "",
        models: ["m-1", " m-1 ", "", 42, "m-2"],
      },
      { id: "p_1", name: "重复 id", baseUrl: "https://dup.example.com" },
      { id: "p_2", name: "  ", baseUrl: "https://ok.example.com", apiFormat: "responses", models: "nope" },
    ],
    bindings: { extractionModel: "m-1" },
  })

  assert.deepEqual(
    dirty.providers.map((provider) => provider.id),
    ["p_1", "p_2"],
    "非法项丢弃、重复 id 只保留第一项"
  )
  assert.deepEqual(dirty.providers[0].models, ["m-1", "m-2"], "模型 ID 去空、去重、保序")
  assert.equal(dirty.providers[0].apiFormat, "chat-completions", "非法 apiFormat 归一为通用格式")
  for (const issue of [
    "provider-invalid",
    "provider-id-duplicate",
    "provider-name-missing",
    "baseUrl-invalid",
    "apiFormat-invalid",
    "models-invalid",
    "bindings-invalid",
  ]) {
    assert.ok(dirty.issues.includes(issue), `应记录 issue: ${issue}`)
  }
  assert.equal(dirty.bindings.extractionModel, null, "旧字符串绑定归一为 null")
})

test("引用完整性：指向不存在的 provider / 模型一律置空，不留悬空引用", () => {
  const resolved = resolveProviderConfig({
    providers: providersFixture(),
    bindings: {
      extractionModel: bindingOf("p_deleted", "glm-4.6v"),
      solutionModel: bindingOf("p_glm", "gpt-5"),
      debuggingModel: bindingOf("p_openai", "gpt-5"),
    },
  })

  assert.equal(resolved.bindings.extractionModel, null)
  assert.ok(resolved.issues.includes("binding-provider-missing"))
  assert.equal(resolved.bindings.solutionModel, null, "模型不属于该 provider 也置空")
  assert.ok(resolved.issues.includes("binding-model-missing"))
  assert.deepEqual(resolved.bindings.debuggingModel, bindingOf("p_openai", "gpt-5"))

  assert.equal(resolveTargetForPurpose(resolved, "extraction"), null)
  assert.equal(resolveTargetForPurpose(resolved, "solution"), null)
  assert.equal(resolveBindingForPurpose(resolved.providers, resolved.bindings, "debugging").modelId, "gpt-5")
})

test("删除 provider：先用 detachProviderBindings 解除绑定，其余用途不变", () => {
  const bindings = crossProviderBindings()
  const { bindings: next, detached } = detachProviderBindings(bindings, "p_glm")

  assert.deepEqual(detached, ["extraction", "debugging"])
  assert.equal(next.extractionModel, null)
  assert.equal(next.debuggingModel, null)
  assert.deepEqual(next.solutionModel, bindingOf("p_openai", "gpt-5"), "另一家的绑定不受影响")
  assert.deepEqual(bindings, crossProviderBindings(), "纯函数，不修改入参")

  // 删掉 provider 后重新归一：不残留悬空引用
  const afterRemoval = resolveProviderConfig({
    providers: providersFixture().filter((provider) => provider.id !== "p_glm"),
    bindings: next,
  })
  assert.equal(afterRemoval.issues.length, 0)
  assert.equal(afterRemoval.bindings.extractionModel, null)
  assert.equal(resolveTargetForPurpose(afterRemoval, "extraction"), null)
  assert.equal(resolveTargetForPurpose(afterRemoval, "solution").provider.id, "p_openai")

  // 未先解绑就删（防御）：归一阶段自动置空 + 记 issue，不崩溃
  const unsafe = resolveProviderConfig({
    providers: providersFixture().filter((provider) => provider.id !== "p_glm"),
    bindings: crossProviderBindings(),
  })
  assert.equal(unsafe.bindings.extractionModel, null)
  assert.equal(unsafe.bindings.debuggingModel, null)
  assert.ok(unsafe.issues.includes("binding-provider-missing"))
})

test("解绑提示：按当前语言列出用途，提示重新选择模型", () => {
  const zh = detachedBindingNotice("zh", "公司 GLM", ["extraction", "debugging"])
  assert.match(zh, /公司 GLM/)
  assert.match(zh, /题面解析/)
  assert.match(zh, /调试/)
  assert.match(zh, /重新选择模型/)

  const en = detachedBindingNotice("en", "Work GLM", ["solution"])
  assert.match(en, /Work GLM/)
  assert.match(en, /solution generation/)
  assert.match(en, /needs a model selected again/)

  assert.equal(modelPurposeLabel("zh", "solution"), "方案生成")
  assert.equal(modelPurposeLabel("en", "extraction"), "problem extraction")
})

test("配置归一：渲染层表单覆盖只接受字符串与合法枚举，其余忽略", () => {
  const provider = providerOf("responses", "https://saved.example.com/v1")
  const merged = applyProviderOverrides(provider, {
    baseUrl: "https://draft.example.com/v1",
    apiKey: "sk-draft",
    apiFormat: "anthropic-messages",
    name: "草稿配置",
    providerId: "p_hacked",
  })
  assert.equal(merged.baseUrl, "https://draft.example.com/v1")
  assert.equal(merged.apiKey, "sk-draft")
  assert.equal(merged.apiFormat, "anthropic-messages")
  assert.equal(merged.name, "草稿配置")
  assert.equal(merged.id, "p_test", "id 是稳定标识，不允许表单覆盖")
  assert.deepEqual(merged.models, provider.models, "覆盖不应改模型列表")

  const junk = applyProviderOverrides(provider, {
    baseUrl: 123,
    apiKey: null,
    apiFormat: "soap",
    name: {},
  })
  assert.deepEqual(junk, provider)

  assert.equal(applyProviderOverrides(provider, "nope"), provider)
  assert.equal(applyProviderOverrides(provider, undefined), provider)
})

test("表单构造新配置：缺字段给安全默认值，不抛错", () => {
  const draft = providerFromOverrides(
    { providerId: "p_new", name: "新建", baseUrl: "https://new.example.com", apiFormat: "responses", apiKey: "sk-new" },
    "p_fallback"
  )
  assert.deepEqual(draft, {
    id: "p_new",
    name: "新建",
    baseUrl: "https://new.example.com",
    apiFormat: "responses",
    apiKey: "sk-new",
    models: [],
  })
  assert.equal(providerFromOverrides({ baseUrl: "https://x" }, "p_fallback").id, "p_fallback")
  assert.equal(providerFromOverrides(null).apiFormat, "chat-completions")
  assert.deepEqual(providerFromOverrides(null, "p_only_id").models, [])

  assert.equal(findProvider([draft], "p_new").name, "新建")
  assert.equal(findProvider([draft], " "), undefined)
  assert.equal(findProvider([draft], "p_missing"), undefined)
})

test("baseUrl 校验：只接受 http/https 绝对地址", () => {
  assert.equal(isValidBaseUrl("https://gw.example.com/v1"), true)
  assert.equal(isValidBaseUrl("http://127.0.0.1:8080"), true)
  for (const bad of ["", "   ", "gw.example.com", "file:///etc/passwd", "ftp://x", "data:text/plain,hi"]) {
    assert.equal(isValidBaseUrl(bad), false, `${bad} 不应通过`)
  }
})

// ---------------------------------------------------------------- 响应解析

test("响应解析：三种格式各自取到文本，结构不认识时返回空串（不抛错）", () => {
  assert.equal(
    extractCompletionText("anthropic-messages", {
      content: [
        { type: "text", text: "第一段" },
        { type: "thinking", text: "不应拼接" },
        { type: "text", text: "第二段" },
      ],
    }),
    "第一段第二段"
  )
  assert.equal(
    extractCompletionText("chat-completions", {
      choices: [{ message: { content: "chat 文本" } }],
    }),
    "chat 文本"
  )
  assert.equal(
    extractCompletionText("chat-completions", {
      choices: [{ message: { content: [{ type: "text", text: "分段 " }, { type: "text", text: "内容" }] } }],
    }),
    "分段 内容"
  )
  assert.equal(
    extractCompletionText("chat-completions", { choices: [{ text: "legacy" }] }),
    "legacy"
  )
  assert.equal(
    extractCompletionText("responses", { output_text: "短路径" }),
    "短路径"
  )
  assert.equal(
    extractCompletionText("responses", {
      output: [
        { type: "message", content: [{ type: "output_text", text: "一" }] },
        { type: "message", content: [{ type: "output_text", text: "二" }] },
      ],
    }),
    "一\n二"
  )

  for (const format of ["anthropic-messages", "chat-completions", "responses"]) {
    assert.equal(extractCompletionText(format, null), "")
    assert.equal(extractCompletionText(format, {}), "")
    assert.equal(extractCompletionText(format, "plain string"), "")
  }
})

test("响应解析：模型 ID 支持 data/models/纯数组三种形态并去重", () => {
  assert.deepEqual(extractModelIds({ data: [{ id: "m-1" }, { id: "m-2" }] }), ["m-1", "m-2"])
  assert.deepEqual(extractModelIds({ models: ["m-1", { name: "m-2" }, "m-1"] }), ["m-1", "m-2"])
  assert.deepEqual(extractModelIds(["m-1", "", 3]), ["m-1"])
  assert.deepEqual(extractModelIds({}), [])
  assert.deepEqual(extractModelIds(null), [])
})

test("响应解析：错误摘要从 error.message / message / 原始正文依次提取", () => {
  assert.equal(
    extractErrorDetail({ error: { message: "invalid api key" } }, ""),
    "invalid api key"
  )
  assert.equal(extractErrorDetail({ message: "rate limited" }, ""), "rate limited")
  assert.equal(extractErrorDetail({ error: "boom" }, ""), "boom")
  assert.equal(extractErrorDetail(null, "  <html>\n 500  </html>"), "<html> 500 </html>")
  assert.equal(hasErrorPayload({ error: { message: "x" } }), true)
  assert.equal(hasErrorPayload({ output_text: "ok" }), false)
  assert.equal(hasErrorPayload(null), false)
})
