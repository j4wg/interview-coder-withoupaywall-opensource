import { app, BrowserWindow, screen, shell, ipcMain } from "electron"
import path from "path"
import fs from "fs"
import { initializeIpcHandlers } from "./ipcHandlers"
import { ProcessingHelper } from "./ProcessingHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { initAutoUpdater } from "./autoUpdater"
import { configHelper } from "./ConfigHelper"
import * as dotenv from "dotenv"
// Simple logging functions
const safeLog = (...args: any[]) => console.log(...args)
const safeError = (...args: any[]) => console.error(...args)
const safeWarn = (...args: any[]) => console.warn(...args)

// Constants
const isDev = process.env.NODE_ENV === "development"

// Global error handler to prevent EIO crashes
process.on('uncaughtException', (error) => {
  if (error.message.includes('EIO') || error.message.includes('write EIO')) {
    // Silently ignore EIO errors during shutdown
    return;
  }
  safeError('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  if (reason && typeof reason === 'object' && 'message' in reason && 
      typeof reason.message === 'string' &&
      (reason.message.includes('EIO') || reason.message.includes('write EIO'))) {
    // Silently ignore EIO errors during shutdown
    return;
  }
  safeError('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Application State
const state = {
  // Window management properties
  mainWindow: null as BrowserWindow | null,
  browserWindow: null as BrowserWindow | null,
  isWindowVisible: false,
  isBrowserWindowVisible: false,
  windowPosition: null as { x: number; y: number } | null,
  windowSize: null as { width: number; height: number } | null,
  browserWindowPosition: null as { x: number; y: number } | null,
  browserWindowSize: null as { width: number; height: number } | null,
  screenWidth: 0,
  screenHeight: 0,
  step: 0,
  currentX: 0,
  currentY: 0,

  // Application helpers
  screenshotHelper: null as ScreenshotHelper | null,
  shortcutsHelper: null as ShortcutsHelper | null,
  processingHelper: null as ProcessingHelper | null,

  // View and state management
  view: "queue" as "queue" | "solutions" | "debug",
  problemInfo: null as any,
  hasDebugged: false,

  // Processing events
  PROCESSING_EVENTS: {
    UNAUTHORIZED: "processing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",
    OUT_OF_CREDITS: "out-of-credits",
    API_KEY_INVALID: "api-key-invalid",
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
  } as const
}

// Add interfaces for helper classes
export interface IProcessingHelperDeps {
  getScreenshotHelper: () => ScreenshotHelper | null
  getMainWindow: () => BrowserWindow | null
  getView: () => "queue" | "solutions" | "debug"
  setView: (view: "queue" | "solutions" | "debug") => void
  getProblemInfo: () => any
  setProblemInfo: (info: any) => void
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  clearQueues: () => void
  takeScreenshot: () => Promise<string>
  getImagePreview: (filepath: string) => Promise<string>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  setHasDebugged: (value: boolean) => void
  getHasDebugged: () => boolean
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS
}

export interface IShortcutsHelperDeps {
  getMainWindow: () => BrowserWindow | null
  takeScreenshot: () => Promise<string>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: ProcessingHelper | null
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  isVisible: () => boolean
  toggleMainWindow: () => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
  toggleBrowserWindow: () => void
  closeBrowserWindow: () => void
}

export interface IIpcHandlerDeps {
  getMainWindow: () => BrowserWindow | null
  setWindowDimensions: (width: number, height: number) => void
  getScreenshotQueue: () => string[]
  getExtraScreenshotQueue: () => string[]
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  getImagePreview: (filepath: string) => Promise<string>
  processingHelper: ProcessingHelper | null
  PROCESSING_EVENTS: typeof state.PROCESSING_EVENTS
  takeScreenshot: () => Promise<string>
  getView: () => "queue" | "solutions" | "debug"
  toggleMainWindow: () => void
  clearQueues: () => void
  setView: (view: "queue" | "solutions" | "debug") => void
  moveWindowLeft: () => void
  moveWindowRight: () => void
  moveWindowUp: () => void
  moveWindowDown: () => void
}

// Initialize helpers
function initializeHelpers() {
  state.screenshotHelper = new ScreenshotHelper(state.view)
  state.processingHelper = new ProcessingHelper({
    getScreenshotHelper,
    getMainWindow,
    getView,
    setView,
    getProblemInfo,
    setProblemInfo,
    getScreenshotQueue,
    getExtraScreenshotQueue,
    clearQueues,
    takeScreenshot,
    getImagePreview,
    deleteScreenshot,
    setHasDebugged,
    getHasDebugged,
    PROCESSING_EVENTS: state.PROCESSING_EVENTS
  } as IProcessingHelperDeps)
  state.shortcutsHelper = new ShortcutsHelper({
    getMainWindow,
    takeScreenshot,
    getImagePreview,
    processingHelper: state.processingHelper,
    clearQueues,
    setView,
    isVisible: () => state.isWindowVisible,
    toggleMainWindow,
    moveWindowLeft: () =>
      moveWindowHorizontal((x) =>
        Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
      ),
    moveWindowRight: () =>
      moveWindowHorizontal((x) =>
        Math.min(
          state.screenWidth - (state.windowSize?.width || 0) / 2,
          x + state.step
        )
      ),
    moveWindowUp: () => moveWindowVertical((y) => y - state.step),
    moveWindowDown: () => moveWindowVertical((y) => y + state.step),
    toggleBrowserWindow,
    closeBrowserWindow
  } as IShortcutsHelperDeps)
}

// Auth callback handler

// Register the interview-coder protocol
if (process.platform === "darwin") {
  app.setAsDefaultProtocolClient("interview-coder")
} else {
  app.setAsDefaultProtocolClient("interview-coder", process.execPath, [
    path.resolve(process.argv[1] || "")
  ])
}

// Handle the protocol. In this case, we choose to show an Error Box.
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient("interview-coder", process.execPath, [
    path.resolve(process.argv[1])
  ])
}

// Force Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on("second-instance", (event, commandLine) => {
    // Someone tried to run a second instance, we should focus our window.
    if (state.mainWindow) {
      if (state.mainWindow.isMinimized()) state.mainWindow.restore()
      state.mainWindow.focus()

      // Protocol handler removed - no longer using auth callbacks
    }
  })
}

// Auth callback removed as we no longer use Supabase authentication

// Window management functions
async function createWindow(): Promise<void> {
  if (state.mainWindow) {
    if (state.mainWindow.isMinimized()) state.mainWindow.restore()
    state.mainWindow.focus()
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workAreaSize
  state.screenWidth = workArea.width
  state.screenHeight = workArea.height
  state.step = 60
  state.currentY = 50

  const windowSettings: Electron.BrowserWindowConstructorOptions = {
    width: 800,
    height: 600,
    minWidth: 750,
    minHeight: 550,
    x: state.currentX,
    y: 50,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: isDev
        ? path.join(__dirname, "../dist-electron/preload.js")
        : path.join(__dirname, "preload.js"),
      scrollBounce: true
    },
    show: true,
    frame: false,
    transparent: true,
    fullscreenable: false,
    hasShadow: false,
    opacity: 1.0,  // Start with full opacity
    backgroundColor: "#00000000",
    focusable: true,
    skipTaskbar: true,
    type: "panel",
    paintWhenInitiallyHidden: true,
    titleBarStyle: "hidden",
    enableLargerThanScreen: true,
    movable: true
  }

  state.mainWindow = new BrowserWindow(windowSettings)

  // Add more detailed logging for window events
  state.mainWindow.webContents.on("did-finish-load", () => {
    safeLog("Window finished loading")
  })
  state.mainWindow.webContents.on(
    "did-fail-load",
    async (event, errorCode, errorDescription) => {
      safeError("Window failed to load:", errorCode, errorDescription)
      if (isDev) {
        // In development, retry loading after a short delay
        safeLog("Retrying to load development server...")
        setTimeout(() => {
          state.mainWindow?.loadURL("http://localhost:54321").catch((error) => {
            safeError("Failed to load dev server on retry:", error)
          })
        }, 1000)
      }
    }
  )

  if (isDev) {
    // In development, load from the dev server
    safeLog("Loading from development server: http://localhost:54321")
    state.mainWindow.loadURL("http://localhost:54321").catch((error) => {
      safeError("Failed to load dev server, falling back to local file:", error)
      // Fallback to local file if dev server is not available
      const indexPath = path.join(__dirname, "../dist/index.html")
      safeLog("Falling back to:", indexPath)
      if (fs.existsSync(indexPath)) {
        state.mainWindow.loadFile(indexPath)
      } else {
        safeError("Could not find index.html in dist folder")
      }
    })
  } else {
    // In production, load from the built files
    const indexPath = path.join(__dirname, "../dist/index.html")
    safeLog("Loading production build:", indexPath)
    
    if (fs.existsSync(indexPath)) {
      state.mainWindow.loadFile(indexPath)
    } else {
      safeError("Could not find index.html in dist folder")
    }
  }

  // Configure window behavior
  state.mainWindow.webContents.setZoomFactor(1)
  if (isDev) {
    state.mainWindow.webContents.openDevTools()
  }
  state.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    safeLog("Attempting to open URL:", url)
    try {
      const parsedURL = new URL(url);
      const hostname = parsedURL.hostname;
      const allowedHosts = ["google.com", "supabase.co"];
      if (allowedHosts.includes(hostname) || hostname.endsWith(".google.com") || hostname.endsWith(".supabase.co")) {
        shell.openExternal(url);
        return { action: "deny" }; // Do not open this URL in a new Electron window
      }
    } catch (error) {
      safeError("Invalid URL %d in setWindowOpenHandler: %d" , url , error);
      return { action: "deny" }; // Deny access as URL string is malformed or invalid
    }
    return { action: "allow" };
  })

  // Enhanced screen capture resistance
  state.mainWindow.setContentProtection(true)

  state.mainWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true
  })
  state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1)

  // Additional screen capture resistance settings
  if (process.platform === "darwin") {
    // Prevent window from being captured in screenshots
    state.mainWindow.setHiddenInMissionControl(true)
    state.mainWindow.setWindowButtonVisibility(false)
    state.mainWindow.setBackgroundColor("#00000000")

    // Prevent window from being included in window switcher
    state.mainWindow.setSkipTaskbar(true)

    // Disable window shadow
    state.mainWindow.setHasShadow(false)
  }

  // Prevent the window from being captured by screen recording
  state.mainWindow.webContents.setBackgroundThrottling(false)
  state.mainWindow.webContents.setFrameRate(60)

  // Set up window listeners
  state.mainWindow.on("move", handleWindowMove)
  state.mainWindow.on("resize", handleWindowResize)
  state.mainWindow.on("closed", handleWindowClosed)

  // Initialize window state
  const bounds = state.mainWindow.getBounds()
  state.windowPosition = { x: bounds.x, y: bounds.y }
  state.windowSize = { width: bounds.width, height: bounds.height }
  state.currentX = bounds.x
  state.currentY = bounds.y
  state.isWindowVisible = true
  
  // Set opacity based on user preferences or hide initially
  // Ensure the window is visible for the first launch or if opacity > 0.1
  const savedOpacity = configHelper.getOpacity();
  safeLog(`Initial opacity from config: ${savedOpacity}`);
  
  // Always make sure window is shown first
  state.mainWindow.showInactive(); // Use showInactive for consistency
  
  if (savedOpacity <= 0.1) {
    safeLog('Initial opacity too low, setting to 0 and hiding window');
    state.mainWindow.setOpacity(0);
    state.isWindowVisible = false;
  } else {
    safeLog(`Setting initial opacity to ${savedOpacity}`);
    state.mainWindow.setOpacity(savedOpacity);
    state.isWindowVisible = true;
  }
}

function handleWindowMove(): void {
  if (!state.mainWindow) return
  const bounds = state.mainWindow.getBounds()
  state.windowPosition = { x: bounds.x, y: bounds.y }
  state.currentX = bounds.x
  state.currentY = bounds.y
}

function handleWindowResize(): void {
  if (!state.mainWindow) return
  const bounds = state.mainWindow.getBounds()
  state.windowSize = { width: bounds.width, height: bounds.height }
}

function handleWindowClosed(): void {
  state.mainWindow = null
  state.isWindowVisible = false
  state.windowPosition = null
  state.windowSize = null
}

// Browser window management functions
async function createBrowserWindow(): Promise<void> {
  if (state.browserWindow) {
    if (state.browserWindow.isMinimized()) state.browserWindow.restore()
    state.browserWindow.focus()
    return
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workAreaSize
  
  const windowSettings: Electron.BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    x: Math.floor((workArea.width - 1200) / 2),
    y: Math.floor((workArea.height - 800) / 2),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    show: false,
    frame: false,
    transparent: true,
    fullscreenable: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    focusable: true,
    skipTaskbar: true,
    title: "Browser",
    titleBarStyle: "hidden",
    enableLargerThanScreen: true,
    movable: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    closable: true,
    alwaysOnTop: true,
    type: "panel"
  }

  state.browserWindow = new BrowserWindow(windowSettings)

  // Load a default page or let user navigate
  await state.browserWindow.loadURL("https://www.google.com")

  // Set up window listeners
  state.browserWindow.on("move", handleBrowserWindowMove)
  state.browserWindow.on("resize", handleBrowserWindowResize)
  state.browserWindow.on("closed", handleBrowserWindowClosed)
  state.browserWindow.on("show", () => {
    state.isBrowserWindowVisible = true
  })
  state.browserWindow.on("hide", () => {
    state.isBrowserWindowVisible = false
  })

  // Apply transparency and stealth settings similar to main window
  state.browserWindow.setContentProtection(true)
  state.browserWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true
  })
  state.browserWindow.setAlwaysOnTop(true, "screen-saver", 1)

  // Additional screen capture resistance settings for macOS
  if (process.platform === "darwin") {
    state.browserWindow.setHiddenInMissionControl(true)
    state.browserWindow.setWindowButtonVisibility(false)
    state.browserWindow.setBackgroundColor("#00000000")
    state.browserWindow.setSkipTaskbar(true)
    state.browserWindow.setHasShadow(false)
  }

  // Prevent the window from being captured by screen recording
  state.browserWindow.webContents.setBackgroundThrottling(false)
  state.browserWindow.webContents.setFrameRate(60)

  // Initialize window state
  const bounds = state.browserWindow.getBounds()
  state.browserWindowPosition = { x: bounds.x, y: bounds.y }
  state.browserWindowSize = { width: bounds.width, height: bounds.height }
  
  // Show the window
  state.browserWindow.show()
  state.isBrowserWindowVisible = true
  
  safeLog("Browser window created and shown")
}

function handleBrowserWindowMove(): void {
  if (!state.browserWindow) return
  const bounds = state.browserWindow.getBounds()
  state.browserWindowPosition = { x: bounds.x, y: bounds.y }
}

function handleBrowserWindowResize(): void {
  if (!state.browserWindow) return
  const bounds = state.browserWindow.getBounds()
  state.browserWindowSize = { width: bounds.width, height: bounds.height }
}

function handleBrowserWindowClosed(): void {
  state.browserWindow = null
  state.isBrowserWindowVisible = false
  state.browserWindowPosition = null
  state.browserWindowSize = null
}

function toggleBrowserWindow(): void {
  safeLog(`Toggling browser window. Current state: ${state.isBrowserWindowVisible ? 'visible' : 'hidden'}`)
  safeLog(`Browser window exists: ${!!state.browserWindow}, destroyed: ${state.browserWindow?.isDestroyed()}`)
  
  if (state.browserWindow && !state.browserWindow.isDestroyed()) {
    // Window exists, toggle visibility
    if (state.isBrowserWindowVisible) {
      hideBrowserWindow()
    } else {
      showBrowserWindow()
    }
  } else {
    // Window doesn't exist or is destroyed, create it
    createBrowserWindow()
  }
}

function showBrowserWindow(): void {
  if (state.browserWindow && !state.browserWindow.isDestroyed()) {
    if (state.browserWindow.isMinimized()) state.browserWindow.restore()
    state.browserWindow.show()
    state.browserWindow.focus()
    state.isBrowserWindowVisible = true
    safeLog("Browser window shown")
  } else {
    createBrowserWindow()
  }
}

function hideBrowserWindow(): void {
  if (state.browserWindow && !state.browserWindow.isDestroyed()) {
    state.browserWindow.hide()
    state.isBrowserWindowVisible = false
    safeLog("Browser window hidden")
  }
}

function closeBrowserWindow(): void {
  if (state.browserWindow && !state.browserWindow.isDestroyed()) {
    state.browserWindow.close()
  }
}

// Window visibility functions
function hideMainWindow(): void {
  if (!state.mainWindow?.isDestroyed()) {
    const bounds = state.mainWindow.getBounds();
    state.windowPosition = { x: bounds.x, y: bounds.y };
    state.windowSize = { width: bounds.width, height: bounds.height };
    state.mainWindow.setIgnoreMouseEvents(true, { forward: true });
    state.mainWindow.setOpacity(0);
    state.isWindowVisible = false;
    safeLog('Window hidden, opacity set to 0');
  }
}

function showMainWindow(): void {
  if (!state.mainWindow?.isDestroyed()) {
    if (state.windowPosition && state.windowSize) {
      state.mainWindow.setBounds({
        ...state.windowPosition,
        ...state.windowSize
      });
    }
    state.mainWindow.setIgnoreMouseEvents(false);
    state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
    state.mainWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true
    });
    state.mainWindow.setContentProtection(true);
    
    // Force show the window first
    state.mainWindow.showInactive();
    
    // Set opacity to 1 to make it visible
    state.mainWindow.setOpacity(1);
    state.isWindowVisible = true;
    safeLog('Window shown with showInactive(), opacity set to 1');
  }
}

function toggleMainWindow(): void {
  safeLog(`Toggling window. Current state: ${state.isWindowVisible ? 'visible' : 'hidden'}`);
  safeLog(`Window exists: ${!!state.mainWindow}, Window destroyed: ${state.mainWindow?.isDestroyed()}`);
  
  if (state.isWindowVisible) {
    hideMainWindow();
  } else {
    showMainWindow();
  }
}

// Window movement functions
function moveWindowHorizontal(updateFn: (x: number) => number): void {
  if (!state.mainWindow) return
  state.currentX = updateFn(state.currentX)
  state.mainWindow.setPosition(
    Math.round(state.currentX),
    Math.round(state.currentY)
  )
}

function moveWindowVertical(updateFn: (y: number) => number): void {
  if (!state.mainWindow) return

  const newY = updateFn(state.currentY)
  // Allow window to go 2/3 off screen in either direction
  const maxUpLimit = (-(state.windowSize?.height || 0) * 2) / 3
  const maxDownLimit =
    state.screenHeight + ((state.windowSize?.height || 0) * 2) / 3

  // Log the current state and limits
  safeLog(JSON.stringify({
    newY,
    maxUpLimit,
    maxDownLimit,
    screenHeight: state.screenHeight,
    windowHeight: state.windowSize?.height,
    currentY: state.currentY
  }))

  // Only update if within bounds
  if (newY >= maxUpLimit && newY <= maxDownLimit) {
    state.currentY = newY
    state.mainWindow.setPosition(
      Math.round(state.currentX),
      Math.round(state.currentY)
    )
  }
}

// Window dimension functions
function setWindowDimensions(width: number, height: number): void {
  if (!state.mainWindow?.isDestroyed()) {
    const [currentX, currentY] = state.mainWindow.getPosition()
    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workAreaSize
    const maxWidth = Math.floor(workArea.width * 0.5)

    state.mainWindow.setBounds({
      x: Math.min(currentX, workArea.width - maxWidth),
      y: currentY,
      width: Math.min(width + 32, maxWidth),
      height: Math.ceil(height)
    })
  }
}

// Environment setup
function loadEnvVariables() {
  if (isDev) {
    safeLog("Loading env variables from:", path.join(process.cwd(), ".env"))
    dotenv.config({ path: path.join(process.cwd(), ".env") })
  } else {
    safeLog(
      "Loading env variables from:",
      path.join(process.resourcesPath, ".env")
    )
    dotenv.config({ path: path.join(process.resourcesPath, ".env") })
  }
  safeLog("Environment variables loaded for open-source version")
}

// Initialize application
async function initializeApp() {
  try {
    // Set custom cache directory to prevent permission issues
    const appDataPath = path.join(app.getPath('appData'), 'interview-coder-v1')
    const sessionPath = path.join(appDataPath, 'session')
    const tempPath = path.join(appDataPath, 'temp')
    const cachePath = path.join(appDataPath, 'cache')
    
    // Create directories if they don't exist
    for (const dir of [appDataPath, sessionPath, tempPath, cachePath]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
    
    app.setPath('userData', appDataPath)
    app.setPath('sessionData', sessionPath)      
    app.setPath('temp', tempPath)
    app.setPath('cache', cachePath)
      
    loadEnvVariables()
    
    // Ensure a configuration file exists
    if (!configHelper.hasApiKey()) {
      safeLog("No API key found in configuration. User will need to set up.")
    }
    
    initializeHelpers()
    initializeIpcHandlers({
      getMainWindow,
      setWindowDimensions,
      getScreenshotQueue,
      getExtraScreenshotQueue,
      deleteScreenshot,
      getImagePreview,
      processingHelper: state.processingHelper,
      PROCESSING_EVENTS: state.PROCESSING_EVENTS,
      takeScreenshot,
      getView,
      toggleMainWindow,
      clearQueues,
      setView,
      moveWindowLeft: () =>
        moveWindowHorizontal((x) =>
          Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)
        ),
      moveWindowRight: () =>
        moveWindowHorizontal((x) =>
          Math.min(
            state.screenWidth - (state.windowSize?.width || 0) / 2,
            x + state.step
          )
        ),
      moveWindowUp: () => moveWindowVertical((y) => y - state.step),
      moveWindowDown: () => moveWindowVertical((y) => y + state.step)
    })
    await createWindow()
    state.shortcutsHelper?.registerGlobalShortcuts()

    // Initialize auto-updater regardless of environment
    initAutoUpdater()
    safeLog(
      "Auto-updater initialized in",
      isDev ? "development" : "production",
      "mode"
    )
  } catch (error) {
    safeError("Failed to initialize application:", error)
    app.quit()
  }
}

// Auth callback handling removed - no longer needed
app.on("open-url", (event, url) => {
  safeLog("open-url event received:", url)
  event.preventDefault()
})

// Handle second instance (removed auth callback handling)
app.on("second-instance", (event, commandLine) => {
  safeLog("second-instance event received:", commandLine)
  
  // Focus or create the main window
  if (!state.mainWindow) {
    createWindow()
  } else {
    if (state.mainWindow.isMinimized()) state.mainWindow.restore()
    state.mainWindow.focus()
  }
})

// Prevent multiple instances of the app
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
      state.mainWindow = null
    }
  })
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// State getter/setter functions
function getMainWindow(): BrowserWindow | null {
  return state.mainWindow
}

function getView(): "queue" | "solutions" | "debug" {
  return state.view
}

function setView(view: "queue" | "solutions" | "debug"): void {
  state.view = view
  state.screenshotHelper?.setView(view)
}

function getScreenshotHelper(): ScreenshotHelper | null {
  return state.screenshotHelper
}

function getProblemInfo(): any {
  return state.problemInfo
}

function setProblemInfo(problemInfo: any): void {
  state.problemInfo = problemInfo
}

function getScreenshotQueue(): string[] {
  return state.screenshotHelper?.getScreenshotQueue() || []
}

function getExtraScreenshotQueue(): string[] {
  return state.screenshotHelper?.getExtraScreenshotQueue() || []
}

function clearQueues(): void {
  state.screenshotHelper?.clearQueues()
  state.problemInfo = null
  setView("queue")
}

async function takeScreenshot(): Promise<string> {
  if (!state.mainWindow) throw new Error("No main window available")
  return (
    state.screenshotHelper?.takeScreenshot(
      () => hideMainWindow(),
      () => showMainWindow()
    ) || ""
  )
}

async function getImagePreview(filepath: string): Promise<string> {
  return state.screenshotHelper?.getImagePreview(filepath) || ""
}

async function deleteScreenshot(
  path: string
): Promise<{ success: boolean; error?: string }> {
  return (
    state.screenshotHelper?.deleteScreenshot(path) || {
      success: false,
      error: "Screenshot helper not initialized"
    }
  )
}

function setHasDebugged(value: boolean): void {
  state.hasDebugged = value
}

function getHasDebugged(): boolean {
  return state.hasDebugged
}

// Export state and functions for other modules
export {
  state,
  createWindow,
  hideMainWindow,
  showMainWindow,
  toggleMainWindow,
  setWindowDimensions,
  moveWindowHorizontal,
  moveWindowVertical,
  getMainWindow,
  getView,
  setView,
  getScreenshotHelper,
  getProblemInfo,
  setProblemInfo,
  getScreenshotQueue,
  getExtraScreenshotQueue,
  clearQueues,
  takeScreenshot,
  getImagePreview,
  deleteScreenshot,
  setHasDebugged,
  getHasDebugged,
  createBrowserWindow,
  toggleBrowserWindow,
  showBrowserWindow,
  hideBrowserWindow,
  closeBrowserWindow
}

app.whenReady().then(initializeApp)
