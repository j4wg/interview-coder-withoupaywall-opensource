import { globalShortcut, app } from "electron";
import { IShortcutsHelperDeps } from "./main";
import { configHelper } from "./ConfigHelper";
import log from "electron-log";

export class ShortcutsHelper {
  private deps: IShortcutsHelperDeps;

  constructor(deps: IShortcutsHelperDeps) {
    this.deps = deps;
  }

  private adjustOpacity(delta: number): void {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    let currentOpacity = mainWindow.getOpacity();
    let newOpacity = Math.max(0.1, Math.min(1.0, currentOpacity + delta));
    log.info(`Adjusting opacity from ${currentOpacity} to ${newOpacity}`);

    mainWindow.setOpacity(newOpacity);

    // Save the opacity setting to config without re-initializing the client
    try {
      const config = configHelper.loadConfig();
      config.opacity = newOpacity;
      configHelper.saveConfig(config);
    } catch (error) {
      console.error("Error saving opacity to config:", error);
    }

    // If we're making the window visible, also make sure it's shown and interaction is enabled
    if (newOpacity > 0.1 && !this.deps.isVisible()) {
      this.deps.toggleMainWindow();
    }
  }

  public registerGlobalShortcuts(): void {
    globalShortcut.register("CommandOrControl+H", async () => {
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow) {
        log.info("Taking screenshot...");
        try {
          const screenshotPath = await this.deps.takeScreenshot();
          const preview = await this.deps.getImagePreview(screenshotPath);
          mainWindow.webContents.send("screenshot-taken", {
            path: screenshotPath,
            preview,
          });
        } catch (error) {
          console.error("Error capturing screenshot:", error);
        }
      }
    });

    globalShortcut.register("CommandOrControl+Enter", async () => {
      await this.deps.processingHelper?.processScreenshots();
    });

    globalShortcut.register("CommandOrControl+R", () => {
      log.info(
        "Command + R pressed. Canceling requests and resetting queues..."
      );

      // Cancel ongoing API requests
      this.deps.processingHelper?.cancelOngoingRequests();

      // Clear both screenshot queues
      this.deps.clearQueues();

      log.info("Cleared queues.");

      // Update the view state to 'queue'
      this.deps.setView("queue");

      // Notify renderer process to switch view to 'queue'
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("reset-view");
        mainWindow.webContents.send("reset");
      }
    });

    // New shortcuts for moving the window
    globalShortcut.register("CommandOrControl+Left", () => {
      log.info("Command/Ctrl + Left pressed. Moving window left.");
      this.deps.moveWindowLeft();
    });

    globalShortcut.register("CommandOrControl+Right", () => {
      log.info("Command/Ctrl + Right pressed. Moving window right.");
      this.deps.moveWindowRight();
    });

    globalShortcut.register("CommandOrControl+Down", () => {
      log.info("Command/Ctrl + down pressed. Moving window down.");
      this.deps.moveWindowDown();
    });

    globalShortcut.register("CommandOrControl+Up", () => {
      log.info("Command/Ctrl + Up pressed. Moving window Up.");
      this.deps.moveWindowUp();
    });

    globalShortcut.register("CommandOrControl+B", () => {
      log.info("Command/Ctrl + B pressed. Toggling window visibility.");
      this.deps.toggleMainWindow();
    });

    globalShortcut.register("CommandOrControl+Q", async () => {
      log.info("Command/Ctrl + Q pressed. Initiating graceful quit.");

      // If voice is currently listening, try to stop it quickly before quit
      if (
        this.deps.voiceHelper &&
        this.deps.voiceHelper.getStatus().isListening
      ) {
        log.info("Voice is listening, attempting quick stop before quit...");
        try {
          // Give it a short time to stop cleanly
          await Promise.race([
            this.deps.voiceHelper.stopListening(),
            new Promise((resolve) => setTimeout(resolve, 1000)), // 1 second timeout
          ]);
          log.info("Voice stopped before quit");
        } catch (error) {
          log.warn("Could not stop voice cleanly before quit:", error);
        }
      }

      app.quit();
    });

    // Adjust opacity shortcuts
    globalShortcut.register("CommandOrControl+[", () => {
      log.info("Command/Ctrl + [ pressed. Decreasing opacity.");
      this.adjustOpacity(-0.1);
    });

    globalShortcut.register("CommandOrControl+]", () => {
      log.info("Command/Ctrl + ] pressed. Increasing opacity.");
      this.adjustOpacity(0.1);
    });

    // Zoom controls
    globalShortcut.register("CommandOrControl+-", () => {
      log.info("Command/Ctrl + - pressed. Zooming out.");
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel();
        mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
      }
    });

    globalShortcut.register("CommandOrControl+0", () => {
      log.info("Command/Ctrl + 0 pressed. Resetting zoom.");
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.setZoomLevel(0);
      }
    });

    globalShortcut.register("CommandOrControl+=", () => {
      log.info("Command/Ctrl + = pressed. Zooming in.");
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow) {
        const currentZoom = mainWindow.webContents.getZoomLevel();
        mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
      }
    });

    // Delete last screenshot shortcut
    globalShortcut.register("CommandOrControl+L", () => {
      log.info("Command/Ctrl + L pressed. Deleting last screenshot.");
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow) {
        // Send an event to the renderer to delete the last screenshot
        mainWindow.webContents.send("delete-last-screenshot");
      }
    });

    // Toggle voice listening shortcut
    globalShortcut.register("CommandOrControl+N", async () => {
      log.info("Command/Ctrl + N pressed. Toggling voice listening.");

      if (!this.deps.voiceHelper) {
        log.warn("Voice helper not available");
        return;
      }

      try {
        const status = this.deps.voiceHelper.getStatus();

        if (status.isListening) {
          log.info("Voice is currently listening. Stopping...");
          await this.deps.voiceHelper.stopListening();
        } else {
          if (!status.hasOpenAI) {
            log.warn(
              "Voice listening unavailable: OpenAI API key not configured"
            );
            return;
          }
          log.info("Voice is not listening. Starting...");
          await this.deps.voiceHelper.startListening();
        }
      } catch (error) {
        log.error("Error toggling voice listening:", error);
      }
    });

    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      globalShortcut.unregisterAll();
    });
  }
}
