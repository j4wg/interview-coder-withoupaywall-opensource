import React, { useState, useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"

import { useToast } from "../../contexts/toast"
import { useI18n } from "../../contexts/i18n"
import { LanguageSelector } from "../shared/LanguageSelector"
import { COMMAND_KEY } from "../../utils/platform"

interface QueueCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void
  screenshotCount?: number
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
}

const QueueCommands: React.FC<QueueCommandsProps> = ({
  onTooltipVisibilityChange,
  screenshotCount = 0,
  credits,
  currentLanguage,
  setLanguage
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()
  const { t } = useI18n()

  // 轮换编程语言：复用 LanguageSelector 的选项顺序，这里临时挂一个隐藏实例取出可选项
  const extractLanguagesAndUpdate = (direction?: 'next' | 'prev') => {
    const hiddenRenderContainer = document.createElement('div');
    hiddenRenderContainer.style.position = 'absolute';
    hiddenRenderContainer.style.left = '-9999px';
    document.body.appendChild(hiddenRenderContainer);
    
    // 临时渲染一份 LanguageSelector 用于取选项
    const root = createRoot(hiddenRenderContainer);
    root.render(
      <LanguageSelector 
        currentLanguage={currentLanguage} 
        setLanguage={() => {}}
      />
    );
    
    // 等一个渲染周期（50ms 足够 React 完成一次提交）
    setTimeout(() => {
      // 从渲染出来的 select 里取选项
      const selectElement = hiddenRenderContainer.querySelector('select');
      if (selectElement) {
        const options = Array.from(selectElement.options);
        const values = options.map(opt => opt.value);
        
        // 当前语言在选项里的下标
        const currentIndex = values.indexOf(currentLanguage);
        let newIndex = currentIndex;
        
        if (direction === 'prev') {
          // 上一个语言
          newIndex = (currentIndex - 1 + values.length) % values.length;
        } else {
          // 默认下一个语言
          newIndex = (currentIndex + 1) % values.length;
        }
        
        if (newIndex !== currentIndex) {
          setLanguage(values[newIndex]);
          window.electronAPI.updateConfig({ language: values[newIndex] });
        }
      }
      
      // 清理临时节点
      root.unmount();
      document.body.removeChild(hiddenRenderContainer);
    }, 50);
  };

  useEffect(() => {
    let tooltipHeight = 0
    if (tooltipRef.current && isTooltipVisible) {
      tooltipHeight = tooltipRef.current.offsetHeight + 10
    }
    onTooltipVisibilityChange(isTooltipVisible, tooltipHeight)
  }, [isTooltipVisible])

  // 退出登录：清本地缓存与配置里的 API Key，然后重载
  const handleSignOut = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();

      await window.electronAPI.updateConfig({
        apiKey: '',
      });

      showToast(t("ui.common.success"), t("ui.header.toast.loggedOut"), 'success');

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("退出登录出错：", err);
      showToast(t("ui.common.error"), t("ui.header.toast.logoutFailed"), 'error');
    }
  }

  const handleMouseEnter = () => {
    setIsTooltipVisible(true)
  }

  const handleMouseLeave = () => {
    setIsTooltipVisible(false)
  }

  return (
    <div>
      <div className="pt-2 w-fit">
        <div className="text-xs text-white/90 backdrop-blur-md bg-black/60 rounded-lg py-2 px-4 flex items-center justify-center gap-4">
          {/* 截图 */}
          <div
            className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
            onClick={async () => {
              try {
                const result = await window.electronAPI.triggerScreenshot()
                if (!result.success) {
                  console.error("截图失败：", result.error)
                  showToast(t("ui.common.error"), t("ui.error.failedToTakeScreenshot"), "error")
                }
              } catch (error) {
                console.error("截图时出错：", error)
                showToast(t("ui.common.error"), t("ui.error.failedToTakeScreenshot"), "error")
              }
            }}
          >
            <span className="text-[11px] leading-none truncate">
              {screenshotCount === 0
                ? t("ui.queue.screenshot.first")
                : screenshotCount === 1
                ? t("ui.queue.screenshot.second")
                : screenshotCount === 2
                ? t("ui.queue.screenshot.third")
                : screenshotCount === 3
                ? t("ui.queue.screenshot.fourth")
                : screenshotCount === 4
                ? t("ui.queue.screenshot.fifth")
                : t("ui.queue.screenshot.replaceFirst")}
            </span>
            <div className="flex gap-1">
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                {COMMAND_KEY}
              </button>
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                H
              </button>
            </div>
          </div>

          {/* 解答 */}
          {screenshotCount > 0 && (
            <div
              className={`flex flex-col cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors ${
                credits <= 0 ? "opacity-50 cursor-not-allowed" : ""
              }`}
              onClick={async () => {

                try {
                  const result =
                    await window.electronAPI.triggerProcessScreenshots()
                  if (!result.success) {
                    console.error(
                      "处理截图失败：",
                      result.error
                    )
                    showToast(t("ui.common.error"), t("ui.error.failedToProcessScreenshots"), "error")
                  }
                } catch (error) {
                  console.error("处理截图时出错：", error)
                  showToast(t("ui.common.error"), t("ui.error.failedToProcessScreenshots"), "error")
                }
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] leading-none">{t("ui.commands.solve")} </span>
                <div className="flex gap-1 ml-2">
                  <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                    {COMMAND_KEY}
                  </button>
                  <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                    ↵
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 分隔线 */}
          <div className="mx-2 h-4 w-px bg-white/20" />

          {/* 设置齿轮 + 快捷键浮层 */}
          <div
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* 齿轮图标 */}
            <div className="w-4 h-4 flex items-center justify-center cursor-pointer text-white/70 hover:text-white/90 transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>

            {/* 浮层内容 */}
            {isTooltipVisible && (
              <div
                ref={tooltipRef}
                className="absolute top-full left-0 mt-2 w-80 transform -translate-x-[calc(50%-12px)]"
                style={{ zIndex: 100 }}
              >
                {/* 透明桥接层：避免鼠标移入浮层时闪烁 */}
                <div className="absolute -top-2 right-0 w-full h-2" />
                <div className="p-3 text-xs bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-white/90 shadow-lg">
                  <div className="space-y-4">
                    <h3 className="font-medium truncate">{t("ui.shortcut.title")}</h3>
                    <div className="space-y-3">
                      {/* 显示/隐藏窗口 */}
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                        onClick={async () => {
                          try {
                            const result =
                              await window.electronAPI.toggleMainWindow()
                            if (!result.success) {
                              console.error(
                                "显示/隐藏窗口失败：",
                                result.error
                              )
                              showToast(
                                t("ui.common.error"),
                                t("ui.error.failedToToggleWindow"),
                                "error"
                              )
                            }
                          } catch (error) {
                            console.error("显示/隐藏窗口时出错：", error)
                            showToast(
                              t("ui.common.error"),
                              t("ui.error.failedToToggleWindow"),
                              "error"
                            )
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{t("ui.commands.toggleWindow")}</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              B
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                          {t("ui.commands.toggleWindowDescription")}
                        </p>
                      </div>

                      {/* 截图 */}
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                        onClick={async () => {
                          try {
                            const result =
                              await window.electronAPI.triggerScreenshot()
                            if (!result.success) {
                              console.error(
                                "截图失败：",
                                result.error
                              )
                              showToast(
                                t("ui.common.error"),
                                t("ui.error.failedToTakeScreenshot"),
                                "error"
                              )
                            }
                          } catch (error) {
                            console.error("截图时出错：", error)
                            showToast(
                              t("ui.common.error"),
                              t("ui.error.failedToTakeScreenshot"),
                              "error"
                            )
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{t("ui.commands.takeScreenshot")}</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              H
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                          {t("ui.commands.takeScreenshotDescription")}
                        </p>
                      </div>

                      {/* 解答 */}
                      <div
                        className={`cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors ${
                          screenshotCount > 0
                            ? ""
                            : "opacity-50 cursor-not-allowed"
                        }`}
                        onClick={async () => {
                          if (screenshotCount === 0) return

                          try {
                            const result =
                              await window.electronAPI.triggerProcessScreenshots()
                            if (!result.success) {
                              console.error(
                                "处理截图失败：",
                                result.error
                              )
                              showToast(
                                t("ui.common.error"),
                                t("ui.error.failedToProcessScreenshots"),
                                "error"
                              )
                            }
                          } catch (error) {
                            console.error(
                              "处理截图时出错：",
                              error
                            )
                            showToast(
                              t("ui.common.error"),
                              t("ui.error.failedToProcessScreenshots"),
                              "error"
                            )
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{t("ui.commands.solve")}</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              ↵
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                          {screenshotCount > 0
                            ? t("ui.commands.solveDescription")
                            : t("ui.commands.solveNeedsScreenshot")}
                        </p>
                      </div>
                      
                      {/* 删除最后一张截图 */}
                      <div
                        className={`cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors ${
                          screenshotCount > 0
                            ? ""
                            : "opacity-50 cursor-not-allowed"
                        }`}
                        onClick={async () => {
                          if (screenshotCount === 0) return
                          
                          try {
                            const result = await window.electronAPI.deleteLastScreenshot()
                            if (!result.success) {
                              console.error(
                                "Failed to delete last screenshot:",
                                result.error
                              )
                              showToast(
                                t("ui.common.error"),
                                result.error || t("ui.error.failedToDeleteScreenshot"),
                                "error"
                              )
                            }
                          } catch (error) {
                            console.error("删除截图时出错：", error)
                            showToast(
                              t("ui.common.error"),
                              t("ui.error.failedToDeleteScreenshot"),
                              "error"
                            )
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{t("ui.commands.deleteLastScreenshot")}</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              L
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                          {screenshotCount > 0
                            ? t("ui.commands.deleteLastScreenshotDescription")
                            : t("ui.commands.deleteLastScreenshotEmpty")}
                        </p>
                      </div>
                    </div>

                    {/* 分隔线 + 语言/设置/退出登录 */}
                    <div className="pt-3 mt-3 border-t border-white/10">
                      {/* 编程语言轮换（点击或方向键） */}
                      <div className="mb-3 px-2">
                        <div 
                          className="flex items-center justify-between cursor-pointer hover:bg-white/10 rounded px-2 py-1 transition-colors"
                          onClick={() => extractLanguagesAndUpdate('next')}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                              extractLanguagesAndUpdate('prev');
                            } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                              extractLanguagesAndUpdate('next');
                            }
                          }}
                        >
                          <span className="text-[11px] text-white/70">{t("ui.common.programmingLanguage")}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-white/90">{currentLanguage}</span>
                            <div className="text-white/40 text-[8px]">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                <path d="M7 13l5 5 5-5M7 6l5 5 5-5"/>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* API Key 设置入口 */}
                      <div className="mb-3 px-2 space-y-1">
                        <div className="flex items-center justify-between text-[13px] font-medium text-white/90">
                          <span>{t("ui.common.apiSettings")}</span>
                          <button
                            className="bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-[11px]"
                            onClick={() => window.electronAPI.openSettingsPortal()}
                          >
                            {t("ui.common.settings")}
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 transition-colors w-full"
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-3 h-3"
                          >
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                        </div>
                        {t("ui.common.logOut")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default QueueCommands
