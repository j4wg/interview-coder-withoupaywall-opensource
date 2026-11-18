// `electron/llm/client.ts` + `electron/llm/modelListIpc.ts` 的集成单测：
// 用 `node:http` 启一个本地 mock server（零新依赖、不联网、不需要真 Key），
// 逐条验证 JUN-48 验收里的链路与错误归一。
//
// 覆盖：
//   1. 三种格式各跑通 解析题面 → 生成方案 → debug，三次请求的 body.model 分别等于 bindings 里的配置值；
//   2. 401 / 429 / 500 / 非 JSON 正文 四种错误在中英两态各自给出当前语言的文案，且不抛未捕获异常；
//   3. 断网 / 超时 / 用户取消 的归一；
//   4. `/models` 返回 3 个 ID 时 IPC 返回 3 个；401 / 超时给出当前语言的错误；拉取失败不影响手工填写模型。
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
const { handleListModels } = require(path.join(llmDir, "modelListIpc.js"))
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

const bindingsWith = (extraction, solution, debugging) => ({
  extractionModel: extraction,
  solutionModel: solution,
  debuggingModel: debugging,
})

const providerFor = (apiFormat, baseUrl, models) => ({
  baseUrl,
  apiFormat,
  apiKey: `key-${apiFormat}`,
  models,
})

// ---------------------------------------------------------------- 完整链路（三格式 × 三用途）

test("完整链路：三种格式各跑 解析题面 → 生成方案 → debug，body.model 分别取 bindings 的三项", async () => {
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
      const provider = providerFor(apiFormat, mock.baseUrl, [
        "extract-model",
        "solution-model",
        "debug-model",
      ])
      const bindings = bindingsWith("extract-model", "solution-model", "debug-model")

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
          completeForPurpose({ ...call, provider, bindings, locale: "zh" })
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
        "请求体里的 model 必须等于 bindings 里对应用途的值"
      )

      if (apiFormat === "anthropic-messages") {
        for (const request of mock.requests) {
          assert.equal(request.headers["x-api-key"], provider.apiKey)
          assert.equal(request.headers["anthropic-version"], "2023-06-01")
          assert.equal(request.headers.authorization, undefined)
          assert.ok(Array.isArray(request.body.messages))
          assert.equal(typeof request.body.max_tokens, "number")
        }
        // 解析题面那一次要带图（Anthropic 的 image block）
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

      // 三次响应各自解析成功且互不串味
      assert.equal(new Set(texts).size, 3)
      assert.match(texts[0], new RegExp(`^reply-${apiFormat}-1$`))
    } finally {
      await mock.close()
    }
  }
})

test("完整链路：bindings 指向不存在的模型时回落 models 首项（与配置层归一一致）", async () => {
  const mock = await startMock((req, res) => {
    sendJson(res, 200, replyFor("chat-completions", "ok"))
  })
  try {
    const provider = providerFor("chat-completions", mock.baseUrl, ["first-model"])
    const { value: result } = await quiet(() =>
      completeForPurpose({
        purpose: "solution",
        provider,
        bindings: bindingsWith("gone-model", "gone-model", "gone-model"),
        user: "u",
        locale: "zh",
      })
    )
    assert.equal(result.kind, "success")
    assert.equal(mock.requests[0].body.model, "first-model")
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
        const provider = providerFor(apiFormat, mock.baseUrl, ["model-a"])
        for (const locale of ["zh", "en"]) {
          const { value: result } = await quiet(() =>
            completeForPurpose({
              purpose: "extraction",
              provider,
              bindings: bindingsWith("model-a", "model-a", "model-a"),
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
    const provider = providerFor("responses", mock.baseUrl, ["model-a"])
    const { value: result, lines } = await quiet(() =>
      completeForPurpose({
        purpose: "solution",
        provider,
        bindings: bindingsWith("model-a", "model-a", "model-a"),
        user: "u",
        locale: "zh",
      })
    )
    assert.equal(result.message, t("processing", "zh", "processing.error.llm.auth", { status: "401" }))
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
    const { value: result } = await quiet(() =>
      completeForPurpose({
        purpose: "solution",
        provider: providerFor("chat-completions", baseUrl, ["model-a"]),
        bindings: bindingsWith("model-a", "model-a", "model-a"),
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
          provider: providerFor("chat-completions", mock.baseUrl, ["model-a"]),
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
        provider: providerFor("chat-completions", mock.baseUrl, ["model-a"]),
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
    const { value: baseUrlMissing } = await quiet(() =>
      completeForPurpose({
        purpose: "extraction",
        provider: providerFor("responses", "", ["m"]),
        bindings: bindingsWith("m", "m", "m"),
        user: "u",
        locale,
      })
    )
    assert.equal(baseUrlMissing.code, "base-url-missing")
    assert.match(baseUrlMissing.message, pattern)

    const { value: noModel } = await quiet(() =>
      completeForPurpose({
        purpose: "debugging",
        provider: providerFor("responses", "https://gw.example.com/v1", []),
        bindings: bindingsWith("", "", ""),
        user: "u",
        locale,
      })
    )
    assert.equal(noModel.code, "model-missing")
    assert.match(noModel.message, locale === "zh" ? /尚未选择该用途的模型/ : /No model selected/)
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
      const provider = providerFor(apiFormat, `${mock.baseUrl}/v1`, [])
      const { value: result } = await quiet(() => listModels({ provider, locale: "zh" }))
      assert.equal(result.kind, "success")
      assert.deepEqual(result.models, ["glm-4.6v-flash", "qwen3-coder", "glm-5"])
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
          provider: providerFor("chat-completions", unauthorized.baseUrl, []),
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
        provider: providerFor("responses", slow.baseUrl, []),
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
    const provider = providerFor("responses", mock.baseUrl, [])
    const { value: listResult } = await quiet(() => listModels({ provider, locale: "zh" }))
    assert.equal(listResult.kind, "failure")

    // 用户在设置页手工添加模型 ID 后，bindings 生效、请求照常发出
    const withManual = { ...provider, models: ["manual-model"] }
    const { value: callResult } = await quiet(() =>
      completeForPurpose({
        purpose: "solution",
        provider: withManual,
        bindings: bindingsWith("", "manual-model", ""),
        user: "u",
        locale: "zh",
      })
    )
    assert.equal(callResult.kind, "success")
    assert.equal(callResult.text, "手工模型的回答")
  } finally {
    await mock.close()
  }
})

// ---------------------------------------------------------------- IPC 处理函数

test("IPC list-models：已保存配置返回 3 个 ID；401 时返回空列表 + 当前语言 error", async () => {
  const okMock = await startMock((req, res) => {
    sendJson(res, 200, { data: [{ id: "m-1" }, { id: "m-2" }, { id: "m-3" }] })
  })
  try {
    const rawConfig = {
      provider: {
        baseUrl: `${okMock.baseUrl}/v1`,
        apiFormat: "responses",
        apiKey: "sk-saved",
        models: ["m-1"],
      },
      bindings: { extractionModel: "m-1", solutionModel: "m-1", debuggingModel: "m-1" },
    }
    const { value: result } = await quiet(() =>
      handleListModels({ rawConfig, locale: "zh" })
    )
    assert.deepEqual(result, { ok: true, models: ["m-1", "m-2", "m-3"] })
  } finally {
    await okMock.close()
  }

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
            provider: {
              baseUrl: deniedMock.baseUrl,
              apiFormat: "chat-completions",
              apiKey: "sk-bad",
              models: [],
            },
          },
          locale,
        })
      )
      assert.equal(result.ok, false)
      assert.deepEqual(result.models, [])
      assert.equal(result.code, "auth")
      assert.match(result.error, pattern)
    }
  } finally {
    await deniedMock.close()
  }
})

test("IPC list-models：未保存的表单值可覆盖配置（设置页先填后拉）；缺配置给可见提示", async () => {
  const mock = await startMock((req, res) => {
    sendJson(res, 200, { models: ["draft-a", "draft-b"] })
  })
  try {
    const { value: overridden } = await quiet(() =>
      handleListModels({
        rawConfig: { provider: { baseUrl: "", apiFormat: "chat-completions", apiKey: "", models: [] } },
        overrides: {
          baseUrl: mock.baseUrl,
          apiFormat: "responses",
          apiKey: "sk-draft",
        },
        locale: "zh",
      })
    )
    assert.deepEqual(overridden, { ok: true, models: ["draft-a", "draft-b"] })
    assert.equal(mock.requests[0].headers.authorization, "Bearer sk-draft")

    const { value: noConfig } = await quiet(() =>
      handleListModels({ rawConfig: {}, locale: "zh" })
    )
    assert.equal(noConfig.ok, false)
    assert.deepEqual(noConfig.models, [])
    assert.equal(noConfig.code, "base-url-missing")
    assert.match(noConfig.error, /API Base URL/)

    const { value: noConfigEn } = await quiet(() =>
      handleListModels({ rawConfig: {}, locale: "en" })
    )
    assert.match(noConfigEn.error, /API Base URL/)
    assert.notEqual(noConfigEn.error, noConfig.error)
  } finally {
    await mock.close()
  }
})
