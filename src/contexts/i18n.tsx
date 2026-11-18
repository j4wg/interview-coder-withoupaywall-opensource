/**
 * 渲染层国际化上下文（`useI18n()`）。
 *
 * 分工约定（见 `docs/i18n-design.md` §3 / §9.3）：
 * - 界面语言的**判定**只在主进程（`app.getLocale()` + `resolveLocale`），渲染层不读 `navigator.language`，
 *   避免"主进程中文 + 界面英文"的错位。
 * - 渲染层启动时通过 IPC `get-ui-locale` 取一次初值，之后由主进程广播的 `ui-locale-changed` 同步。
 * - 在拿到初值之前 `ready === false`，此时调用方不要渲染带文案的界面（避免首帧语言闪烁）。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react"
import type { ReactNode } from "react"

import { createTranslator } from "../../electron/i18n"
// 副作用 import：把 ui 中英文案表注册进翻译器内核
import "../../electron/i18n/messages/ui"
import type { Locale, UiLanguageSetting } from "../../electron/i18n/types"

interface I18nContextValue {
  /** 实际生效的界面语言 */
  locale: Locale
  /** 用户在设置里的选择：跟随系统 / 中文 / English */
  setting: UiLanguageSetting
  /** 是否已从主进程拿到界面语言；为 false 时不要渲染用户可见文案 */
  ready: boolean
  /** 取 `ui` 命名空间的一条文案，第二个参数替换 `{{name}}` 占位符 */
  t: (key: string, vars?: Record<string, string>) => string
  /** 写配置并立即重渲染；写盘失败会抛出，由调用方提示 */
  setSetting: (setting: UiLanguageSetting) => Promise<void>
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [setting, setSettingState] = useState<UiLanguageSetting>("system")
  const [locale, setLocale] = useState<Locale>("en")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let disposed = false

    // 启动时取一次初值；失败也不阻塞渲染，按"跟随系统 + 英文"兜底
    window.electronAPI
      .getUiLocale()
      .then((info) => {
        if (disposed) return
        setSettingState(info.setting)
        setLocale(info.locale)
      })
      .catch((error: unknown) => {
        console.error("[i18n] 读取界面语言失败：", error)
      })
      .finally(() => {
        if (!disposed) setReady(true)
      })

    // 主进程在 `uiLanguage` 写盘成功后广播，界面据此跟随（含"跟随系统"解析结果）
    const unsubscribe = window.electronAPI.onUiLocaleChanged((info) => {
      setSettingState(info.setting)
      setLocale(info.locale)
      setReady(true)
    })

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  const t = useMemo(() => createTranslator("ui", locale), [locale])

  const setSetting = useCallback(async (next: UiLanguageSetting) => {
    // 写盘成功后再刷新本地状态：写盘失败时界面不切走，避免"看起来切了但重启又变回去"
    await window.electronAPI.updateConfig({ uiLanguage: next })
    const info = await window.electronAPI.getUiLocale()
    setSettingState(info.setting)
    setLocale(info.locale)
  }, [])

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setting, ready, t, setSetting }),
    [locale, setting, ready, t, setSetting]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n 必须在 I18nProvider 内使用")
  }
  return context
}
