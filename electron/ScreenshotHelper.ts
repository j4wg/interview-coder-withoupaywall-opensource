// ScreenshotHelper.ts — 截图的采集、队列管理与预览

import path from "node:path";
import fs from "node:fs";
import { app } from "electron";
import { v4 as uuidv4 } from "uuid";
import { execFile } from "child_process";
import { promisify } from "util";
import screenshot from "screenshot-desktop";
import os from "os";
import { mainT } from "./i18n/mainT";

const execFileAsync = promisify(execFile);

// 主进程翻译器：每次调用都实时解析当前界面语言
const t = mainT("main");

export class ScreenshotHelper {
  private screenshotQueue: string[] = [];
  private extraScreenshotQueue: string[] = [];
  private readonly MAX_SCREENSHOTS = 5;

  private readonly screenshotDir: string;
  private readonly extraScreenshotDir: string;
  private readonly tempDir: string;

  private view: "queue" | "solutions" | "debug" = "queue";

  constructor(view: "queue" | "solutions" | "debug" = "queue") {
    this.view = view;

    // 初始化目录
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots");
    this.extraScreenshotDir = path.join(
      app.getPath("userData"),
      "extra_screenshots"
    );
    this.tempDir = path.join(
      app.getPath("temp"),
      "interview-coder-screenshots"
    );

    // 目录不存在则创建
    this.ensureDirectoriesExist();

    // 启动时清空已有的截图目录
    this.cleanScreenshotDirectories();
  }

  private ensureDirectoriesExist(): void {
    const directories = [
      this.screenshotDir,
      this.extraScreenshotDir,
      this.tempDir,
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          console.log(t("main.shot.dirCreated", { path: dir }));
        } catch (err) {
          console.error(t("main.error.createDir", { path: dir }), err);
        }
      }
    }
  }

  // 替代原有的 loadExistingScreenshots()，保证每次启动时队列都是空的
  private cleanScreenshotDirectories(): void {
    try {
      // 清理主截图目录
      if (fs.existsSync(this.screenshotDir)) {
        const files = fs
          .readdirSync(this.screenshotDir)
          .filter((file) => file.endsWith(".png"))
          .map((file) => path.join(this.screenshotDir, file));

        // 逐个删除截图文件
        for (const file of files) {
          try {
            fs.unlinkSync(file);
            console.log(t("main.shot.deletedExisting", { path: file }));
          } catch (err) {
            console.error(t("main.error.deleteScreenshot", { path: file }), err);
          }
        }
      }

      // 清理附加截图目录
      if (fs.existsSync(this.extraScreenshotDir)) {
        const files = fs
          .readdirSync(this.extraScreenshotDir)
          .filter((file) => file.endsWith(".png"))
          .map((file) => path.join(this.extraScreenshotDir, file));

        // 逐个删除截图文件
        for (const file of files) {
          try {
            fs.unlinkSync(file);
            console.log(t("main.shot.deletedExistingExtra", { path: file }));
          } catch (err) {
            console.error(
              t("main.error.deleteExtraScreenshot", { path: file }),
              err
            );
          }
        }
      }

      console.log(t("main.shot.dirsCleaned"));
    } catch (err) {
      console.error(t("main.error.cleanDirs"), err);
    }
  }

  public getView(): "queue" | "solutions" | "debug" {
    return this.view;
  }

  public setView(view: "queue" | "solutions" | "debug"): void {
    console.log(t("main.shot.setView", { view }));
    console.log(
      t("main.shot.queuesState", {
        main: String(this.screenshotQueue),
        extra: String(this.extraScreenshotQueue)
      })
    );
    this.view = view;
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotQueue;
  }

  public getExtraScreenshotQueue(): string[] {
    console.log(
      t("main.shot.getExtraQueue", { queue: String(this.extraScreenshotQueue) })
    );
    return this.extraScreenshotQueue;
  }

  public clearQueues(): void {
    // 清空主队列
    this.screenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            t("main.error.deleteScreenshotAt", { path: screenshotPath }),
            err
          );
      });
    });
    this.screenshotQueue = [];

    // 清空附加队列
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            t("main.error.deleteExtraScreenshotAt", { path: screenshotPath }),
            err
          );
      });
    });
    this.extraScreenshotQueue = [];
  }

  private async captureScreenshot(): Promise<Buffer> {
    try {
      console.log(t("main.shot.captureStarting"));

      // Windows 上尝试多种方式
      if (process.platform === "win32") {
        return await this.captureWindowsScreenshot();
      }

      // macOS 与 Linux 直接取 buffer
      console.log(t("main.shot.captureNonWindows"));
      const buffer = await screenshot({ format: "png" });
      console.log(
        t("main.shot.captureSuccess", { bytes: String(buffer.length) })
      );
      return buffer;
    } catch (error) {
      console.error(t("main.error.capture"), error);
      throw new Error(
        t("main.error.captureFailed", { error: String(error.message) })
      );
    }
  }

  /**
   * Windows 专用截图，带多级兜底方案
   */
  private async captureWindowsScreenshot(): Promise<Buffer> {
    console.log(t("main.shot.windowsAttempt"));

    // 方式 1：先用 screenshot-desktop 写临时文件
    try {
      const tempFile = path.join(this.tempDir, `temp-${uuidv4()}.png`);
      console.log(t("main.shot.windowsTempFile", { path: tempFile }));

      await screenshot({ filename: tempFile });

      if (fs.existsSync(tempFile)) {
        const buffer = await fs.promises.readFile(tempFile);
        console.log(
          t("main.shot.windowsMethod1Success", {
            bytes: String(buffer.length)
          })
        );

        // 清理临时文件
        try {
          await fs.promises.unlink(tempFile);
        } catch (cleanupErr) {
          console.warn(t("main.error.cleanupTempFile"), cleanupErr);
        }

        return buffer;
      } else {
        console.log(t("main.shot.windowsMethod1NoFile"));
        throw new Error(t("main.error.fileNotCreated"));
      }
    } catch (error) {
      console.warn(t("main.error.windowsMethod1Failed"), error);

      // 方式 2：改用 PowerShell
      try {
        console.log(t("main.shot.windowsMethod2"));
        const tempFile = path.join(this.tempDir, `ps-temp-${uuidv4()}.png`);

        // 用 .NET 类截屏的 PowerShell 命令
        const psScript = `
        Add-Type -AssemblyName System.Windows.Forms,System.Drawing
        $screens = [System.Windows.Forms.Screen]::AllScreens
        $top = ($screens | ForEach-Object {$_.Bounds.Top} | Measure-Object -Minimum).Minimum
        $left = ($screens | ForEach-Object {$_.Bounds.Left} | Measure-Object -Minimum).Minimum
        $width = ($screens | ForEach-Object {$_.Bounds.Right} | Measure-Object -Maximum).Maximum
        $height = ($screens | ForEach-Object {$_.Bounds.Bottom} | Measure-Object -Maximum).Maximum
        $bounds = [System.Drawing.Rectangle]::FromLTRB($left, $top, $width, $height)
        $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
        $graphics = [System.Drawing.Graphics]::FromImage($bmp)
        $graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size)
        $bmp.Save('${tempFile.replace(
          /\\/g,
          "\\\\"
        )}', [System.Drawing.Imaging.ImageFormat]::Png)
        $graphics.Dispose()
        $bmp.Dispose()
        `;

        // 执行 PowerShell
        await execFileAsync("powershell", [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          psScript,
        ]);

        // 检查文件是否生成并读取
        if (fs.existsSync(tempFile)) {
          const buffer = await fs.promises.readFile(tempFile);
          console.log(
            t("main.shot.windowsMethod2Success", {
              bytes: String(buffer.length)
            })
          );

          // 清理
          try {
            await fs.promises.unlink(tempFile);
          } catch (err) {
            console.warn(t("main.error.cleanupPowerShellTemp"), err);
          }

          return buffer;
        } else {
          throw new Error(t("main.error.powerShellFileNotCreated"));
        }
      } catch (psError) {
        console.warn(t("main.error.windowsMethod2Failed"), psError);

        // 方式 3：最后的兜底，生成一张极小的占位图
        console.log(t("main.shot.windowsAllFailed"));

        // 生成 1x1 透明 PNG 作为兜底
        const fallbackBuffer = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          "base64"
        );
        console.log(t("main.shot.placeholderCreated"));

        // 把错误暴露出来，但仍返回可用 buffer，避免应用崩溃
        throw new Error(t("main.error.windowsAllFailed"));
      }
    }
  }

  public async takeScreenshot(
    hideMainWindow: () => void,
    showMainWindow: () => void
  ): Promise<string> {
    console.log(t("main.shot.takingInView", { view: this.view }));
    hideMainWindow();

    // Windows 上隐藏窗口需要更长的延时
    const hideDelay = process.platform === "win32" ? 500 : 300;
    await new Promise((resolve) => setTimeout(resolve, hideDelay));

    let screenshotPath = "";
    try {
      // 用跨平台方式拿到截图 buffer
      const screenshotBuffer = await this.captureScreenshot();

      if (!screenshotBuffer || screenshotBuffer.length === 0) {
        throw new Error(t("main.error.emptyBuffer"));
      }

      // 按当前视图保存并管理截图
      if (this.view === "queue") {
        screenshotPath = path.join(this.screenshotDir, `${uuidv4()}.png`);
        const screenshotDir = path.dirname(screenshotPath);
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true });
        }
        await fs.promises.writeFile(screenshotPath, screenshotBuffer);
        console.log(t("main.shot.addedToMainQueue", { path: screenshotPath }));
        this.screenshotQueue.push(screenshotPath);
        if (this.screenshotQueue.length > this.MAX_SCREENSHOTS) {
          const removedPath = this.screenshotQueue.shift();
          if (removedPath) {
            try {
              await fs.promises.unlink(removedPath);
              console.log(
                t("main.shot.removedFromMainQueue", { path: removedPath })
              );
            } catch (error) {
              console.error(t("main.error.removeOld"), error);
            }
          }
        }
      } else {
        // 解答视图下只进附加队列
        screenshotPath = path.join(this.extraScreenshotDir, `${uuidv4()}.png`);
        const screenshotDir = path.dirname(screenshotPath);
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true });
        }
        await fs.promises.writeFile(screenshotPath, screenshotBuffer);
        console.log(t("main.shot.addedToExtraQueue", { path: screenshotPath }));
        this.extraScreenshotQueue.push(screenshotPath);
        if (this.extraScreenshotQueue.length > this.MAX_SCREENSHOTS) {
          const removedPath = this.extraScreenshotQueue.shift();
          if (removedPath) {
            try {
              await fs.promises.unlink(removedPath);
              console.log(
                t("main.shot.removedFromExtraQueue", { path: removedPath })
              );
            } catch (error) {
              console.error(t("main.error.removeOld"), error);
            }
          }
        }
      }
    } catch (error) {
      console.error(t("main.error.capture"), error);
      throw error;
    } finally {
      // 重新显示窗口同样需要延时
      await new Promise((resolve) => setTimeout(resolve, 200));
      showMainWindow();
    }

    return screenshotPath;
  }

  public async getImagePreview(filepath: string): Promise<string> {
    try {
      if (!fs.existsSync(filepath)) {
        console.error(t("main.error.imageNotFound", { path: filepath }));
        return "";
      }

      const data = await fs.promises.readFile(filepath);
      return `data:image/png;base64,${data.toString("base64")}`;
    } catch (error) {
      console.error(t("main.error.readImage"), error);
      return "";
    }
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (fs.existsSync(path)) {
        await fs.promises.unlink(path);
      }

      if (this.view === "queue") {
        this.screenshotQueue = this.screenshotQueue.filter(
          (filePath) => filePath !== path
        );
      } else {
        this.extraScreenshotQueue = this.extraScreenshotQueue.filter(
          (filePath) => filePath !== path
        );
      }
      return { success: true };
    } catch (error) {
      console.error(t("main.error.deleteFile"), error);
      // 这里的 error.message 来自 Node fs，是第三方英文原文，保持原样
      return { success: false, error: error.message };
    }
  }

  public clearExtraScreenshotQueue(): void {
    // 清空附加队列
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      if (fs.existsSync(screenshotPath)) {
        fs.unlink(screenshotPath, (err) => {
          if (err)
            console.error(
              t("main.error.deleteExtraScreenshotAt", { path: screenshotPath }),
              err
            );
        });
      }
    });
    this.extraScreenshotQueue = [];
  }
}
