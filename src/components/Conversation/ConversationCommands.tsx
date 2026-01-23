/**
 * ConversationCommands - Command bar for conversation/recording features
 * Follows the same design pattern as QueueCommands and SolutionCommands
 */
import React, { useState, useEffect, useRef } from "react";
import { useToast } from "../../contexts/toast";
import { COMMAND_KEY } from "../../utils/platform";

interface ConversationCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void;
  isRecording: boolean;
  isProcessing: boolean;
  recordingDuration: number;
  currentSpeaker: 'interviewer' | 'interviewee';
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onToggleSpeaker: () => Promise<void>;
  onClearConversation: () => Promise<void>;
}

export const ConversationCommands: React.FC<ConversationCommandsProps> = ({
  onTooltipVisibilityChange,
  isRecording,
  isProcessing,
  recordingDuration,
  currentSpeaker,
  onStartRecording,
  onStopRecording,
  onToggleSpeaker,
  onClearConversation,
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let tooltipHeight = 0;
    if (tooltipRef.current && isTooltipVisible) {
      tooltipHeight = tooltipRef.current.offsetHeight + 10;
    }
    onTooltipVisibilityChange(isTooltipVisible, tooltipHeight);
  }, [isTooltipVisible, onTooltipVisibilityChange]);

  const handleMouseEnter = () => {
    setIsTooltipVisible(true);
  };

  const handleMouseLeave = () => {
    setIsTooltipVisible(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      await onStopRecording();
    } else {
      await onStartRecording();
    }
  };

  return (
    <div>
      <div className="pt-2 w-fit">
        <div className="text-xs text-white/90 backdrop-blur-md bg-black/60 rounded-lg py-2 px-4 flex items-center justify-center gap-4 flex-wrap">
          {/* Start/Stop Recording */}
          <div
            className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
            onClick={handleToggleRecording}
          >
            <span className="text-[11px] leading-none">
              {isRecording ? `Stop (${formatDuration(recordingDuration)})` : 'Start Recording'}
            </span>
            <div className="flex gap-1">
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                {COMMAND_KEY}
              </button>
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                M
              </button>
            </div>
          </div>

          {/* Toggle Speaker Mode */}
          <div
            className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onToggleSpeaker}
            style={{ opacity: isRecording ? 0.5 : 1, pointerEvents: isRecording ? 'none' : 'auto' }}
          >
            <span className="text-[11px] leading-none">
              {currentSpeaker === 'interviewer' ? 'Interviewer' : 'You'}
            </span>
            <div className="flex gap-1">
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                {COMMAND_KEY}
              </button>
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                Shift
              </button>
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                M
              </button>
            </div>
          </div>

          {/* Clear Conversation */}
          <div
            className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
            onClick={onClearConversation}
          >
            <span className="text-[11px] leading-none">Clear</span>
          </div>

          {/* Keyboard Shortcuts Tooltip Trigger */}
          <div
            className="relative flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <span className="text-[11px] leading-none">Shortcuts</span>

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
                      {/* Start/Stop Recording */}
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                        onClick={handleToggleRecording}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">Start/Stop Recording</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              M
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                          Record interview conversation for transcription.
                        </p>
                      </div>

                      {/* Toggle Speaker Mode */}
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                        onClick={onToggleSpeaker}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">Toggle Speaker Mode</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              Shift
                            </span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              M
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                          Switch between Interviewer and You mode.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {isProcessing && (
            <span className="text-[11px] text-white/70">Processing...</span>
          )}
        </div>
      </div>
    </div>
  );
};
