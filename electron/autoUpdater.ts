import { autoUpdater } from "electron-updater"
import { BrowserWindow, ipcMain, app } from "electron"
import log from "electron-log"
import { mainT } from "./i18n/mainT"

// 主进程翻译器：每次调用都实时解析当前界面语言
const t = mainT("main")

export function initAutoUpdater() {
  console.log(t("main.update.initializing"))

  // 开发模式下跳过更新检查
  if (!app.isPackaged) {
    console.log(t("main.update.skipDev"))
    return
  }

  if (!process.env.GH_TOKEN) {
    console.error(t("main.error.ghTokenMissing"))
    return
  }

  // 配置自动更新
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = true
  autoUpdater.allowPrerelease = true

  // 打开更详细的日志
  autoUpdater.logger = log
  log.transports.file.level = "debug"
  console.log(
    t("main.update.loggerConfigured", {
      level: String(log.transports.file.level)
    })
  )

  // 记录所有更新事件
  autoUpdater.on("checking-for-update", () => {
    console.log(t("main.update.checking"))
  })

  autoUpdater.on("update-available", (info) => {
    console.log(t("main.update.available"), info)
    // 通知渲染层有新版本可用
    BrowserWindow.getAllWindows().forEach((window) => {
      console.log(t("main.update.sendingAvailable"))
      window.webContents.send("update-available", info)
    })
  })

  autoUpdater.on("update-not-available", (info) => {
    console.log(t("main.update.notAvailable"), info)
  })

  autoUpdater.on("download-progress", (progressObj) => {
    console.log(t("main.update.downloadProgress"), progressObj)
  })

  autoUpdater.on("update-downloaded", (info) => {
    console.log(t("main.update.downloaded"), info)
    // 通知渲染层更新已就绪，可安装
    BrowserWindow.getAllWindows().forEach((window) => {
      console.log(t("main.update.sendingDownloaded"))
      window.webContents.send("update-downloaded", info)
    })
  })

  autoUpdater.on("error", (err) => {
    console.error(t("main.error.updater"), err)
  })

  // 立即检查一次更新
  console.log(t("main.update.checking"))
  autoUpdater
    .checkForUpdates()
    .then((result) => {
      console.log(t("main.update.checkResult"), result)
    })
    .catch((err) => {
      console.error(t("main.error.checkFailed"), err)
    })

  // 定时检查更新（每小时一次）
  setInterval(() => {
    console.log(t("main.update.checkingInterval"))
    autoUpdater
      .checkForUpdates()
      .then((result) => {
        console.log(t("main.update.checkResultInterval"), result)
      })
      .catch((err) => {
        console.error(t("main.error.checkFailedInterval"), err)
      })
  }, 60 * 60 * 1000)

  // 处理渲染层发来的 IPC 消息
  ipcMain.handle("start-update", async () => {
    console.log(t("main.update.startRequested"))
    try {
      await autoUpdater.downloadUpdate()
      console.log(t("main.update.downloadCompleted"))
      return { success: true }
    } catch (error) {
      console.error(t("main.error.startUpdate"), error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("install-update", () => {
    console.log(t("main.update.installRequested"))
    autoUpdater.quitAndInstall()
  })
}
