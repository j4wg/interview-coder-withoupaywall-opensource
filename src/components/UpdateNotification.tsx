import React, { useEffect, useState } from "react"
import { Dialog, DialogContent } from "./ui/dialog"
import { Button } from "./ui/button"
import { useToast } from "../contexts/toast"
import { useI18n } from "../contexts/i18n"

export const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const { showToast } = useToast()
  const { t } = useI18n()

  // 订阅主进程的更新事件：有新版本 / 新版本已下载完成
  useEffect(() => {
    console.log("更新提示：注册事件监听")

    const unsubscribeAvailable = window.electronAPI.onUpdateAvailable(
      (info) => {
        console.log("更新提示：收到有可用版本的广播", info)
        setUpdateAvailable(true)
      }
    )

    const unsubscribeDownloaded = window.electronAPI.onUpdateDownloaded(
      (info) => {
        console.log("更新提示：收到更新下载完成的广播", info)
        setUpdateDownloaded(true)
        setIsDownloading(false)
      }
    )

    return () => {
      console.log("更新提示：清理事件监听")
      unsubscribeAvailable()
      unsubscribeDownloaded()
    }
  }, [])

  // 开始下载更新包
  const handleStartUpdate = async () => {
    console.log("更新提示：开始下载更新")
    setIsDownloading(true)
    const result = await window.electronAPI.startUpdate()
    console.log("更新提示：下载结果", result)
    if (!result.success) {
      setIsDownloading(false)
      showToast(t("ui.common.error"), t("ui.error.failedToDownloadUpdate"), "error")
    }
  }

  // 重启并安装已下载的更新
  const handleInstallUpdate = () => {
    console.log("更新提示：开始安装更新")
    window.electronAPI.installUpdate()
  }

  console.log("更新提示：渲染状态", {
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
              ? t("ui.update.readyTitle")
              : t("ui.update.availableTitle")}
          </h2>
          <p className="text-sm text-white/70 mb-6">
            {updateDownloaded
              ? t("ui.update.readyDescription")
              : t("ui.update.availableDescription")}
          </p>
          <div className="flex justify-end gap-2">
            {updateDownloaded ? (
              <Button
                variant="outline"
                onClick={handleInstallUpdate}
                className="border-white/20 hover:bg-white/10"
              >
                {t("ui.update.restartAndInstall")}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleStartUpdate}
                disabled={isDownloading}
                className="border-white/20 hover:bg-white/10"
              >
                {isDownloading ? t("ui.update.downloading") : t("ui.update.download")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
