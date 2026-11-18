// Solutions.tsx
import React, { useState, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"

import ScreenshotQueue from "../components/Queue/ScreenshotQueue"

import { ProblemStatementData } from "../types/solutions"
import SolutionCommands from "../components/Solutions/SolutionCommands"
import Debug from "./Debug"
import { useToast } from "../contexts/toast"
import { useI18n } from "../contexts/i18n"
import { COMMAND_KEY } from "../utils/platform"

// 通用文本区块（题目描述 / 我的思路）：加载中显示脉冲占位文案
export const ContentSection = ({
  title,
  content,
  isLoading,
  loadingText
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
  loadingText: string
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="mt-4 flex">
        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          {loadingText}
        </p>
      </div>
    ) : (
      <div className="text-[13px] leading-[1.4] text-gray-100 max-w-[600px]">
        {content}
      </div>
    )}
  </div>
)
const SolutionSection = ({
  title,
  content,
  isLoading,
  currentLanguage
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
  currentLanguage: string
}) => {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  // 复制代码到剪贴板，2 秒后按钮文案复位
  const copyToClipboard = () => {
    if (typeof content === "string") {
      navigator.clipboard.writeText(content).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <div className="space-y-2 relative">
      <h2 className="text-[13px] font-medium text-white tracking-wide">
        {title}
      </h2>
      {isLoading ? (
        <div className="space-y-1.5">
          <div className="mt-4 flex">
            <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
              {t("ui.solutions.loading")}
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full relative">
          <button
            onClick={copyToClipboard}
            className="absolute top-2 right-2 text-xs text-white bg-white/10 hover:bg-white/20 rounded px-2 py-1 transition"
          >
            {copied ? t("ui.solutions.copied") : t("ui.solutions.copy")}
          </button>
          <SyntaxHighlighter
            showLineNumbers
            language={currentLanguage == "golang" ? "go" : currentLanguage}
            style={dracula}
            customStyle={{
              maxWidth: "100%",
              margin: 0,
              padding: "1rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              backgroundColor: "rgba(22, 27, 34, 0.5)"
            }}
            wrapLongLines={true}
          >
            {content as string}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  )
}

export const ComplexitySection = ({
  timeComplexity,
  spaceComplexity,
  isLoading
}: {
  timeComplexity: string | null
  spaceComplexity: string | null
  isLoading: boolean
}) => {
  const { t } = useI18n()

  // 归一化复杂度展示：模型偶尔只给 "n log n"，这里补成大 O 记法
  const formatComplexity = (complexity: string | null): string => {
    // 模型没给复杂度时的兜底文案
    if (!complexity || complexity.trim() === "") {
      return t("ui.solutions.complexityUnavailable");
    }

    const bigORegex = /O\([^)]+\)/i;
    // 已经是 Big O 记法就原样展示
    if (bigORegex.test(complexity)) {
      return complexity;
    }

    return `O(${complexity})`;
  };
  
  const formattedTimeComplexity = formatComplexity(timeComplexity);
  const formattedSpaceComplexity = formatComplexity(spaceComplexity);
  
  return (
    <div className="space-y-2">
      <h2 className="text-[13px] font-medium text-white tracking-wide">
        {t("ui.solutions.complexity")}
      </h2>
      {isLoading ? (
        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          {t("ui.solutions.calculating")}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="text-[13px] leading-[1.4] text-gray-100 bg-white/5 rounded-md p-3">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
              <div>
                <strong>{t("ui.solutions.time")}</strong> {formattedTimeComplexity}
              </div>
            </div>
          </div>
          <div className="text-[13px] leading-[1.4] text-gray-100 bg-white/5 rounded-md p-3">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
              <div>
                <strong>{t("ui.solutions.space")}</strong> {formattedSpaceComplexity}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface SolutionsProps {
  setView: (view: "queue" | "solutions" | "debug") => void
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
}
const Solutions: React.FC<SolutionsProps> = ({
  setView,
  credits,
  currentLanguage,
  setLanguage
}) => {
  const queryClient = useQueryClient()
  const { t } = useI18n()
  const contentRef = useRef<HTMLDivElement>(null)

  const [debugProcessing, setDebugProcessing] = useState(false)
  const [problemStatementData, setProblemStatementData] =
    useState<ProblemStatementData | null>(null)
  const [solutionData, setSolutionData] = useState<string | null>(null)
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null)
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(
    null
  )
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(
    null
  )

  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)

  const [isResetting, setIsResetting] = useState(false)

  interface Screenshot {
    id: string
    path: string
    preview: string
    timestamp: number
  }

  const [extraScreenshots, setExtraScreenshots] = useState<Screenshot[]>([])

  // 解答生成后重新读取截图列表（用于缩略图区）
  useEffect(() => {
    const fetchScreenshots = async () => {
      try {
        const existing = await window.electronAPI.getScreenshots()
        console.log("原始截图数据：", existing)
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now()
          })
        )
        console.log("处理后的截图：", screenshots)
        setExtraScreenshots(screenshots)
      } catch (error) {
        console.error("加载额外截图失败：", error)
        setExtraScreenshots([])
      }
    }

    fetchScreenshots()
  }, [solutionData])

  const { showToast } = useToast()

  useEffect(() => {
    // 内容高度同步给主进程
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

    // 订阅解答/调试相关的主进程事件
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(async () => {
        try {
          const existing = await window.electronAPI.getScreenshots()
          const screenshots = (Array.isArray(existing) ? existing : []).map(
            (p) => ({
              id: p.path,
              path: p.path,
              preview: p.preview,
              timestamp: Date.now()
            })
          )
          setExtraScreenshots(screenshots)
        } catch (error) {
          console.error("加载额外截图失败：", error)
        }
      }),
      window.electronAPI.onResetView(() => {
        // 先置位"重置中"，避免用旧数据渲染
        setIsResetting(true)

        queryClient.removeQueries({
          queryKey: ["solution"]
        })
        queryClient.removeQueries({
          queryKey: ["new_solution"]
        })

        setExtraScreenshots([])

        // 下一个事件循环再解除，保证视图已切回队列页
        setTimeout(() => {
          setIsResetting(false)
        }, 0)
      }),
      window.electronAPI.onSolutionStart(() => {
        // 每次开始处理都清空上一次的解答与复杂度
        setSolutionData(null)
        setThoughtsData(null)
        setTimeComplexityData(null)
        setSpaceComplexityData(null)
      }),
      window.electronAPI.onProblemExtracted((data) => {
        queryClient.setQueryData(["problem_statement"], data)
      }),
      // 首次生成解答失败：提示并把界面回退到上一次的缓存结果
      window.electronAPI.onSolutionError((error: string) => {
        showToast(t("ui.error.processingFailed"), error, "error")
        // 缓存里若有上一次的解答，就回填它，避免界面空白
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string
          thoughts: string[]
          time_complexity: string
          space_complexity: string
        } | null
        if (!solution) {
          setView("queue")
        }
        setSolutionData(solution?.code || null)
        setThoughtsData(solution?.thoughts || null)
        setTimeComplexityData(solution?.time_complexity || null)
        setSpaceComplexityData(solution?.space_complexity || null)
        console.error("处理出错：", error)
      }),
      // 解答生成成功：写入缓存并回填界面状态
      window.electronAPI.onSolutionSuccess((data) => {
        if (!data) {
          console.warn("收到的解答数据为空或格式不正确")
          return
        }
        console.log({ data })
        const solutionData = {
          code: data.code,
          thoughts: data.thoughts,
          time_complexity: data.time_complexity,
          space_complexity: data.space_complexity
        }

        queryClient.setQueryData(["solution"], solutionData)
        setSolutionData(solutionData.code || null)
        setThoughtsData(solutionData.thoughts || null)
        setTimeComplexityData(solutionData.time_complexity || null)
        setSpaceComplexityData(solutionData.space_complexity || null)

        // 成功后拉一次最新截图
        const fetchScreenshots = async () => {
          try {
            const existing = await window.electronAPI.getScreenshots()
            const screenshots =
              existing.previews?.map((p) => ({
                id: p.path,
                path: p.path,
                preview: p.preview,
                timestamp: Date.now()
              })) || []
            setExtraScreenshots(screenshots)
          } catch (error) {
            console.error("加载额外截图失败：", error)
            setExtraScreenshots([])
          }
        }
        fetchScreenshots()
      }),

      //########################################################
      // 调试相关事件
      //########################################################
      window.electronAPI.onDebugStart(() => {
        // 进入调试中：用这个状态渲染加载态
        setDebugProcessing(true)
      }),
      // 调试成功：结果写入缓存，视图由下面渲染逻辑切到调试页
      window.electronAPI.onDebugSuccess((data) => {
        queryClient.setQueryData(["new_solution"], data)
        setDebugProcessing(false)
      }),
      // 调试失败：提示并停止加载态
      window.electronAPI.onDebugError(() => {
        showToast(
          t("ui.error.processingFailed"),
          t("ui.error.debugDescription"),
          "error"
        )
        setDebugProcessing(false)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          t("ui.info.noScreenshots"),
          t("ui.info.noExtraScreenshotsToProcess"),
          "neutral"
        )
      }),
      // 本版本不限额，不再监听"额度用尽"事件
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [isTooltipVisible, tooltipHeight])

  useEffect(() => {
    setProblemStatementData(
      queryClient.getQueryData(["problem_statement"]) || null
    )
    setSolutionData(queryClient.getQueryData(["solution"]) || null)

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === "problem_statement") {
        setProblemStatementData(
          queryClient.getQueryData(["problem_statement"]) || null
        )
      }
      if (event?.query.queryKey[0] === "solution") {
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string
          thoughts: string[]
          time_complexity: string
          space_complexity: string
        } | null

        setSolutionData(solution?.code ?? null)
        setThoughtsData(solution?.thoughts ?? null)
        setTimeComplexityData(solution?.time_complexity ?? null)
        setSpaceComplexityData(solution?.space_complexity ?? null)
      }
    })
    return () => unsubscribe()
  }, [queryClient])

  // 浮层高度变化时重新计算窗口高度
  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  // 删除解答页上的额外截图，成功后重取列表
  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = extraScreenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        // 删除成功后重取截图列表
        const existing = await window.electronAPI.getScreenshots()
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now()
          })
        )
        setExtraScreenshots(screenshots)
      } else {
        console.error("删除额外截图失败：", response.error)
        showToast(t("ui.common.error"), t("ui.error.failedToDeleteScreenshot"), "error")
      }
    } catch (error) {
      console.error("删除额外截图时出错：", error)
      showToast(t("ui.common.error"), t("ui.error.failedToDeleteScreenshot"), "error")
    }
  }

  return (
    <>
      {!isResetting && queryClient.getQueryData(["new_solution"]) ? (
        <Debug
          isProcessing={debugProcessing}
          setIsProcessing={setDebugProcessing}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      ) : (
        <div ref={contentRef} className="relative">
          <div className="space-y-3 px-4 py-3">
          {/* 有解答数据时才展示截图缩略图 */}
          {solutionData && (
            <div className="bg-transparent w-fit">
              <div className="pb-3">
                <div className="space-y-3 w-fit">
                  <ScreenshotQueue
                    isLoading={debugProcessing}
                    screenshots={extraScreenshots}
                    onDeleteScreenshot={handleDeleteExtraScreenshot}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 命令栏（含快捷键浮层） */}
          <SolutionCommands
            onTooltipVisibilityChange={handleTooltipVisibilityChange}
            isProcessing={!problemStatementData || !solutionData}
            extraScreenshots={extraScreenshots}
            credits={credits}
            currentLanguage={currentLanguage}
            setLanguage={setLanguage}
          />

          {/* 主体内容 */}
          <div className="w-full text-sm text-black bg-black/60 rounded-md">
            <div className="rounded-lg overflow-hidden">
              <div className="px-4 py-3 space-y-4 max-w-full">
                {!solutionData && (
                  <>
                    <ContentSection
                      title={t("ui.solutions.problemStatement")}
                      content={problemStatementData?.problem_statement}
                      isLoading={!problemStatementData}
                      loadingText={t("ui.solutions.extracting")}
                    />
                    {problemStatementData && (
                      <div className="mt-4 flex">
                        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
                          {t("ui.solutions.generating")}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {solutionData && (
                  <>
                    <ContentSection
                      title={t("ui.solutions.thoughts", { key: COMMAND_KEY })}
                      content={
                        thoughtsData && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              {thoughtsData.map((thought, index) => (
                                <div
                                  key={index}
                                  className="flex items-start gap-2"
                                >
                                  <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
                                  <div>{thought}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      }
                      isLoading={!thoughtsData}
                      loadingText={t("ui.solutions.loading")}
                    />

                    <SolutionSection
                      title={t("ui.solutions.solutionTitle")}
                      content={solutionData}
                      isLoading={!solutionData}
                      currentLanguage={currentLanguage}
                    />

                    <ComplexitySection
                      timeComplexity={timeComplexityData}
                      spaceComplexity={spaceComplexityData}
                      isLoading={!timeComplexityData || !spaceComplexityData}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </>
  )
}

export default Solutions
