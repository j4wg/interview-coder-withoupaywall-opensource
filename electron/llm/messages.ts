/**
 * 调用层错误码 → `processing` 命名空间文案键的映射（纯函数）。
 *
 * 所有对用户可见的文案都从这里出，保证：
 * - 中文界面出中文、English 界面出英文（缺键由 tsc 的「中文表为类型真源」拦住）；
 * - 供应商原始报文只进 `detail`（日志），不混进用户提示，避免中英混排。
 */
import { t } from "../i18n"
import type { Locale } from "../i18n/types"
import type { LlmErrorCode, ModelPurpose } from "./types"

const MESSAGE_KEY: Record<LlmErrorCode, string> = {
  "base-url-missing": "processing.error.llm.baseUrlMissing",
  "base-url-invalid": "processing.error.llm.baseUrlInvalid",
  "api-key-missing": "processing.error.llm.apiKeyMissing",
  "provider-missing": "processing.error.llm.providerMissing",
  "binding-missing": "processing.error.llm.bindingMissing",
  "model-missing": "processing.error.llm.modelMissing",
  network: "processing.error.llm.network",
  timeout: "processing.error.llm.timeout",
  auth: "processing.error.llm.auth",
  "rate-limit": "processing.error.llm.rateLimit",
  server: "processing.error.llm.server",
  "bad-request": "processing.error.llm.badRequest",
  "too-large": "processing.error.llm.tooLarge",
  "invalid-response": "processing.error.llm.invalidResponse",
  "empty-response": "processing.error.llm.emptyResponse",
  // 用户取消沿用既有文案，避免同一个动作出现两套说法
  aborted: "processing.error.cancelled",
  unknown: "processing.error.llm.unknown",
}

/** 取一条本地化错误文案；未知 code 走 unknown 文案，永不返回空串 */
export function llmErrorMessage(
  locale: Locale,
  code: LlmErrorCode,
  vars?: Record<string, string>
): string {
  const key = MESSAGE_KEY[code] ?? MESSAGE_KEY.unknown
  return t("processing", locale, key, vars)
}

/** 用途 → 文案键（设置页与解绑提示共用，避免各处自造中文） */
const PURPOSE_KEY: Record<ModelPurpose, string> = {
  extraction: "processing.modelPurpose.extraction",
  solution: "processing.modelPurpose.solution",
  debugging: "processing.modelPurpose.debugging",
}

/** 用途的本地化名称（如「题面解析」/「problem extraction」） */
export function modelPurposeLabel(
  locale: Locale,
  purpose: ModelPurpose
): string {
  return t("processing", locale, PURPOSE_KEY[purpose])
}

/**
 * 删除 provider 后给界面的提示：列出被解除绑定的用途，
 * 明确告知「该用途需要重新选择模型」。
 */
export function detachedBindingNotice(
  locale: Locale,
  providerName: string,
  purposes: readonly ModelPurpose[]
): string {
  const separator = locale === "zh" ? "、" : ", "
  return t("processing", locale, "processing.notice.llm.bindingDetached", {
    provider: providerName,
    purpose: purposes.map((purpose) => modelPurposeLabel(locale, purpose)).join(separator),
  })
}
