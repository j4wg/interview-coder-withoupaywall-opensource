/**
 * 调用层错误码 → `processing` 命名空间文案键的映射（纯函数）。
 *
 * 所有对用户可见的文案都从这里出，保证：
 * - 中文界面出中文、English 界面出英文（缺键由 tsc 的「中文表为类型真源」拦住）；
 * - 供应商原始报文只进 `detail`（日志），不混进用户提示，避免中英混排。
 */
import { t } from "../i18n"
import type { Locale } from "../i18n/types"
import type { LlmErrorCode } from "./types"

const MESSAGE_KEY: Record<LlmErrorCode, string> = {
  "base-url-missing": "processing.error.llm.baseUrlMissing",
  "base-url-invalid": "processing.error.llm.baseUrlInvalid",
  "api-key-missing": "processing.error.llm.apiKeyMissing",
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
