import React, { useEffect, useRef, useState } from "react"
import { useToast } from "../../contexts/toast"
import { supabase } from "../../lib/supabase"
import { Screenshot } from "../../types/screenshots"
import { COMMAND_KEY } from "../../utils/platform"
import { LanguageSelector } from "../shared/LanguageSelector"

export interface SolutionCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void
  isProcessing: boolean
  screenshots?: Screenshot[]
  extraScreenshots?: Screenshot[]
  currentLanguage: string
  setLanguage: (language: string) => void
}

const handleSignOut = async () => {
  try {
    // Clear any local storage or electron-specific data first
    localStorage.clear()
    sessionStorage.clear()

    // Then sign out from Supabase
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  } catch (err) {
    console.error("Error signing out:", err)
  }
}

const SolutionCommands: React.FC<SolutionCommandsProps> = ({
  onTooltipVisibilityChange,
  isProcessing,
  extraScreenshots = [],
  currentLanguage,
  setLanguage
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()

  useEffect(() => {
    if (onTooltipVisibilityChange) {
      let tooltipHeight = 0
      if (tooltipRef.current && isTooltipVisible) {
        tooltipHeight = tooltipRef.current.offsetHeight + 10 // Adjust if necessary
      }
      onTooltipVisibilityChange(isTooltipVisible, tooltipHeight)
    }
  }, [isTooltipVisible, onTooltipVisibilityChange])

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
          {/* Show/Hide - Always visible */}
          <div
            className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
            onClick={async () => {
              try {
                const result = await window.electronAPI.toggleMainWindow()
                if (!result.success) {
                  console.error("Failed to toggle window:", result.error)
                  showToast("Error", "Failed to toggle window", "error")
                }
              } catch (error) {
                console.error("Error toggling window:", error)
                showToast("Error", "Failed to toggle window", "error")
              }
            }}
          >
            <span className="text-[11px] leading-none">Show/Hide</span>
            <div className="flex gap-1">
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                {COMMAND_KEY}
              </button>
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                B
              </button>
            </div>
          </div>

          {/* Screenshot and Debug commands - Only show if not processing */}
          {!isProcessing && (
            <>
              <div
                className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                onClick={async () => {
                  try {
                    const result = await window.electronAPI.triggerScreenshot()
                    if (!result.success) {
                      console.error("Failed to take screenshot:", result.error)
                      showToast("Error", "Failed to take screenshot", "error")
                    }
                  } catch (error) {
                    console.error("Error taking screenshot:", error)
                    showToast("Error", "Failed to take screenshot", "error")
                  }
                }}
              >
                <span className="text-[11px] leading-none truncate">
                  {extraScreenshots.length === 0
                    ? "Screenshot your code"
                    : "Screenshot"}
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

              {extraScreenshots.length > 0 && (
                <div
                  className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                  onClick={async () => {
                    try {
                      const result =
                        await window.electronAPI.triggerProcessScreenshots()
                      if (!result.success) {
                        console.error(
                          "Failed to process screenshots:",
                          result.error
                        )
                        showToast(
                          "Error",
                          "Failed to process screenshots",
                          "error"
                        )
                      }
                    } catch (error) {
                      console.error("Error processing screenshots:", error)
                      showToast(
                        "Error",
                        "Failed to process screenshots",
                        "error"
                      )
                    }
                  }}
                >
                  <span className="text-[11px] leading-none">Debug</span>
                  <div className="flex gap-1">
                    <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                      {COMMAND_KEY}
                    </button>
                    <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                      ↵
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Start Over - Always visible */}
          <div
            className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
            onClick={async () => {
              try {
                const result = await window.electronAPI.triggerReset()
                if (!result.success) {
                  console.error("Failed to reset:", result.error)
                  showToast("Error", "Failed to reset", "error")
                }
              } catch (error) {
                console.error("Error resetting:", error)
                showToast("Error", "Failed to reset", "error")
              }
            }}
          >
            <span className="text-[11px] leading-none">Start Over</span>
            <div className="flex gap-1">
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                {COMMAND_KEY}
              </button>
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                R
              </button>
            </div>
          </div>

          {/* Separator */}
          <div className="mx-2 h-4 w-px bg-white/20" />

          {/* Settings with Tooltip */}
          <div
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Gear icon */}
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
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>

            {/* Tooltip Content */}
            {isTooltipVisible && (
              <div
                ref={tooltipRef}
                className="absolute top-full right-0 mt-2 w-80"
                style={{ zIndex: 100 }}
              >
                {/* Add transparent bridge */}
                <div className="absolute -top-2 right-0 w-full h-2" />
                <div className="p-3 text-xs bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-white/90 shadow-lg">
                  <div className="space-y-4">
                    <h3 className="font-medium whitespace-nowrap">
                      Keyboard Shortcuts
                    </h3>
                    <div className="space-y-3">
                      {/* Show/Hide - Always visible */}
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                        onClick={async () => {
                          try {
                            const result =
                              await window.electronAPI.toggleMainWindow()
                            if (!result.success) {
                              console.error(
                                "Failed to toggle window:",
                                result.error
                              )
                              showToast(
                                "Error",
                                "Failed to toggle window",
                                "error"
                              )
                            }
                          } catch (error) {
                            console.error("Error toggling window:", error)
                            showToast(
                              "Error",
                              "Failed to toggle window",
                              "error"
                            )
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">Toggle Window</span>
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
                          Show or hide this window.
                        </p>
                      </div>

                      {/* Screenshot and Debug commands - Only show if not processing */}
                      {!isProcessing && (
                        <>
                          <div
                            className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                            onClick={async () => {
                              try {
                                const result =
                                  await window.electronAPI.triggerScreenshot()
                                if (!result.success) {
                                  console.error(
                                    "Failed to take screenshot:",
                                    result.error
                                  )
                                  showToast(
                                    "Error",
                                    "Failed to take screenshot",
                                    "error"
                                  )
                                }
                              } catch (error) {
                                console.error("Error taking screenshot:", error)
                                showToast(
                                  "Error",
                                  "Failed to take screenshot",
                                  "error"
                                )
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">Take Screenshot</span>
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
                              Capture additional parts of the question or your
                              solution for debugging help.
                            </p>
                          </div>

                          {extraScreenshots.length > 0 && (
                            <div
                              className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                              onClick={async () => {
                                try {
                                  const result =
                                    await window.electronAPI.triggerProcessScreenshots()
                                  if (!result.success) {
                                    console.error(
                                      "Failed to process screenshots:",
                                      result.error
                                    )
                                    showToast(
                                      "Error",
                                      "Failed to process screenshots",
                                      "error"
                                    )
                                  }
                                } catch (error) {
                                  console.error(
                                    "Error processing screenshots:",
                                    error
                                  )
                                  showToast(
                                    "Error",
                                    "Failed to process screenshots",
                                    "error"
                                  )
                                }
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="truncate">Debug</span>
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
                                Generate new solutions based on all previous and
                                newly added screenshots.
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      {/* Start Over - Always visible */}
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                        onClick={async () => {
                          try {
                            const result =
                              await window.electronAPI.triggerReset()
                            if (!result.success) {
                              console.error("Failed to reset:", result.error)
                              showToast("Error", "Failed to reset", "error")
                            }
                          } catch (error) {
                            console.error("Error resetting:", error)
                            showToast("Error", "Failed to reset", "error")
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">Start Over</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              R
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                          Start fresh with a new question.
                        </p>
                      </div>
                    </div>

                    {/* Separator and Log Out */}
                    <div className="pt-3 mt-3 border-t border-white/10">
                      <LanguageSelector
                        currentLanguage={currentLanguage}
                        setLanguage={setLanguage}
                      />

                      {/* API Key Settings */}
                      <div className="mb-3 px-2 space-y-1">
                        <div className="flex items-center justify-between text-[13px] font-medium text-white/90">
                          <span>OpenAI API Settings</span>
                          <button
                            className="bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-[11px]"
                            onClick={() => window.electronAPI.openSettingsPortal()}
                          >
                            Settings
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
                        Log Out
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

export default SolutionCommands
