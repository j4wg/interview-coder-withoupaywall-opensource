/**
 * 「跟随系统」的唯一语言判定实现。
 *
 * 本文件是纯函数模块：不 import electron、不读取任何全局状态，
 * 系统信号由调用方（主进程 ConfigHelper）作为参数传入，便于 node --test 直接覆盖。
 */
import type { Locale, UiLanguageSetting } from "./types"

/**
 * 把任意 BCP 47 语言标签归一化为本应用支持的两种语言。
 * 取主子标签：`zh`、`zh-CN`、`zh-TW`、`zh-HK`、`zh_CN` → `zh`；其余（含空值）→ `en`。
 */
export function normalizeLocaleTag(tag: string | undefined | null): Locale {
  const normalized = (tag ?? "").trim()
  const primary = normalized.split(/[-_]/)[0]?.toLowerCase() ?? ""
  return primary === "zh" ? "zh" : "en"
}

/** 读取 Intl 的兜底信号；取不到或非法时返回 null（不抛错） */
function readIntlLocale(): string | null {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().locale
    return typeof resolved === "string" && resolved.trim() ? resolved : null
  } catch {
    return null
  }
}

/**
 * 解析最终生效的语言。
 *
 * - `setting` 为 `zh` / `en`：直接用用户选择，`appLocale` 不参与。
 * - `setting` 为 `system`（或运行期出现的任何非法值，等同 system）：
 *   `appLocale` → `Intl.DateTimeFormat().resolvedOptions().locale` → `en`，取到即止。
 *
 * @param appLocale 主进程 `app.getLocale()` 的结果；ready 前可能为空串或 null。
 */
export function resolveLocale(
  setting: UiLanguageSetting,
  appLocale?: string | null
): Locale {
  if (setting === "zh" || setting === "en") {
    return setting
  }

  const fromApp = (appLocale ?? "").trim()
  if (fromApp) {
    return normalizeLocaleTag(fromApp)
  }

  const fromIntl = readIntlLocale()
  if (fromIntl) {
    return normalizeLocaleTag(fromIntl)
  }

  return "en"
}
