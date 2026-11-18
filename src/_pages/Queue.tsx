import React, { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
import QueueCommands from "../components/Queue/QueueCommands"

import { useToast } from "../contexts/toast"
import { useI18n } from "../contexts/i18n"
import { Screenshot } from "../types/screenshots"

// 读取当前已截取的截图（查询层统一走 react-query 缓存）
async function fetchScreenshots(): Promise<Screenshot[]> {
  try {
    const existing = await window.electronAPI.getScreenshots()
    return existing
  } catch (error) {
    console.error("加载截图失败：", error)
    throw error
  }
}

interface QueueProps {
  setView: (view: "queue" | "solutions" | "debug") => void
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
}

const Queue: React.FC<QueueProps> = ({
  setView,
  credits,
  currentLanguage,
  setLanguage
}) => {
  const { showToast } = useToast()
  const { t } = useI18n()

  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  const {
    data: screenshots = [],
    isLoading,
    refetch
  } = useQuery<Screenshot[]>({
    queryKey: ["screenshots"],
    queryFn: fetchScreenshots,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false
  })

  // 删除指定下标的截图，成功后重新拉取列表
  const handleDeleteScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        refetch() // 直接重取，不在本地维护截图数组
      } else {
        console.error("删除截图失败：", response.error)
        showToast(t("ui.common.error"), t("ui.error.failedToDeleteScreenshot"), "error")
      }
    } catch (error) {
      console.error("删除截图时出错：", error)
    }
  }

  useEffect(() => {
    // 把内容高度同步给主进程，窗口才能随内容自适应
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight
        const contentWidth = contentRef.current.scrollWidth
        if (isTooltipVisible) {
          contentHeight += tooltipHeight
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight
        })
      }
    }

    // 初始化尺寸监听
    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    // 监听截图/重置/删除/处理失败等主进程事件
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onDeleteLastScreenshot(async () => {
        if (screenshots.length > 0) {
          await handleDeleteScreenshot(screenshots.length - 1);
          // 删除成功不弹提示（按产品要求）
        } else {
          showToast(t("ui.info.noScreenshots"), t("ui.info.noScreenshotsToDelete"), "neutral");
        }
      }),
      window.electronAPI.onSolutionError((error: string) => {
        showToast(
          t("ui.error.processingFailed"),
          t("ui.error.queueProcessingDescription"),
          "error"
        )
        setView("queue") // 处理失败退回队列页
        console.error("处理出错：", error)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          t("ui.info.noScreenshots"),
          t("ui.info.noScreenshotsToProcess"),
          "neutral"
        )
      }),
      // 本版本不限额，不再监听"额度用尽"事件
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [isTooltipVisible, tooltipHeight, screenshots])

  // 浮层高度变化时重新计算窗口高度
  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  const handleOpenSettings = () => {
    window.electronAPI.openSettingsPortal();
  };
  
  return (
    <div ref={contentRef} className={`bg-transparent w-1/2`}>
      <div className="px-4 py-3">
        <div className="space-y-3 w-fit">
          <ScreenshotQueue
            isLoading={false}
            screenshots={screenshots}
            onDeleteScreenshot={handleDeleteScreenshot}
          />

          <QueueCommands
            onTooltipVisibilityChange={handleTooltipVisibilityChange}
            screenshotCount={screenshots.length}
            credits={credits}
            currentLanguage={currentLanguage}
            setLanguage={setLanguage}
          />
        </div>
      </div>
    </div>
  )
}

export default Queue
