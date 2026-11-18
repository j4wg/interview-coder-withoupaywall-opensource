/**
 * `main` namespace English messages.
 *
 * The key set is derived from the Chinese table (`MainMessageKeys`), so a missing
 * or extra key fails `tsc -p tsconfig.electron.json` instead of falling back to
 * the key name at runtime.
 */
import type { MainMessageKeys } from "./main.zh"

export const mainEn: Record<MainMessageKeys, string> = {
  // Window lifecycle (main.ts)
  "main.window.loaded": "Window finished loading",
  "main.window.loadFailed":
    "Window failed to load: {{code}} {{description}}",
  "main.window.retryDevServer": "Retrying to load development server...",
  "main.window.retryDevServerFailed":
    "Failed to load dev server on retry:",
  "main.window.loadingDevServer":
    "Loading from development server: http://localhost:54321",
  "main.window.devServerFallback":
    "Failed to load dev server, falling back to local file:",
  "main.window.fallingBackTo": "Falling back to: {{path}}",
  "main.window.loadingProductionBuild": "Loading production build: {{path}}",
  "main.window.openUrlAttempt": "Attempting to open URL: {{url}}",
  "main.window.initialOpacity": "Initial opacity from config: {{opacity}}",
  "main.window.opacityTooLow":
    "Initial opacity too low, setting to 0 and hiding window",
  "main.window.setInitialOpacity": "Setting initial opacity to {{opacity}}",
  "main.window.hidden": "Window hidden, opacity set to 0",
  "main.window.shown":
    "Window shown with showInactive(), opacity set to 1",
  "main.window.toggleState":
    "Toggling window. Current state: {{state}}",
  "main.window.stateVisible": "visible",
  "main.window.stateHidden": "hidden",
  "main.window.moveBounds": "Window vertical move bounds and position:",

  // Environment and app events (main.ts)
  "main.env.loading": "Loading env variables from: {{path}}",
  "main.env.loaded": "Environment variables loaded for open-source version",
  "main.app.openUrl": "open-url event received: {{url}}",
  "main.app.secondInstance": "second-instance event received:",
  "main.config.noApiKey":
    "No API key found in configuration. User will need to set up.",

  // Config layer (ConfigHelper.ts / configFile.ts)
  "main.config.path": "Config file path: {{path}}",
  "main.config.migrated":
    "Config upgraded to v{{version}}: provider and model list need to be set up again.",
  "main.config.legacyModelsDropped":
    "Discarded the legacy built-in model selection: {{keys}}",
  "main.config.normalized":
    "Invalid config values normalized in memory (file left untouched): {{keys}}",
  "main.config.invalidBackedUp":
    "Config file is not valid JSON, backed up to: {{path}}",
  "main.config.invalidReason": "Config parse failure reason: {{message}}",
  "main.config.readFailed":
    "Failed to read config file, using defaults for this run: {{message}}",
  "main.config.writeFailed":
    "Failed to write config file, continuing with in-memory config: {{message}}",
  "main.config.invalidUiLanguage":
    "Invalid UI language value ({{value}}), falling back to follow-system.",
  "main.config.localeUnavailable":
    "Failed to read system locale, falling back to process locale:",
  "main.config.legacyUpdateIgnored":
    "Ignored legacy config fields (v3 no longer writes them): {{keys}}",
  "main.config.bindingCleared":
    "Provider {{providerId}} changed; these uses were unbound and need a model picked again: {{uses}}",
  "main.config.updateFailed": "Failed to update config: {{message}}",
  "main.config.keyTest.noProvider":
    "No provider configured yet. Add one in settings first.",
  "main.config.keyTest.missingBaseUrl":
    "Base URL is not set yet. Please fill in the service address first.",
  "main.config.keyTest.invalidKey":
    "API key is invalid or rejected by the server (HTTP {{status}}).",
  "main.config.keyTest.rateLimited":
    "Too many requests or insufficient quota (HTTP 429). Please retry later.",
  "main.config.keyTest.serverError":
    "Server error (HTTP {{status}}). Please retry later.",
  "main.config.keyTest.httpError":
    "Server returned HTTP {{status}}. Check the Base URL and API format.",
  "main.config.keyTest.networkError":
    "Could not reach the service address: {{message}}",

  // IPC handlers (ipcHandlers.ts)
  "main.ipc.initializing": "Initializing IPC handlers",
  "main.ipc.openingExternalUrl": "Opening external URL: {{url}}",

  // Screenshots (ScreenshotHelper.ts)
  "main.shot.dirCreated": "Created directory: {{path}}",
  "main.shot.deletedExisting": "Deleted existing screenshot: {{path}}",
  "main.shot.deletedExistingExtra":
    "Deleted existing extra screenshot: {{path}}",
  "main.shot.dirsCleaned": "Screenshot directories cleaned successfully",
  "main.shot.setView": "Setting view in ScreenshotHelper: {{view}}",
  "main.shot.queuesState":
    "Current queues - Main: {{main}} Extra: {{extra}}",
  "main.shot.getExtraQueue": "Getting extra screenshot queue: {{queue}}",
  "main.shot.captureStarting": "Starting screenshot capture...",
  "main.shot.captureNonWindows":
    "Taking screenshot on non-Windows platform",
  "main.shot.captureSuccess":
    "Screenshot captured successfully, size: {{bytes}} bytes",
  "main.shot.windowsAttempt":
    "Attempting Windows screenshot with multiple methods",
  "main.shot.windowsTempFile":
    "Taking Windows screenshot to temp file (Method 1): {{path}}",
  "main.shot.windowsMethod1Success":
    "Method 1 successful, screenshot size: {{bytes}} bytes",
  "main.shot.windowsMethod1NoFile": "Method 1 failed: File not created",
  "main.shot.windowsMethod2":
    "Attempting Windows screenshot with PowerShell (Method 2)",
  "main.shot.windowsMethod2Success":
    "Method 2 successful, screenshot size: {{bytes}} bytes",
  "main.shot.windowsAllFailed":
    "All screenshot methods failed, creating placeholder image",
  "main.shot.placeholderCreated":
    "Created placeholder image as fallback",
  "main.shot.takingInView": "Taking screenshot in view: {{view}}",
  "main.shot.addedToMainQueue": "Adding screenshot to main queue: {{path}}",
  "main.shot.removedFromMainQueue":
    "Removed old screenshot from main queue: {{path}}",
  "main.shot.addedToExtraQueue":
    "Adding screenshot to extra queue: {{path}}",
  "main.shot.removedFromExtraQueue":
    "Removed old screenshot from extra queue: {{path}}",

  // Shortcuts (shortcuts.ts)
  "main.shortcut.adjustOpacity":
    "Adjusting opacity from {{from}} to {{to}}",
  "main.shortcut.takingScreenshot": "Taking screenshot...",
  "main.shortcut.resetPressed":
    "Command + R pressed. Canceling requests and resetting queues...",
  "main.shortcut.queuesCleared": "Cleared queues.",
  "main.shortcut.moveLeft":
    "Command/Ctrl + Left pressed. Moving window left.",
  "main.shortcut.moveRight":
    "Command/Ctrl + Right pressed. Moving window right.",
  "main.shortcut.moveDown":
    "Command/Ctrl + Down pressed. Moving window down.",
  "main.shortcut.moveUp":
    "Command/Ctrl + Up pressed. Moving window up.",
  "main.shortcut.toggle":
    "Command/Ctrl + B pressed. Toggling window visibility.",
  "main.shortcut.quit":
    "Command/Ctrl + Q pressed. Quitting application.",
  "main.shortcut.opacityDown":
    "Command/Ctrl + [ pressed. Decreasing opacity.",
  "main.shortcut.opacityUp":
    "Command/Ctrl + ] pressed. Increasing opacity.",
  "main.shortcut.zoomOut": "Command/Ctrl + - pressed. Zooming out.",
  "main.shortcut.zoomReset": "Command/Ctrl + 0 pressed. Resetting zoom.",
  "main.shortcut.zoomIn": "Command/Ctrl + = pressed. Zooming in.",
  "main.shortcut.deleteLast":
    "Command/Ctrl + L pressed. Deleting last screenshot.",

  // Auto updater (autoUpdater.ts)
  "main.update.initializing": "Initializing auto-updater...",
  "main.update.initialized":
    "Auto-updater initialized in {{mode}} mode",
  "main.update.modeDev": "development",
  "main.update.modeProd": "production",
  "main.update.skipDev": "Skipping auto-updater in development mode",
  "main.update.loggerConfigured":
    "Auto-updater logger configured with level: {{level}}",
  "main.update.checking": "Checking for updates...",
  "main.update.checkingInterval": "Checking for updates (interval)...",
  "main.update.available": "Update available:",
  "main.update.notAvailable": "Update not available:",
  "main.update.downloadProgress": "Download progress:",
  "main.update.downloaded": "Update downloaded:",
  "main.update.sendingAvailable":
    "Sending update-available to window",
  "main.update.sendingDownloaded":
    "Sending update-downloaded to window",
  "main.update.checkResult": "Update check result:",
  "main.update.checkResultInterval":
    "Update check result (interval):",
  "main.update.startRequested": "Start update requested",
  "main.update.downloadCompleted": "Update download completed",
  "main.update.installRequested": "Install update requested",

  // Preload (preload.ts)
  "main.preload.starting": "Preload script starting...",
  "main.preload.running": "Preload script is running",
  "main.preload.toggleCalled": "toggleMainWindow called from preload",
  "main.preload.toggleResult": "toggle-window result:",
  "main.preload.exposingApi":
    "About to expose electronAPI with methods:",
  "main.preload.apiExposed": "electronAPI exposed to window",

  // Errors and error logs
  "main.error.indexHtmlMissing":
    "Could not find index.html in dist folder",
  "main.error.invalidUrl":
    "Invalid URL in setWindowOpenHandler: {{url}}",
  "main.error.initFailed": "Failed to initialize application:",
  "main.error.noMainWindow": "No main window available",
  "main.error.screenshotHelperNotInitialized":
    "Screenshot helper not initialized",
  "main.error.resolveUiLocale": "Error resolving UI locale:",
  "main.error.apiKeyFormat":
    "Invalid API key format: it must not be empty or contain whitespace",
  "main.error.setInitialCredits": "Error setting initial credits:",
  "main.error.decrementCredits": "Error decrementing credits:",
  "main.error.getScreenshots": "Error getting screenshots:",
  "main.error.triggerScreenshot": "Error triggering screenshot:",
  "main.error.triggerScreenshotFailed": "Failed to trigger screenshot",
  "main.error.noMainWindowAvailable": "No main window available",
  "main.error.takeScreenshot": "Error taking screenshot:",
  "main.error.takeScreenshotFailed": "Failed to take screenshot",
  "main.error.openUrl": "Error opening URL {{url}}:",
  "main.error.openUrlFailed": "Failed to open URL: {{error}}",
  "main.error.mainWindowNotAvailable": "Main window not available",
  "main.error.toggleWindow": "Error toggling window:",
  "main.error.toggleWindowFailed": "Failed to toggle window",
  "main.error.resetQueues": "Error resetting queues:",
  "main.error.resetQueuesFailed": "Failed to reset queues",
  "main.error.processScreenshots": "Error processing screenshots:",
  "main.error.processScreenshotsFailed":
    "Failed to process screenshots",
  "main.error.apiKeyRequired": "API key required",
  "main.error.triggerReset": "Error triggering reset:",
  "main.error.triggerResetFailed": "Failed to trigger reset",
  "main.error.moveLeft": "Error moving window left:",
  "main.error.moveLeftFailed": "Failed to move window left",
  "main.error.moveRight": "Error moving window right:",
  "main.error.moveRightFailed": "Failed to move window right",
  "main.error.moveUp": "Error moving window up:",
  "main.error.moveUpFailed": "Failed to move window up",
  "main.error.moveDown": "Error moving window down:",
  "main.error.moveDownFailed": "Failed to move window down",
  "main.error.deleteLastScreenshot":
    "Error deleting last screenshot:",
  "main.error.deleteLastScreenshotFailed":
    "Failed to delete last screenshot",
  "main.error.noScreenshotsToDelete": "No screenshots to delete",
  "main.error.createDir": "Error creating directory {{path}}:",
  "main.error.deleteScreenshot":
    "Error deleting screenshot {{path}}:",
  "main.error.deleteExtraScreenshot":
    "Error deleting extra screenshot {{path}}:",
  "main.error.cleanDirs": "Error cleaning screenshot directories:",
  "main.error.deleteScreenshotAt":
    "Error deleting screenshot at {{path}}:",
  "main.error.deleteExtraScreenshotAt":
    "Error deleting extra screenshot at {{path}}:",
  "main.error.capture": "Error capturing screenshot:",
  "main.error.captureFailed": "Failed to capture screenshot: {{error}}",
  "main.error.cleanupTempFile": "Failed to clean up temp file:",
  "main.error.cleanupPowerShellTemp":
    "Failed to clean up PowerShell temp file:",
  "main.error.windowsMethod1Failed":
    "Windows screenshot Method 1 failed:",
  "main.error.windowsMethod2Failed":
    "Windows PowerShell screenshot failed:",
  "main.error.windowsAllFailed":
    "Could not capture screenshot with any method. Please check your Windows security settings and try again.",
  "main.error.emptyBuffer":
    "Screenshot capture returned empty buffer",
  "main.error.fileNotCreated": "Screenshot file not created",
  "main.error.powerShellFileNotCreated":
    "PowerShell screenshot file not created",
  "main.error.removeOld": "Error removing old screenshot:",
  "main.error.imageNotFound": "Image file not found: {{path}}",
  "main.error.readImage": "Error reading image:",
  "main.error.deleteFile": "Error deleting file:",
  "main.error.saveOpacity": "Error saving opacity to config:",
  "main.error.captureShortcut": "Error capturing screenshot:",
  "main.error.ghTokenMissing":
    "GH_TOKEN environment variable is not set",
  "main.error.updater": "Auto updater error:",
  "main.error.checkFailed": "Error checking for updates:",
  "main.error.checkFailedInterval":
    "Error checking for updates (interval):",
  "main.error.startUpdate": "Failed to start update:",
  "main.error.preloadToggle": "Error in toggleMainWindow:",

  // Script output (stealth-run.sh / stealth-run.bat)
  "main.script.stealth.title":
    "=== Interview Coder - Invisible Edition (No Paywall) ===",
  "main.script.stealth.important":
    "IMPORTANT: This app is designed to be INVISIBLE by default!",
  "main.script.stealth.useShortcuts":
    "Use the keyboard shortcuts to control it:",
  "main.script.stealth.shortcutToggle":
    "- Toggle Window Visibility: Cmd+B",
  "main.script.stealth.shortcutScreenshot": "- Take Screenshot: Cmd+H",
  "main.script.stealth.shortcutProcess":
    "- Process Screenshots: Cmd+Enter",
  "main.script.stealth.shortcutMove":
    "- Move Window: Cmd+Arrow keys (Left/Right/Up/Down)",
  "main.script.stealth.shortcutOpacity":
    "- Decrease Opacity: Cmd+[ / Increase Opacity: Cmd+]",
  "main.script.stealth.shortcutReset": "- Start New Problem: Cmd+R",
  "main.script.stealth.shortcutQuit": "- Quit: Cmd+Q",
  "main.script.stealth.toggleHint":
    "When you press Cmd+B, the window will toggle between visible and invisible.",
  "main.script.stealth.moveHint":
    "If movement shortcuts aren't working, try making the window visible first with Cmd+B.",
  "main.script.step.dirs": "=== Step 1: Creating required directories... ===",
  "main.script.step.clean": "=== Step 2: Cleaning previous builds... ===",
  "main.script.step.cleanDetail":
    "Removing old build files to ensure a fresh start...",
  "main.script.step.build": "=== Step 3: Building application... ===",
  "main.script.step.buildDetail": "This may take a moment...",
  "main.script.step.launch": "=== Step 4: Launching in stealth mode... ===",
  "main.script.step.launchHint":
    "Remember: Cmd+B to make it visible, Cmd+[ and Cmd+] to adjust opacity!",
  "main.script.stealth.running":
    "App is now running invisibly! Press Cmd+B to make it visible.",
  "main.script.stealth.issues": "If you encounter any issues:",
  "main.script.stealth.issue1":
    "1. Make sure you've installed dependencies with 'npm install'",
  "main.script.stealth.issue2":
    "2. Make sure this script has execute permissions (chmod +x stealth-run.sh)",
  "main.script.stealth.issue3":
    "3. Press Cmd+B multiple times to toggle visibility",
  "main.script.stealth.issue4":
    "4. Check Activity Monitor to verify the app is running",
  "main.script.stealth.batIssue2":
    "2. Press Ctrl+B multiple times to toggle visibility",
  "main.script.stealth.batIssue3":
    "3. Check Task Manager to verify the app is running",

  // Script output (cleanup-for-github.sh / .bat)
  "main.script.cleanup.start": "Cleaning up project for GitHub...",
  "main.script.cleanup.rmNodeModules": "Removing node_modules directory...",
  "main.script.cleanup.rmDist": "Removing dist directory...",
  "main.script.cleanup.rmDistElectron": "Removing dist-electron directory...",
  "main.script.cleanup.rmRelease": "Removing release directory...",
  "main.script.cleanup.rmPackageLock": "Removing package-lock.json...",
  "main.script.cleanup.rmEnv": "Removing any .env files...",
  "main.script.cleanup.done": "Cleanup complete!",
  "main.script.cleanup.ready": "Ready to commit to GitHub.",
  "main.script.cleanup.afterClone":
    "Run 'npm install' after cloning to install dependencies.",
  "main.script.cleanup.pressEnter": "Press Enter to continue..."
}
