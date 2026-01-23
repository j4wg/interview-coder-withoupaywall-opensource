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
  getScreenshots: () => Promise<{
    success: boolean
    previews?: Array<{ path: string; preview: string }> | null
    error?: string
  }>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
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
  getPlatform: () => string
  
  // New methods for OpenAI integration
  getConfig: () => Promise<{ apiKey: string; model: string; apiProvider?: string; extractionModel?: string; solutionModel?: string; debuggingModel?: string; answerModel?: string; speechRecognitionModel?: string; candidateProfile?: any }>
  updateConfig: (config: { apiKey?: string; model?: string; apiProvider?: string; extractionModel?: string; solutionModel?: string; debuggingModel?: string; answerModel?: string; speechRecognitionModel?: string; candidateProfile?: any }) => Promise<boolean>
  checkApiKey: () => Promise<boolean>
  validateApiKey: (apiKey: string) => Promise<{ valid: boolean; error?: string }>
  openLink: (url: string) => void
  onApiKeyInvalid: (callback: () => void) => () => void
  removeListener: (eventName: string, callback: (...args: any[]) => void) => void
  
  // Conversation & Transcription methods
  transcribeAudio: (audioBuffer: ArrayBuffer, mimeType: string) => Promise<{ success: boolean; result?: { text: string; language?: string }; error?: string }>
  addConversationMessage: (text: string, speaker?: string) => Promise<{ success: boolean; message?: any; error?: string }>
  toggleSpeaker: () => Promise<{ success: boolean; speaker?: string; error?: string }>
  getConversation: () => Promise<{ success: boolean; messages?: any[]; error?: string }>
  clearConversation: () => Promise<{ success: boolean; error?: string }>
  updateConversationMessage: (messageId: string, newText: string) => Promise<{ success: boolean; error?: string }>
  getAnswerSuggestions: (question: string, screenshotContext?: string, candidateProfile?: any) => Promise<{ success: boolean; suggestions?: { suggestions: string[]; reasoning: string }; error?: string }>
  onConversationMessageAdded: (callback: (message: any) => void) => () => void
  onSpeakerChanged: (callback: (speaker: string) => void) => () => void
  onConversationMessageUpdated: (callback: (message: any) => void) => () => void
  onConversationCleared: (callback: () => void) => () => void
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
