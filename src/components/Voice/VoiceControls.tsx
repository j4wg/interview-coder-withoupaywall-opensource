import React, { useState, useEffect } from "react";
import { useToast } from "../../contexts/toast";
import { COMMAND_KEY } from "../../utils/platform";

interface VoiceStatus {
  isListening: boolean;
  hasOpenAI: boolean;
}

interface VoiceControlsProps {
  className?: string;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  className = "",
}) => {
  const [status, setStatus] = useState<VoiceStatus>({
    isListening: false,
    hasOpenAI: false,
  });
  const [isStarting, setIsStarting] = useState(false);
  const [lastDetectedQuestion, setLastDetectedQuestion] = useState<
    string | null
  >(null);
  const { showToast } = useToast();

  // Update status on mount and periodically
  useEffect(() => {
    const updateStatus = async () => {
      try {
        const voiceStatus = await window.electronAPI.voiceGetStatus();
        setStatus(voiceStatus);
      } catch (error) {
        console.error("Voice: Error getting status:", error);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Set up voice event listeners
  useEffect(() => {
    const cleanupFunctions: (() => void)[] = [];

    // Listening started
    cleanupFunctions.push(
      window.electronAPI.onVoiceListeningStarted(() => {
        setStatus((prev) => ({ ...prev, isListening: true }));
        setIsStarting(false);
        showToast("Voice", "🎤 Voice listening started", "success");
      })
    );

    // Listening stopped
    cleanupFunctions.push(
      window.electronAPI.onVoiceListeningStopped(() => {
        setStatus((prev) => ({ ...prev, isListening: false }));
        setIsStarting(false);
        showToast("Voice", "🔇 Voice listening stopped", "neutral");
      })
    );

    // Question detected
    cleanupFunctions.push(
      window.electronAPI.onVoiceQuestionDetected((data: { text: string }) => {
        setLastDetectedQuestion(data.text);
        showToast(
          "Voice",
          `🗣️ Question detected: "${data.text.substring(0, 50)}..."`,
          "neutral"
        );

        // Clear the detected question after 10 seconds
        setTimeout(() => {
          setLastDetectedQuestion(null);
        }, 10000);
      })
    );

    // Error handling
    cleanupFunctions.push(
      window.electronAPI.onVoiceListeningError((error: string) => {
        setStatus((prev) => ({ ...prev, isListening: false }));
        setIsStarting(false);
        showToast("Voice Error", `🚫 Voice error: ${error}`, "error");
      })
    );

    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [showToast]);

  const handleStartListening = async () => {
    if (isStarting || status.isListening) return;

    setIsStarting(true);
    try {
      const result = await window.electronAPI.voiceStartListening();
      if (!result.success) {
        throw new Error(result.error || "Failed to start voice listening");
      }
    } catch (error: any) {
      setIsStarting(false);
      showToast(
        "Voice Error",
        `Failed to start voice listening: ${error.message}`,
        "error"
      );
    }
  };

  const handleStopListening = async () => {
    try {
      const result = await window.electronAPI.voiceStopListening();
      if (!result.success) {
        throw new Error(result.error || "Failed to stop voice listening");
      }
    } catch (error: any) {
      showToast(
        "Voice Error",
        `Failed to stop voice listening: ${error.message}`,
        "error"
      );
    }
  };

  if (!status.hasOpenAI) {
    return (
      <div className={`voice-controls-disabled ${className}`}>
        <div className="text-xs text-gray-400 bg-gray-900/50 rounded px-2 py-1">
          🎤 Voice: OpenAI required
        </div>
      </div>
    );
  }

  return (
    <div className={`voice-controls ${className}`}>
      <div className="flex items-center gap-2">
        {/* Voice Status Indicator */}
        <div className="flex items-center gap-1">
          <div
            className={`w-2 h-2 rounded-full ${
              status.isListening ? "bg-red-500 animate-pulse" : "bg-gray-500"
            }`}
          />
          <span className="text-xs text-gray-300">
            {status.isListening ? "Listening" : "Idle"}
          </span>
        </div>

        {/* Control Button */}
        {!status.isListening ? (
          <button
            onClick={handleStartListening}
            disabled={isStarting}
            className={`
              text-xs px-3 py-1 rounded transition-all duration-200
              ${
                isStarting
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }
            `}
          >
            {isStarting ? "🎤 Starting..." : "🎤 Start Listening"}
          </button>
        ) : (
          <button
            onClick={handleStopListening}
            className="text-xs px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white transition-all duration-200"
          >
            🔇 Stop Listening
          </button>
        )}
      </div>

      {/* Last Detected Question */}
      {lastDetectedQuestion && (
        <div className="mt-2 text-xs bg-blue-900/30 border border-blue-500/30 rounded p-2">
          <div className="text-blue-300 font-medium mb-1">
            🗣️ Last detected:
          </div>
          <div className="text-gray-300 break-words">
            "
            {lastDetectedQuestion.length > 100
              ? lastDetectedQuestion.substring(0, 100) + "..."
              : lastDetectedQuestion}
            "
          </div>
        </div>
      )}

      {/* Voice Instructions */}
      {status.isListening && (
        <div className="mt-2 text-xs text-gray-400 bg-gray-900/30 rounded p-2">
          💡 Speak clearly. Questions containing coding keywords will trigger
          analysis.
        </div>
      )}

      {/* Hotkey Information */}
      {!status.isListening && status.hasOpenAI && (
        <div className="mt-2 text-xs text-gray-400 bg-gray-900/20 rounded p-2">
          🔑 Press{" "}
          <span className="text-gray-300 font-mono">{COMMAND_KEY}+N</span> to
          start voice listening
        </div>
      )}
    </div>
  );
};
