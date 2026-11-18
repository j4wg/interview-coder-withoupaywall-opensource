/**
 * `list-models` IPC 的纯逻辑（不 import electron，可直接被 node --test 覆盖）。
 *
 * 返回结构固定为 `{ ok, models, error?, code? }`：
 * - 成功：`{ ok: true, models: string[] }`；
 * - 失败：`{ ok: false, models: [], error: 当前语言的提示, code }`。
 * 失败时**不抛异常**，渲染层可以继续手工填写模型 ID。
 */
import type { Locale } from "../i18n/types"
import { listModels } from "./client"
import { llmErrorMessage } from "./messages"
import {
  applyProviderOverrides,
  resolveProviderConfig,
} from "./providerConfig"

export interface ListModelsIpcResult {
  ok: boolean
  models: string[]
  error?: string
  code?: string
}

/** 渲染层可带未保存的表单值（baseUrl / apiFormat / apiKey），已保存的配置作为兜底 */
export async function handleListModels(opts: {
  rawConfig: unknown
  overrides?: unknown
  locale: Locale
  timeoutMs?: number
}): Promise<ListModelsIpcResult> {
  try {
    const { provider } = resolveProviderConfig(opts.rawConfig)
    const effective = applyProviderOverrides(provider, opts.overrides)
    const result = await listModels({
      provider: effective,
      locale: opts.locale,
      timeoutMs: opts.timeoutMs,
    })
    if (result.kind === "success") return { ok: true, models: result.models }
    return {
      ok: false,
      models: [],
      error: result.message,
      code: result.code,
    }
  } catch (error) {
    // 兜底：配置/网络之外的意外错误也不让 IPC 抛到渲染层
    console.error("[llm] list-models handler failed:", error)
    return {
      ok: false,
      models: [],
      error: llmErrorMessage(opts.locale, "unknown"),
      code: "unknown",
    }
  }
}
