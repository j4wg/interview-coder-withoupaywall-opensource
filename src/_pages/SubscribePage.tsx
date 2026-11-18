// 订阅页：当前版本的路由已不再引用该页面（开源版无付费流程），
// 但保留文件并接入 i18n，避免后续重新启用时出现英文硬编码。
import { useState, useRef, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { User } from "@supabase/supabase-js"
import { useI18n } from "../contexts/i18n"

interface SubscribePageProps {
  user: User
}

export default function SubscribePage({ user }: SubscribePageProps) {
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 该页面是固定尺寸的小窗口，挂载时把尺寸同步给主进程
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        window.electronAPI.updateContentDimensions({
          width: 400, // 固定宽度
          height: 400 // 固定高度
        })
      }
    }

    updateDimensions()
  }, [])

  // 退出登录：失败时给出 3 秒提示
  const handleSignOut = async () => {
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
    } catch (err) {
      console.error("退出登录失败：", err)
      setError(t("ui.subscribe.error.signOutFailed"))
      setTimeout(() => setError(null), 3000)
    }
  }

  // 打开订阅页（外部浏览器）
  const handleSubscribe = async () => {
    if (!user) return

    try {
      const result = await window.electronAPI.openSubscriptionPortal({
        id: user.id,
        email: user.email!
      })

      if (!result.success) {
        throw new Error(result.error || t("ui.subscribe.error.portalFailed"))
      }
    } catch (err) {
      console.error("打开订阅页面失败：", err)
      setError(t("ui.subscribe.error.portalFailed"))
      setTimeout(() => setError(null), 3000)
    }
  }

  return (
    <div
      ref={containerRef}
      className="h-[400px] w-[400px] bg-black flex items-center justify-center"
    >
      <div className="w-full px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">
            {t("ui.subscribe.title")}
          </h2>
          <p className="text-gray-400 text-sm mt-2 mb-6">
            {t("ui.subscribe.description")}
          </p>
          <p className="text-gray-500 text-[11px] -mt-4 mb-6 italic">
            {t("ui.subscribe.note")}
          </p>

          {/* 快捷键提示 */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 mb-6">
            <div className="flex items-center justify-between text-white/70 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-white/40">{t("ui.shortcut.toggleVisibility")}</span>
                <div className="flex gap-1">
                  <kbd className="bg-white/[0.07] border border-white/[0.1] rounded-md px-1.5 py-1 text-[10px] leading-none text-white/60">
                    ⌘
                  </kbd>
                  <kbd className="bg-white/[0.07] border border-white/[0.1] rounded-md px-1.5 py-1 text-[10px] leading-none text-white/60">
                    B
                  </kbd>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/40">{t("ui.shortcut.quitApp")}</span>
                <div className="flex gap-1">
                  <kbd className="bg-white/[0.07] border border-white/[0.1] rounded-md px-1.5 py-1 text-[10px] leading-none text-white/60">
                    ⌘
                  </kbd>
                  <kbd className="bg-white/[0.07] border border-white/[0.1] rounded-md px-1.5 py-1 text-[10px] leading-none text-white/60">
                    Q
                  </kbd>
                </div>
              </div>
            </div>
          </div>

          {/* 订阅按钮 */}
          <button
            onClick={handleSubscribe}
            className="w-full px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors flex items-center justify-center gap-2 mb-6"
          >
            {t("ui.subscribe.subscribe")}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>

          {/* 退出登录 */}
          <div className="border-t border-white/[0.06] pt-4">
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-1.5 text-[11px] text-red-400/80 hover:text-red-400 transition-colors w-full group"
            >
              <div className="w-3.5 h-3.5 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-full h-full"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              {t("ui.common.logOut")}
            </button>
          </div>

          {error && (
            <div className="mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
