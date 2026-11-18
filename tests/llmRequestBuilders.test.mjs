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
  resolveModelForPurpose,
  isValidBaseUrl,
} = require(path.join(llmDir, "providerConfig.js"))
const {
  extractCompletionText,
  extractModelIds,
  extractErrorDetail,
  hasErrorPayload,
} = require(path.join(llmDir, "responseParsers.js"))

const providerOf = (apiFormat, baseUrl = "https://gw.example.com/v1") => ({
  baseUrl,
  apiFormat,
  apiKey: "sk-test-key",
  models: ["model-a", "model-b", "model-c"],
})

const bindingsOf = () => ({
  extractionModel: "model-a",
  solutionModel: "model-b",
  debuggingModel: "model-c",
})

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

// ---------------------------------------------------------------- 配置归一

test("配置归一：v3 结构原样读出，bindings 按用途命中模型", () => {
  const resolved = resolveProviderConfig({
    provider: {
      baseUrl: " https://gw.example.com/v1 ",
      apiFormat: "responses",
      apiKey: " sk-1 ",
      models: ["m-1", "m-2"],
    },
    bindings: {
      extractionModel: "m-1",
      solutionModel: "m-2",
      debuggingModel: "m-2",
    },
  })

  assert.deepEqual(resolved.provider, {
    baseUrl: "https://gw.example.com/v1",
    apiFormat: "responses",
    apiKey: "sk-1",
    models: ["m-1", "m-2"],
  })
  assert.deepEqual(resolved.issues, [])
  assert.equal(resolveModelForPurpose(resolved.provider, resolved.bindings, "extraction"), "m-1")
  assert.equal(resolveModelForPurpose(resolved.provider, resolved.bindings, "solution"), "m-2")
  assert.equal(resolveModelForPurpose(resolved.provider, resolved.bindings, "debugging"), "m-2")
})

test("配置归一：旧结构 / 非法 apiFormat / 脏 models 都不抛错并给出 issues", () => {
  const legacy = resolveProviderConfig({
    apiKey: "sk-old",
    apiProvider: "openai",
    extractionModel: "gpt-x",
  })
  assert.equal(legacy.provider.baseUrl, "")
  assert.equal(legacy.provider.models.length, 0)
  assert.ok(legacy.issues.includes("provider-missing"))

  const dirty = resolveProviderConfig({
    provider: {
      baseUrl: "not-a-url",
      apiFormat: "grpc",
      apiKey: "",
      models: ["m-1", " m-1 ", "", 42, "m-2"],
    },
    bindings: { extractionModel: "gone", solutionModel: 7 },
  })
  assert.equal(dirty.provider.apiFormat, "chat-completions", "非法 apiFormat 归一为通用格式")
  assert.deepEqual(dirty.provider.models, ["m-1", "m-2"], "模型 ID 去空、去重、保序")
  assert.ok(dirty.issues.includes("baseUrl-invalid"))
  assert.ok(dirty.issues.includes("apiFormat-invalid"))
  assert.ok(dirty.issues.includes("models-invalid"))
  assert.equal(dirty.bindings.solutionModel, "", "非字符串 binding 归一为空")

  // bindings 指向不在列表里的 ID 时回落列表首项；列表为空时回落 binding 本身
  assert.equal(resolveModelForPurpose(dirty.provider, dirty.bindings, "extraction"), "m-1")
  assert.equal(
    resolveModelForPurpose(
      dirty.provider,
      { extractionModel: "only-binding", solutionModel: "", debuggingModel: "" },
      "extraction"
    ),
    "m-1"
  )
  assert.equal(
    resolveModelForPurpose(
      { ...dirty.provider, models: [] },
      { extractionModel: "only-binding", solutionModel: "", debuggingModel: "" },
      "extraction"
    ),
    "only-binding"
  )
  assert.equal(
    resolveModelForPurpose(
      { ...dirty.provider, models: [] },
      { extractionModel: "", solutionModel: "", debuggingModel: "" },
      "extraction"
    ),
    ""
  )
})

test("配置归一：渲染层表单覆盖只接受字符串与合法枚举，其余忽略", () => {
  const provider = providerOf("responses", "https://saved.example.com/v1")
  const merged = applyProviderOverrides(provider, {
    baseUrl: "https://draft.example.com/v1",
    apiKey: "sk-draft",
    apiFormat: "anthropic-messages",
  })
  assert.equal(merged.baseUrl, "https://draft.example.com/v1")
  assert.equal(merged.apiKey, "sk-draft")
  assert.equal(merged.apiFormat, "anthropic-messages")
  assert.deepEqual(merged.models, provider.models, "覆盖不应改模型列表")

  const junk = applyProviderOverrides(provider, {
    baseUrl: 123,
    apiKey: null,
    apiFormat: "soap",
  })
  assert.deepEqual(junk, provider)

  assert.equal(applyProviderOverrides(provider, "nope"), provider)
  assert.equal(applyProviderOverrides(provider, undefined), provider)
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
