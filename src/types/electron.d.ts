/**
 * `window.electronAPI` 的权威类型声明（唯一真源）。
 *
 * 三处历史声明（本文件、`src/types/global.d.ts`、`src/env.d.ts`）已收敛到这一份：
 * 另外两处只保留对本文的引用，避免同一 API 多处漂移。
 *
 * `Config` 与 `getConfig` / `updateConfig` 与 `electron/ConfigHelper.ts` 的实现逐字段一致，
 * 界面语言相关类型直接复用主进程真源 `electron/i18n/types.ts`。
 */
import type { Locale, UiLanguageSetting } from "../../electron/i18n/types"
import type { Screenshot } from "./screenshots"

/** 与 `electron/ConfigHelper.ts` 中 Config 逐字段一致 */
export interface Config {
  apiKey: string
  apiProvider: "openai" | "gemini" | "anthropic"
  extractionModel: string
  solutionModel: string
  debuggingModel: string
  /** 编程语言，默认 "java"；不是界面语言 */
  language: string
  opacity: number
  /** 界面语言设置，默认 "system"（跟随系统） */
  uiLanguage: UiLanguageSetting
  /** 迁移标记，当前 2；渲染层写入会被忽略 */
  configVersion: number
}

/** `get-ui-locale` 的响应体 */
export interface UiLocaleInfo {
  setting: UiLanguageSetting
  locale: Locale
  source: "config" | "system"
}

/**
 * 历史遗留形状：preload / IPC 实际返回 `Array<{ path, preview }>`（见 electron/ipcHandlers.ts
 * 的 `get-screenshots`）。渲染层历史上有两种用法：Queue/Debug 当 `Screenshot[]` 用，
 * Solutions 读 `.previews`。本次只收敛 `getConfig`/`updateConfig`，不在 JUN-39 拥有的
 * `src/**` 里改调用点，因此用交叉类型同时容纳两种历史用法（不含 `any`）；
 * JUN-39 统一成数组用法后应收窄为 `Array<{ path: string; preview: string }>`。
 */
export type ScreenshotListResponse = Screenshot[] & {
  previews?: Array<{ path: string; preview: string }> | null
}

export interface ElectronAPI {
  // Original methods
  openSubscriptionPortal: (authData: {
    id: string
    email: string
  }) => Promise<{ success: boolean; error?: string }>
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  clearStore: () => Promise<{ success: boolean; error?: string }>
  getScreenshots: () => Promise<ScreenshotListResponse>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  deleteLastScreenshot: () => Promise<{ success: boolean; error?: string }>
  onDeleteLastScreenshot: (callback: () => void) => () => void
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
  onResetView: (callback: () => void) => () => void
  onSolutionStart: (callback: () => void) => () => void
  onDebugStart: (callback: () => void) => () => void
  onDebugSuccess: (callback: (data: any) => void) => () => void
  onSolutionError: (callback: (error: string) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void
  onProblemExtracted: (callback: (data: any) => void) => () => void
  onSolutionSuccess: (callback: (data: any) => void) => () => void
  onUnauthorized: (callback: () => void) => () => void
  onDebugError: (callback: (error: string) => void) => () => void
  openExternal: (url: string) => void
  toggleMainWindow: () => Promise<{ success: boolean; error?: string }>
  triggerScreenshot: () => Promise<{ success: boolean; error?: string }>
  triggerProcessScreenshots: () => Promise<{ success: boolean; error?: string }>
  triggerReset: () => Promise<{ success: boolean; error?: string }>
  triggerMoveLeft: () => Promise<{ success: boolean; error?: string }>
  triggerMoveRight: () => Promise<{ success: boolean; error?: string }>
  triggerMoveUp: () => Promise<{ success: boolean; error?: string }>
  triggerMoveDown: () => Promise<{ success: boolean; error?: string }>
  onSubscriptionUpdated: (callback: () => void) => () => void
  onSubscriptionPortalClosed: (callback: () => void) => () => void
  startUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => void
  onUpdateAvailable: (callback: (info: any) => void) => () => void
  onUpdateDownloaded: (callback: (info: any) => void) => () => void

  decrementCredits: () => Promise<void>
  setInitialCredits: (credits: number) => Promise<void>
  onCreditsUpdated: (callback: (credits: number) => void) => () => void
  onOutOfCredits: (callback: () => void) => () => void
  openSettingsPortal: () => Promise<void>
  onShowSettings: (callback: () => void) => () => void
  getPlatform: () => string

  // 配置与界面语言
  getConfig: () => Promise<Config>
  updateConfig: (config: Partial<Config>) => Promise<Config>
  getUiLocale: () => Promise<UiLocaleInfo>
  onUiLocaleChanged: (
    callback: (data: { setting: UiLanguageSetting; locale: Locale }) => void
  ) => () => void
  checkApiKey: () => Promise<boolean>
  validateApiKey: (apiKey: string) => Promise<{ valid: boolean; error?: string }>
  openLink: (url: string) => void
  onApiKeyInvalid: (callback: () => void) => () => void
  removeListener: (eventName: string, callback: (...args: any[]) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    electron: {
      ipcRenderer: {
        on: (channel: string, func: (...args: any[]) => void) => void
        removeListener: (
          channel: string,
          func: (...args: any[]) => void
        ) => void
      }
    }
    __CREDITS__: number
    __LANGUAGE__: string
    __IS_INITIALIZED__: boolean
    __AUTH_TOKEN__?: string | null
  }
}
