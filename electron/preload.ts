// preload.ts — 通过 contextBridge 暴露受控的 electronAPI
import { contextBridge, ipcRenderer } from "electron"

/** 实际生效的界面语言 */
type Locale = "zh" | "en"

// preload 运行在**沙箱渲染进程**（Electron 20+ 默认 sandbox=true），只能 require("electron")，
// 无法 require 本地模块，因此这里不能 import ConfigHelper / i18n 内核，文案以字面量内联。
// 语言仍由主进程 get-ui-locale（唯一判定点）最终确定：模块加载期的两条启动日志用
// navigator.language（与 resolveLocale 的 system 信号同源），invoke 返回后其余日志跟随用户设置。
// 内联文案与 electron/i18n/messages/main.*.ts 由 tests/mainMessages.test.mjs 逐条比对。
const PRELOAD_MESSAGES_ZH: Record<string, string> = {
  "main.preload.starting": "preload 脚本开始执行…",
  "main.preload.running": "preload 脚本运行中",
  "main.preload.toggleCalled": "渲染层调用了 toggleMainWindow",
  "main.preload.toggleResult": "toggle-window 返回结果：",
  "main.preload.exposingApi": "即将暴露 electronAPI，方法列表：",
  "main.preload.apiExposed": "electronAPI 已暴露到 window",
  "main.error.preloadToggle": "toggleMainWindow 出错："
}

const PRELOAD_MESSAGES_EN: Record<string, string> = {
  "main.preload.starting": "Preload script starting...",
  "main.preload.running": "Preload script is running",
  "main.preload.toggleCalled": "toggleMainWindow called from preload",
  "main.preload.toggleResult": "toggle-window result:",
  "main.preload.exposingApi": "About to expose electronAPI with methods:",
  "main.preload.apiExposed": "electronAPI exposed to window",
  "main.error.preloadToggle": "Error in toggleMainWindow:"
}

const PRELOAD_MESSAGES: Record<Locale, Record<string, string>> = {
  zh: PRELOAD_MESSAGES_ZH,
  en: PRELOAD_MESSAGES_EN
}

/** 从主进程注入的 `--app-ui-locale=zh|en` 里取语言（沙箱 preload 读不到配置，只能走 argv） */
function readArgvLocale(): Locale | null {
  try {
    const prefix = "--app-ui-locale="
    const found = (process.argv || []).find((arg) => arg.startsWith(prefix))
    if (!found) return null
    const value = found.slice(prefix.length)
    return value === "zh" || value === "en" ? value : null
  } catch {
    return null
  }
}

/** 从 `navigator.language` 取系统语言，取不到时按英文处理（与 resolveLocale 的回落一致） */
function readSystemLocale(): Locale {
  try {
    const tag = navigator.language || ""
    return tag.toLowerCase().startsWith("zh") ? "zh" : "en"
  } catch {
    return "en"
  }
}

let preloadLocale: Locale = readArgvLocale() ?? readSystemLocale()

/** preload 内的日志翻译：按当前缓存的语言取内联文案 */
function tp(key: string): string {
  return PRELOAD_MESSAGES[preloadLocale][key] ?? key
}

console.log(tp("main.preload.starting"))

const { shell } = require("electron")

export const PROCESSING_EVENTS = {
  // 全局状态
  UNAUTHORIZED: "procesing-unauthorized",
  NO_SCREENSHOTS: "processing-no-screenshots",
  OUT_OF_CREDITS: "out-of-credits",
  API_KEY_INVALID: "api-key-invalid",

  // 生成初始解答过程的状态
  INITIAL_START: "initial-start",
  PROBLEM_EXTRACTED: "problem-extracted",
  SOLUTION_SUCCESS: "solution-success",
  INITIAL_SOLUTION_ERROR: "solution-error",
  RESET: "reset",

  // 调试过程的状态
  DEBUG_START: "debug-start",
  DEBUG_SUCCESS: "debug-success",
  DEBUG_ERROR: "debug-error"
} as const

// 启动时向主进程取一次当前生效语言（argv 只是初值，这里以主进程为准）；
// 之后监听 ui-locale-changed，用户在设置里切换语言时 preload 日志同步跟随。
ipcRenderer
  .invoke("get-ui-locale")
  .then((result: { locale?: string } | null) => {
    if (result && (result.locale === "zh" || result.locale === "en")) {
      preloadLocale = result.locale
    }
  })
  .catch(() => {
    // 取不到就沿用 argv / navigator 的初值，不抛错
  })

ipcRenderer.on("ui-locale-changed", (_event, data: { locale?: string }) => {
  if (data && (data.locale === "zh" || data.locale === "en")) {
    preloadLocale = data.locale
  }
})

// 文件开头
console.log(tp("main.preload.running"))

const electronAPI = {
  // 原有方法
  openSubscriptionPortal: async (authData: { id: string; email: string }) => {
    return ipcRenderer.invoke("open-subscription-portal", authData)
  },
  openSettingsPortal: () => ipcRenderer.invoke("open-settings-portal"),
  updateContentDimensions: (dimensions: { width: number; height: number }) =>
    ipcRenderer.invoke("update-content-dimensions", dimensions),
  clearStore: () => ipcRenderer.invoke("clear-store"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (path: string) =>
    ipcRenderer.invoke("delete-screenshot", path),
  toggleMainWindow: async () => {
    console.log(tp("main.preload.toggleCalled"))
    try {
      const result = await ipcRenderer.invoke("toggle-window")
      console.log(tp("main.preload.toggleResult"), result)
      return result
    } catch (error) {
      console.error(tp("main.error.preloadToggle"), error)
      throw error
    }
  },
  // 事件监听
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => {
    const subscription = (_: any, data: { path: string; preview: string }) =>
      callback(data)
    ipcRenderer.on("screenshot-taken", subscription)
    return () => {
      ipcRenderer.removeListener("screenshot-taken", subscription)
    }
  },
  onResetView: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("reset-view", subscription)
    return () => {
      ipcRenderer.removeListener("reset-view", subscription)
    }
  },
  onSolutionStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.INITIAL_START, subscription)
    }
  },
  onDebugStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_START, subscription)
    }
  },
  onDebugSuccess: (callback: (data: any) => void) => {
    ipcRenderer.on("debug-success", (_event, data) => callback(data))
    return () => {
      ipcRenderer.removeListener("debug-success", (_event, data) =>
        callback(data)
      )
    }
  },
  onDebugError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    }
  },
  onSolutionError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        subscription
      )
    }
  },
  onProcessingNoScreenshots: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    }
  },
  onOutOfCredits: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.OUT_OF_CREDITS, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.OUT_OF_CREDITS, subscription)
    }
  },
  onProblemExtracted: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.PROBLEM_EXTRACTED, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.PROBLEM_EXTRACTED,
        subscription
      )
    }
  },
  onSolutionSuccess: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.SOLUTION_SUCCESS, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.SOLUTION_SUCCESS,
        subscription
      )
    }
  },
  onUnauthorized: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    }
  },
  // 外部链接处理器
  openLink: (url: string) => shell.openExternal(url),
  triggerScreenshot: () => ipcRenderer.invoke("trigger-screenshot"),
  triggerProcessScreenshots: () =>
    ipcRenderer.invoke("trigger-process-screenshots"),
  triggerReset: () => ipcRenderer.invoke("trigger-reset"),
  triggerMoveLeft: () => ipcRenderer.invoke("trigger-move-left"),
  triggerMoveRight: () => ipcRenderer.invoke("trigger-move-right"),
  triggerMoveUp: () => ipcRenderer.invoke("trigger-move-up"),
  triggerMoveDown: () => ipcRenderer.invoke("trigger-move-down"),
  onSubscriptionUpdated: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("subscription-updated", subscription)
    return () => {
      ipcRenderer.removeListener("subscription-updated", subscription)
    }
  },
  onSubscriptionPortalClosed: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("subscription-portal-closed", subscription)
    return () => {
      ipcRenderer.removeListener("subscription-portal-closed", subscription)
    }
  },
  onReset: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.RESET, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.RESET, subscription)
    }
  },
  startUpdate: () => ipcRenderer.invoke("start-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateAvailable: (callback: (info: any) => void) => {
    const subscription = (_: any, info: any) => callback(info)
    ipcRenderer.on("update-available", subscription)
    return () => {
      ipcRenderer.removeListener("update-available", subscription)
    }
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    const subscription = (_: any, info: any) => callback(info)
    ipcRenderer.on("update-downloaded", subscription)
    return () => {
      ipcRenderer.removeListener("update-downloaded", subscription)
    }
  },
  decrementCredits: () => ipcRenderer.invoke("decrement-credits"),
  onCreditsUpdated: (callback: (credits: number) => void) => {
    const subscription = (_event: any, credits: number) => callback(credits)
    ipcRenderer.on("credits-updated", subscription)
    return () => {
      ipcRenderer.removeListener("credits-updated", subscription)
    }
  },
  getPlatform: () => process.platform,

  // OpenAI API 集成新增的方法
  getConfig: () => ipcRenderer.invoke("get-config"),
  updateConfig: (config: { apiKey?: string; model?: string; language?: string; opacity?: number; uiLanguage?: "system" | "zh" | "en" }) =>
    ipcRenderer.invoke("update-config", config),
  getUiLocale: () => ipcRenderer.invoke("get-ui-locale"),
  onUiLocaleChanged: (
    callback: (data: { setting: "system" | "zh" | "en"; locale: "zh" | "en" }) => void
  ) => {
    const subscription = (
      _: unknown,
      data: { setting: "system" | "zh" | "en"; locale: "zh" | "en" }
    ) => callback(data)
    ipcRenderer.on("ui-locale-changed", subscription)
    return () => {
      ipcRenderer.removeListener("ui-locale-changed", subscription)
    }
  },
  onShowSettings: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("show-settings-dialog", subscription)
    return () => {
      ipcRenderer.removeListener("show-settings-dialog", subscription)
    }
  },
  checkApiKey: () => ipcRenderer.invoke("check-api-key"),
  // 拉取模型列表：按 providerId 指定哪一套配置（多套配置并存），
  // 同时可带该卡片尚未保存的表单值（name/baseUrl/apiFormat/apiKey）。
  // 返回 { ok, models, providerId?, error?, code? }；失败时 models 为空且 error 已是当前语言
  listModels: (options?: {
    providerId?: string
    name?: string
    baseUrl?: string
    apiFormat?: string
    apiKey?: string
  }) => ipcRenderer.invoke("list-models", options),
  validateApiKey: (apiKey: string) =>
    ipcRenderer.invoke("validate-api-key", apiKey),
  openExternal: (url: string) =>
    ipcRenderer.invoke("openExternal", url),
  onApiKeyInvalid: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.API_KEY_INVALID, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.API_KEY_INVALID, subscription)
    }
  },
  removeListener: (eventName: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(eventName, callback)
  },
  onDeleteLastScreenshot: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("delete-last-screenshot", subscription)
    return () => {
      ipcRenderer.removeListener("delete-last-screenshot", subscription)
    }
  },
  deleteLastScreenshot: () => ipcRenderer.invoke("delete-last-screenshot")
}

// 暴露之前先打印方法列表
console.log(
  tp("main.preload.exposingApi"),
  Object.keys(electronAPI)
)

// 暴露 API
contextBridge.exposeInMainWorld("electronAPI", electronAPI)

console.log(tp("main.preload.apiExposed"))

// 焦点恢复处理器
ipcRenderer.on("restore-focus", () => {
  // 若当前有聚焦元素，尝试让它重新获得焦点
  const activeElement = document.activeElement as HTMLElement
  if (activeElement && typeof activeElement.focus === "function") {
    activeElement.focus()
  }
})

// 已移除 auth-callback 处理，不再需要
