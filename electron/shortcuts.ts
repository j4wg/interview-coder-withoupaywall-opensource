import { globalShortcut, app } from "electron"
import { IShortcutsHelperDeps } from "./main"
import { configHelper } from "./ConfigHelper"
import { mainT } from "./i18n/mainT"

// 主进程翻译器：每次调用都实时解析当前界面语言
const t = mainT("main")

export class ShortcutsHelper {
  private deps: IShortcutsHelperDeps

  constructor(deps: IShortcutsHelperDeps) {
    this.deps = deps
  }

  private adjustOpacity(delta: number): void {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    let currentOpacity = mainWindow.getOpacity();
    let newOpacity = Math.max(0.1, Math.min(1.0, currentOpacity + delta));
    console.log(
      t("main.shortcut.adjustOpacity", {
        from: String(currentOpacity),
        to: String(newOpacity)
      })
    );

    mainWindow.setOpacity(newOpacity);

    // 把不透明度写进配置，但不重新初始化客户端
    try {
      const config = configHelper.loadConfig();
      config.opacity = newOpacity;
      configHelper.saveConfig(config);
    } catch (error) {
      console.error(t("main.error.saveOpacity"), error);
    }

    // 如果刚把窗口调成可见，还要确保它已显示且可交互
    if (newOpacity > 0.1 && !this.deps.isVisible()) {
      this.deps.toggleMainWindow();
    }
  }

  public registerGlobalShortcuts(): void {
    globalShortcut.register("CommandOrControl+H", async () => {
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        console.log(t("main.shortcut.takingScreenshot"))
        try {
          const screenshotPath = await this.deps.takeScreenshot()
          const preview = await this.deps.getImagePreview(screenshotPath)
          mainWindow.webContents.send("screenshot-taken", {
            path: screenshotPath,
            preview
          })
        } catch (error) {
          console.error(t("main.error.captureShortcut"), error)
        }
      }
    })

    globalShortcut.register("CommandOrControl+Enter", async () => {
      await this.deps.processingHelper?.processScreenshots()
    })

    globalShortcut.register("CommandOrControl+R", () => {
      console.log(t("main.shortcut.resetPressed"))

      // 取消进行中的 API 请求
      this.deps.processingHelper?.cancelOngoingRequests()

      // 清空两个截图队列
      this.deps.clearQueues()

      console.log(t("main.shortcut.queuesCleared"))

      // 把视图切回 queue
      this.deps.setView("queue")

      // 通知渲染层切回 queue 视图
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }
    })

    // 窗口移动相关快捷键
    globalShortcut.register("CommandOrControl+Left", () => {
      console.log(t("main.shortcut.moveLeft"))
      this.deps.moveWindowLeft()
    })

    globalShortcut.register("CommandOrControl+Right", () => {
      console.log(t("main.shortcut.moveRight"))
      this.deps.moveWindowRight()
    })

    globalShortcut.register("CommandOrControl+Down", () => {
      console.log(t("main.shortcut.moveDown"))
      this.deps.moveWindowDown()
    })

    globalShortcut.register("CommandOrControl+Up", () => {
      console.log(t("main.shortcut.moveUp"))
      this.deps.moveWindowUp()
    })

    globalShortcut.register("CommandOrControl+B", () => {
      console.log(t("main.shortcut.toggle"))
      this.deps.toggleMainWindow()
    })

    globalShortcut.register("CommandOrControl+Q", () => {
      console.log(t("main.shortcut.quit"))
      app.quit()
    })

    // 不透明度相关快捷键
    globalShortcut.register("CommandOrControl+[", () => {
      console.log(t("main.shortcut.opacityDown"))
      this.adjustOpacity(-0.1)
    })

    globalShortcut.register("CommandOrControl+]", () => {
      console.log(t("main.shortcut.opacityUp"))
      this.adjustOpacity(0.1)
    })

    // 缩放控制
    globalShortcut.register("CommandOrControl+-", () => {
      console.log(t("main.shortcut.zoomOut"))
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel()
        mainWindow.webContents.setZoomLevel(currentZoom - 0.5)
      }
    })

    globalShortcut.register("CommandOrControl+0", () => {
      console.log(t("main.shortcut.zoomReset"))
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.setZoomLevel(0)
      }
    })

    globalShortcut.register("CommandOrControl+=", () => {
      console.log(t("main.shortcut.zoomIn"))
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel()
        mainWindow.webContents.setZoomLevel(currentZoom + 0.5)
      }
    })

    // 删除最后一张截图的快捷键
    globalShortcut.register("CommandOrControl+L", () => {
      console.log(t("main.shortcut.deleteLast"))
      const mainWindow = this.deps.getMainWindow()
      if (mainWindow) {
        // 通知渲染层删除最后一张截图
        mainWindow.webContents.send("delete-last-screenshot")
      }
    })

    // 退出时注销全部快捷键
    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }
}
