/**
 * `list-models` IPC 的纯逻辑（不 import electron，可直接被 node --test 覆盖）。
 *
 * 多套配置并存：渲染层传 `providerId` 指定要给哪张 provider 卡片拉模型，
 * 同时可带该卡片尚未保存的表单值（baseUrl / apiFormat / apiKey）。
 * 未指定 providerId 时：表单带 baseUrl 就按表单拉（新建卡片），否则用第一套已保存配置。
 *
 * 返回结构固定为 `{ ok, models, providerId?, error?, code? }`：
 * - 成功：`{ ok: true, models: string[], providerId }`；
 * - 失败：`{ ok: false, models: [], error: 当前语言的提示, code }`。
 * 失败时**不抛异常**，渲染层可以继续手工填写模型 ID。
 */
import type { Locale } from "../i18n/types"
import { listModels } from "./client"
import { llmErrorMessage } from "./messages"
import {
  applyProviderOverrides,
  findProvider,
  providerFromOverrides,
  resolveProviderConfig,
} from "./providerConfig"
import type { ProviderConfig } from "./types"

export interface ListModelsIpcResult {
  ok: boolean
  models: string[]
  /** 本次实际使用的配置 id（新建卡片可能为空串） */
  providerId?: string
  error?: string
  code?: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * 选出这次要用的配置：
 * 1. 指定了 `providerId` 且已保存 → 用已保存配置 + 表单覆盖；
 * 2. 指定了 `providerId` 但未保存（新建卡片）→ 用表单值构造，id 沿用；
 * 3. 未指定 id：表单带了 baseUrl → 用表单值；否则用第一套已保存配置；
 * 4. 都不成立 → `null`（交给调用方给"请先选择/新建配置"的可见提示）。
 */
export function selectProviderForModelList(
  providers: readonly ProviderConfig[],
  providerId: unknown,
  overrides: unknown
): ProviderConfig | null {
  const form = isPlainObject(overrides) ? overrides : null
  const requestedId =
    asTrimmedString(providerId) ||
    (form ? asTrimmedString(form.providerId) : "")

  if (requestedId) {
    const saved = findProvider(providers, requestedId)
    if (saved) return applyProviderOverrides(saved, overrides)
    if (form && asTrimmedString(form.baseUrl)) {
      return providerFromOverrides(form, requestedId)
    }
    return null
  }

  if (form && asTrimmedString(form.baseUrl)) {
    return providerFromOverrides(form)
  }
  if (providers.length > 0) return providers[0]
  return null
}

export async function handleListModels(opts: {
  rawConfig: unknown
  providerId?: unknown
  overrides?: unknown
  locale: Locale
  timeoutMs?: number
}): Promise<ListModelsIpcResult> {
  const { locale } = opts
  try {
    const { providers } = resolveProviderConfig(opts.rawConfig)
    const provider = selectProviderForModelList(
      providers,
      opts.providerId,
      opts.overrides
    )
    if (!provider) {
      return {
        ok: false,
        models: [],
        error: llmErrorMessage(locale, "provider-missing"),
        code: "provider-missing",
      }
    }

    const result = await listModels({
      provider,
      locale,
      timeoutMs: opts.timeoutMs,
    })
    if (result.kind === "success") {
      return {
        ok: true,
        models: result.models,
        providerId: result.providerId,
      }
    }
    return {
      ok: false,
      models: [],
      error: result.message,
      code: result.code,
      providerId: result.providerId,
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
