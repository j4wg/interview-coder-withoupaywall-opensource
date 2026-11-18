// 调试页：在已有解答基础上，带新截图重新生成
import { useQuery, useQueryClient } from "@tanstack/react-query"
import React, { useEffect, useRef, useState } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"
import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
import SolutionCommands from "../components/Solutions/SolutionCommands"
import { Screenshot } from "../types/screenshots"
import { ComplexitySection, ContentSection } from "./Solutions"
import { useToast } from "../contexts/toast"
import { useI18n } from "../contexts/i18n"

const CodeSection = ({
  title,
  code,
  isLoading,
  currentLanguage,
  loadingText
}: {
  title: string
  code: React.ReactNode
  isLoading: boolean
  currentLanguage: string
  loadingText: string
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide"></h2>
    {isLoading ? (
      <div className="space-y-1.5">
        <div className="mt-4 flex">
          <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
            {loadingText}
          </p>
        </div>
      </div>
    ) : (
      <div className="w-full">
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
          {code as string}
        </SyntaxHighlighter>
      </div>
    )}
  </div>
)

// 读取当前截图列表
async function fetchScreenshots(): Promise<Screenshot[]> {
  try {
    const existing = await window.electronAPI.getScreenshots()
    console.log("调试页原始截图数据：", existing)
    return (Array.isArray(existing) ? existing : []).map((p) => ({
      id: p.path,
      path: p.path,
      preview: p.preview,
      timestamp: Date.now()
    }))
  } catch (error) {
    console.error("加载截图失败：", error)
    throw error
  }
}

interface DebugProps {
  isProcessing: boolean
  setIsProcessing: (isProcessing: boolean) => void
  currentLanguage: string
  setLanguage: (language: string) => void
}

const Debug: React.FC<DebugProps> = ({
  isProcessing,
  setIsProcessing,
  currentLanguage,
  setLanguage
}) => {
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)
  const { showToast } = useToast()
  const { t } = useI18n()

  const { data: screenshots = [], refetch } = useQuery<Screenshot[]>({
    queryKey: ["screenshots"],
    queryFn: fetchScreenshots,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false
  })

  const [newCode, setNewCode] = useState<string | null>(null)
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null)
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(
    null
  )
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(
    null
  )
  const [debugAnalysis, setDebugAnalysis] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 优先从缓存里取上一次的调试结果
    const newSolution = queryClient.getQueryData(["new_solution"]) as {
      code: string
      debug_analysis: string
      thoughts: string[]
      time_complexity: string
      space_complexity: string
    } | null

    // 有缓存就整体回填，避免页面空白
    if (newSolution) {
      console.log("命中缓存的调试结果：", newSolution);

      if (newSolution.debug_analysis) {
        setDebugAnalysis(newSolution.debug_analysis);
        // 代码区块单独存一份
        setNewCode(
          newSolution.code || t("ui.debug.placeholder.seeAnalysis")
        );

        // 分析文本按空行切段，前几段作为"我改了什么"展示
        if (newSolution.debug_analysis.includes('\n\n')) {
          const sections = newSolution.debug_analysis.split('\n\n').filter(Boolean);
          setThoughtsData(sections.slice(0, 3));
        } else {
          setThoughtsData([t("ui.debug.fallbackThoughts")]);
        }
      } else {
        // 分析文本缺失时只展示代码
        setNewCode(newSolution.code || t("ui.debug.placeholder.noAnalysis"));
        setThoughtsData(newSolution.thoughts || [t("ui.debug.fallbackThoughts")]);
      }
      setTimeComplexityData(newSolution.time_complexity || t("ui.debug.notAvailable"))
      setSpaceComplexityData(newSolution.space_complexity || t("ui.debug.notAvailable"))
      setIsProcessing(false)
    }

    // 订阅截图/调试相关事件
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onDebugSuccess((data) => {
        console.log("收到调试成功事件，数据：", data);
        queryClient.setQueryData(["new_solution"], data);

        // 同时回填本地状态，保证立即渲染
        if (data.debug_analysis) {
          setDebugAnalysis(data.debug_analysis);
          setNewCode(data.code || t("ui.debug.placeholder.seeAnalysis"));

          if (data.debug_analysis.includes('\n\n')) {
            const sections = data.debug_analysis.split('\n\n').filter(Boolean);
            setThoughtsData(sections.slice(0, 3));
          } else if (data.debug_analysis.includes('\n')) {
            // 退化场景：按列表项/冒号行挑出要点
            const lines = data.debug_analysis.split('\n');
            const bulletPoints = lines.filter(line =>
              line.trim().match(/^[\d*\-•]+\s/) ||
              line.trim().match(/^[A-Z][\d\.\)\:]/) ||
              (line.includes(':') && line.length < 100)
            );

            if (bulletPoints.length > 0) {
              setThoughtsData(bulletPoints.slice(0, 5));
            } else {
              setThoughtsData([t("ui.debug.fallbackThoughts")]);
            }
          } else {
            setThoughtsData([t("ui.debug.fallbackThoughts")]);
          }
        } else {
          setNewCode(data.code || t("ui.debug.placeholder.noAnalysis"));
          setThoughtsData(data.thoughts || [t("ui.debug.fallbackThoughts")]);
          setDebugAnalysis(null);
        }
        setTimeComplexityData(data.time_complexity || t("ui.debug.notAvailable"));
        setSpaceComplexityData(data.space_complexity || t("ui.debug.notAvailable"));

        setIsProcessing(false);
      }),
      
      window.electronAPI.onDebugStart(() => {
        setIsProcessing(true)
      }),
      window.electronAPI.onDebugError((error: string) => {
        showToast(
          t("ui.error.processingFailed"),
          t("ui.error.debugDescription"),
          "error"
        )
        setIsProcessing(false)
        console.error("处理出错：", error)
      })
    ]

    // 内容高度同步给主进程
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight
        const contentWidth = contentRef.current.scrollWidth
        if (tooltipVisible) {
          contentHeight += tooltipHeight
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight
        })
      }
    }

    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [queryClient, setIsProcessing, t])

  // 浮层高度变化时重新计算窗口高度
  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setTooltipVisible(visible)
    setTooltipHeight(height)
  }

  // 删除额外截图，成功后重取列表
  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        refetch()
      } else {
        console.error("删除额外截图失败：", response.error)
      }
    } catch (error) {
      console.error("删除额外截图时出错：", error)
    }
  }

  return (
    <div ref={contentRef} className="relative">
      <div className="space-y-3 px-4 py-3">
      {/* 截图缩略图区 */}
      <div className="bg-transparent w-fit">
        <div className="pb-3">
          <div className="space-y-3 w-fit">
            <ScreenshotQueue
              screenshots={screenshots}
              onDeleteScreenshot={handleDeleteExtraScreenshot}
              isLoading={isProcessing}
            />
          </div>
        </div>
      </div>

      {/* 命令栏（含快捷键浮层） */}
      <SolutionCommands
        screenshots={screenshots}
        onTooltipVisibilityChange={handleTooltipVisibilityChange}
        isProcessing={isProcessing}
        extraScreenshots={screenshots}
        credits={window.__CREDITS__}
        currentLanguage={currentLanguage}
        setLanguage={setLanguage}
      />

      {/* 主体内容 */}
      <div className="w-full text-sm text-black bg-black/60 rounded-md">
        <div className="rounded-lg overflow-hidden">
          <div className="px-4 py-3 space-y-4">
            {/* "我改了什么"区块 */}
            <ContentSection
              title={t("ui.debug.whatIChanged")}
              content={
                thoughtsData && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      {thoughtsData.map((thought, index) => (
                        <div key={index} className="flex items-start gap-2">
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

            {/* 代码区块 */}
            <CodeSection
              title={t("ui.debug.originalCode")}
              code={newCode}
              isLoading={!newCode}
              currentLanguage={currentLanguage}
              loadingText={t("ui.solutions.loading")}
            />
            
            {/* 调试分析区块 */}
            <div className="space-y-2">
              <h2 className="text-[13px] font-medium text-white tracking-wide">{t("ui.debug.analysis")}</h2>
              {!debugAnalysis ? (
                <div className="space-y-1.5">
                  <div className="mt-4 flex">
                    <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
                      {t("ui.debug.loadingAnalysis")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full bg-black/30 rounded-md p-4 text-[13px] leading-[1.4] text-gray-100 whitespace-pre-wrap overflow-auto max-h-[600px]">
                  {/* 按章节/行解析调试分析文本 */}
                  {(() => {
                    // 先按模型输出里的常见标记切分章节
                    const sections = [];
                    let currentSection = { title: '', content: [] };
                    
                    // 按可能的章节标题（### / ##）切分
                    const mainSections = debugAnalysis.split(/(?=^#{1,3}\s|^\*\*\*|^\s*[A-Z][\w\s]+\s*$)/m);
                    
                    // 过滤空章节后逐个处理
                    mainSections.filter(Boolean).forEach(sectionText => {
                      // 首行可能是章节标题
                      const lines = sectionText.split('\n');
                      let title = '';
                      let startLineIndex = 0;
                      
                      // 判断首行是否为标题
                      if (lines[0] && (lines[0].startsWith('#') || lines[0].startsWith('**') || 
                          lines[0].match(/^[A-Z][\w\s]+$/) || lines[0].includes('Issues') || 
                          lines[0].includes('Improvements') || lines[0].includes('Optimizations'))) {
                        title = lines[0].replace(/^#+\s*|\*\*/g, '');
                        startLineIndex = 1;
                      }
                      
                      // 记录该章节
                      sections.push({
                        title,
                        content: lines.slice(startLineIndex).filter(Boolean)
                      });
                    });
                    
                    // 渲染切分后的章节
                    return sections.map((section, sectionIndex) => (
                      <div key={sectionIndex} className="mb-6">
                        {section.title && (
                          <div className="font-bold text-white/90 text-[14px] mb-2 pb-1 border-b border-white/10">
                            {section.title}
                          </div>
                        )}
                        <div className="pl-1">
                          {section.content.map((line, lineIndex) => {
                            // 代码块：整段识别，不按行拆分
                            if (line.trim().startsWith('```')) {
                              // 遇到代码块起始标记后，收集到结束标记为止
                              if (line.trim() === '```' || line.trim().startsWith('```')) {
                                // 找到该代码块的结束位置
                                const codeBlockEndIndex = section.content.findIndex(
                                  (l, i) => i > lineIndex && l.trim() === '```'
                                );
                                
                                if (codeBlockEndIndex > lineIndex) {
                                  // 取出代码块语言（可能未标注）
                                  const langMatch = line.trim().match(/```(\w+)/);
                                  const language = langMatch ? langMatch[1] : '';
                                  
                                  // 取出代码内容
                                  const codeContent = section.content
                                    .slice(lineIndex + 1, codeBlockEndIndex)
                                    .join('\n');
                                  
                                  // 跳过已消费的行
                                  lineIndex = codeBlockEndIndex;
                                  
                                  return (
                                    <div key={lineIndex} className="font-mono text-xs bg-black/50 p-3 my-2 rounded overflow-x-auto">
                                      {codeContent}
                                    </div>
                                  );
                                }
                              }
                            }
                            
                            // 列表项
                            if (line.trim().match(/^[\-*•]\s/) || line.trim().match(/^\d+\.\s/)) {
                              return (
                                <div key={lineIndex} className="flex items-start gap-2 my-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400/80 mt-2 shrink-0" />
                                  <div className="flex-1">
                                    {line.replace(/^[\-*•]\s|^\d+\.\s/, '')}
                                  </div>
                                </div>
                              );
                            }
                            
                            // 行内代码
                            if (line.includes('`')) {
                              const parts = line.split(/(`[^`]+`)/g);
                              return (
                                <div key={lineIndex} className="my-1.5">
                                  {parts.map((part, partIndex) => {
                                    if (part.startsWith('`') && part.endsWith('`')) {
                                      return <span key={partIndex} className="font-mono bg-black/30 px-1 py-0.5 rounded">{part.slice(1, -1)}</span>;
                                    }
                                    return <span key={partIndex}>{part}</span>;
                                  })}
                                </div>
                              );
                            }
                            
                            // 子标题
                            if (line.trim().match(/^#+\s/) || (line.trim().match(/^[A-Z][\w\s]+:/) && line.length < 60)) {
                              return (
                                <div key={lineIndex} className="font-semibold text-white/80 mt-3 mb-1">
                                  {line.replace(/^#+\s+/, '')}
                                </div>
                              );
                            }
                            
                            // 普通文本
                            return <div key={lineIndex} className="my-1.5">{line}</div>;
                          })}
                        </div>
                      </div>
                    ));
                  })()} 
                </div>
              )}
            </div>

            {/* Complexity Section */}
            <ComplexitySection
              timeComplexity={timeComplexityData}
              spaceComplexity={spaceComplexityData}
              isLoading={!timeComplexityData || !spaceComplexityData}
            />
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}

export default Debug
