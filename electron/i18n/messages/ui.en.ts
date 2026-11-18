/**
 * 渲染层界面文案（`ui` 命名空间）英文表。
 *
 * 类型绑定中文表（`typeof uiZh`）：键集合必须与 `ui.zh.ts` 完全一致，
 * 缺键或多键都在 `tsc` 阶段报错，避免运行时缺文案。
 */
import type { uiZh } from "./ui.zh"

export const uiEn: typeof uiZh = {
  // 全局通用
  "ui.common.success": "Success",
  "ui.common.error": "Error",
  "ui.common.cancel": "Cancel",
  "ui.common.close": "Close",
  "ui.common.settings": "Settings",
  "ui.common.logOut": "Log Out",
  "ui.common.programmingLanguage": "Language",
  "ui.common.apiSettings": "OpenAI API Settings",

  // 应用外壳
  "ui.app.initializing": "Initializing...",
  "ui.app.toast.apiKeyInvalid.title": "API Key Invalid",
  "ui.app.toast.apiKeyInvalid.description":
    "Your OpenAI API key appears to be invalid or has insufficient credits",
  "ui.app.toast.apiKeySaved": "API key saved successfully",
  "ui.app.toast.apiKeySaveFailed": "Failed to save API key",

  // 欢迎页
  "ui.welcome.badge": "Unlocked Edition",
  "ui.welcome.title": "Welcome to Interview Coder",
  "ui.welcome.description":
    "This application helps you ace technical interviews by providing AI-powered solutions to coding problems.",
  "ui.welcome.shortcutsTitle": "Global Shortcuts",
  "ui.welcome.gettingStartedTitle": "Getting Started",
  "ui.welcome.gettingStartedDescription":
    "Before using the application, you need to configure your OpenAI API key.",
  "ui.welcome.openSettings": "Open Settings",
  "ui.welcome.footer":
    "Start by taking screenshots of your coding problem (Ctrl+H / Cmd+H)",

  // 快捷键名称
  "ui.shortcut.title": "Keyboard Shortcuts",
  "ui.shortcut.toggleVisibility": "Toggle Visibility",
  "ui.shortcut.takeScreenshot": "Take Screenshot",
  "ui.shortcut.processScreenshots": "Process Screenshots",
  "ui.shortcut.deleteLastScreenshot": "Delete Last Screenshot",
  "ui.shortcut.resetView": "Reset View",
  "ui.shortcut.quitApp": "Quit Application",
  "ui.shortcut.moveWindow": "Move Window",
  "ui.shortcut.decreaseOpacity": "Decrease Opacity",
  "ui.shortcut.increaseOpacity": "Increase Opacity",
  "ui.shortcut.zoomOut": "Zoom Out",
  "ui.shortcut.resetZoom": "Reset Zoom",
  "ui.shortcut.zoomIn": "Zoom In",

  // 顶栏
  "ui.header.programmingLanguageLabel": "Language:",
  "ui.header.toast.loggedOut": "Logged out successfully",
  "ui.header.toast.logoutFailed": "Failed to log out",

  // 队列页
  "ui.queue.screenshot.first": "Take first screenshot",
  "ui.queue.screenshot.second": "Take second screenshot",
  "ui.queue.screenshot.third": "Take third screenshot",
  "ui.queue.screenshot.fourth": "Take fourth screenshot",
  "ui.queue.screenshot.fifth": "Take fifth screenshot",
  "ui.queue.screenshot.replaceFirst": "Next will replace first screenshot",

  // 工具栏与快捷键浮层
  "ui.commands.showHide": "Show/Hide",
  "ui.commands.toggleWindow": "Toggle Window",
  "ui.commands.toggleWindowDescription": "Show or hide this window.",
  "ui.commands.takeScreenshot": "Take Screenshot",
  "ui.commands.takeScreenshotDescription":
    "Take a screenshot of the problem description.",
  "ui.commands.takeScreenshotForCode": "Screenshot your code",
  "ui.commands.takeScreenshotForSolutionDescription":
    "Capture additional parts of the question or your solution for debugging help.",
  "ui.commands.solve": "Solve",
  "ui.commands.solveDescription":
    "Generate a solution based on the current problem.",
  "ui.commands.solveNeedsScreenshot":
    "Take a screenshot first to generate a solution.",
  "ui.commands.deleteLastScreenshot": "Delete Last Screenshot",
  "ui.commands.deleteLastScreenshotDescription":
    "Remove the most recently taken screenshot.",
  "ui.commands.deleteLastScreenshotEmpty": "No screenshots to delete.",
  "ui.commands.debug": "Debug",
  "ui.commands.debugDescription":
    "Generate new solutions based on all previous and newly added screenshots.",
  "ui.commands.startOver": "Start Over",
  "ui.commands.startOverDescription": "Start fresh with a new question.",
  "ui.commands.screenshot": "Screenshot",

  // 解答页
  "ui.solutions.problemStatement": "Problem Statement",
  "ui.solutions.extracting": "Extracting problem statement...",
  "ui.solutions.thoughts": "My Thoughts ({{key}} + Arrow keys to scroll)",
  "ui.solutions.generating": "Generating solutions...",
  "ui.solutions.solutionTitle": "Solution",
  "ui.solutions.loading": "Loading solutions...",
  "ui.solutions.copy": "Copy",
  "ui.solutions.copied": "Copied!",
  "ui.solutions.complexity": "Complexity",
  "ui.solutions.calculating": "Calculating complexity...",
  "ui.solutions.time": "Time:",
  "ui.solutions.space": "Space:",
  "ui.solutions.complexityUnavailable": "Complexity not available",

  // 调试页
  "ui.debug.whatIChanged": "What I Changed",
  "ui.debug.originalCode": "Original Code",
  "ui.debug.analysis": "Analysis & Improvements",
  "ui.debug.loadingAnalysis": "Loading debug analysis...",
  "ui.debug.fallbackThoughts": "Debug analysis based on your screenshots",
  "ui.debug.notAvailable": "N/A - Debug mode",
  "ui.debug.placeholder.noAnalysis": "// No analysis available",
  "ui.debug.placeholder.seeAnalysis": "// Debug mode - see analysis below",

  // Toast：错误与提示
  "ui.error.failedToTakeScreenshot": "Failed to take screenshot",
  "ui.error.failedToProcessScreenshots": "Failed to process screenshots",
  "ui.error.failedToToggleWindow": "Failed to toggle window",
  "ui.error.failedToDeleteScreenshot": "Failed to delete the screenshot",
  "ui.error.failedToReset": "Failed to reset",
  "ui.error.failedToLoadSettings": "Failed to load settings",
  "ui.error.failedToSaveSettings": "Failed to save settings",
  "ui.error.failedToDownloadUpdate": "Failed to download update",
  "ui.error.processingFailed": "Processing Failed",
  "ui.error.queueProcessingDescription":
    "There was an error processing your screenshots.",
  "ui.error.debugDescription": "There was an error debugging your code.",
  "ui.info.noScreenshots": "No Screenshots",
  "ui.info.noScreenshotsToDelete": "There are no screenshots to delete",
  "ui.info.noScreenshotsToProcess": "There are no screenshots to process.",
  "ui.info.noExtraScreenshotsToProcess":
    "There are no extra screenshots to process.",

  // 设置对话框
  "ui.settings.title": "API Settings",
  "ui.settings.description":
    "Configure your API endpoint, key, and models. You need your own API credentials to use this app.",
  "ui.settings.interfaceLanguage": "Interface Language",
  "ui.settings.interfaceLanguageHint":
    "Takes effect immediately, no restart required",
  "ui.settings.interfaceLanguage.current": "Current interface language: {{locale}}",
  "ui.settings.interfaceLanguage.system": "Follow System",
  "ui.settings.interfaceLanguage.zh": "中文",
  "ui.settings.interfaceLanguage.en": "English",
  "ui.settings.baseUrl.label": "Base URL",
  "ui.settings.baseUrl.placeholder": "https://api.example.com/v1",
  "ui.settings.apiFormat.label": "API Format",
  "ui.settings.apiFormat.anthropicMessages": "Anthropic Messages (/v1/messages)",
  "ui.settings.apiFormat.chatCompletions": "Chat Completions (/chat/completions)",
  "ui.settings.apiFormat.responses": "Responses (/responses)",
  "ui.settings.apiKey.label": "API Key",
  "ui.settings.apiKey.placeholder": "Enter your API key",
  "ui.settings.apiKey.show": "Show API key",
  "ui.settings.apiKey.hide": "Hide API key",
  "ui.settings.models.listTitle": "Model List",
  "ui.settings.models.add": "Add Model",
  "ui.settings.models.fetch": "Fetch Models",
  "ui.settings.models.fetching": "Fetching...",
  "ui.settings.models.empty":
    "No models configured. Add a model to use it in chats.",
  "ui.settings.models.addInputLabel": "Model ID",
  "ui.settings.models.addPlaceholder": "Enter a model ID, e.g. glm-4.6",
  "ui.settings.models.addConfirm": "Add",
  "ui.settings.models.addEmpty": "Enter a model ID",
  "ui.settings.models.addDuplicate": "\"{{model}}\" is already in the list",
  "ui.settings.models.remove": "Remove model {{model}}",
  "ui.settings.models.fetchNeedsBaseUrl":
    "Enter a Base URL before fetching models",
  "ui.settings.models.fetchUnavailable":
    "The model list API is not ready yet. Add model IDs manually.",
  "ui.settings.models.fetchUnknownError": "Unknown error",
  "ui.settings.models.fetchFailed": "Failed to fetch models: {{message}}",
  "ui.settings.models.fetchManualHint":
    "You can still add a model ID manually with \"Add Model\"; the form is not blocked.",
  "ui.settings.models.retry": "Retry",
  "ui.settings.models.fetchResultTitle": "Models returned by the API, select to add",
  "ui.settings.models.fetchEmpty":
    "The API returned no models. You can enter a model ID manually.",
  "ui.settings.models.alreadyAdded": "Added",
  "ui.settings.models.addSelected": "Add selected ({{count}})",
  "ui.settings.models.fetchAdded": "Added {{count}} model(s) to the list",
  "ui.settings.bindings.title": "Model Usage",
  "ui.settings.bindings.description":
    "Pick one model from the list above for each usage",
  "ui.settings.bindings.emptyOption": "Add a model first",
  "ui.settings.bindings.selectPlaceholder": "Select a model",
  "ui.settings.bindings.addFirst":
    "Add a model first, then choose one for each usage",
  "ui.settings.models.extraction.title": "Problem Extraction",
  "ui.settings.models.extraction.description":
    "Model used to analyze screenshots and extract problem details",
  "ui.settings.models.solution.title": "Solution Generation",
  "ui.settings.models.solution.description":
    "Model used to generate coded solutions",
  "ui.settings.models.debugging.title": "Debugging",
  "ui.settings.models.debugging.description":
    "Model used to debug and improve solutions",
  "ui.settings.saving": "Saving...",
  "ui.settings.save": "Save Settings",
  "ui.settings.toast.saved": "Settings saved successfully",

  // 更新提示
  "ui.update.readyTitle": "Update Ready to Install",
  "ui.update.availableTitle": "A New Version is Available",
  "ui.update.readyDescription":
    "The update has been downloaded and will be installed when you restart the app.",
  "ui.update.availableDescription":
    "A new version of Interview Coder is available. Please update to continue using the app.",
  "ui.update.restartAndInstall": "Restart and Install",
  "ui.update.downloading": "Downloading...",
  "ui.update.download": "Download Update",

  // 订阅页
  "ui.subscribe.title": "Welcome to Interview Coder",
  "ui.subscribe.description":
    "To continue using Interview Coder, you'll need to subscribe ($60/month)",
  "ui.subscribe.note":
    "* Undetectability may not work with some versions of MacOS. See our help center for more details",
  "ui.subscribe.subscribe": "Subscribe",
  "ui.subscribe.error.signOutFailed": "Failed to sign out. Please try again.",
  "ui.subscribe.error.portalFailed":
    "Failed to open subscription portal. Please try again.",

  // 截图缩略图
  "ui.screenshotQueue.alt": "Screenshot",
  "ui.screenshotQueue.delete": "Delete screenshot",
}
