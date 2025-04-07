import React, { useEffect, useState } from "react"
import { useToast } from "../contexts/toast"

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

export const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    console.log("UpdateNotification: Setting up event listeners")

    const unsubscribeAvailable = window.electronAPI.onUpdateAvailable(
      (info: UpdateInfo) => {
        console.log("UpdateNotification: Update available received", info)
        setUpdateAvailable(true)
        showToast("Update Available", "A new version is available. The app will update on next restart.", "neutral")
      }
    )

    const unsubscribeDownloaded = window.electronAPI.onUpdateDownloaded(
      (info: UpdateInfo) => {
        console.log("UpdateNotification: Update downloaded received", info)
        setUpdateDownloaded(true)
        setIsDownloading(false)
        showToast("Update Ready", "Update downloaded. The app will update on next restart.", "neutral")
      }
    )

    return () => {
      console.log("UpdateNotification: Cleaning up event listeners")
      unsubscribeAvailable()
      unsubscribeDownloaded()
    }
  }, [showToast])

  const handleStartUpdate = async () => {
    console.log("UpdateNotification: Starting update download")
    setIsDownloading(true)
    const result = await window.electronAPI.startUpdate()
    console.log("UpdateNotification: Update download result", result)
    if (!result.success) {
      setIsDownloading(false)
      showToast("Error", "Failed to download update", "error")
    }
  }

  const handleInstallUpdate = () => {
    console.log("UpdateNotification: Installing update")
    window.electronAPI.installUpdate()
  }

  // Return null to prevent any UI from showing
  return null
}
