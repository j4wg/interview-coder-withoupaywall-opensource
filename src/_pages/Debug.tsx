// Debug.tsx
import { useQuery, useQueryClient } from "@tanstack/react-query"
import React, { useEffect, useRef, useState, lazy, Suspense } from "react"
// Lazy load syntax highlighter to reduce initial bundle size
const SyntaxHighlighter = lazy(() => 
  import("react-syntax-highlighter").then(module => ({ 
    default: module.Prism 
  }))
)
import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
import SolutionCommands from "../components/Solutions/SolutionCommands"
import { Screenshot } from "../types/screenshots"
import { ComplexitySection, ContentSection } from "./Solutions"
import { useToast } from "../contexts/toast"

const CodeSection = ({
  title,
  code,
  isLoading,
  currentLanguage
}: {
  title: string
  code: React.ReactNode
  isLoading: boolean
  currentLanguage: string
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide"></h2>
    {isLoading ? (
      <div className="space-y-1.5">
        <div className="mt-4 flex">
          <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
            Loading solutions...
          </p>
        </div>
      </div>
    ) : (
      <div className="w-full">
        <Suspense fallback={<div className="text-white/60 text-sm">Loading syntax highlighter...</div>}>
          <SyntaxHighlighter
            showLineNumbers
            language={currentLanguage == "golang" ? "go" : currentLanguage}
            style={(() => {
              // Dynamically import style to reduce initial bundle size
              // This will be code-split by Vite
              try {
                const styleModule = require("react-syntax-highlighter/dist/esm/styles/prism")
                return styleModule.dracula || {}
              } catch {
                return {}
              }
            })()}
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
        </Suspense>
      </div>
    )}
  </div>
)

async function fetchScreenshots(): Promise<Screenshot[]> {
  try {
    const existing = await window.electronAPI.getScreenshots()
    console.log("Raw screenshot data in Debug:", existing)
    return (Array.isArray(existing) ? existing : []).map((p) => ({
      id: p.path,
      path: p.path,
      preview: p.preview,
      timestamp: Date.now()
    }))
  } catch (error) {
    console.error("Error loading screenshots:", error)
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
    // Try to get the new solution data from cache first
    const newSolution = queryClient.getQueryData(["new_solution"]) as {
      code: string
      debug_analysis: string
      thoughts: string[]
      time_complexity: string
      space_complexity: string
    } | null

    // If we have cached data, set all state variables to the cached data
    if (newSolution) {
      console.log("Found cached debug solution:", newSolution);
      
      if (newSolution.debug_analysis) {
        // Store the debug analysis in its own state variable
        setDebugAnalysis(newSolution.debug_analysis);
        // Set code separately for the code section
        setNewCode(newSolution.code || "// Debug mode - see analysis below");
        
        // Process thoughts/analysis points
        if (newSolution.debug_analysis.includes('\n\n')) {
          const sections = newSolution.debug_analysis.split('\n\n').filter(Boolean);
          // Pick first few sections as thoughts
          setThoughtsData(sections.slice(0, 3));
        } else {
          setThoughtsData(["Debug analysis based on your screenshots"]);
        }
      } else {
        // Fallback to code or default
        setNewCode(newSolution.code || "// No analysis available");
        setThoughtsData(newSolution.thoughts || ["Debug analysis based on your screenshots"]);
      }
      setTimeComplexityData(newSolution.time_complexity || "N/A - Debug mode")
      setSpaceComplexityData(newSolution.space_complexity || "N/A - Debug mode")
      setIsProcessing(false)
    }

    // Set up event listeners
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onDebugSuccess((data) => {
        console.log("Debug success event received with data:", data);
        queryClient.setQueryData(["new_solution"], data);
        
        // Also update local state for immediate rendering
        if (data.debug_analysis) {
          // Store the debug analysis in its own state variable
          setDebugAnalysis(data.debug_analysis);
          // Set code separately for the code section
          setNewCode(data.code || "// Debug mode - see analysis below");
          
          // Process thoughts/analysis points
          if (data.debug_analysis.includes('\n\n')) {
            const sections = data.debug_analysis.split('\n\n').filter(Boolean);
            // Pick first few sections as thoughts
            setThoughtsData(sections.slice(0, 3));
          } else if (data.debug_analysis.includes('\n')) {
            // Try to find bullet points or numbered lists
            const lines = data.debug_analysis.split('\n');
            const bulletPoints = lines.filter(line => 
              line.trim().match(/^[\d*\-•]+\s/) || 
              line.trim().match(/^[A-Z][\d\.\)\:]/) ||
              line.includes(':') && line.length < 100
            );
            
            if (bulletPoints.length > 0) {
              setThoughtsData(bulletPoints.slice(0, 5));
            } else {
              setThoughtsData(["Debug analysis based on your screenshots"]);
            }
          } else {
            setThoughtsData(["Debug analysis based on your screenshots"]);
          }
        } else {
          // Fallback to code or default
          setNewCode(data.code || "// No analysis available");
          setThoughtsData(data.thoughts || ["Debug analysis based on your screenshots"]);
          setDebugAnalysis(null);
        }
        setTimeComplexityData(data.time_complexity || "N/A - Debug mode");
        setSpaceComplexityData(data.space_complexity || "N/A - Debug mode");
        
        setIsProcessing(false);
      }),
      
      window.electronAPI.onDebugStart(() => {
        setIsProcessing(true)
      }),
      window.electronAPI.onDebugError((error: string) => {
        showToast(
          "Processing Failed",
          "There was an error debugging your code.",
          "error"
        )
        setIsProcessing(false)
        console.error("Processing error:", error)
      })
    ]

    // Set up resize observer
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
  }, [queryClient, setIsProcessing])

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setTooltipVisible(visible)
    setTooltipHeight(height)
  }

  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        refetch()
      } else {
        console.error("Failed to delete extra screenshot:", response.error)
      }
    } catch (error) {
      console.error("Error deleting extra screenshot:", error)
    }
  }

  return (
    <div ref={contentRef} className="relative">
      <div className="space-y-3 px-4 py-3">
      {/* Conditionally render the screenshot queue */}
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

      {/* Navbar of commands with the tooltip */}
      <SolutionCommands
        screenshots={screenshots}
        onTooltipVisibilityChange={handleTooltipVisibilityChange}
        isProcessing={isProcessing}
        extraScreenshots={screenshots}
        credits={window.__CREDITS__}
        currentLanguage={currentLanguage}
        setLanguage={setLanguage}
      />

      {/* Main Content */}
      <div className="w-full text-sm text-black bg-black/60 rounded-md">
        <div className="rounded-lg overflow-hidden">
          <div className="px-4 py-3 space-y-4">
            {/* Thoughts Section */}
            <ContentSection
              title="What I Changed"
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
            />

            {/* Code Section */}
            <CodeSection
              title="Original Code"
              code={newCode}
              isLoading={!newCode}
              currentLanguage={currentLanguage}
            />
            
            {/* Debug Analysis Section */}
            <div className="space-y-2">
              <h2 className="text-[13px] font-medium text-white tracking-wide">Analysis & Improvements</h2>
              {!debugAnalysis ? (
                <div className="space-y-1.5">
                  <div className="mt-4 flex">
                    <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
                      Loading debug analysis...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full bg-black/30 rounded-md p-4 text-[13px] leading-[1.4] text-gray-100 whitespace-pre-wrap overflow-auto max-h-[600px]">
                  {/* Process the debug analysis text by sections and lines */}
                  {(() => {
                    // First identify key sections based on common patterns in the debug output
                    const sections = [];
                    let currentSection = { title: '', content: [] };
                    
                    // Split by possible section headers (### or ##)
                    const mainSections = debugAnalysis.split(/(?=^#{1,3}\s|^\*\*\*|^\s*[A-Z][\w\s]+\s*$)/m);
                    
                    // Filter out empty sections and process each one
                    mainSections.filter(Boolean).forEach(sectionText => {
                      // First line might be a header
                      const lines = sectionText.split('\n');
                      let title = '';
                      let startLineIndex = 0;
                      
                      // Check if first line is a header
                      if (lines[0] && (lines[0].startsWith('#') || lines[0].startsWith('**') || 
                          lines[0].match(/^[A-Z][\w\s]+$/) || lines[0].includes('Issues') || 
                          lines[0].includes('Improvements') || lines[0].includes('Optimizations'))) {
                        title = lines[0].replace(/^#+\s*|\*\*/g, '');
                        startLineIndex = 1;
                      }
                      
                      // Add the section
                      sections.push({
                        title,
                        content: lines.slice(startLineIndex).filter(Boolean)
                      });
                    });
                    
                    // Render the processed sections
                    return sections.map((section, sectionIndex) => (
                      <div key={sectionIndex} className="mb-6">
                        {section.title && (
                          <div className="font-bold text-white/90 text-[14px] mb-2 pb-1 border-b border-white/10">
                            {section.title}
                          </div>
                        )}
                        <div className="pl-1">
                          {section.content.map((line, lineIndex) => {
                            // Handle code blocks - detect full code blocks
                            if (line.trim().startsWith('```')) {
                              // If we find the start of a code block, collect all lines until the end
                              if (line.trim() === '```' || line.trim().startsWith('```')) {
                                // Find end of this code block
                                const codeBlockEndIndex = section.content.findIndex(
                                  (l, i) => i > lineIndex && l.trim() === '```'
                                );
                                
                                if (codeBlockEndIndex > lineIndex) {
                                  // Extract language if specified
                                  const langMatch = line.trim().match(/```(\w+)/);
                                  const language = langMatch ? langMatch[1] : '';
                                  
                                  // Get the code content
                                  const codeContent = section.content
                                    .slice(lineIndex + 1, codeBlockEndIndex)
                                    .join('\n');
                                  
                                  // Skip ahead in our loop
                                  lineIndex = codeBlockEndIndex;
                                  
                                  return (
                                    <div key={lineIndex} className="font-mono text-xs bg-black/50 p-3 my-2 rounded overflow-x-auto">
                                      {codeContent}
                                    </div>
                                  );
                                }
                              }
                            }
                            
                            // Handle bullet points
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
                            
                            // Handle inline code
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
                            
                            // Handle sub-headers
                            if (line.trim().match(/^#+\s/) || (line.trim().match(/^[A-Z][\w\s]+:/) && line.length < 60)) {
                              return (
                                <div key={lineIndex} className="font-semibold text-white/80 mt-3 mb-1">
                                  {line.replace(/^#+\s+/, '')}
                                </div>
                              );
                            }
                            
                            // Regular text
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
