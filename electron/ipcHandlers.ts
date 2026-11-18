// ipcHandlers.ts — 渲染进程与主进程之间的 IPC 处理器

import { ipcMain, shell, dialog } from "electron"
import { randomBytes } from "crypto"
import { IIpcHandlerDeps } from "./main"
import { configHelper } from "./ConfigHelper"
import { mainT } from "./i18n/mainT"
import { handleListModels } from "./llm/modelListIpc"

export function initializeIpcHandlers(deps: IIpcHandlerDeps): void {
  // 每次调用都按当前界面语言取文案
  const t = mainT("main")

  console.log(t("main.ipc.initializing"))

  // 配置相关处理器
  ipcMain.handle("get-config", () => {
    return configHelper.loadConfig();
  })

  ipcMain.handle("update-config", (_event, updates) => {
    return configHelper.updateConfig(updates);
  })

  // 读当前生效的界面语言：永不抛错，异常时回落到 system + en
  ipcMain.handle("get-ui-locale", () => {
    try {
      const { setting, locale } = configHelper.getUiLocale();
      return { setting, locale, source: setting === "system" ? "system" : "config" };
    } catch (error) {
      console.error(t("main.error.resolveUiLocale"), error);
      return { setting: "system", locale: "en", source: "system" };
    }
  })

  // 界面语言变更：ConfigHelper 只在 update-config 写盘成功后才发出该事件
  configHelper.on(
    "ui-language-changed",
    (info: { setting: "system" | "zh" | "en"; locale: "zh" | "en" }) => {
      const mainWindow = deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("ui-locale-changed", info);
      }
    }
  )

  ipcMain.handle("check-api-key", () => {
    return configHelper.hasApiKey();
  })

  // 拉取模型列表：GET {baseUrl}/models，鉴权头按 provider.apiFormat 走。
  // 失败时返回 { ok: false, models: [], error }（当前语言），不影响渲染层手工填写模型 ID。
  ipcMain.handle("list-models", async (_event, overrides?: unknown) => {
    const locale = configHelper.getUiLocale().locale;
    console.log(t("main.ipc.listModelsRequest"));
    const result = await handleListModels({
      rawConfig: configHelper.loadConfig(),
      overrides,
      locale,
    });
    if (result.ok) {
      console.log(
        t("main.ipc.listModelsResult", { count: String(result.models.length) })
      );
    } else {
      console.warn(
        t("main.ipc.listModelsFailed", { code: result.code ?? "unknown" })
      );
    }
    return result;
  })

  ipcMain.handle("validate-api-key", async (_event, apiKey) => {
    // 先校验格式
    if (!configHelper.isValidApiKeyFormat(apiKey)) {
      return {
        valid: false,
        error: t("main.error.apiKeyFormat")
      };
    }

    // 再用 OpenAI 实测该 Key
    const result = await configHelper.testApiKey(apiKey);
    return result;
  })

  // 额度相关处理器
  ipcMain.handle("set-initial-credits", async (_event, credits: number) => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      // 以原子方式设置额度
      await mainWindow.webContents.executeJavaScript(
        `window.__CREDITS__ = ${credits}`
      )
      mainWindow.webContents.send("credits-updated", credits)
    } catch (error) {
      console.error(t("main.error.setInitialCredits"), error)
      throw error
    }
  })

  ipcMain.handle("decrement-credits", async () => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      const currentCredits = await mainWindow.webContents.executeJavaScript(
        "window.__CREDITS__"
      )
      if (currentCredits > 0) {
        const newCredits = currentCredits - 1
        await mainWindow.webContents.executeJavaScript(
          `window.__CREDITS__ = ${newCredits}`
        )
        mainWindow.webContents.send("credits-updated", newCredits)
      }
    } catch (error) {
      console.error(t("main.error.decrementCredits"), error)
    }
  })

  // 截图队列处理器
  ipcMain.handle("get-screenshot-queue", () => {
    return deps.getScreenshotQueue()
  })

  ipcMain.handle("get-extra-screenshot-queue", () => {
    return deps.getExtraScreenshotQueue()
  })

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return deps.deleteScreenshot(path)
  })

  ipcMain.handle("get-image-preview", async (event, path: string) => {
    return deps.getImagePreview(path)
  })

  // 截图处理处理器
  ipcMain.handle("process-screenshots", async () => {
    // 处理前先检查 API Key
    if (!configHelper.hasApiKey()) {
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
      }
      return;
    }

    await deps.processingHelper?.processScreenshots()
  })

  // 窗口尺寸处理器
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        deps.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle(
    "set-window-dimensions",
    (event, width: number, height: number) => {
      deps.setWindowDimensions(width, height)
    }
  )

  // 截图管理处理器
  ipcMain.handle("get-screenshots", async () => {
    try {
      let previews = []
      const currentView = deps.getView()

      if (currentView === "queue") {
        const queue = deps.getScreenshotQueue()
        previews = await Promise.all(
          queue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      } else {
        const extraQueue = deps.getExtraScreenshotQueue()
        previews = await Promise.all(
          extraQueue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      }

      return previews
    } catch (error) {
      console.error(t("main.error.getScreenshots"), error)
      throw error
    }
  })

  // 截图触发处理器
  ipcMain.handle("trigger-screenshot", async () => {
    const mainWindow = deps.getMainWindow()
    if (mainWindow) {
      try {
        const screenshotPath = await deps.takeScreenshot()
        const preview = await deps.getImagePreview(screenshotPath)
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview
        })
        return { success: true }
      } catch (error) {
        console.error(t("main.error.triggerScreenshot"), error)
        return { error: t("main.error.triggerScreenshotFailed") }
      }
    }
    return { error: t("main.error.noMainWindowAvailable") }
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await deps.takeScreenshot()
      const preview = await deps.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error(t("main.error.takeScreenshot"), error)
      return { error: t("main.error.takeScreenshotFailed") }
    }
  })

  // 鉴权相关处理器已移除

  ipcMain.handle("open-external-url", (event, url: string) => {
    shell.openExternal(url)
  })

  // 打开外部链接处理器
  ipcMain.handle("openLink", (event, url: string) => {
    try {
      console.log(t("main.ipc.openingExternalUrl", { url }));
      shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error(t("main.error.openUrl", { url }), error);
      return { success: false, error: t("main.error.openUrlFailed", { error: String(error) }) };
    }
  })

  // 设置面板处理器
  ipcMain.handle("open-settings-portal", () => {
    const mainWindow = deps.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send("show-settings-dialog");
      return { success: true };
    }
    return { success: false, error: t("main.error.mainWindowNotAvailable") };
  })

  // 窗口管理处理器
  ipcMain.handle("toggle-window", () => {
    try {
      deps.toggleMainWindow()
      return { success: true }
    } catch (error) {
      console.error(t("main.error.toggleWindow"), error)
      return { error: t("main.error.toggleWindowFailed") }
    }
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      deps.clearQueues()
      return { success: true }
    } catch (error) {
      console.error(t("main.error.resetQueues"), error)
      return { error: t("main.error.resetQueuesFailed") }
    }
  })

  // 处理截图处理器
  ipcMain.handle("trigger-process-screenshots", async () => {
    try {
      // 处理前先检查 API Key
      if (!configHelper.hasApiKey()) {
        const mainWindow = deps.getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
        }
        return { success: false, error: t("main.error.apiKeyRequired") };
      }

      await deps.processingHelper?.processScreenshots()
      return { success: true }
    } catch (error) {
      console.error(t("main.error.processScreenshots"), error)
      return { error: t("main.error.processScreenshotsFailed") }
    }
  })

  // 重置处理器
  ipcMain.handle("trigger-reset", () => {
    try {
      // 先取消所有进行中的请求
      deps.processingHelper?.cancelOngoingRequests()

      // 立即清空所有队列
      deps.clearQueues()

      // 把视图重置回队列页
      deps.setView("queue")

      // 取主窗口并发送重置事件
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        // 按顺序发送重置事件
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }

      return { success: true }
    } catch (error) {
      console.error(t("main.error.triggerReset"), error)
      return { error: t("main.error.triggerResetFailed") }
    }
  })

  // 窗口移动处理器
  ipcMain.handle("trigger-move-left", () => {
    try {
      deps.moveWindowLeft()
      return { success: true }
    } catch (error) {
      console.error(t("main.error.moveLeft"), error)
      return { error: t("main.error.moveLeftFailed") }
    }
  })

  ipcMain.handle("trigger-move-right", () => {
    try {
      deps.moveWindowRight()
      return { success: true }
    } catch (error) {
      console.error(t("main.error.moveRight"), error)
      return { error: t("main.error.moveRightFailed") }
    }
  })

  ipcMain.handle("trigger-move-up", () => {
    try {
      deps.moveWindowUp()
      return { success: true }
    } catch (error) {
      console.error(t("main.error.moveUp"), error)
      return { error: t("main.error.moveUpFailed") }
    }
  })

  ipcMain.handle("trigger-move-down", () => {
    try {
      deps.moveWindowDown()
      return { success: true }
    } catch (error) {
      console.error(t("main.error.moveDown"), error)
      return { error: t("main.error.moveDownFailed") }
    }
  })

  // 删除最后一张截图的处理器
  ipcMain.handle("delete-last-screenshot", async () => {
    try {
      const queue = deps.getView() === "queue"
        ? deps.getScreenshotQueue()
        : deps.getExtraScreenshotQueue()

      if (queue.length === 0) {
        return { success: false, error: t("main.error.noScreenshotsToDelete") }
      }

      // 取队列里的最后一张截图
      const lastScreenshot = queue[queue.length - 1]

      // 删除它
      const result = await deps.deleteScreenshot(lastScreenshot)

      // 通知渲染层刷新
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("screenshot-deleted", { path: lastScreenshot })
      }

      return result
    } catch (error) {
      console.error(t("main.error.deleteLastScreenshot"), error)
      return { success: false, error: t("main.error.deleteLastScreenshotFailed") }
    }
  })
}
