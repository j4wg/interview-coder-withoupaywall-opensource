import React, { useEffect, useState } from "react"
import { Dialog, DialogContent } from "./ui/dialog"
import { Button } from "./ui/button"
import { useToast } from "../contexts/toast"

export const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    console.log("UpdateNotification: Setting up event listeners")

    const unsubscribeAvailable = window.electronAPI.onUpdateAvailable(
      (info: any) => {
        console.log("UpdateNotification: Update available received", info)
        setUpdateAvailable(true)
      }
    )

    const unsubscribeDownloaded = window.electronAPI.onUpdateDownloaded(
      (info: any) => {
        console.log("UpdateNotification: Update downloaded received", info)
        setUpdateDownloaded(true)
        setIsDownloading(false)
      }
    )

    return () => {
      console.log("UpdateNotification: Cleaning up event listeners")
      unsubscribeAvailable()
      unsubscribeDownloaded()
    }
  }, [])

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

  console.log("UpdateNotification: Render state", {
    updateAvailable,
    updateDownloaded,
    isDownloading
  })
  if (!updateAvailable && !updateDownloaded) return null

  return (
    <Dialog open={true}>
      <DialogContent
        className="bg-black/90 text-white border-white/20"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">
            {updateDownloaded
              ? "Update Ready to Install"
              : "A New Version is Available"}
          </h2>
          <p className="text-sm text-white/70 mb-6">
            {updateDownloaded
              ? "The update has been downloaded and will be installed when you restart the app."
              : "A new version of Interview Coder is available. Please update to continue using the app."}
          </p>
          <div className="flex justify-end gap-2">
            {updateDownloaded ? (
              <Button
                variant="outline"
                onClick={handleInstallUpdate}
                className="border-white/20 hover:bg-white/10"
              >
                Restart and Install
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleStartUpdate}
                disabled={isDownloading}
                className="border-white/20 hover:bg-white/10"
              >
                {isDownloading ? "Downloading..." : "Download Update"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
