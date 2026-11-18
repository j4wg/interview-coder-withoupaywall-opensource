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

/**
 * API 格式三选一（JUN-47 / JUN-48 / JUN-49 共用契约，不得改名）。
 * - `anthropic-messages` → `/v1/messages`
 * - `chat-completions` → `/chat/completions`
 * - `responses` → `/responses`
 */
export type ApiFormat =
  | "anthropic-messages"
  | "chat-completions"
  | "responses"

/** 三个用途 → `bindings` 的键名（与主进程契约逐字一致） */
export type BindingKey =
  | "extractionModel"
  | "solutionModel"
  | "debuggingModel"

/** 一套供应商配置（配置层 v3 契约）；`models` 里只存模型 ID 字符串 */
export interface ProviderConfig {
  /** 稳定标识（`p_` + 6 位十六进制）；创建后不可变，重命名只改 `name` */
  id: string
  /** 界面显示名；空串表示未命名，由界面给占位文案 */
  name: string
  /** 服务地址（含版本路径）；空串 = 尚未配置 */
  baseUrl: string
  apiFormat: ApiFormat
  apiKey: string
  models: string[]
}

/** 某个用途的绑定：provider 与 model 必须同时存在且相互匹配 */
export interface ModelBinding {
  providerId: string
  modelId: string
}

/** 三个用途各自指向"某套 provider 里的某个模型"，允许跨 provider */
export type ModelBindings = Record<BindingKey, ModelBinding>

/** 与 `electron/ConfigHelper.ts` 中 Config 逐字段一致（v3：多套 provider 并存） */
export interface Config {
  providers: ProviderConfig[]
  bindings: ModelBindings
  /** 编程语言，默认 "java"；不是界面语言 */
  language: string
  opacity: number
  /** 界面语言设置，默认 "system"（跟随系统） */
  uiLanguage: UiLanguageSetting
  /** 迁移标记，当前 3；渲染层写入会被忽略 */
  configVersion: number
  /** @deprecated 已迁入 `providers[].apiKey`，v3 运行期恒为 undefined */
  apiKey?: string
  /** @deprecated 已由 `providers[].apiFormat` 取代，v3 运行期恒为 undefined */
  apiProvider?: string
  /** @deprecated 已迁入 `bindings.extractionModel`，v3 运行期恒为 undefined */
  extractionModel?: string
  /** @deprecated 已迁入 `bindings.solutionModel`，v3 运行期恒为 undefined */
  solutionModel?: string
  /** @deprecated 已迁入 `bindings.debuggingModel`，v3 运行期恒为 undefined */
  debuggingModel?: string
}

/** `update-config` 的返回：保存后的完整配置 + 因引用失效被置空的用途 */
export interface UpdateConfigOutcome {
  config: Config
  clearedBindings: BindingKey[]
}

/**
 * `list-models` 通道（JUN-48 提供）的返回形状。
 * 调用层归一前可能是数组，也可能是 `{ ok, models, error?, code? }` 对象（JUN-48 实际实现），
 * 渲染层两种都接；失败时 `error` 已是当前语言的文案。
 */
export type ListModelsResponse =
  | string[]
  | {
      ok?: boolean
      success?: boolean
      models?: string[]
      /** 实际参与拉取的 provider（未保存的新卡片会回传它的临时 id） */
      providerId?: string
      error?: string
      code?: string
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
  updateConfig: (config: Partial<Config>) => Promise<UpdateConfigOutcome>
  /**
   * 拉取模型列表。通道由调用层（JUN-48）提供，在其合并前可能不存在，
   * 调用方必须按可选处理：缺失或失败时仍允许手工填写模型 ID。
   */
  listModels?: (options?: {
    /** 已保存 provider 的 id；新卡片可带尚未落盘的临时 id */
    providerId?: string
    name?: string
    baseUrl: string
    apiFormat: ApiFormat
    apiKey: string
  }) => Promise<ListModelsResponse>
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
