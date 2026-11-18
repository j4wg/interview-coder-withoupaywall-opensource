// `electron/llm/client.ts` + `electron/llm/modelListIpc.ts` 的集成单测：
// 用 `node:http` 启一个本地 mock server（零新依赖、不联网、不需要真 Key），
// 逐条验证 JUN-48 验收里的链路与错误归一（多套 provider 并存口径）。
//
// 覆盖：
//   1. 三种格式各跑通 解析题面 → 生成方案 → debug，三次请求的 body.model 分别等于对应 binding 的 modelId；
//   2. 跨 provider：三个用途分别绑定到不同 provider（可混合 API 格式），各自打到自己的 baseUrl；
//   3. 悬空引用 / 删除 provider（先解绑）：归一为 binding-missing，不发请求、不抛异常，其余用途不受影响；
//   4. 401 / 429 / 500 / 非 JSON 正文 四种错误在中英两态各自给出当前语言的文案；
//   5. 断网 / 超时 / 用户取消 的归一；
//   6. `/models` 返回 3 个 ID 时返回 3 个；401 / 超时给出当前语言错误；拉取失败不影响手工填写模型；
//   7. IPC 多套配置：按 providerId 选卡片、未保存的新卡片、provider 不存在。
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const llmDir = path.resolve(here, "../dist-electron/llm")

if (!fs.existsSync(path.join(llmDir, "client.js"))) {
  throw new Error(
    `缺少编译产物 ${llmDir}，请先执行 \`npx tsc -p tsconfig.electron.json\``
  )
}

const { completeText, completeForPurpose, listModels } = require(
  path.join(llmDir, "client.js")
)
const { handleListModels, selectProviderForModelList } = require(
  path.join(llmDir, "modelListIpc.js")
)
const { detachProviderBindings, resolveProviderConfig } = require(
  path.join(llmDir, "providerConfig.js")
)
const { t } = require(path.resolve(here, "../dist-electron/i18n/index.js"))

const FORMATS = ["anthropic-messages", "chat-completions", "responses"]

/** 按格式造一个能被调用层解析出 text 的响应体 */
function replyFor(apiFormat, text) {
  switch (apiFormat) {
    case "anthropic-messages":
      return { content: [{ type: "text", text }] }
    case "chat-completions":
      return { choices: [{ message: { role: "assistant", content: text } }] }
    case "responses":
      return {
        output: [{ type: "message", content: [{ type: "output_text", text }] }],
      }
    default:
      throw new Error(`unknown format ${apiFormat}`)
  }
}

function sendJson(res, status, payload) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload)
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  res.end(body)
}

/** 启动本地 mock server；handler 拿到 (req, res, record) */
async function startMock(handler) {
  const requests = []
  const server = http.createServer((req, res) => {
    let raw = ""
    req.on("data", (chunk) => {
      raw += chunk
    })
    req.on("end", () => {
      let body = null
      try {
        body = raw ? JSON.parse(raw) : null
      } catch {
        body = null
      }
      const record = { method: req.method, url: req.url, headers: req.headers, body, raw }
      requests.push(record)
      handler(req, res, record)
    })
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address()
  return {
    requests,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

/** 静音控制台并收集日志行（断言日志也走当前语言） */
async function quiet(fn) {
  const saved = { log: console.log, error: console.error, warn: console.warn }
  const lines = []
  const record = (...args) => lines.push(args.map((a) => String(a)).join(" "))
  console.log = record
  console.error = record
  console.warn = record
  try {
    return { value: await fn(), lines }
  } finally {
    console.log = saved.log
    console.error = saved.error
    console.warn = saved.warn
  }
}

/** 一套 provider 配置（多套并存时每套各有 id/name/baseUrl/apiFormat/apiKey/models） */
const providerOf = (id, apiFormat, baseUrl, models, name = id) => ({
  id,
  name,
  baseUrl,
  apiFormat,
  apiKey: `key-${id}`,
  models,
})

const bindingOf = (providerId, modelId) => ({ providerId, modelId })

const bindingsFor = (providerId, models) => ({
  extractionModel: bindingOf(providerId, models[0]),
  solutionModel: bindingOf(providerId, models[1]),
  debuggingModel: bindingOf(providerId, models[2]),
})

// ---------------------------------------------------------------- 完整链路（三格式 × 三用途）

test("完整链路：三种格式各跑 解析题面 → 生成方案 → debug，body.model 分别取各用途 binding 的 modelId", async () => {
  const expectedPath = {
    "anthropic-messages": "/v1/messages",
    "chat-completions": "/chat/completions",
    responses: "/responses",
  }

  for (const apiFormat of FORMATS) {
    let replySeq = 0
    const mock = await startMock((req, res) => {
      replySeq += 1
      sendJson(res, 200, replyFor(apiFormat, `reply-${apiFormat}-${replySeq}`))
    })

    try {
      const provider = providerOf(
        "p_main",
        apiFormat,
        mock.baseUrl,
        ["extract-model", "solution-model", "debug-model"],
        "主配置"
      )
      const providers = [provider]
      const bindings = bindingsFor("p_main", [
        "extract-model",
        "solution-model",
        "debug-model",
      ])

      const calls = [
        {
          purpose: "extraction",
          system: "system: extract",
          user: "user: extract the problem",
          images: [{ mimeType: "image/png", data: "QUJD" }],
        },
        { purpose: "solution", system: "system: solution", user: "user: solve it" },
        {
          purpose: "debugging",
          system: "system: debug",
          user: "user: debug my code",
          images: [{ mimeType: "image/png", data: "QUJD" }],
        },
      ]

      const texts = []
      for (const call of calls) {
        const { value: result } = await quiet(() =>
          completeForPurpose({ ...call, providers, bindings, locale: "zh" })
        )
        assert.equal(
          result.kind,
          "success",
          `${apiFormat}/${call.purpose} 失败：${result.message ?? ""}`
        )
        texts.push(result.text)
      }

      assert.equal(mock.requests.length, 3, "每个用途各一次请求")
      assert.deepEqual(
        mock.requests.map((r) => r.method),
        ["POST", "POST", "POST"]
      )
      assert.deepEqual(
        mock.requests.map((r) => r.url),
        [expectedPath[apiFormat], expectedPath[apiFormat], expectedPath[apiFormat]]
      )
      assert.deepEqual(
        mock.requests.map((r) => r.body.model),
        ["extract-model", "solution-model", "debug-model"],
        "请求体里的 model 必须等于 bindings 里对应用途的 modelId"
      )

      if (apiFormat === "anthropic-messages") {
        for (const request of mock.requests) {
          assert.equal(request.headers["x-api-key"], provider.apiKey)
          assert.equal(request.headers["anthropic-version"], "2023-06-01")
          assert.equal(request.headers.authorization, undefined)
          assert.ok(Array.isArray(request.body.messages))
          assert.equal(typeof request.body.max_tokens, "number")
        }
        assert.equal(mock.requests[0].body.messages[0].content[1].type, "image")
      } else {
        for (const request of mock.requests) {
          assert.equal(request.headers.authorization, `Bearer ${provider.apiKey}`)
          assert.equal(request.headers["x-api-key"], undefined)
        }
        if (apiFormat === "chat-completions") {
          assert.ok(Array.isArray(mock.requests[0].body.messages))
          assert.equal(mock.requests[0].body.messages[1].content[1].type, "image_url")
        } else {
          assert.ok(Array.isArray(mock.requests[0].body.input))
          assert.equal(mock.requests[0].body.input[0].content[1].type, "input_image")
        }
      }

      assert.equal(new Set(texts).size, 3)
      assert.match(texts[0], new RegExp(`^reply-${apiFormat}-1$`))
    } finally {
      await mock.close()
    }
  }
})

test("跨 provider：三个用途分别绑定到不同配置（混合三种 API 格式），各打各的 baseUrl", async () => {
  const mocks = {}
  for (const apiFormat of FORMATS) {
    mocks[apiFormat] = await startMock((req, res) => {
      sendJson(res, 200, replyFor(apiFormat, `reply-${apiFormat}`))
    })
  }

  try {
    const providers = [
      providerOf("p_chat", "chat-completions", mocks["chat-completions"].baseUrl, ["glm-4.6v"], "公司 GLM"),
      providerOf("p_anthropic", "anthropic-messages", mocks["anthropic-messages"].baseUrl, ["claude-4-5"], "个人 Claude"),
      providerOf("p_responses", "responses", mocks.responses.baseUrl, ["gpt-5"], "个人 OpenAI"),
    ]
    const bindings = {
      extractionModel: bindingOf("p_chat", "glm-4.6v"),
      solutionModel: bindingOf("p_anthropic", "claude-4-5"),
      debuggingModel: bindingOf("p_responses", "gpt-5"),
    }

    const calls = [
      ["extraction", "user: extract the problem"],
      ["solution", "user: solve it"],
      ["debugging", "user: debug my code"],
    ]
    const texts = []
    for (const [purpose, user] of calls) {
      const { value: result } = await quiet(() =>
        completeForPurpose({ purpose, providers, bindings, user, locale: "zh" })
      )
      assert.equal(result.kind, "success", `${purpose} 失败：${result.message ?? ""}`)
      texts.push(result.text)
    }

    assert.deepEqual(texts, [
      "reply-chat-completions",
      "reply-anthropic-messages",
      "reply-responses",
    ])

    const chat = mocks["chat-completions"].requests
    const anthropic = mocks["anthropic-messages"].requests
    const responses = mocks.responses.requests
    assert.equal(chat.length, 1, "解析题面打到 GLM 那套")
    assert.equal(chat[0].body.model, "glm-4.6v")
    assert.equal(chat[0].headers.authorization, "Bearer key-p_chat")
    assert.equal(chat[0].url, "/chat/completions")

    assert.equal(anthropic.length, 1, "生成方案打到 Claude 那套（跨 provider）")
    assert.equal(anthropic[0].body.model, "claude-4-5")
    assert.equal(anthropic[0].headers["x-api-key"], "key-p_anthropic")
    assert.equal(anthropic[0].headers.authorization, undefined)
    assert.equal(anthropic[0].url, "/v1/messages")

    assert.equal(responses.length, 1, "debug 打到 OpenAI 那套")
    assert.equal(responses[0].body.model, "gpt-5")
    assert.equal(responses[0].headers.authorization, "Bearer key-p_responses")
    assert.equal(responses[0].url, "/responses")
  } finally {
    for (const mock of Object.values(mocks)) await mock.close()
  }
})

// ---------------------------------------------------------------- 引用完整性

test("引用完整性：绑定指向已删除的 provider → binding-missing，不发请求、不抛异常；其余用途照常", async () => {
  const mock = await startMock((req, res) => {
    sendJson(res, 200, replyFor("chat-completions", "ok"))
  })
  try {
    const providers = [
      providerOf("p_alive", "chat-completions", mock.baseUrl, ["m-solution"], "还在的配置"),
    ]
    const rawConfig = {
      providers: [
        providerOf("p_alive", "chat-completions", mock.baseUrl, ["m-solution"], "还在的配置"),
        providerOf("p_gone", "chat-completions", "https://gone.example.com", ["m-gone"], "已删除的配置"),
      ],
      bindings: {
        extractionModel: bindingOf("p_gone", "m-gone"),
        solutionModel: bindingOf("p_alive", "m-solution"),
        debuggingModel: bindingOf("p_gone", "m-gone"),
      },
    }
    const { providers: alive } = resolveProviderConfig({
      providers: providers.concat({
        id: "p_gone",
        name: "已删除的配置",
        baseUrl: "https://gone.example.com",
        apiFormat: "chat-completions",
        apiKey: "key-gone",
        models: ["m-gone"],
      }),
      bindings: rawConfig.bindings,
    })
    // 删除 p_gone 后重新读取配置：归一阶段自动置空，不留悬空引用
    const { bindings } = resolveProviderConfig({
      providers: alive.filter((provider) => provider.id !== "p_gone"),
      bindings: rawConfig.bindings,
    })
    assert.equal(bindings.extractionModel, null)
    assert.equal(bindings.debuggingModel, null)

    for (const locale of ["zh", "en"]) {
      const { value: extraction } = await quiet(() =>
        completeForPurpose({
          purpose: "extraction",
          providers,
          bindings,
          user: "u",
          locale,
        })
      )
      assert.equal(extraction.kind, "failure")
      assert.equal(extraction.code, "binding-missing")
      assert.match(
        extraction.message,
        locale === "zh" ? /还没有绑定模型/ : /No model is bound/
      )
    }
    assert.equal(mock.requests.length, 0, "绑定缺失不应发出任何请求")

    const { value: solution } = await quiet(() =>
      completeForPurpose({
        purpose: "solution",
        providers,
        bindings,
        user: "u",
        locale: "zh",
      })
    )
    assert.equal(solution.kind, "success", "另一个用途不受影响")
    assert.equal(mock.requests[0].body.model, "m-solution")
  } finally {
    await mock.close()
  }
})

test("引用完整性：模型不在该 provider 的 models 里 → 归一为未绑定（不静默保留悬空引用）", async () => {
  const mock = await startMock((req, res) => {
    sendJson(res, 200, replyFor("responses", "ok"))
  })
  try {
    const providers = [
      providerOf("p_a", "responses", mock.baseUrl, ["a-1"], "A"),
      providerOf("p_b", "responses", mock.baseUrl, ["b-1"], "B"),
    ]
    // 模型属于 p_b，却绑在 p_a 上：归一阶段置空
    const { bindings, issues } = resolveProviderConfig({
      providers,
      bindings: {
        extractionModel: bindingOf("p_a", "b-1"),
        solutionModel: bindingOf("p_a", "a-1"),
        debuggingModel: bindingOf("p_b", "b-1"),
      },
    })
    assert.equal(bindings.extractionModel, null)
    assert.ok(issues.includes("binding-model-missing"))

    const { value: extraction } = await quiet(() =>
      completeForPurpose({ purpose: "extraction", providers, bindings, user: "u", locale: "zh" })
    )
    assert.equal(extraction.code, "binding-missing")
    assert.equal(mock.requests.length, 0)

    const { value: solution } = await quiet(() =>
      completeForPurpose({ purpose: "solution", providers, bindings, user: "u", locale: "zh" })
    )
    assert.equal(solution.kind, "success")
    assert.equal(mock.requests[0].body.model, "a-1")
  } finally {
    await mock.close()
  }
})

test("删除 provider：先 detachProviderBindings 再删，被解绑的用途提示重选，其他用途保留", async () => {
  const mock = await startMock((req, res) => {
    sendJson(res, 200, replyFor("chat-completions", "ok"))
  })
  try {
    const bindings = {
      extractionModel: bindingOf("p_keep", "keep-1"),
      solutionModel: bindingOf("p_drop", "drop-1"),
      debuggingModel: bindingOf("p_drop", "drop-1"),
    }
    const { bindings: next, detached } = detachProviderBindings(bindings, "p_drop")
    assert.deepEqual(detached, ["solution", "debugging"])
    assert.deepEqual(next.extractionModel, bindingOf("p_keep", "keep-1"))

    const providers = [providerOf("p_keep", "chat-completions", mock.baseUrl, ["keep-1"], "保留的配置")]
    const { value: solution } = await quiet(() =>
      completeForPurpose({ purpose: "solution", providers, bindings: next, user: "u", locale: "zh" })
    )
    assert.equal(solution.code, "binding-missing")

    const { value: extraction } = await quiet(() =>
      completeForPurpose({ purpose: "extraction", providers, bindings: next, user: "u", locale: "zh" })
    )
    assert.equal(extraction.kind, "success")
    assert.equal(mock.requests[0].body.model, "keep-1")
  } finally {
    await mock.close()
  }
})

// ---------------------------------------------------------------- 错误归一

const HTTP_ERROR_CASES = [
  {
    name: "401",
    status: 401,
    body: { error: { message: "invalid api key" } },
    code: "auth",
    zh: "API Key 无效",
    en: "API key is invalid",
  },
  {
    name: "429",
    status: 429,
    body: { error: { message: "rate limit" } },
    code: "rate-limit",
    zh: "请求过于频繁",
    en: "Too many requests",
  },
  {
    name: "500",
    status: 500,
    body: { error: { message: "boom" } },
    code: "server",
    zh: "服务端错误",
    en: "server error",
  },
  {
    name: "非 JSON 正文",
    status: 200,
    body: "<html>gateway timeout</html>",
    code: "invalid-response",
    zh: "不是可解析的 JSON",
    en: "parsable JSON",
  },
]

for (const testCase of HTTP_ERROR_CASES) {
  test(`错误归一：${testCase.name} 在中英两态给出当前语言文案，且不抛异常`, async () => {
    for (const apiFormat of FORMATS) {
      const mock = await startMock((req, res) => {
        sendJson(res, testCase.status, testCase.body)
      })
      try {
        const providers = [providerOf("p_err", apiFormat, mock.baseUrl, ["model-a"])]
        for (const locale of ["zh", "en"]) {
          const { value: result } = await quiet(() =>
            completeForPurpose({
              purpose: "extraction",
              providers,
              bindings: bindingsFor("p_err", ["model-a", "model-a", "model-a"]),
              user: "u",
              locale,
            })
          )
          assert.equal(result.kind, "failure", `${apiFormat}/${locale} 应失败`)
          assert.equal(result.code, testCase.code)
          assert.match(
            result.message,
            new RegExp(testCase[locale]),
            `${apiFormat}/${locale} 文案应含「${testCase[locale]}」，实际：${result.message}`
          )
          assert.ok(result.message.length > 0)
        }
      } finally {
        await mock.close()
      }
    }
  })
}

test("错误归一：错误文案与日志都跟随当前语言（中文态取证）", async () => {
  const mock = await startMock((req, res) => {
    sendJson(res, 401, { error: { message: "invalid api key" } })
  })
  try {
    const providers = [providerOf("p_zh", "responses", mock.baseUrl, ["model-a"])]
    const { value: result, lines } = await quiet(() =>
      completeForPurpose({
        purpose: "solution",
        providers,
        bindings: bindingsFor("p_zh", ["model-a", "model-a", "model-a"]),
        user: "u",
        locale: "zh",
      })
    )
    assert.equal(
      result.message,
      t("processing", "zh", "processing.error.llm.auth", { status: "401" })
    )
    assert.ok(
      lines.some((line) => line.includes("模型接口调用失败")),
      `日志应为中文，实际：${lines.join(" | ")}`
    )
    assert.ok(lines.some((line) => line.includes("auth")))
  } finally {
    await mock.close()
  }
})

test("错误归一：断网给出本地化提示，不抛未捕获异常", async () => {
  const mock = await startMock((req, res) => sendJson(res, 200, {}))
  const baseUrl = mock.baseUrl
  await mock.close() // 端口已关闭：模拟断网 / Base URL 不可达

  for (const locale of ["zh", "en"]) {
    const providers = [providerOf("p_net", "chat-completions", baseUrl, ["model-a"])]
    const { value: result } = await quiet(() =>
      completeForPurpose({
        purpose: "solution",
        providers,
        bindings: bindingsFor("p_net", ["model-a", "model-a", "model-a"]),
        user: "u",
        locale,
      })
    )
    assert.equal(result.kind, "failure")
    assert.equal(result.code, "network")
    assert.match(result.message, locale === "zh" ? /无法连接/ : /Could not reach/)
  }
})

test("错误归一：超时给出本地化提示（含超时秒数）", async () => {
  const mock = await startMock((req, res) => {
    setTimeout(() => sendJson(res, 200, replyFor("chat-completions", "late")), 500)
  })
  try {
    for (const locale of ["zh", "en"]) {
      const { value: result } = await quiet(() =>
        completeText({
          provider: providerOf("p_slow", "chat-completions", mock.baseUrl, ["model-a"]),
          request: { model: "model-a", user: "u", timeoutMs: 80 },
          locale,
        })
      )
      assert.equal(result.kind, "failure")
      assert.equal(result.code, "timeout")
      assert.match(result.message, locale === "zh" ? /没有返回/ : /did not finish/)
      assert.match(result.message, /1/, "文案里应带超时秒数（80ms 取整为 1 秒）")
    }
  } finally {
    await mock.close()
  }
})

test("错误归一：用户取消映射为既有「已取消」文案", async () => {
  const mock = await startMock((req, res) => {
    setTimeout(() => sendJson(res, 200, replyFor("chat-completions", "late")), 500)
  })
  try {
    const controller = new AbortController()
    const pending = quiet(() =>
      completeText({
        provider: providerOf("p_cancel", "chat-completions", mock.baseUrl, ["model-a"]),
        request: { model: "model-a", user: "u", signal: controller.signal },
        locale: "zh",
      })
    )
    setTimeout(() => controller.abort(), 50)
    const { value: result } = await pending
    assert.equal(result.kind, "failure")
    assert.equal(result.code, "aborted")
    assert.equal(result.message, t("processing", "zh", "processing.error.cancelled"))
  } finally {
    await mock.close()
  }
})

test("错误归一：配置缺失不发起请求，直接给出当前语言提示", async () => {
  for (const [locale, pattern] of [
    ["zh", /尚未配置 API Base URL/],
    ["en", /No API Base URL configured/],
  ]) {
    const providers = [providerOf("p_empty", "responses", "", ["m"])]
    const { value: baseUrlMissing } = await quiet(() =>
      completeForPurpose({
        purpose: "extraction",
        providers,
        bindings: bindingsFor("p_empty", ["m", "m", "m"]),
        user: "u",
        locale,
      })
    )
    assert.equal(baseUrlMissing.code, "base-url-missing")
    assert.match(baseUrlMissing.message, pattern)

    const noKey = [{ ...providers[0], baseUrl: "https://gw.example.com/v1", apiKey: "" }]
    const { value: keyMissing } = await quiet(() =>
      completeForPurpose({
        purpose: "debugging",
        providers: noKey,
        bindings: bindingsFor("p_empty", ["m", "m", "m"]),
        user: "u",
        locale,
      })
    )
    assert.equal(keyMissing.code, "api-key-missing")

    const { value: noProvider } = await quiet(() =>
      completeForPurpose({
        purpose: "debugging",
        providers: [],
        bindings: bindingsFor("p_empty", ["m", "m", "m"]),
        user: "u",
        locale,
      })
    )
    assert.equal(noProvider.code, "binding-missing")
    assert.match(noProvider.message, locale === "zh" ? /还没有绑定模型/ : /No model is bound/)
  }
})

// ---------------------------------------------------------------- 模型列表

test("模型列表：mock /models 返回 3 个 ID 时返回这 3 个（三种鉴权头各验一次）", async () => {
  for (const apiFormat of FORMATS) {
    const mock = await startMock((req, res) => {
      sendJson(res, 200, {
        data: [{ id: "glm-4.6v-flash" }, { id: "qwen3-coder" }, { id: "glm-5" }],
      })
    })
    try {
      const provider = providerOf("p_models", apiFormat, `${mock.baseUrl}/v1`, [], "拉取用")
      const { value: result } = await quiet(() => listModels({ provider, locale: "zh" }))
      assert.equal(result.kind, "success")
      assert.deepEqual(result.models, ["glm-4.6v-flash", "qwen3-coder", "glm-5"])
      assert.equal(result.providerId, "p_models")
      assert.equal(mock.requests.length, 1)
      assert.equal(mock.requests[0].method, "GET")
      assert.equal(mock.requests[0].url, "/v1/models")
      if (apiFormat === "anthropic-messages") {
        assert.equal(mock.requests[0].headers["x-api-key"], provider.apiKey)
        assert.equal(mock.requests[0].headers["anthropic-version"], "2023-06-01")
      } else {
        assert.equal(mock.requests[0].headers.authorization, `Bearer ${provider.apiKey}`)
      }
    } finally {
      await mock.close()
    }
  }
})

test("模型列表：401 与超时给出当前语言提示，且不抛异常", async () => {
  const unauthorized = await startMock((req, res) => {
    sendJson(res, 401, { error: { message: "invalid api key" } })
  })
  try {
    for (const [locale, pattern] of [
      ["zh", /API Key 无效/],
      ["en", /API key is invalid/],
    ]) {
      const { value: result } = await quiet(() =>
        listModels({
          provider: providerOf("p_401", "chat-completions", unauthorized.baseUrl, []),
          locale,
        })
      )
      assert.equal(result.kind, "failure")
      assert.equal(result.code, "auth")
      assert.deepEqual(result.models, [])
      assert.match(result.message, pattern)
    }
  } finally {
    await unauthorized.close()
  }

  const slow = await startMock((req, res) => {
    setTimeout(() => sendJson(res, 200, { data: [{ id: "late" }] }), 500)
  })
  try {
    const { value: timedOut } = await quiet(() =>
      listModels({
        provider: providerOf("p_slow", "responses", slow.baseUrl, []),
        locale: "zh",
        timeoutMs: 80,
      })
    )
    assert.equal(timedOut.kind, "failure")
    assert.equal(timedOut.code, "timeout")
    assert.deepEqual(timedOut.models, [])
    assert.match(timedOut.message, /没有返回/)
  } finally {
    await slow.close()
  }
})

test("模型列表：拉取失败不影响手工填写模型（失败后仍可正常调用）", async () => {
  const mock = await startMock((req, res, record) => {
    if (req.url.endsWith("/models")) {
      sendJson(res, 401, { error: { message: "invalid api key" } })
      return
    }
    assert.equal(record.body.model, "manual-model")
    sendJson(res, 200, replyFor("responses", "手工模型的回答"))
  })
  try {
    const provider = providerOf("p_manual", "responses", mock.baseUrl, [])
    const { value: listResult } = await quiet(() => listModels({ provider, locale: "zh" }))
    assert.equal(listResult.kind, "failure")

    // 用户在设置页手工添加模型 ID 后，bindings 生效、请求照常发出
    const withManual = { ...provider, models: ["manual-model"] }
    const providers = [withManual]
    const bindings = {
      extractionModel: null,
      solutionModel: bindingOf("p_manual", "manual-model"),
      debuggingModel: null,
    }
    const { value: callResult } = await quiet(() =>
      completeForPurpose({ purpose: "solution", providers, bindings, user: "u", locale: "zh" })
    )
    assert.equal(callResult.kind, "success")
    assert.equal(callResult.text, "手工模型的回答")
  } finally {
    await mock.close()
  }
})

// ---------------------------------------------------------------- IPC 处理函数

const twoProviderConfig = (glmBaseUrl, openaiBaseUrl) => ({
  providers: [
    providerOf("p_glm", "chat-completions", glmBaseUrl, ["glm-5"], "公司 GLM"),
    providerOf("p_openai", "responses", openaiBaseUrl, ["gpt-5"], "个人 OpenAI"),
  ],
  bindings: {
    extractionModel: bindingOf("p_glm", "glm-5"),
    solutionModel: bindingOf("p_openai", "gpt-5"),
    debuggingModel: bindingOf("p_glm", "glm-5"),
  },
})

test("IPC list-models：多套配置下按 providerId 选卡片，各用各自的 baseUrl / 鉴权头", async () => {
  const glm = await startMock((req, res) => {
    sendJson(res, 200, { data: [{ id: "glm-5" }, { id: "glm-4.6v" }, { id: "qwen3-coder" }] })
  })
  const openai = await startMock((req, res) => {
    sendJson(res, 200, { data: [{ id: "gpt-5" }] })
  })
  try {
    const rawConfig = twoProviderConfig(glm.baseUrl, openai.baseUrl)

    const { value: glmResult } = await quiet(() =>
      handleListModels({ rawConfig, providerId: "p_glm", locale: "zh" })
    )
    assert.deepEqual(glmResult, {
      ok: true,
      models: ["glm-5", "glm-4.6v", "qwen3-coder"],
      providerId: "p_glm",
    })
    assert.equal(glm.requests.length, 1)
    assert.equal(glm.requests[0].headers.authorization, "Bearer key-p_glm")
    assert.equal(openai.requests.length, 0, "不应误打到另一套配置")

    // 不带 providerId 时回落到第一套（兼容旧调用）
    const { value: fallback } = await quiet(() =>
      handleListModels({ rawConfig, locale: "zh" })
    )
    assert.deepEqual(fallback.models, ["glm-5", "glm-4.6v", "qwen3-coder"])
  } finally {
    await glm.close()
    await openai.close()
  }
})

test("IPC list-models：未保存的新卡片用表单值拉取，providerId 原样带回", async () => {
  const mock = await startMock((req, res) => {
    sendJson(res, 200, { models: ["draft-a", "draft-b"] })
  })
  try {
    const { value: draft } = await quiet(() =>
      handleListModels({
        rawConfig: { providers: [], bindings: {} },
        providerId: "p_new",
        overrides: {
          providerId: "p_new",
          name: "新建配置",
          baseUrl: mock.baseUrl,
          apiFormat: "responses",
          apiKey: "sk-draft",
        },
        locale: "zh",
      })
    )
    assert.deepEqual(draft, {
      ok: true,
      models: ["draft-a", "draft-b"],
      providerId: "p_new",
    })
    assert.equal(mock.requests[0].headers.authorization, "Bearer sk-draft")
    assert.equal(mock.requests[0].url, "/models")

    // 已保存卡片 + 表单覆盖：覆盖 baseUrl 生效，id 仍是已保存的稳定 id
    const selected = selectProviderForModelList(
      twoProviderConfig("https://saved.example.com", "https://other.example.com").providers,
      "p_glm",
      { baseUrl: mock.baseUrl, apiKey: "sk-override", apiFormat: "anthropic-messages" }
    )
    assert.equal(selected.id, "p_glm")
    assert.equal(selected.baseUrl, mock.baseUrl)
    assert.equal(selected.apiKey, "sk-override")
    assert.equal(selected.apiFormat, "anthropic-messages")
  } finally {
    await mock.close()
  }
})

test("IPC list-models：providerId 不存在给当前语言提示（不崩溃），不影响手工填写", async () => {
  for (const [locale, pattern] of [
    ["zh", /没有找到所选的配置/],
    ["en", /selected provider configuration was not found/],
  ]) {
    const { value: result } = await quiet(() =>
      handleListModels({
        rawConfig: twoProviderConfig("https://a.example.com", "https://b.example.com"),
        providerId: "p_deleted",
        locale,
      })
    )
    assert.equal(result.ok, false)
    assert.deepEqual(result.models, [])
    assert.equal(result.code, "provider-missing")
    assert.match(result.error, pattern)

    // 手工填写的路径不受影响：表单自带 baseUrl 就能拉
    const mock = await startMock((req, res) => {
      sendJson(res, 200, { data: [{ id: "manual" }] })
    })
    try {
      const { value: byForm } = await quiet(() =>
        handleListModels({
          rawConfig: twoProviderConfig("https://a.example.com", "https://b.example.com"),
          providerId: "p_deleted",
          overrides: { baseUrl: mock.baseUrl, apiFormat: "chat-completions", apiKey: "sk-form" },
          locale,
        })
      )
      assert.equal(byForm.ok, true)
      assert.deepEqual(byForm.models, ["manual"])
    } finally {
      await mock.close()
    }
  }
})

test("IPC list-models：已保存配置 401 时返回空列表 + 当前语言 error", async () => {
  const deniedMock = await startMock((req, res) => {
    sendJson(res, 401, { error: { message: "invalid api key" } })
  })
  try {
    for (const [locale, pattern] of [
      ["zh", /API Key 无效/],
      ["en", /API key is invalid/],
    ]) {
      const { value: result } = await quiet(() =>
        handleListModels({
          rawConfig: {
            providers: [
              providerOf("p_bad", "chat-completions", deniedMock.baseUrl, [], "坏 Key"),
            ],
          },
          providerId: "p_bad",
          locale,
        })
      )
      assert.equal(result.ok, false)
      assert.deepEqual(result.models, [])
      assert.equal(result.code, "auth")
      assert.equal(result.providerId, "p_bad")
      assert.match(result.error, pattern)
    }
  } finally {
    await deniedMock.close()
  }
})

test("IPC list-models：完全没有配置时给当前语言提示", async () => {
  for (const [locale, pattern] of [
    ["zh", /没有找到所选的配置/],
    ["en", /selected provider configuration was not found/],
  ]) {
    const { value: result } = await quiet(() =>
      handleListModels({ rawConfig: { providers: [] }, locale })
    )
    assert.equal(result.ok, false)
    assert.deepEqual(result.models, [])
    assert.equal(result.code, "provider-missing")
    assert.match(result.error, pattern)
  }
})
